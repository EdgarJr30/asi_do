// Guardia estática: toda RPC que el cliente invoca debe existir y tener su
// `grant execute … to authenticated` vigente en las migraciones.
//
// Uso:
//   node scripts/check-rpc-grants.ts            # falla si alguna RPC no cumple
//   node scripts/check-rpc-grants.ts --list     # además imprime las 51 con su estado
//
// Por qué existe: se revocó el default privilege de funciones de Supabase, así que
// una RPC sin su grant explícito **falla en tiempo de ejecución** con "permission
// denied". El 2026-08-09 se verificaron las 51 a mano y las 51 estaban bien; el
// problema es que aguantaban solo por disciplina, y la disciplina no sobrevive a un
// día con prisa. Esto lo convierte en algo que no depende de que alguien se acuerde.
//
// Qué comprueba, y qué no:
//
//   ✔ La función se crea en alguna migración.
//   ✔ El último evento de privilegio que la menciona junto al rol `authenticated`
//     es un GRANT, no un REVOKE. Se ordena por nombre de archivo y, dentro de un
//     archivo, por posición: es el mismo orden en que Postgres las aplicaría.
//   ✘ No comprueba el **remoto**. `CLAUDE.md` documenta que hay objetos en el
//     Supabase desplegado que no están en `migrations/`, así que esto hereda la
//     debilidad de R2: afirma algo sobre archivos. Aun así atrapa el caso
//     frecuente y barato — RPC nueva sin grant — que es el que se cuela.
//   ✘ No distingue sobrecargas. Se indexa por nombre, no por firma: si un nombre
//     tiene dos versiones y solo una lleva grant, esto pasa. PostgREST resuelve
//     por argumentos, así que la comprobación fina exige ejecutarla — eso es R9.2.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const SRC_DIR = join(ROOT, 'src')
const MIGRATIONS_DIR = join(ROOT, 'supabase', 'migrations')

/** El rol que usa el cliente autenticado de la SPA. */
const CLIENT_ROLE = 'authenticated'

// ── Lado cliente: qué RPC se invocan ─────────────────────────────────────────

/** `supabase.rpc('nombre'…)`, tolerando espacios y el `as never` de algunas llamadas. */
const RPC_CALL_RE = /\.rpc\(\s*['"]([a-z_][a-z0-9_]*)['"]/g

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      walk(full, out)
    } else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      out.push(full)
    }
  }
  return out
}

function collectCallSites(): Map<string, string[]> {
  const sites = new Map<string, string[]>()

  for (const file of walk(SRC_DIR)) {
    const source = readFileSync(file, 'utf8')
    for (const match of source.matchAll(RPC_CALL_RE)) {
      const name = match[1]
      const files = sites.get(name) ?? []
      files.push(relative(ROOT, file))
      sites.set(name, files)
    }
  }

  return sites
}

// ── Lado migraciones: qué se crea y qué privilegios se mueven ────────────────

type Action = 'grant' | 'revoke'

interface PrivilegeEvent {
  name: string
  action: Action
  roles: string[]
  file: string
  offset: number
  /** Qué parser lo encontró. Se usa para el suelo anti-falso-verde. */
  source: 'estatico' | 'bucle'
}

/**
 * Quita las líneas que son **solo** comentario. No se toca el resto de la línea:
 * un `--` a media línea puede vivir dentro de una cadena y cortarla haría más daño
 * que el falso positivo que evita.
 */
function stripFullLineComments(sql: string): string {
  return sql
    .split('\n')
    .map((line) => (line.trimStart().startsWith('--') ? '' : line))
    .join('\n')
}

/** Nombres de función de una lista de firmas, ignorando lo que hay entre paréntesis. */
function functionNamesIn(signatures: string): string[] {
  const names: string[] = []
  let depth = 0
  let token = ''

  for (const char of signatures) {
    if (char === '(') {
      if (depth === 0) {
        const name = token.trim().split('.').pop()?.trim()
        if (name && /^[a-z_][a-z0-9_]*$/.test(name)) {
          names.push(name)
        }
        token = ''
      }
      depth += 1
    } else if (char === ')') {
      depth -= 1
    } else if (depth === 0) {
      token = char === ',' ? '' : token + char
    }
  }

  return names
}

