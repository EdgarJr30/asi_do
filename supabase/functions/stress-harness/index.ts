// Edge Function: stress-harness
//
// Arnés de estrés in-app para el SUPER ADMIN (platform_owner).
//
// Cumple los criterios de seguridad:
//   - service_role vive SOLO aquí (servidor). El browser nunca la ve: el UI llama
//     a esta función con el JWT del usuario.
//   - No hay bypass de RLS desde cliente: la AUTORIZACIÓN se decide con el JWT del
//     usuario vía RPC `is_platform_admin()` (respeta RLS) + verificación de rol
//     platform_owner. Solo TRAS autorizar se usa service_role para generar datos.
//   - Guarda de entorno FAIL-CLOSED: requiere STRESS_HARNESS_ENABLED=true y una
//     etiqueta HARNESS_ENV no productiva. Producción se bloquea siempre.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import {
  runHarness,
  resolveSeedPlan,
  type HarnessPlan,
  type AdminApplications,
  type AdminApplicationsMode
} from '../_shared/harness-core.ts'
import { evaluateHarnessGuard } from '../_shared/harness-guards.ts'

declare const Deno: { env: { get(key: string): string | undefined } }

type HarnessRequest = {
  profile?: 'smoke' | 'baseline' | 'heavy'
  plan?: Partial<HarnessPlan>
  concurrency?: number
  timeoutMs?: number
  seed?: number
  runId?: string
  sendEmails?: boolean
  adminApplications?: {
    email?: string
    mode?: AdminApplicationsMode
    ratio?: number
  }
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Método no permitido' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

  // 1) Guarda de entorno (antes de tocar nada).
  const guard = evaluateHarnessGuard({
    supabaseUrl,
    envLabel: Deno.env.get('HARNESS_ENV'),
    enabledFlag: Deno.env.get('STRESS_HARNESS_ENABLED'),
    productionTargets: (Deno.env.get('HARNESS_PRODUCTION_TARGETS') ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  })
  if (!guard.allowed) {
    return jsonResponse({ error: 'Arnés deshabilitado en este entorno', reason: guard.reason }, 403)
  }

  // 2) Autorización: el JWT del usuario debe ser super admin (platform_owner).
  const authHeader = request.headers.get('Authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Falta token de autorización' }, 401)
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false }
  })

  const { data: userData, error: userError } = await userClient.auth.getUser()
  if (userError || !userData.user) {
    return jsonResponse({ error: 'Sesión inválida' }, 401)
  }
  const callerId = userData.user.id

  // 2a) Gate confiable de la app (respeta RLS con el JWT del usuario).
  const adminCheck = await userClient.rpc('is_platform_admin')
  if (adminCheck.error || adminCheck.data !== true) {
    return jsonResponse({ error: 'Requiere rol de administrador de plataforma' }, 403)
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  })

  // 2b) Estricto: exige rol platform_owner (super admin), no solo platform_admin.
  const roleCheck = await admin
    .from('user_platform_roles')
    .select('platform_roles!inner(code)')
    .eq('user_id', callerId)
    .is('revoked_at', null)
  const isOwner = (roleCheck.data ?? []).some(
    (row: { platform_roles: { code: string } | null }) => row.platform_roles?.code === 'platform_owner'
  )
  if (!isOwner) {
    return jsonResponse({ error: 'Solo el super admin (platform_owner) puede ejecutar el arnés' }, 403)
  }

  // 3) Parseo del plan y ejecución.
  let body: HarnessRequest = {}
  try {
    body = (await request.json()) as HarnessRequest
  } catch {
    body = {}
  }

  const basePlan = resolveSeedPlan(body.profile ?? 'baseline')
  const plan: Partial<HarnessPlan> = { ...basePlan, ...(body.plan ?? {}) }
  const runId = (body.runId ?? crypto.randomUUID().slice(0, 8)).replace(/[^a-z0-9]/gi, '').toLowerCase()
  const concurrency = clamp(body.concurrency ?? 8, 1, 50)
  const timeoutMs = clamp(body.timeoutMs ?? 30000, 1000, 120000)

  const sendEmails = body.sendEmails === true // por defecto NO envía correos

  // Asignación opcional de postulaciones a un administrador real. Solo se activa
  // si llega un email y un modo válido distinto de 'off'.
  const adminMode = body.adminApplications?.mode
  const adminEmail = body.adminApplications?.email?.trim()
  const adminApplications: AdminApplications | undefined =
    adminEmail && (adminMode === 'all' || adminMode === 'random')
      ? { email: adminEmail, mode: adminMode, ratio: clamp(body.adminApplications?.ratio ?? 0.4, 0, 1) }
      : undefined

  const logs: string[] = []
  try {
    const report = await runHarness(admin as never, {
      runId,
      seed: body.seed ?? Date.now() % 2147483647,
      concurrency,
      timeoutMs,
      plan,
      sendEmails,
      adminApplications,
      onLog: (message) => logs.push(message)
    })

    // Persistimos el run para que el historial sobreviva a recargas de página.
    await admin.from('stress_harness_runs').insert({
      run_id: report.runId,
      created_by_user_id: callerId,
      env_label: guard.envLabel,
      project_ref: guard.projectRef,
      profile: body.profile ?? 'baseline',
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
      report,
      logs
    })

    return jsonResponse({ ok: true, guard: { projectRef: guard.projectRef, envLabel: guard.envLabel }, report, logs })
  } catch (error) {
    return jsonResponse(
      { ok: false, error: error instanceof Error ? error.message : String(error), logs },
      500
    )
  }
})

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
