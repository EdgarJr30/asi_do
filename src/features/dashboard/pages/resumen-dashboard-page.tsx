import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, useReducedMotion } from 'motion/react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, BriefcaseBusiness, CalendarClock, ChevronLeft, ChevronRight, Send, Settings, UsersRound } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { useAppSession } from '@/app/providers/app-session-provider'
import { surfacePaths } from '@/app/router/surface-paths'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Spinner } from '@/components/ui/loader'
import {
  fetchWorkspaceDashboardMetrics,
  type DashboardActivityItem,
  type DashboardRecentApplication
} from '@/features/dashboard/lib/dashboard-api'
import { cardReveal, gridStagger, pageStagger } from '@/shared/ui/card-motion'
import { useRealtimeSync } from '@/lib/realtime/use-realtime-sync'
import { cn } from '@/lib/utils/cn'

function greetingForNow(date = new Date()) {
  const hour = date.getHours()
  if (hour < 12) {
    return 'Buenos días'
  }
  if (hour < 19) {
    return 'Buenas tardes'
  }
  return 'Buenas noches'
}

function firstName(value: string) {
  return value.trim().split(/\s+/)[0] ?? value
}

function initialsOf(value: string) {
  return (
    value
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('') || '·'
  )
}

function relativeTime(value: string) {
  const diffMs = Date.now() - new Date(value).getTime()
  const minutes = Math.round(diffMs / 60000)
  if (minutes < 1) {
    return 'hace un momento'
  }
  if (minutes < 60) {
    return `hace ${minutes} min`
  }
  const hours = Math.round(minutes / 60)
  if (hours < 24) {
    return `hace ${hours} h`
  }
  const days = Math.round(hours / 24)
  return `hace ${days} d`
}

function scoreVariant(score: number) {
  if (score >= 85) {
    return 'default' as const
  }
  if (score >= 70) {
    return 'soft' as const
  }
  return 'outline' as const
}

