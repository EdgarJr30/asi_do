// Arnés de estrés / seeder sintético — CLI server-side.
//
// Uso (Node >= 22; corre TypeScript de forma nativa):
//   node scripts/stress-harness.ts --profile=baseline --env=development --enable --yes
//   node scripts/stress-harness.ts --users=80 --jobs=120 --applications=500 --concurrency=12 --env=development --enable --yes
//   node scripts/stress-harness.ts --purge --env=development --enable --yes
//
// Seguridad:
//   - Usa SUPABASE_SERVICE_ROLE_KEY SOLO en este proceso de servidor (jamás en el browser).
//   - Guarda FAIL-CLOSED: requiere STRESS_HARNESS_ENABLED=true (o --enable) y una
//     etiqueta de entorno no productiva (HARNESS_ENV / --env). Producción se bloquea.
//   - HARNESS_PRODUCTION_TARGETS (coma-separado) define una lista negra de refs/URLs.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import {
  runHarness,
  resolveSeedPlan,
  type HarnessPlan,
  type AdminApplications,
  type AdminApplicationsMode
} from '../supabase/functions/_shared/harness-core.ts'
import { evaluateHarnessGuard } from '../supabase/functions/_shared/harness-guards.ts'
import { SYNTHETIC_MARKER } from '../supabase/functions/_shared/synthetic.ts'
import type { HarnessReport } from '../supabase/functions/_shared/harness-core.ts'
import type { MetricsSummary } from '../supabase/functions/_shared/metrics.ts'

type Args = Record<string, string | boolean>

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

function fmt(ms: number): string {
  return `${ms.toFixed(0)}ms`
}

function printReport(report: HarnessReport): void {
  const line = '─'.repeat(96)
  console.log(`\n${line}`)
  console.log(`  REPORTE ARNÉS DE ESTRÉS · runId=${report.runId} · seed=${report.seed} · concurrency=${report.concurrency}`)
  console.log(line)
  const header =
    '  módulo'.padEnd(22) +
    'ops'.padStart(6) +
    'ok'.padStart(6) +
    'err'.padStart(5) +
    't/o'.padStart(5) +
    'err%'.padStart(7) +
    'p50'.padStart(9) +
    'p95'.padStart(9) +
    'p99'.padStart(9) +
    'max'.padStart(9) +
    'ops/s'.padStart(9)
  console.log(header)
  console.log(line)
  for (const m of report.modules) {
    console.log(rowFor(m))
  }
  console.log(line)
  const t = report.totals
  console.log(
    '  TOTAL'.padEnd(22) +
      String(t.operations).padStart(6) +
      String(t.ok).padStart(6) +
      String(t.errors).padStart(5) +
      String(t.timeouts).padStart(5) +
      `${(t.errorRate * 100).toFixed(1)}%`.padStart(7) +
      ''.padStart(9) +
      ''.padStart(9) +
      ''.padStart(9) +
      ''.padStart(9) +
      t.throughputPerSec.toFixed(1).padStart(9)
  )
  console.log(`${line}`)
  console.log(`  Wall clock total: ${fmt(report.totalWallClockMs)}  ·  ${report.startedAt} → ${report.finishedAt}`)
  console.log(
    `  Correos: ${
      report.sendEmails
        ? 'ENVIADOS por el pipeline'
        : `SUPRIMIDOS en origen — cero correos (residuales borrados: ${report.suppressedEmails})`
    }`
  )

  // Detalle de errores por módulo (clave para diagnosticar).
  const withErrors = report.modules.filter((m) => m.errorSamples.length > 0)
  if (withErrors.length > 0) {
    console.log(`${line}`)
    console.log('  ERRORES (muestras agrupadas):')
    for (const m of withErrors) {
      console.log(`  · ${m.label} (${m.errors} err):`)
      for (const sample of m.errorSamples) {
        console.log(`      ${sample.count}× ${sample.message}`)
      }
    }
  }
  console.log('')
}