/** Los roles van siempre al final de la sentencia; anclarlo evita confundirlos
 *  con un parámetro llamado `p_to`. */
function splitSignaturesAndRoles(body: string): { signatures: string; roles: string[] } | null {
  const match = body.trim().match(/\s(?:to|from)\s+([a-z_][a-z_,\s]*)$/i)
  if (!match) {
    return null
  }
  return {
    signatures: body.trim().slice(0, match.index),
    roles: match[1].split(',').map((role) => role.trim().toLowerCase()).filter(Boolean)
  }
}

/** `grant|revoke … on function <firmas> to|from <roles>;` */
const STATIC_PRIVILEGE_RE = /\b(grant|revoke)\s+(?:all|execute)(?:\s+privileges)?\s+on\s+function\s+([^;]+);/gi

/**
 * El bloque dinámico de `20260807042236`: una lista de firmas y, dentro del loop,
 * un `execute format('grant execute on function %s to …')`. Sin esto, 60 funciones
 * quedarían como "sin grant" y la guardia sería inútil el día uno.
 */
const LOOP_RE = /foreach\s+\w+\s+in\s+array\s+array\[([\s\S]*?)\]\s*loop([\s\S]*?)end\s+loop/gi
const LOOP_PRIVILEGE_RE = /\b(grant|revoke)\s+(?:all|execute)\s+on\s+function\s+%s\s+(?:to|from)\s+([a-z_,\s]+?)'/gi