export function ResumenDashboardPage() {
  const session = useAppSession()
  const navigate = useNavigate()
  const shouldReduceMotion = useReducedMotion()
  const tenantId = session.activeTenantId
  const displayName = session.profile?.display_name ?? session.profile?.full_name ?? session.authUser?.email ?? 'equipo'

  const dashboardKey = ['workspace', 'dashboard', tenantId] as const
  const metricsQuery = useQuery({
    queryKey: dashboardKey,
    enabled: Boolean(tenantId),
    queryFn: async () => fetchWorkspaceDashboardMetrics(tenantId!)
  })

  // En vivo: el panel se actualiza solo cuando entran postulaciones, cambian de
  // etapa o se publican vacantes. RLS asegura que solo lleguen los cambios del
  // tenant. Sin recargas manuales.
  useRealtimeSync(
    'workspace-dashboard',
    [
      { table: 'applications', invalidate: [dashboardKey] },
      { table: 'application_stage_history', invalidate: [dashboardKey] },
      { table: 'job_postings', invalidate: [dashboardKey] }
    ],
    { enabled: Boolean(tenantId) }
  )

  const metrics = metricsQuery.data
  const maxFunnelCount = useMemo(
    () => (metrics ? Math.max(1, ...metrics.funnel.map((stage) => stage.count)) : 1),
    [metrics]
  )

  const RECENT_APPLICATIONS_PER_PAGE = 5
  const recentApplications = metrics?.recentApplications ?? []
  const applicationsPageCount = Math.max(1, Math.ceil(recentApplications.length / RECENT_APPLICATIONS_PER_PAGE))
  const [applicationsPage, setApplicationsPage] = useState(0)

  // Si cambian las aplicaciones (realtime) y la página actual queda fuera de
  // rango, volvemos a una página válida.
  useEffect(() => {
    setApplicationsPage((current) => Math.min(current, applicationsPageCount - 1))
  }, [applicationsPageCount])

  const pagedApplications = recentApplications.slice(
    applicationsPage * RECENT_APPLICATIONS_PER_PAGE,
    applicationsPage * RECENT_APPLICATIONS_PER_PAGE + RECENT_APPLICATIONS_PER_PAGE
  )

  if (!tenantId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No tienes un workspace operativo activo</CardTitle>
          <CardDescription>El panel se habilita para tenants aprobados con acceso de reclutamiento.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const stats = metrics?.stats
  const greeting = greetingForNow()
  const isFirstRun =
    Boolean(metrics) &&
    (stats?.openJobs ?? 0) === 0 &&
    (stats?.activeCandidates ?? 0) === 0 &&
    (metrics?.recentApplications.length ?? 0) === 0

  return (
    <motion.div
      className="space-y-6"
      variants={pageStagger}
      initial={shouldReduceMotion ? false : 'hidden'}
      animate="show"
    >
      <motion.div
        variants={cardReveal}
        className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"
      >
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight text-(--app-text) sm:text-[1.6rem]">
            {greeting}, {firstName(displayName)}
          </h1>
          <p className="text-[0.8rem] text-(--app-text-muted)">Este es el estado de tu reclutamiento hoy.</p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Button variant="outline" onClick={() => void navigate(surfacePaths.workspace.pipeline)}>
            Ver pipeline
          </Button>
          <Button onClick={() => void navigate(surfacePaths.workspace.jobs)}>Publicar vacante</Button>
        </div>
      </motion.div>

      <motion.div variants={gridStagger} className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
        <motion.div variants={cardReveal} className="h-full">
          <AccentStatCard
            icon={BriefcaseBusiness}
            accent="emerald"
            label="Vacantes abiertas"
            value={stats?.openJobs ?? '—'}
            helper="Publicadas y recibiendo aplicaciones"
          />
        </motion.div>
        <motion.div variants={cardReveal} className="h-full">
          <AccentStatCard
            icon={UsersRound}
            accent="sky"
            label="Candidatos activos"
            value={stats?.activeCandidates ?? '—'}
            helper="En proceso, sin descartar ni contratar"
          />
        </motion.div>
        <motion.div variants={cardReveal} className="h-full">
          <AccentStatCard
            icon={CalendarClock}
            accent="violet"
            label="Entrevistas"
            value={stats?.interviews ?? '—'}
            helper="Candidatos en etapa de entrevista"
          />
        </motion.div>
        <motion.div variants={cardReveal} className="h-full">
          <AccentStatCard
            icon={Send}
            accent="amber"
            label="Ofertas enviadas"
            value={stats?.offers ?? '—'}
            helper="Esperando respuesta del candidato"
          />
        </motion.div>
      </motion.div>

      {isFirstRun ? (
        <motion.div variants={cardReveal}>
          <Card className="border-primary-200/70 bg-primary-50/50 dark:border-primary-500/25 dark:bg-primary-500/10">
            <CardHeader>
              <CardTitle>Primeros pasos</CardTitle>
              <CardDescription>Configura tu reclutamiento en minutos. Empieza por aquí.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              <FirstStepCard
                icon={BriefcaseBusiness}
                title="Publica tu primera vacante"
                description="Crea una vacante y empieza a recibir postulaciones."
                cta="Publicar vacante"
                onClick={() => void navigate(surfacePaths.workspace.jobs)}
              />
              <FirstStepCard
                icon={UsersRound}
                title="Explora el banco de talento"
                description="Descubre personas abiertas a nuevas oportunidades."
                cta="Ver talento"
                onClick={() => void navigate(surfacePaths.workspace.talent)}
              />
              <FirstStepCard
                icon={Settings}
                title="Invita a tu equipo"
                description="Configura accesos y roles para colaborar."
                cta="Abrir configuración"
                onClick={() => void navigate(surfacePaths.workspace.settings)}
              />
            </CardContent>
          </Card>
        </motion.div>
      ) : null}

      <motion.div variants={gridStagger} className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <motion.div variants={cardReveal} className="h-full">
          <Card className="h-full">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle>Embudo de contratación</CardTitle>
                  <CardDescription>Distribución de candidatos por etapa del pipeline.</CardDescription>
                </div>
                <Button className="h-9 rounded-full px-3 text-xs" variant="ghost" onClick={() => void navigate(surfacePaths.workspace.pipeline)}>
                  Ver detalles
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {metricsQuery.isLoading ? (
                <LoadingRow label="Cargando embudo…" />
              ) : metrics && metrics.funnel.length > 0 ? (
                <div className="space-y-3.5">
                  {metrics.funnel.map((stage) => (
                    <div key={stage.stageId} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-(--app-text)">{stage.name}</span>
                        <span className="tabular-nums text-(--app-text-muted)">
                          {stage.count} · {stage.percent}%
                        </span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-(--app-surface-muted)">
                        <motion.div
                          className="h-full rounded-full bg-primary-500"
                          initial={shouldReduceMotion ? false : { width: 0 }}
                          animate={{ width: `${Math.max(2, Math.round((stage.count / maxFunnelCount) * 100))}%` }}
                          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState title="Sin datos del embudo" description="Aún no hay aplicaciones para mostrar la distribución por etapa." />
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={cardReveal} className="h-full">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Actividad reciente</CardTitle>
              <CardDescription>Últimos eventos relevantes de tu pipeline.</CardDescription>
            </CardHeader>
            <CardContent>
              {metricsQuery.isLoading ? (
                <LoadingRow label="Cargando actividad…" />
              ) : metrics && metrics.recentActivity.length > 0 ? (
                <ul className="-mr-2 max-h-[19rem] space-y-3.5 overflow-y-auto pr-2">
                  {metrics.recentActivity.map((item) => (
                    <ActivityRow key={item.id} item={item} />
                  ))}
                </ul>
              ) : (
                <EmptyState title="Sin actividad" description="Cuando tu equipo trabaje el pipeline, lo verás aquí." />
              )}
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      <motion.div variants={cardReveal}>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>Aplicaciones recientes</CardTitle>
                <CardDescription>Las postulaciones más nuevas de tu empresa.</CardDescription>
              </div>
              <Button className="h-9 rounded-full px-3 text-xs" variant="ghost" onClick={() => void navigate(surfacePaths.workspace.applications)}>
                Ver todas
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {metricsQuery.isLoading ? (
              <LoadingRow label="Cargando aplicaciones…" />
            ) : metrics && recentApplications.length > 0 ? (
              <div className="space-y-3">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[34rem] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-(--app-border) text-left text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-(--app-text-subtle)">
                        <th className="py-2.5 pr-3 font-semibold">Candidato</th>
                        <th className="px-3 py-2.5 font-semibold">Posición</th>
                        <th className="px-3 py-2.5 font-semibold">Etapa</th>
                        <th className="px-3 py-2.5 font-semibold">Score</th>
                        <th className="py-2.5 pl-3 text-right font-semibold">Aplicó</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedApplications.map((application) => (
                        <ApplicationRow key={application.applicationId} application={application} />
                      ))}
                    </tbody>
                  </table>
                </div>
                {applicationsPageCount > 1 ? (
                  <div className="flex items-center justify-between gap-3 pt-1">
                    <p className="text-xs text-(--app-text-subtle)">
                      Página {applicationsPage + 1} de {applicationsPageCount}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        className="size-8 rounded-full p-0"
                        disabled={applicationsPage === 0}
                        onClick={() => setApplicationsPage((current) => Math.max(0, current - 1))}
                        aria-label="Página anterior"
                      >
                        <ChevronLeft className="size-4" />
                      </Button>
                      <Button
                        variant="outline"
                        className="size-8 rounded-full p-0"
                        disabled={applicationsPage >= applicationsPageCount - 1}
                        onClick={() => setApplicationsPage((current) => Math.min(applicationsPageCount - 1, current + 1))}
                        aria-label="Página siguiente"
                      >
                        <ChevronRight className="size-4" />
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <EmptyState title="Sin aplicaciones" description="Aún no hay postulaciones recientes en tus vacantes." />
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  )
}

const accentClassName = {
  emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/12 dark:text-emerald-300',
  sky: 'bg-sky-50 text-sky-600 dark:bg-sky-500/12 dark:text-sky-300',
  violet: 'bg-violet-50 text-violet-600 dark:bg-violet-500/12 dark:text-violet-300',
  amber: 'bg-amber-50 text-amber-600 dark:bg-amber-500/12 dark:text-amber-300'
} as const

function AccentStatCard({
  icon: Icon,
  accent,
  label,
  value,
  helper
}: {
  icon: LucideIcon
  accent: keyof typeof accentClassName
  label: ReactNode
  value: ReactNode
  helper?: ReactNode
}) {
  return (
    <div className="h-full rounded-panel border border-(--app-border) bg-(--app-surface-elevated) px-3.5 py-3 shadow-[0_10px_26px_rgba(10,18,36,0.06)] dark:shadow-[0_14px_30px_rgba(0,0,0,0.16)]">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-(--app-text-subtle)">{label}</p>
        <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-full', accentClassName[accent])}>
          <Icon className="size-4" />
        </span>
      </div>
      <p className="mt-2 text-[1.15rem] font-semibold tracking-tight text-(--app-text) sm:text-[1.3rem]">{value}</p>
      {helper ? <p className="mt-1.5 text-[0.8rem] leading-4.5 text-(--app-text-muted)">{helper}</p> : null}
    </div>
  )
}

function LoadingRow({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2.5 text-sm text-(--app-text-muted)">
      <Spinner size="sm" /> {label}
    </div>
  )
}

function FirstStepCard({
  icon: Icon,
  title,
  description,
  cta,
  onClick
}: {
  icon: LucideIcon
  title: string
  description: string
  cta: string
  onClick: () => void
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-(--app-border) bg-(--app-surface) p-4">
      <span className="flex size-10 items-center justify-center rounded-2xl bg-primary-50 text-primary-600 dark:bg-primary-500/12 dark:text-primary-300">
        <Icon className="size-5" />
      </span>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-(--app-text)">{title}</p>
        <p className="text-xs leading-5 text-(--app-text-muted)">{description}</p>
      </div>
      <Button
        variant="ghost"
        className="mt-auto h-9 justify-start px-0 text-sm text-primary-600 hover:bg-transparent hover:text-primary-700 dark:text-primary-300"
        onClick={onClick}
      >
        {cta}
        <ArrowRight className="size-4" />
      </Button>
    </div>
  )
}

function ActivityRow({ item }: { item: DashboardActivityItem }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-(--app-surface-muted) text-[11px] font-semibold text-(--app-text-muted)">
        {initialsOf(item.candidateName)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-5 text-(--app-text)">
          <span className="font-semibold">{item.candidateName}</span> {item.summary}
        </p>
        <p className="mt-0.5 text-xs text-(--app-text-subtle)">{relativeTime(item.occurredAt)}</p>
      </div>
    </li>
  )
}

function ApplicationRow({ application }: { application: DashboardRecentApplication }) {
  return (
    <tr className="border-b border-(--app-border)/70 last:border-0">
      <td className="py-3 pr-3">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-(--app-surface-muted) text-[11px] font-semibold text-(--app-text-muted)">
            {initialsOf(application.candidateName)}
          </span>
          <span className="truncate font-medium text-(--app-text)">{application.candidateName}</span>
        </div>
      </td>
      <td className="px-3 py-3 text-(--app-text-muted)">{application.position}</td>
      <td className="px-3 py-3">
        {application.stageName ? <Badge variant="outline">{application.stageName}</Badge> : <span className="text-(--app-text-subtle)">—</span>}
      </td>
      <td className="px-3 py-3">
        {application.score !== null ? (
          <Badge variant={scoreVariant(application.score)}>{application.score}%</Badge>
        ) : (
          <span className="text-(--app-text-subtle)">—</span>
        )}
      </td>
      <td className={cn('py-3 pl-3 text-right tabular-nums text-(--app-text-muted)')}>{relativeTime(application.submittedAt)}</td>
    </tr>
  )
}
