// Runner de las probes SQL de `supabase/tests/`.
//
// Uso:
//   node scripts/run-db-probes.ts                    # todas las que el tier permita
//   node scripts/run-db-probes.ts --tier=catalogo    # solo las deterministas en base vacía
//   node scripts/run-db-probes.ts --filter=fase_d    # subconjunto por nombre
//   node scripts/run-db-probes.ts --db-url=postgresql://…
//
// Por qué existe: las 17 probes se escribieron, se corrieron a mano una vez y
// nadie volvió a ejecutarlas. La autorización de este producto vive entera en la
// base de datos, así que eso significa que **nada** comprobaba la autorización
// entre el día que se escribió cada probe y hoy.
//
// Los tres problemas que resuelve, y que explican por qué no basta un `psql -f`:
//
//   1. Las probes terminan siempre en `raise exception`. El `raise` está ahí para
//      revertir la transacción —para no dejar filas de prueba—, no para señalar
//      fallo: un éxito y un fallo de seguridad salen con el mismo código de
//      error. Un step que solo corra `psql` falla el 100 % de las veces; uno que
//      ignore el error pasa el 100 % de las veces. Por eso el veredicto viaja
//      **dentro** del mensaje, con el contrato `PROBE_VERDICT`.
//
//   2. Una probe que no emite `PROBE_VERDICT` es indistinguible de una que no se
//      ejecutó. Aquí eso es FALLO, no aviso.
//
//   3. Una probe nueva que nadie registre nacería ya sin ejecutar — que es
//      exactamente cómo llegamos aquí. El manifiesto de abajo es obligatorio: un
//      `.sql` en `supabase/tests/` que no esté declarado rompe el runner.

import { spawnSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { appendFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * El contrato de veredicto. Cada probe termina en:
 *
 *   raise exception 'PROBE_VERDICT status=% fails=% | %',
 *     case when v_fail = 0 then 'PASS' else 'FAIL' end, v_fail, v_out;
 */
const VERDICT_RE = /PROBE_VERDICT\s+status=(PASS|FAIL)\s+fails=(\d+)/

/**
 * Tiers de ejecución.
 *
 * `catalogo` — solo lee `pg_catalog`, `information_schema` o `has_*_privilege`.
 *   Determinista sobre una base recién reproducida desde las migraciones, así que
 *   corre en CI hoy.
 *
 * `datos` — necesita filas de negocio. Sobre base vacía no son verdes: son
 *   **mudas**, que es peor. `p0_users_guard_probe` busca su víctima con
 *   `select … limit 1`; sin filas, `v_uid` queda null, el update no afecta a
 *   nadie, no lanza `insufficient_privilege` y la probe reporta BLOQUEADA — el
 *   mismo veredicto que si la seguridad funcionara. Quedan fuera de CI hasta que
 *   existan los fixtures deterministas.
 */
type Tier = 'catalogo' | 'datos'

const MANIFIESTO: Record<string, Tier> = {
  p1_anon_table_grants_probe: 'catalogo',
  p1_public_media_listing_probe: 'catalogo',
  p1_storage_truncate_grants_probe: 'catalogo',
  p2_fase_d_authenticated_grants_probe: 'catalogo',
  p2_platform_grants_probe: 'catalogo',

  p0_anon_surface_probe: 'datos',
  p0_azul_settlement_probe: 'datos',
  p0_email_claim_probe: 'datos',
  p0_error_ingestion_probe: 'datos',
  p0_notification_authz_probe: 'datos',
  p0_users_guard_probe: 'datos',
  p1_access_log_page_probe: 'datos',
  p1_audit_logs_probe: 'datos',
  p1_rbac_review_moderation_probe: 'datos',
  p1_rls_initplan_probe: 'datos',
  p1_tenant_job_application_counts_probe: 'datos',
  p1_workspace_dashboard_metrics_probe: 'datos',
  p2_talent_directory_search_probe: 'datos',
  p2_tenant_applications_page_probe: 'datos',
}

/** Archivos de `supabase/tests/` que no son probes y no se ejecutan sueltos. */
const NO_SON_PROBES = new Set<string>(['fixtures'])

const TESTS_DIR = resolve('supabase/tests')

/** La base local que levanta `supabase start`. */
const DB_URL_LOCAL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

interface Resultado {
  probe: string
  tier: Tier
  status: 'PASS' | 'FAIL' | 'MUDA' | 'ERROR'
  fails: number
  detalle: string
  ms: number
}

function parseArgs(argv: string[]) {
  const get = (name: string) =>
    argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3)

  const tier = get('tier')
  if (tier && tier !== 'catalogo' && tier !== 'datos' && tier !== 'todos') {
    console.error(`Tier desconocido: ${tier}. Usa catalogo, datos o todos.`)
    process.exit(2)
  }

  return {
    tier: (tier ?? 'todos') as Tier | 'todos',
    filter: get('filter'),
    dbUrl: get('db-url') ?? process.env.PROBE_DB_URL ?? DB_URL_LOCAL,
    fixtures: argv.includes('--fixtures'),
  }
}

/**
 * Carga `fixtures.sql` y lo deja **commiteado**, al revés que las probes.
 *
 * Escribe de verdad, así que solo tiene sentido sobre una base desechable: la
 * que levanta `supabase start` o la que CI reproduce desde las migraciones.
 * Nunca contra el remoto — de ahí que sea una bandera explícita y no el
 * comportamiento por omisión.
 */
function cargarFixtures(dbUrl: string) {
  const proceso = spawnSync(
    'psql',
    [dbUrl, '--no-psqlrc', '--quiet', '-v', 'ON_ERROR_STOP=1', '--file', `${TESTS_DIR}/fixtures.sql`],
    { encoding: 'utf8' }
  )

  if (proceso.status !== 0) {
    console.error('\n⛔ No se pudieron cargar los fixtures:\n')
    console.error(`${proceso.stdout ?? ''}${proceso.stderr ?? ''}`)
    process.exit(1)
  }

  console.log('  Fixtures cargados (supabase/tests/fixtures.sql)')
}

/**
 * Comprueba que el directorio y el manifiesto dicen lo mismo, en los dos
 * sentidos. Es la guardia contra la probe huérfana: sin ella, el siguiente
 * archivo que alguien añada nace fuera de CI sin que nada lo note.
 */
function verificarManifiesto(): string[] {
  const enDisco = readdirSync(TESTS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .map((f) => f.replace(/\.sql$/, ''))
    .filter((f) => !NO_SON_PROBES.has(f))

  const problemas: string[] = []

  for (const probe of enDisco) {
    if (!(probe in MANIFIESTO)) {
      problemas.push(
        `\`${probe}.sql\` existe en supabase/tests/ pero no está en el manifiesto de ` +
          `scripts/run-db-probes.ts. Declárala como 'catalogo' o 'datos' — una probe ` +
          `sin declarar no se ejecuta nunca, que es el problema que este runner arregla.`
      )
    }
  }

  for (const probe of Object.keys(MANIFIESTO)) {
    if (!enDisco.includes(probe)) {
      problemas.push(
        `El manifiesto declara \`${probe}\` pero el archivo no existe. Bórralo del ` +
          `manifiesto o recupera la probe.`
      )
    }
  }

  return problemas
}

/**
 * Ejecuta una probe y extrae su veredicto.
 *
 * `--single-transaction` es lo que garantiza que nada quede escrito: el
 * `raise exception` final aborta y todo se revierte, incluidas las filas
 * sintéticas que algunas probes insertan para tener algo que medir.
 *
 * El código de salida de psql no decide nada: el `raise` de la probe es un error
 * de SQL, así que psql sale 0 igual que si no hubiera pasado nada. Y el mensaje
 * viaja por **stderr**, no por stdout — de ahí `spawnSync` en vez de
 * `execFileSync`, que solo devuelve stdout y dejaría todas las probes mudas.
 */
function ejecutar(probe: string, dbUrl: string): Omit<Resultado, 'tier'> {
  const inicio = Date.now()

  const proceso = spawnSync(
    'psql',
    [dbUrl, '--single-transaction', '--no-psqlrc', '--quiet', '--file', `${TESTS_DIR}/${probe}.sql`],
    { encoding: 'utf8' }
  )

  if (proceso.error && (proceso.error as NodeJS.ErrnoException).code === 'ENOENT') {
    console.error('\n⛔ No se encontró `psql`. Instálalo (brew install libpq) o apunta a otro cliente.\n')
    process.exit(2)
  }

  const salida = `${proceso.stdout ?? ''}\n${proceso.stderr ?? ''}`

  // No poder conectar no es "la probe falló": es que no se ejecutó nada. Sin esta
  // distinción, una base caída se lee en el log como diecisiete fallos de
  // seguridad y el diagnóstico empieza por el sitio equivocado.
  if (/could not connect|Connection refused|no such host|password authentication failed/i.test(salida)) {
    console.error(`\n⛔ No hay conexión con la base (${dbUrl.replace(/:[^:@/]+@/, ':***@')}).\n`)
    console.error(`   ${primeraLineaUtil(salida)}\n`)
    console.error('   Local: `supabase start`. Remoto: pasa --db-url o PROBE_DB_URL.\n')
    process.exit(2)
  }

  const ms = Date.now() - inicio
  const match = VERDICT_RE.exec(salida)

  if (!match) {
    // Probe muda. Puede ser que no se haya migrado al contrato, o que haya
    // reventado antes de llegar al `raise` final — un error de sintaxis, una
    // tabla que ya no existe. Los dos casos son fallo: en ninguno se comprobó
    // lo que la probe dice comprobar.
    return {
      probe,
      status: 'MUDA',
      fails: 0,
      detalle: primeraLineaUtil(salida),
      ms,
    }
  }

  return {
    probe,
    status: match[1] as 'PASS' | 'FAIL',
    fails: Number(match[2]),
    detalle: salida.slice(match.index).trim(),
    ms,
  }
}

function primeraLineaUtil(salida: string): string {
  const linea = salida
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.length > 0 && !l.startsWith('psql:'))
  return linea ?? salida.trim().split('\n')[0] ?? '(sin salida)'
}

function main() {
  const { tier, filter, dbUrl, fixtures } = parseArgs(process.argv.slice(2))

  const problemas = verificarManifiesto()
  if (problemas.length > 0) {
    console.error('\n⛔ El manifiesto de probes no coincide con supabase/tests/:\n')
    for (const p of problemas) console.error(`  · ${p}\n`)
    process.exit(1)
  }

  const seleccionadas = Object.entries(MANIFIESTO)
    .filter(([, t]) => tier === 'todos' || t === tier)
    .filter(([nombre]) => !filter || nombre.includes(filter))
    .map(([nombre, t]) => ({ nombre, tier: t }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre))

  if (seleccionadas.length === 0) {
    console.error(`\n⛔ Ninguna probe coincide con tier=${tier}${filter ? ` filter=${filter}` : ''}.\n`)
    process.exit(1)
  }

  const omitidas = Object.keys(MANIFIESTO).length - seleccionadas.length

  console.log(`\n  PROBES DE BASE DE DATOS · ${seleccionadas.length} a ejecutar${omitidas > 0 ? ` · ${omitidas} fuera de selección` : ''}`)
  console.log('  ' + '─'.repeat(76))

  if (fixtures) cargarFixtures(dbUrl)

  const resultados: Resultado[] = []
  for (const { nombre, tier: t } of seleccionadas) {
    const r = ejecutar(nombre, dbUrl)
    resultados.push({ ...r, tier: t })

    const icono = r.status === 'PASS' ? '✅' : r.status === 'MUDA' ? '🔇' : '❌'
    const sufijo =
      r.status === 'PASS' ? '' : r.status === 'MUDA' ? ' — no emitió PROBE_VERDICT' : ` — ${r.fails} aserto(s) en rojo`
    console.log(`  ${icono} ${nombre.padEnd(44)} ${String(r.ms).padStart(5)} ms${sufijo}`)
  }

  const rotas = resultados.filter((r) => r.status !== 'PASS')

  if (rotas.length > 0) {
    console.error('\n  Detalle de las que no pasaron:\n')
    for (const r of rotas) {
      console.error(`  ── ${r.probe} [${r.status}]`)
      console.error(
        r.detalle
          .split('\n')
          .map((l) => `     ${l}`)
          .join('\n')
      )
      console.error('')
    }
  }

  escribirResumenCI(resultados)

  if (rotas.length > 0) {
    console.error(`\n⛔ ${rotas.length} de ${resultados.length} probes no pasaron.\n`)
    process.exit(1)
  }

  console.log(`\n✅ ${resultados.length} probes en verde.\n`)
}

/** El summary del job: sin esto, saber qué se ejecutó exige abrir los logs. */
function escribirResumenCI(resultados: Resultado[]) {
  const destino = process.env.GITHUB_STEP_SUMMARY
  if (!destino) return

  const filas = resultados
    .map((r) => `| \`${r.probe}\` | ${r.tier} | ${r.status} | ${r.fails} | ${r.ms} ms |`)
    .join('\n')

  appendFileSync(
    destino,
    `\n### Probes de base de datos\n\n` +
      `| Probe | Tier | Veredicto | Asertos en rojo | Tiempo |\n|---|---|---|---|---|\n${filas}\n`
  )
}

main()