function parseMigrations(): { created: Map<string, string>; events: PrivilegeEvent[] } {
  const created = new Map<string, string>()
  const events: PrivilegeEvent[] = []

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort()

  for (const file of files) {
    const sql = stripFullLineComments(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'))

    for (const match of sql.matchAll(/\bcreate\s+(?:or\s+replace\s+)?function\s+(?:public\.)?([a-z_][a-z0-9_]*)\s*\(/gi)) {
      if (!created.has(match[1])) {
        created.set(match[1], file)
      }
    }

    for (const match of sql.matchAll(STATIC_PRIVILEGE_RE)) {
      const parsed = splitSignaturesAndRoles(match[2])
      if (!parsed) {
        continue
      }
      for (const name of functionNamesIn(parsed.signatures)) {
        events.push({
          name,
          action: match[1].toLowerCase() as Action,
          roles: parsed.roles,
          file,
          offset: match.index,
          source: 'estatico'
        })
      }
    }

    for (const loop of sql.matchAll(LOOP_RE)) {
      const signatures = [...loop[1].matchAll(/'([^']+)'/g)].flatMap((sig) => functionNamesIn(sig[1]))

      for (const statement of loop[2].matchAll(LOOP_PRIVILEGE_RE)) {
        const roles = statement[2].split(',').map((role) => role.trim().toLowerCase()).filter(Boolean)
        for (const name of signatures) {
          events.push({
            name,
            action: statement[1].toLowerCase() as Action,
            roles,
            file,
            offset: loop.index + statement.index,
            source: 'bucle'
          })
        }
      }
    }
  }

  events.sort((a, b) => (a.file === b.file ? a.offset - b.offset : a.file < b.file ? -1 : 1))
  return { created, events }
}

// ── Veredicto ────────────────────────────────────────────────────────────────

interface Verdict {
  name: string
  callers: string[]
  createdIn: string | undefined
  grantedIn: string | undefined
  revokedIn: string | undefined
}

function lastEventFor(events: PrivilegeEvent[], name: string): PrivilegeEvent | undefined {
  // `revoke … from public` no toca un grant directo a `authenticated`: en Postgres
  // PUBLIC es otro concesionario. Por eso solo cuentan los eventos que nombran al rol.
  const relevant = events.filter((event) => event.name === name && event.roles.includes(CLIENT_ROLE))
  return relevant.at(-1)
}

/**
 * El peor final posible para esta guardia es el mismo que tenían las probes de R1:
 * seguir en verde sin comprobar nada. Si los extractores dejan de encontrar sus
 * patrones —un cambio de formato, un `.rpc()` envuelto en un helper— el resultado
 * sería "0 de 0 problemas", indistinguible de "todo bien".
 *
 * No basta con exigir que el total sea > 0. Hoy **las 51 reciben su grant vigente
 * del bloque dinámico** de `20260807042236`, así que romper el parser estático dejaba
 * la guardia en verde — comprobado inyectándolo. Y el parser estático es justo el que
 * tiene que sostener el futuro: las migraciones nuevas escriben `grant execute … to
 * authenticated` a mano. Por eso cada parser lleva su propio suelo.
 */
function assertParsersFoundSomething(callSites: Map<string, string[]>, events: PrivilegeEvent[]): void {
  if (callSites.size === 0) {
    console.error(
      '✖ No se encontró ninguna llamada `.rpc()` en src/. El extractor está roto o las llamadas\n' +
        '  cambiaron de forma: revisa RPC_CALL_RE antes de dar esto por bueno.'
    )
    process.exit(1)
  }

  for (const source of ['estatico', 'bucle'] as const) {
    if (events.some((event) => event.source === source)) {
      continue
    }
    console.error(
      `✖ El parser de grants "${source}" no encontró ni una sentencia en supabase/migrations/.\n` +
        '  Si el formato de las migraciones cambió, arregla el patrón; si no, esta guardia está\n' +
        '  comprobando menos de lo que dice. Revisa STATIC_PRIVILEGE_RE / LOOP_PRIVILEGE_RE.'
    )
    process.exit(1)
  }
}

function main(): void {
  const callSites = collectCallSites()
  const { created, events } = parseMigrations()

  assertParsersFoundSomething(callSites, events)

  const verdicts: Verdict[] = [...callSites.keys()].sort().map((name) => {
    const last = lastEventFor(events, name)
    return {
      name,
      callers: callSites.get(name) ?? [],
      createdIn: created.get(name),
      grantedIn: last?.action === 'grant' ? last.file : undefined,
      revokedIn: last?.action === 'revoke' ? last.file : undefined
    }
  })

  const missing = verdicts.filter((verdict) => !verdict.createdIn || !verdict.grantedIn)

  if (process.argv.includes('--list')) {
    for (const verdict of verdicts) {
      const state = !verdict.createdIn
        ? 'NO EXISTE'
        : verdict.grantedIn
          ? `ok · ${verdict.grantedIn}`
          : verdict.revokedIn
            ? `REVOCADA en ${verdict.revokedIn}`
            : 'SIN GRANT'
      console.log(`${verdict.name.padEnd(42)} ${state}`)
    }
    console.log('')
  }

  if (missing.length === 0) {
    console.log(
      `✔ ${verdicts.length} RPC invocadas desde src/: todas existen y conservan su grant execute a ${CLIENT_ROLE}.`
    )
    return
  }

  console.error(`\n✖ ${missing.length} de ${verdicts.length} RPC invocadas desde src/ no cumplen el contrato:\n`)

  for (const verdict of missing) {
    const problem = !verdict.createdIn
      ? 'no se crea en ninguna migración'
      : verdict.revokedIn
        ? `su último evento de privilegio es un revoke (${verdict.revokedIn})`
        : `no tiene grant execute … to ${CLIENT_ROLE}`

    console.error(`  · ${verdict.name}: ${problem}`)
    console.error(`      la invoca: ${[...new Set(verdict.callers)].join(', ')}`)
  }

  console.error(
    '\nSe revocó el default privilege de funciones de Supabase: sin el grant explícito la RPC\n' +
      'falla con "permission denied" en cuanto un usuario la llama. Añade el grant en la misma\n' +
      'migración que crea la función — nunca editando una migración ya aplicada.\n'
  )
  process.exit(1)
}

main()
