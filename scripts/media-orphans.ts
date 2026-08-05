// Inventario y limpieza de media huérfana — CLI server-side (TASK-271).
//
// Uso (Node >= 22; corre TypeScript de forma nativa):
//   node scripts/media-orphans.ts                      # inventario dry-run (por defecto)
//   node scripts/media-orphans.ts --grace-days=14      # ventana de gracia más amplia
//   node scripts/media-orphans.ts --bucket=avatars     # acota a un bucket
//   node scripts/media-orphans.ts --apply --yes        # borra los huérfanos confirmados
//
// Por qué existe:
//   Cada subida de avatar o logo usa un UUID nuevo, así que reemplazar la imagen
//   solo movía la referencia y dejaba el objeto anterior —y su miniatura— en el
//   bucket. El ciclo de vida ya está corregido en la app; este barredor recoge
//   lo que quedó de antes y sirve de red para cualquier borrado que falle.
//
// Seguridad:
//   - Usa SUPABASE_SERVICE_ROLE_KEY SOLO en este proceso de servidor.
//   - Es dry-run salvo que se pasen `--apply` y `--yes` a la vez.
//   - Ventana de gracia: nunca toca objetos recientes, porque una subida en vuelo
//     todavía no tiene su referencia escrita en base y parecería huérfana.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Convención de miniatura, copiada de `src/lib/uploads/media.ts`.
 *
 * No se importa porque ese módulo usa `canvas`/`document` y este script corre
 * bajo `tsconfig.node.json`, que no carga los tipos del DOM. La copia está
 * vigilada por `tests/unit/media-orphans-thumbnail-convention.test.ts`, que
 * falla si las dos definiciones divergen. Si esto se rompe, el barredor
 * dejaría de reconocer las miniaturas vivas y las borraría.
 */
const THUMBNAIL_MAX_DIMENSION = 128

function deriveThumbnailPath(path: string): string {
  return `${path.replace(/\.[^/.]+$/, '')}-${THUMBNAIL_MAX_DIMENSION}.webp`
}

/**
 * Toda columna que guarda una ruta de storage, con su bucket.
 *
 * Se obtuvo consultando el remoto por columnas de texto cuyo nombre sugiere una
 * ruta y descartando las que no lo son (`*_filename`, `identity_document_number`).
 * **Omitir una columna aquí hace que el barredor borre archivos vivos**, así que
 * cualquier columna nueva de tipo ruta debe añadirse en el mismo cambio.
 */
const REFERENCE_SOURCES: Array<{ bucket: string; table: string; column: string }> = [
  { bucket: 'avatars', table: 'users', column: 'avatar_path' },
  { bucket: 'company-assets', table: 'company_profiles', column: 'logo_path' },
  { bucket: 'company-assets', table: 'company_profiles', column: 'cover_image_path' },
  { bucket: 'candidate-resumes', table: 'candidate_resumes', column: 'storage_path' },
  { bucket: 'membership-receipts', table: 'membership_payments', column: 'receipt_path' },
  { bucket: 'verification-documents', table: 'recruiter_requests', column: 'company_logo_path' },
  { bucket: 'verification-documents', table: 'recruiter_requests', column: 'verification_document_path' },
  {
    bucket: 'verification-documents',
    table: 'pastor_authority_requests',
    column: 'identity_document_file_path'
  },
  {
    bucket: 'verification-documents',
    table: 'regional_administrator_authority_requests',
    column: 'identity_document_file_path'
  },
  {
    bucket: 'verification-documents',
    table: 'regional_administrator_authority_requests',
    column: 'appointment_document_file_path'
  }
]

const MANAGED_BUCKETS = [...new Set(REFERENCE_SOURCES.map((source) => source.bucket))]

const DEFAULT_GRACE_DAYS = 7
const LIST_PAGE_SIZE = 100

type Args = Record<string, string | boolean>

interface StorageObject {
  bucket: string
  name: string
  createdAt: string | null
  sizeBytes: number
}

function parseArgs(argv: string[]): Args {
  const out: Args = {}
  for (const token of argv) {
    if (!token.startsWith('--')) continue
    const [key, value] = token.slice(2).split('=')
    out[key] = value === undefined ? true : value
  }
  return out
}

