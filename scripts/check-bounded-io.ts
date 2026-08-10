// Guardia estática: ninguna Edge Function puede esperar indefinidamente a un
// servicio remoto.
//
// Uso:
//   node scripts/check-bounded-io.ts          # falla si alguna frontera no tiene tope
//   node scripts/check-bounded-io.ts --list   # además imprime cada frontera con su estado
//
// Por qué existe: el 2026-08-10, entre las 12:06 y las 14:14 UTC, PostgreSQL dejó
// de aceptar conexiones. Las funciones que hablaban con la base sin presupuesto de
// tiempo se quedaron colgadas hasta que Cloudflare cortaba a los ~90-150 s, y cada
// reintento del proveedor abría otra espera igual. Una caída se convirtió así en
// una caída *más* una tormenta de peticiones contra la base ya caída.
//
// La lección no es «el pipeline de correos»: es que una llamada remota sin tope
// convierte cualquier degradación ajena en carga propia. Esto lo comprueba por
// archivo, no por disciplina.
//
// Qué comprueba, y qué no:
//
//   ✔ Todo `createClient(...)` de una Edge Function pasa un `fetch` con timeout.
//   ✔ Toda llamada a `fetch(...)` de una Edge Function sale por un envoltorio con
//     timeout, o se le inyecta uno declarado en el mismo archivo.
//   ✔ Los SDK que hablan por red sin usar `fetch` (web-push) van envueltos.
//   ✘ No comprueba el remoto: afirma algo sobre archivos, como `check-rpc-grants`.
//   ✘ No comprueba topes de *tamaño* (lotes, destinatarios, profundidad de cola).
//     Esos viven en PostgreSQL, donde no se pueden saltar desde el cliente, y los
//     cubre `tests/integration/email-pipeline-safety-contract.test.ts`.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const FUNCTIONS_DIR = join(ROOT, 'supabase', 'functions')

/** Envoltorios que sí imponen un presupuesto de tiempo. */
const TIMEOUT_WRAPPERS = ['fetchWithTimeout', 'withTimeout']

/**
 * Fronteras de red que no pasan por `fetch`, así que el envoltorio no las cubre
 * automáticamente. Se declaran a mano porque son pocas y añadir una es un acto
 * deliberado que merece pensar en su tope.
 */
const NON_FETCH_NETWORK_CALLS = ['webpush.sendNotification']

interface Finding {
  file: string
  line: number
  boundary: string
  detail: string
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    // `node_modules` aparece dentro de las funciones cuando se corre `deno test`
    // o `deno cache`; son dependencias, no código nuestro.
    if (entry === 'node_modules') continue

    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      walk(full, out)
    } else if (/\.ts$/.test(entry) && !/\.test\.ts$/.test(entry)) {
      out.push(full)
    }
  }
  return out
}

/** `fetch(` que es una llamada de verdad, no `foo.fetch(`, `fetch:` ni una definición. */
const FETCH_CALL_RE = /(^|[^\w.$])fetch\s*\(/
const CREATE_CLIENT_RE = /createClient\s*\(/

/**
 * Recorta el fragmento que va desde una posición hasta el cierre de su llamada,
 * para poder preguntar si el envoltorio aparece *dentro* de esos argumentos y no
 * en cualquier otro punto del archivo.
 */
function sliceCall(source: string, startIndex: number): string {
  const open = source.indexOf('(', startIndex)
  if (open === -1) return ''

  let depth = 0
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '(') depth += 1
    else if (source[i] === ')') {
      depth -= 1
      if (depth === 0) return source.slice(open, i + 1)
    }
  }
  return source.slice(open)
}

function lineOf(source: string, index: number): number {
  return source.slice(0, index).split('\n').length
}

function hasWrapper(fragment: string): boolean {
  return TIMEOUT_WRAPPERS.some((wrapper) => fragment.includes(wrapper))
}