function rowFor(m: MetricsSummary): string {
  return (
    `  ${m.label}`.padEnd(22) +
    String(m.count).padStart(6) +
    String(m.ok).padStart(6) +
    String(m.errors).padStart(5) +
    String(m.timeouts).padStart(5) +
    `${(m.errorRate * 100).toFixed(1)}%`.padStart(7) +
    fmt(m.durationsMs.p50).padStart(9) +
    fmt(m.durationsMs.p95).padStart(9) +
    fmt(m.durationsMs.p99).padStart(9) +
    fmt(m.durationsMs.max).padStart(9) +
    m.throughputPerSec.toFixed(1).padStart(9)
  )
}

// Purga TODOS los datos sintéticos identificables. No toca datos reales.
async function purge(client: ReturnType<typeof createClient>): Promise<void> {
  console.log('Purga de datos sintéticos en curso…')

  // 1) Tenants sintéticos → cascada a company_profiles, job_postings, applications, memberships.
  const tenants = await client.from('tenants').select('id').like('slug', 'harness-%')
  const tenantIds = (tenants.data ?? []).map((r: { id: string }) => r.id)
  if (tenantIds.length > 0) {
    await client.from('tenants').delete().in('id', tenantIds)
    console.log(`  tenants eliminados: ${tenantIds.length} (cascada a empresas/vacantes/postulaciones)`)
  }

  // 2) Pagos + solicitudes de membresía institucional sintéticas.
  await client.from('membership_payments').delete().like('order_number', 'MBR-%')
  const apps = await client
    .from('institutional_membership_applications')
    .delete()
    .like('applicant_email', 'stress+%@harness.asido.test')
  console.log(`  membresías institucionales purgadas (payments + applications)`)

  // 3) Donaciones sintéticas.
  await client.from('donations').delete().like('order_number', 'DON-%')
  console.log('  donaciones purgadas')

  // 4) Notificaciones de prueba.
  await client.from('notifications').delete().eq('is_test', true).contains('payload', { marker: SYNTHETIC_MARKER })
  console.log('  notificaciones de prueba purgadas')

  // 5) Usuarios sintéticos (auth) → cascada a public.users → candidate_profiles, etc.
  let page = 1
  let removed = 0
  // Listamos por páginas y borramos los que tengan el dominio sintético.
  // (auth.admin.listUsers no filtra por email, así que paginamos.)
  // Limitamos a 50 páginas por seguridad.
  for (; page <= 50; page += 1) {
    const list = await client.auth.admin.listUsers({ page, perPage: 200 })
    const users = list.data?.users ?? []
    if (users.length === 0) break
    for (const u of users) {
      if (u.email && u.email.endsWith('@harness.asido.test')) {
        await client.auth.admin.deleteUser(u.id)
        removed += 1
      }
    }
    if (users.length < 200) break
  }
  console.log(`  usuarios sintéticos (auth) eliminados: ${removed}`)
  console.log('Purga completa.')
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  const root = resolve(process.cwd())
  const fileEnv = { ...loadEnvFile(resolve(root, '.env.local')) }
  const env = { ...fileEnv, ...process.env }

  const supabaseUrl = env.VITE_SUPABASE_URL ?? env.SUPABASE_URL ?? ''
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  if (!supabaseUrl || !serviceKey) {
    console.error('Falta VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY (revisa .env.local).')
    process.exit(1)
  }

  // ---- Guarda de entorno (fail-closed) ----
  const envLabel = (args.env as string) ?? env.HARNESS_ENV
  const enabledFlag = args.enable === true || args.enable === 'true' ? 'true' : env.STRESS_HARNESS_ENABLED
  const productionTargets = (env.HARNESS_PRODUCTION_TARGETS ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  const guard = evaluateHarnessGuard({ supabaseUrl, envLabel, enabledFlag, productionTargets })

  console.log(`Destino: ${guard.projectRef}  ·  entorno: ${guard.envLabel}`)
  if (!guard.allowed) {
    console.error(`\n⛔ Arnés BLOQUEADO: ${guard.reason}`)
    console.error('   Para autorizar un entorno no productivo: --env=development --enable --yes')
    process.exit(2)
  }
  if (args.yes !== true) {
    console.error('\nFalta confirmación explícita. Añade --yes para ejecutar contra este destino.')
    process.exit(2)
  }
  console.log(`✅ ${guard.reason}\n`)

  const client = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  })

  if (args.purge === true) {
    await purge(client)
    return
  }

  // ---- Construcción del plan ----
  const profile = (args.profile as string) ?? 'baseline'
  const basePlan = resolveSeedPlan(profile === 'smoke' || profile === 'heavy' ? profile : 'baseline')
  const plan: Partial<HarnessPlan> = { ...basePlan }
  for (const key of ['users', 'companies', 'jobs', 'applications', 'memberships', 'donations', 'notifications'] as const) {
    if (typeof args[key] === 'string') plan[key] = num(args[key], plan[key] ?? 0)
  }

  const runId = (args['run-id'] as string) ?? Math.random().toString(36).slice(2, 8)
  const seed = num(args.seed, hashRunId(runId))
  const concurrency = num(args.concurrency, 8)
  const timeoutMs = num(args.timeout, 30000)
  const sendEmails = args.emails === true || args.emails === 'true' // por defecto NO envía correos

  // Postulaciones a nombre de un administrador real:
  //   --admin-applications=all|random  --admin-email=<correo>  [--admin-ratio=0.4]
  const adminModeRaw = (args['admin-applications'] as string) ?? 'off'
  const adminMode: AdminApplicationsMode =
    adminModeRaw === 'all' || adminModeRaw === 'random' ? adminModeRaw : 'off'
  const adminEmail = (args['admin-email'] as string)?.trim() ?? ''
  let adminApplications: AdminApplications | undefined
  if (adminMode !== 'off') {
    if (!adminEmail) {
      console.error('⛔ --admin-applications requiere --admin-email=<correo>')
      process.exit(2)
    }
    adminApplications = {
      email: adminEmail,
      mode: adminMode,
      ratio: Math.min(1, Math.max(0, num(args['admin-ratio'], 0.4)))
    }
  }

  console.log(`Plan: ${JSON.stringify(plan)}`)
  console.log(`Correos: ${sendEmails ? 'ENVIADOS (--emails)' : 'suprimidos (usa --emails para enviarlos)'}`)
  if (adminApplications) {
    console.log(
      `Postulaciones del admin: ${adminApplications.mode} → ${adminApplications.email}` +
        (adminApplications.mode === 'random' ? ` (ratio ${adminApplications.ratio})` : '')
    )
  }
  console.log(`Ejecutando (concurrency=${concurrency}, timeout=${timeoutMs}ms)…\n`)

  const report = await runHarness(client as never, {
    runId,
    seed,
    concurrency,
    timeoutMs,
    plan,
    sendEmails,
    adminApplications,
    onLog: (message) => console.log(`  · ${message}`)
  })

  printReport(report)

  // Persistimos el run (mismo historial que la UI). Best-effort.
  const { error: persistError } = await client.from('stress_harness_runs').insert({
    run_id: report.runId,
    env_label: guard.envLabel,
    project_ref: guard.projectRef,
    profile,
    plan,
    concurrency,
    send_emails: sendEmails,
    total_operations: report.totals.operations,
    total_ok: report.totals.ok,
    total_errors: report.totals.errors,
    total_timeouts: report.totals.timeouts,
    error_rate: report.totals.errorRate,
    throughput_per_sec: report.totals.throughputPerSec,
    total_wall_clock_ms: report.totalWallClockMs,
    suppressed_emails: report.suppressedEmails,
    report
  })
  if (persistError) console.log(`Aviso: no se pudo persistir el run (${persistError.message})`)
  else console.log('Run persistido en stress_harness_runs (visible en la UI).')

  if (typeof args.report === 'string') {
    const { writeFileSync } = await import('node:fs')
    writeFileSync(args.report, JSON.stringify(report, null, 2))
    console.log(`Reporte JSON guardado en ${args.report}`)
  }
}

function hashRunId(value: string): number {
  let hash = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

main().catch((error) => {
  console.error('\n💥 Error fatal del arnés:', error instanceof Error ? error.stack ?? error.message : error)
  process.exit(1)
})
