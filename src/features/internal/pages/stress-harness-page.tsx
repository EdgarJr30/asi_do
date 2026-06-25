import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Activity, AlertTriangle, History, Mail, MailX, Play, ShieldAlert } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Spinner } from '@/components/ui/loader'
import { PageHeader } from '@/components/ui/page-header'
import {
  listStressHarnessRuns,
  runStressHarness,
  type AdminApplicationsMode,
  type HarnessPlan,
  type HarnessProfile,
  type HarnessReport
} from '@/features/internal/lib/stress-harness-api'

// Email del super admin al que se pueden amarrar postulaciones por defecto.
const DEFAULT_ADMIN_EMAIL = 'edgarjoel9912@gmail.com'

const PROFILE_PRESETS: Record<HarnessProfile, HarnessPlan> = {
  smoke: { users: 5, companies: 5, jobs: 5, applications: 5, memberships: 5, donations: 5, notifications: 5 },
  baseline: { users: 60, companies: 55, jobs: 60, applications: 60, memberships: 60, donations: 55, notifications: 60 },
  heavy: { users: 200, companies: 100, jobs: 300, applications: 1000, memberships: 300, donations: 300, notifications: 500 }
}

const MODULE_FIELDS: { key: keyof HarnessPlan; label: string }[] = [
  { key: 'users', label: 'Usuarios + perfiles' },
  { key: 'companies', label: 'Empresas / tenants' },
  { key: 'jobs', label: 'Vacantes' },
  { key: 'applications', label: 'Postulaciones' },
  { key: 'memberships', label: 'Membresías (pagadas/no)' },
  { key: 'donations', label: 'Donaciones' },
  { key: 'notifications', label: 'Notificaciones' }
]

function fmtMs(ms: number): string {
  return `${Math.round(ms)}ms`
}