function inspect(file: string, findings: Finding[], checked: string[]): void {
  const source = readFileSync(file, 'utf8')
  const shown = relative(ROOT, file)

  // ── Clientes de Supabase ───────────────────────────────────────────────────
  for (const match of source.matchAll(new RegExp(CREATE_CLIENT_RE, 'g'))) {
    const index = match.index ?? 0
    const call = sliceCall(source, index)
    const line = lineOf(source, index)
    const ok = hasWrapper(call)

    checked.push(`${ok ? 'ok  ' : 'FALLA'} ${shown}:${line} createClient`)
    if (!ok) {
      findings.push({
        file: shown,
        line,
        boundary: 'createClient',
        detail:
          'abre un cliente de Supabase sin `global.fetch: fetchWithTimeout(fetch, …)`; ' +
          'si PostgREST deja de responder, la función espera hasta que la corte el borde'
      })
    }
  }

  // ── Llamadas directas a fetch ──────────────────────────────────────────────
  for (const match of source.matchAll(new RegExp(FETCH_CALL_RE, 'g'))) {
    const index = (match.index ?? 0) + match[1].length
    const line = lineOf(source, index)

    // `fetchWithTimeout(fetch, …)` inyecta el `fetch` desnudo en el envoltorio:
    // esa aparición está acotada por construcción.
    const contextStart = Math.max(0, index - 40)
    if (hasWrapper(source.slice(contextStart, index))) continue

    const ok = hasWrapper(source.slice(Math.max(0, index - 200), index))
    checked.push(`${ok ? 'ok  ' : 'FALLA'} ${shown}:${line} fetch`)
    if (!ok) {
      findings.push({
        file: shown,
        line,
        boundary: 'fetch',
        detail: 'llama a `fetch` sin envolverlo en `fetchWithTimeout`'
      })
    }
  }

  // ── SDK de red que no pasan por fetch ──────────────────────────────────────
  for (const call of NON_FETCH_NETWORK_CALLS) {
    let from = 0
    for (;;) {
      const index = source.indexOf(call, from)
      if (index === -1) break
      from = index + call.length

      const line = lineOf(source, index)
      const ok = hasWrapper(source.slice(Math.max(0, index - 200), index))
      checked.push(`${ok ? 'ok  ' : 'FALLA'} ${shown}:${line} ${call}`)
      if (!ok) {
        findings.push({
          file: shown,
          line,
          boundary: call,
          detail: `llama a \`${call}\` sin envolverlo en \`withTimeout\``
        })
      }
    }
  }
}

function main(): void {
  const findings: Finding[] = []
  const checked: string[] = []

  for (const file of walk(FUNCTIONS_DIR)) {
    inspect(file, findings, checked)
  }

  if (process.argv.includes('--list')) {
    for (const entry of checked.sort()) console.log(entry)
    console.log('')
  }

  // Piso anti-silencio (§14.1 de TESTING_RULES): si los extractores dejan de
  // encontrar nada, «0 problemas de 0» se lee igual que «todo bien». Las Edge
  // Functions siempre abren al menos un cliente de Supabase; cero fronteras
  // significa que este guardia se rompió, no que el repo mejoró.
  if (checked.length === 0) {
    console.error(
      'check:bounded-io — no se encontró ninguna frontera de red en supabase/functions.\n' +
        'El guardia dejó de reconocer el código, no el código de tener fronteras.'
    )
    process.exit(1)
  }

  if (findings.length === 0) {
    console.log(`check:bounded-io — ${checked.length} fronteras de red, todas con tope.`)
    return
  }

  console.error('check:bounded-io — fronteras de red sin presupuesto de tiempo:\n')
  for (const finding of findings) {
    console.error(`  ${finding.file}:${finding.line} · ${finding.boundary}`)
    console.error(`      ${finding.detail}\n`)
  }
  console.error(
    'Una llamada remota sin tope convierte la caída de otro servicio en carga propia.\n' +
      'Ver R-152 en docs/governance/REGRESSION_RULES.md.'
  )
  process.exit(1)
}

main()