// Lee variables de un archivo .env sin dependencias externas.
function loadEnvFile(path: string): Record<string, string> {
  const env: Record<string, string> = {}
  try {
    const content = readFileSync(path, 'utf8')
    for (const rawLine of content.split('\n')) {
      const line = rawLine.trim()
      if (!line || line.startsWith('#')) continue
      const eq = line.indexOf('=')
      if (eq === -1) continue
      const key = line.slice(0, eq).trim()
      let value = line.slice(eq + 1).trim()
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      env[key] = value
    }
  } catch {
    // archivo ausente: se ignora
  }
  return env
}

function num(value: string | boolean | undefined, fallback: number): number {
  if (typeof value !== 'string') return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

/**
 * Conjunto de rutas vivas: las referenciadas en base **más** la miniatura que le
 * corresponde a cada una.
 *
 * Se calcula en esa dirección a propósito. Al revés —deducir el original desde
 * `…-128.webp`— la extensión ya se perdió y habría que adivinarla; así la
 * pertenencia es exacta.
 */
async function collectReferencedPaths(
  client: SupabaseClient,
  buckets: string[]
): Promise<Map<string, Set<string>>> {
  const referenced = new Map<string, Set<string>>()
  for (const bucket of buckets) {
    referenced.set(bucket, new Set<string>())
  }

  for (const source of REFERENCE_SOURCES) {
    if (!referenced.has(source.bucket)) continue

    const response = await client.from(source.table).select(source.column).not(source.column, 'is', null)

    if (response.error) {
      throw new Error(
        `No se pudo leer ${source.table}.${source.column}: ${response.error.message}. ` +
          'Se aborta: un inventario incompleto borraría archivos vivos.'
      )
    }

    const target = referenced.get(source.bucket)!
    // `select()` recibe el nombre de columna en runtime, así que el tipo inferido
    // no puede ser más específico que `unknown`.
    const rows = (response.data ?? []) as unknown as Array<Record<string, unknown>>
    for (const row of rows) {
      const value = row[source.column]
      if (typeof value !== 'string' || value.length === 0) continue
      const normalized = value.replace(/^\/+/, '')
      target.add(normalized)
      target.add(deriveThumbnailPath(normalized))
    }
  }

  return referenced
}

/** Recorre un bucket entero: la API de storage lista por carpeta, no recursivo. */
async function listBucketObjects(client: SupabaseClient, bucket: string): Promise<StorageObject[]> {
  const objects: StorageObject[] = []
  const pendingPrefixes: string[] = ['']

  while (pendingPrefixes.length > 0) {
    const prefix = pendingPrefixes.pop()!
    let offset = 0

    for (;;) {
      const response = await client.storage.from(bucket).list(prefix, {
        limit: LIST_PAGE_SIZE,
        offset,
        sortBy: { column: 'name', order: 'asc' }
      })

      if (response.error) {
        throw new Error(`No se pudo listar ${bucket}/${prefix}: ${response.error.message}`)
      }

      const entries = response.data ?? []
      for (const entry of entries) {
        const fullPath = prefix ? `${prefix}/${entry.name}` : entry.name
        // Una carpeta viene sin `id`; un archivo siempre lo trae.
        if (entry.id === null || entry.id === undefined) {
          pendingPrefixes.push(fullPath)
          continue
        }

        objects.push({
          bucket,
          name: fullPath,
          createdAt: entry.created_at ?? null,
          sizeBytes: Number((entry.metadata as Record<string, unknown> | null)?.size ?? 0)
        })
      }

      if (entries.length < LIST_PAGE_SIZE) break
      offset += LIST_PAGE_SIZE
    }
  }

  return objects
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  const root = resolve(process.cwd())
  const env = { ...loadEnvFile(resolve(root, '.env.local')), ...process.env }

  const supabaseUrl = env.VITE_SUPABASE_URL ?? env.SUPABASE_URL ?? ''
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  if (!supabaseUrl || !serviceKey) {
    console.error('Falta VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY (revisa .env.local).')
    process.exit(1)
  }

  const graceDays = num(args['grace-days'], DEFAULT_GRACE_DAYS)
  const apply = args.apply === true || args.apply === 'true'
  const confirmed = args.yes === true || args.yes === 'true'
  const bucketFilter = typeof args.bucket === 'string' ? args.bucket : null

  const buckets = bucketFilter ? MANAGED_BUCKETS.filter((bucket) => bucket === bucketFilter) : MANAGED_BUCKETS
  if (buckets.length === 0) {
    console.error(`Bucket desconocido: ${bucketFilter}. Conocidos: ${MANAGED_BUCKETS.join(', ')}`)
    process.exit(1)
  }

  if (apply && !confirmed) {
    console.error('`--apply` borra objetos de forma irreversible. Añade `--yes` para confirmar.')
    process.exit(2)
  }

  const client = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  })

  const projectRef = supabaseUrl.replace(/^https?:\/\//, '').split('.')[0]
  const mode = apply ? 'APLICAR (borra)' : 'DRY-RUN (no borra)'
  console.log(`\nDestino: ${projectRef}  ·  modo: ${mode}  ·  gracia: ${graceDays} día(s)`)
  console.log(`Buckets: ${buckets.join(', ')}\n`)

  const referenced = await collectReferencedPaths(client, buckets)
  const graceCutoff = Date.now() - graceDays * 24 * 60 * 60 * 1000

  let totalObjects = 0
  let totalOrphans = 0
  let totalOrphanBytes = 0
  let totalProtected = 0
  let totalDeleted = 0
  let totalFailed = 0

  for (const bucket of buckets) {
    const objects = await listBucketObjects(client, bucket)
    const live = referenced.get(bucket)!

    const orphans: StorageObject[] = []
    let protectedByGrace = 0

    for (const object of objects) {
      if (live.has(object.name)) continue

      const createdAtMs = object.createdAt ? Date.parse(object.createdAt) : Number.NaN
      // Sin fecha legible se protege: preferimos dejar basura antes que borrar algo vivo.
      if (!Number.isFinite(createdAtMs) || createdAtMs > graceCutoff) {
        protectedByGrace += 1
        continue
      }

      orphans.push(object)
    }

    totalObjects += objects.length
    totalOrphans += orphans.length
    totalProtected += protectedByGrace
    totalOrphanBytes += orphans.reduce((sum, object) => sum + object.sizeBytes, 0)

    const referencedCount = objects.length - orphans.length - protectedByGrace
    console.log(
      `${bucket}: ${objects.length} objeto(s) · ${referencedCount} referenciado(s) · ` +
        `${protectedByGrace} en gracia · ${orphans.length} huérfano(s)`
    )

    for (const orphan of orphans) {
      console.log(`   - ${orphan.name}  (${formatBytes(orphan.sizeBytes)}, ${orphan.createdAt ?? 'sin fecha'})`)
    }

    if (apply && orphans.length > 0) {
      // `remove` acepta lotes; se trocea para no exceder el límite del endpoint.
      for (let index = 0; index < orphans.length; index += LIST_PAGE_SIZE) {
        const batch = orphans.slice(index, index + LIST_PAGE_SIZE)
        const response = await client.storage.from(bucket).remove(batch.map((object) => object.name))

        if (response.error) {
          console.error(`   ⚠️  fallo al borrar un lote de ${bucket}: ${response.error.message}`)
          totalFailed += batch.length
          continue
        }

        totalDeleted += response.data?.length ?? batch.length
      }
      console.log(`   → borrados en ${bucket}: ${totalDeleted}`)
    }

    console.log('')
  }

  const line = '─'.repeat(72)
  console.log(line)
  console.log(
    `  objetos: ${totalObjects}  ·  huérfanos: ${totalOrphans} (${formatBytes(totalOrphanBytes)})  ` +
      `·  protegidos por gracia: ${totalProtected}`
  )
  if (apply) {
    console.log(`  borrados: ${totalDeleted}  ·  fallidos: ${totalFailed}`)
  } else if (totalOrphans > 0) {
    console.log('  Nada se borró. Revisa la lista y vuelve a correr con `--apply --yes`.')
  }
  console.log(`${line}\n`)

  if (totalFailed > 0) {
    process.exit(1)
  }
}

main().catch((error: unknown) => {
  console.error('\nBarredor de media abortado:', error instanceof Error ? error.message : error)
  process.exit(1)
})