function ReportTable({ report }: { report: HarnessReport }) {
  const modulesWithErrors = report.modules.filter((module) => module.errorSamples.length > 0)
  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
              <th className="py-2 pr-2 font-semibold">Módulo</th>
              <th className="px-2 py-2 text-right font-semibold">Ops</th>
              <th className="px-2 py-2 text-right font-semibold">Err</th>
              <th className="px-2 py-2 text-right font-semibold">T/O</th>
              <th className="px-2 py-2 text-right font-semibold">p50</th>
              <th className="px-2 py-2 text-right font-semibold">p95</th>
              <th className="px-2 py-2 text-right font-semibold">p99</th>
              <th className="px-2 py-2 text-right font-semibold">max</th>
              <th className="px-2 py-2 text-right font-semibold">ops/s</th>
            </tr>
          </thead>
          <tbody>
            {report.modules.map((module) => (
              <tr key={module.label} className="border-b border-zinc-100 dark:border-zinc-900">
                <td className="py-2 pr-2 font-medium">{module.label}</td>
                <td className="px-2 py-2 text-right tabular-nums">{module.count}</td>
                <td className={`px-2 py-2 text-right tabular-nums ${module.errors > 0 ? 'text-rose-600' : ''}`}>
                  {module.errors}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">{module.timeouts}</td>
                <td className="px-2 py-2 text-right tabular-nums">{fmtMs(module.durationsMs.p50)}</td>
                <td className="px-2 py-2 text-right tabular-nums">{fmtMs(module.durationsMs.p95)}</td>
                <td className="px-2 py-2 text-right tabular-nums">{fmtMs(module.durationsMs.p99)}</td>
                <td className="px-2 py-2 text-right tabular-nums">{fmtMs(module.durationsMs.max)}</td>
                <td className="px-2 py-2 text-right tabular-nums">{module.throughputPerSec.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modulesWithErrors.length > 0 ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-3 text-sm dark:border-rose-900/40 dark:bg-rose-950/15">
          <p className="mb-2 flex items-center gap-2 font-semibold text-rose-700 dark:text-rose-300">
            <AlertTriangle className="h-4 w-4" /> Detalle de errores
          </p>
          <ul className="space-y-2">
            {modulesWithErrors.map((module) => (
              <li key={module.label}>
                <span className="font-medium">{module.label}</span> ({module.errors} err):
                <ul className="mt-1 space-y-0.5 pl-4 font-mono text-xs text-rose-700/90 dark:text-rose-300/80">
                  {module.errorSamples.map((sample, index) => (
                    <li key={index}>
                      {sample.count}× {sample.message}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

export function StressHarnessPage() {
  const queryClient = useQueryClient()
  const [profile, setProfile] = useState<HarnessProfile>('baseline')
  const [plan, setPlan] = useState<HarnessPlan>(PROFILE_PRESETS.baseline)
  const [concurrency, setConcurrency] = useState(8)
  const [timeoutMs, setTimeoutMs] = useState(30000)
  const [sendEmails, setSendEmails] = useState(false)
  const [adminMode, setAdminMode] = useState<AdminApplicationsMode>('off')
  const [adminEmail, setAdminEmail] = useState(DEFAULT_ADMIN_EMAIL)
  const [adminRatio, setAdminRatio] = useState(40)
  const [report, setReport] = useState<HarnessReport | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const [guardInfo, setGuardInfo] = useState<{ projectRef: string; envLabel: string } | null>(null)

  const historyQuery = useQuery({
    queryKey: ['stress-harness-runs'],
    queryFn: () => listStressHarnessRuns(20)
  })

  const mutation = useMutation({
    mutationFn: () =>
      runStressHarness({
        profile,
        plan,
        concurrency,
        timeoutMs,
        sendEmails,
        adminApplications:
          adminMode === 'off'
            ? undefined
            : { email: adminEmail.trim(), mode: adminMode, ratio: adminRatio / 100 }
      }),
    onSuccess: (response) => {
      if (!response.ok) {
        setReport(null)
        toast.error(response.error ?? 'El arnés fue rechazado', { description: response.reason })
        if (response.logs) setLogs(response.logs)
        return
      }
      setReport(response.report ?? null)
      setLogs(response.logs ?? [])
      setGuardInfo(response.guard ?? null)
      void queryClient.invalidateQueries({ queryKey: ['stress-harness-runs'] })
      toast.success('Escenario completado', {
        description: `${response.report?.totals.operations ?? 0} operaciones · ${(
          (response.report?.totals.errorRate ?? 0) * 100
        ).toFixed(1)}% error`
      })
    },
    onError: (error) => {
      toast.error('No se pudo ejecutar el arnés', {
        description: error instanceof Error ? error.message : 'Error desconocido'
      })
    }
  })

  function applyProfile(next: HarnessProfile) {
    setProfile(next)
    setPlan(PROFILE_PRESETS[next])
  }

  function updatePlan(key: keyof HarnessPlan, value: string) {
    const parsed = Number(value)
    setPlan((current) => ({ ...current, [key]: Number.isFinite(parsed) && parsed >= 0 ? parsed : 0 }))
  }

  const totalPlanned = Object.values(plan).reduce((acc, value) => acc + value, 0)
  const isRunning = mutation.isPending

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Super admin"
        title="Arnés de estrés"
        description="Genera datos sintéticos masivos y mide el comportamiento de la base (p50/p95/p99, throughput, error rate, timeouts). Solo entornos no productivos."
        actions={
          <Button onClick={() => mutation.mutate()} disabled={isRunning || totalPlanned === 0}>
            {isRunning ? <Spinner size="sm" /> : <Play className="h-4 w-4" />}
            {isRunning ? 'Ejecutando…' : 'Ejecutar escenario'}
          </Button>
        }
      />

      <Card className="border-amber-300/60 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/20">
        <CardContent className="flex items-start gap-3 py-4">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div className="space-y-1 text-sm">
            <p className="font-semibold text-amber-900 dark:text-amber-200">Solo datos sintéticos · nunca producción</p>
            <p className="text-amber-800/90 dark:text-amber-200/80">
              El backend valida rol <code>platform_owner</code> y una guarda de entorno fail-closed. Todo lo creado queda
              marcado (emails <code>@harness.asido.test</code>, slugs <code>harness-*</code>) y es purgable.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Configuración del escenario</CardTitle>
            <CardDescription>Define el volumen por módulo y la concurrencia de inserción.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Perfil</span>
              <Select
                value={profile}
                disabled={isRunning}
                onChange={(event) => applyProfile(event.target.value as HarnessProfile)}
              >
                <option value="smoke">Smoke (5 c/u)</option>
                <option value="baseline">Baseline (~60 c/u)</option>
                <option value="heavy">Heavy (carga alta)</option>
              </Select>
            </label>

            <div className="grid grid-cols-2 gap-3">
              {MODULE_FIELDS.map((field) => (
                <label key={field.key} className="block space-y-1">
                  <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{field.label}</span>
                  <Input
                    type="number"
                    min={0}
                    disabled={isRunning}
                    value={plan[field.key]}
                    onChange={(event) => updatePlan(field.key, event.target.value)}
                  />
                </label>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1">
                <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Concurrencia</span>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  disabled={isRunning}
                  value={concurrency}
                  onChange={(event) => setConcurrency(Math.max(1, Number(event.target.value) || 1))}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Timeout op (ms)</span>
                <Input
                  type="number"
                  min={1000}
                  step={1000}
                  disabled={isRunning}
                  value={timeoutMs}
                  onChange={(event) => setTimeoutMs(Math.max(1000, Number(event.target.value) || 1000))}
                />
              </label>
            </div>

            {/* Toggle de correos: clave para no inundar inboxes en runs grandes. */}
            <button
              type="button"
              disabled={isRunning}
              onClick={() => setSendEmails((value) => !value)}
              className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition ${
                sendEmails
                  ? 'border-emerald-300 bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-950/15'
                  : 'border-zinc-200 bg-zinc-50/60 dark:border-zinc-800 dark:bg-zinc-900/40'
              } ${isRunning ? 'cursor-not-allowed opacity-60' : ''}`}
            >
              {sendEmails ? (
                <Mail className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
              ) : (
                <MailX className="mt-0.5 h-5 w-5 shrink-0 text-zinc-500" />
              )}
              <span className="space-y-0.5">
                <span className="block text-sm font-semibold">
                  {sendEmails ? 'Enviar correos durante la prueba' : 'No enviar correos (recomendado para runs grandes)'}
                </span>
                <span className="block text-xs text-zinc-500">
                  {sendEmails
                    ? 'Las notificaciones que disparen los triggers se enviarán por el pipeline real.'
                    : 'Se suprimen las entregas de email generadas por la prueba. Ideal cuando son cientos/miles de ops.'}
                </span>
              </span>
              <span
                className={`ml-auto mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full px-0.5 transition ${
                  sendEmails ? 'justify-end bg-emerald-500' : 'justify-start bg-zinc-300 dark:bg-zinc-700'
                }`}
              >
                <span className="h-4 w-4 rounded-full bg-white" />
              </span>
            </button>

            {/* Postulaciones a nombre de un administrador real (no sintético). */}
            <div className="space-y-3 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Postulaciones del administrador
                </span>
                <Select
                  value={adminMode}
                  disabled={isRunning}
                  onChange={(event) => setAdminMode(event.target.value as AdminApplicationsMode)}
                >
                  <option value="off">Solo candidatos sintéticos</option>
                  <option value="all">Todas a nombre del administrador</option>
                  <option value="random">Aleatorias (mezcla admin + sintéticos)</option>
                </Select>
                <span className="block text-xs text-zinc-500">
                  Amarra postulaciones a la cuenta real del administrador para verlas en su perfil. Las postulaciones se
                  crean sobre vacantes sintéticas, así que se purgan junto con el resto del run.
                </span>
              </label>

              {adminMode !== 'off' ? (
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Email del administrador</span>
                  <Input
                    type="email"
                    disabled={isRunning}
                    value={adminEmail}
                    placeholder={DEFAULT_ADMIN_EMAIL}
                    onChange={(event) => setAdminEmail(event.target.value)}
                  />
                </label>
              ) : null}

              {adminMode === 'random' ? (
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    % de postulaciones del admin: {adminRatio}%
                  </span>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    disabled={isRunning}
                    value={adminRatio}
                    onChange={(event) =>
                      setAdminRatio(Math.min(100, Math.max(0, Number(event.target.value) || 0)))
                    }
                  />
                </label>
              ) : null}
            </div>

            <p className="text-xs text-zinc-500">Total planificado: {totalPlanned.toLocaleString()} operaciones.</p>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {isRunning ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                <Spinner size="lg" />
                <p className="text-sm font-medium">Ejecutando el arnés…</p>
                <p className="max-w-md text-xs text-zinc-500">
                  Generando {totalPlanned.toLocaleString()} operaciones con concurrencia {concurrency}. Esto puede tardar
                  según el volumen; no cierres la página.
                </p>
              </CardContent>
            </Card>
          ) : report ? (
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Activity className="h-5 w-5 text-emerald-600" />
                    Resultados · run {report.runId}
                  </CardTitle>
                  <div className="flex flex-wrap items-center gap-2">
                    {guardInfo ? (
                      <Badge variant="soft">
                        {guardInfo.envLabel} · {guardInfo.projectRef}
                      </Badge>
                    ) : null}
                    <Badge variant="soft">{report.sendEmails ? 'correos enviados' : 'correos suprimidos'}</Badge>
                    <Badge variant="soft">{(report.totals.errorRate * 100).toFixed(1)}% error</Badge>
                  </div>
                </div>
                <CardDescription>
                  {report.totals.operations.toLocaleString()} ops · {report.totals.throughputPerSec.toFixed(1)} ops/s ·{' '}
                  wall {fmtMs(report.totalWallClockMs)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ReportTable report={report} />
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center gap-2 py-16 text-center text-sm text-zinc-500">
                <Activity className="h-8 w-8 text-zinc-300" />
                <p>Ejecuta un escenario para ver p50/p95/p99, throughput y tasa de error por módulo.</p>
              </CardContent>
            </Card>
          )}

          {!isRunning && logs.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <AlertTriangle className="h-4 w-4 text-zinc-400" />
                  Bitácora de ejecución
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                  {logs.map((log, index) => (
                    <li key={index}>· {log}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      {/* Historial persistido: sobrevive a recargas de página. */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <History className="h-5 w-5 text-zinc-400" />
            Historial de pruebas
          </CardTitle>
          <CardDescription>Cada run queda guardado. Haz clic para ver su reporte completo.</CardDescription>
        </CardHeader>
        <CardContent>
          {historyQuery.isLoading ? (
            <div className="flex justify-center py-6">
              <Spinner />
            </div>
          ) : (historyQuery.data?.length ?? 0) === 0 ? (
            <p className="py-4 text-center text-sm text-zinc-500">Aún no hay pruebas registradas.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
                    <th className="py-2 pr-2 font-semibold">Fecha</th>
                    <th className="px-2 py-2 font-semibold">Run</th>
                    <th className="px-2 py-2 font-semibold">Perfil</th>
                    <th className="px-2 py-2 text-right font-semibold">Ops</th>
                    <th className="px-2 py-2 text-right font-semibold">Err%</th>
                    <th className="px-2 py-2 text-right font-semibold">ops/s</th>
                    <th className="px-2 py-2 text-right font-semibold">Wall</th>
                    <th className="px-2 py-2 font-semibold">Correos</th>
                    <th className="px-2 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {historyQuery.data?.map((run) => (
                    <tr key={run.id} className="border-b border-zinc-100 dark:border-zinc-900">
                      <td className="py-2 pr-2 whitespace-nowrap text-zinc-600 dark:text-zinc-400">
                        {new Date(run.created_at).toLocaleString()}
                      </td>
                      <td className="px-2 py-2 font-mono text-xs">{run.run_id}</td>
                      <td className="px-2 py-2">{run.profile ?? '—'}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{run.total_operations}</td>
                      <td
                        className={`px-2 py-2 text-right tabular-nums ${run.total_errors > 0 ? 'text-rose-600' : ''}`}
                      >
                        {(run.error_rate * 100).toFixed(1)}%
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">{run.throughput_per_sec.toFixed(1)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{fmtMs(run.total_wall_clock_ms)}</td>
                      <td className="px-2 py-2 text-xs">{run.send_emails ? 'enviados' : 'suprimidos'}</td>
                      <td className="px-2 py-2 text-right">
                        <Button
                          variant="outline"
                          className="h-8 px-3 text-xs"
                          onClick={() => {
                            setReport(run.report)
                            setGuardInfo(
                              run.env_label && run.project_ref
                                ? { envLabel: run.env_label, projectRef: run.project_ref }
                                : null
                            )
                            setLogs([])
                            window.scrollTo({ top: 0, behavior: 'smooth' })
                          }}
                        >
                          Ver
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
