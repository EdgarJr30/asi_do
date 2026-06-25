import { supabase } from '@/lib/supabase/client'

// Cliente del arnés de estrés. Invoca la Edge Function `stress-harness` con el JWT
// del super admin. La service_role nunca toca el browser: vive en la función.

export type HarnessProfile = 'smoke' | 'baseline' | 'heavy'

export type HarnessPlan = {
  users: number
  companies: number
  jobs: number
  applications: number
  memberships: number
  donations: number
  notifications: number
}

export type HarnessModuleSummary = {
  label: string
  count: number
  ok: number
  errors: number
  timeouts: number
  errorRate: number
  durationsMs: { min: number; p50: number; p95: number; p99: number; max: number; mean: number }
  wallClockMs: number
  throughputPerSec: number
  errorSamples: { message: string; count: number }[]
}

export type HarnessReport = {
  runId: string
  seed: number
  concurrency: number
  startedAt: string
  finishedAt: string
  totalWallClockMs: number
  sendEmails: boolean
  suppressedEmails: number
  modules: HarnessModuleSummary[]
  totals: {
    operations: number
    ok: number
    errors: number
    timeouts: number
    errorRate: number
    throughputPerSec: number
  }
}

export type HarnessResponse = {
  ok: boolean
  guard?: { projectRef: string; envLabel: string }
  report?: HarnessReport
  logs?: string[]
  error?: string
  reason?: string
}

export type AdminApplicationsMode = 'off' | 'all' | 'random'

export type AdminApplicationsInput = {
  email: string
  mode: AdminApplicationsMode
  ratio?: number
}

export type RunHarnessInput = {
  profile?: HarnessProfile
  plan?: Partial<HarnessPlan>
  concurrency?: number
  timeoutMs?: number
  sendEmails?: boolean
  adminApplications?: AdminApplicationsInput
}

export type StressHarnessRunRow = {
  id: string
  run_id: string
  created_at: string
  env_label: string | null
  project_ref: string | null
  profile: string | null
  send_emails: boolean
  total_operations: number
  total_errors: number
  total_timeouts: number
  error_rate: number
  throughput_per_sec: number
  total_wall_clock_ms: number
  suppressed_emails: number
  report: HarnessReport
}

export async function runStressHarness(input: RunHarnessInput): Promise<HarnessResponse> {
  if (!supabase) {
    throw new Error('Supabase no está configurado en este entorno.')
  }

  const sessionResponse = await supabase.auth.getSession()
  const accessToken = sessionResponse.data.session?.access_token ?? null
  if (!accessToken) {
    throw new Error('No encontramos una sesión válida para invocar el arnés.')
  }

  const response = await supabase.functions.invoke<HarnessResponse>('stress-harness', {
    headers: { Authorization: `Bearer ${accessToken}` },
    body: {
      profile: input.profile ?? 'baseline',
      plan: input.plan,
      concurrency: input.concurrency,
      timeoutMs: input.timeoutMs,
      sendEmails: input.sendEmails ?? false,
      adminApplications:
        input.adminApplications && input.adminApplications.mode !== 'off'
          ? input.adminApplications
          : undefined
    }
  })

  if (response.error) {
    // La Edge Function devuelve detalle en el cuerpo incluso con status != 2xx.
    const invokeError = response.error as { message?: unknown; context?: { body?: unknown } }
    const body = invokeError.context?.body
    if (typeof body === 'string') {
      try {
        return JSON.parse(body) as HarnessResponse
      } catch {
        /* noop */
      }
    }
    throw new Error(typeof invokeError.message === 'string' ? invokeError.message : 'Error al invocar el arnés')
  }

  return response.data as HarnessResponse
}

// Historial persistido de runs (RLS: solo platform admins pueden leer).
export async function listStressHarnessRuns(limit = 20): Promise<StressHarnessRunRow[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('stress_harness_runs')
    .select(
      'id, run_id, created_at, env_label, project_ref, profile, send_emails, total_operations, total_errors, total_timeouts, error_rate, throughput_per_sec, total_wall_clock_ms, suppressed_emails, report'
    )
    .order('created_at', { ascending: false })
    .limit(limit)
    .overrideTypes<StressHarnessRunRow[]>()

  if (error) throw new Error(error.message)
  return data ?? []
}
