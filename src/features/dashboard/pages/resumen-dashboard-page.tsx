import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, useReducedMotion } from 'motion/react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  BriefcaseBusiness,
  ChevronDown,
  ChevronRight,
  FileText,
  Plus,
  Settings,
  Star,
  UserPlus,
  UsersRound
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { useAppSession } from '@/app/providers/app-session-provider'
import { surfacePaths } from '@/app/router/surface-paths'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Spinner } from '@/components/ui/loader'
import { Select } from '@/components/ui/select'
import {
  fetchWorkspaceDashboardMetrics,
  type DashboardActivityItem,
  type DashboardRecentApplication
} from '@/features/dashboard/lib/dashboard-api'
import {
  smoothCardReveal as cardReveal,
  smoothGridStagger as gridStagger,
  smoothPageStagger as pageStagger
} from '@/shared/ui/card-motion'
import { useRealtimeSync } from '@/lib/realtime/use-realtime-sync'
import { cn } from '@/lib/utils/cn'
import { UserAvatar } from '@/shared/ui/user-avatar'

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

type ActivityKind = DashboardActivityItem['kind']
type ActivityFilter = 'all' | ActivityKind
type ActivityBucket = 'today' | 'week' | 'older'
const WORKSPACE_JOB_CREATE_PATH = `${surfacePaths.workspace.jobs}?action=create`

const ACTIVITY_FILTERS: { value: ActivityFilter; label: string }[] = [
  { value: 'all', label: 'Todo' },
  { value: 'application', label: 'Aplicaciones' },
  { value: 'rating', label: 'Calificaciones' },
  { value: 'note', label: 'Notas' }
]

const ACTIVITY_BUCKET_LABELS: Record<ActivityBucket, string> = {
  today: 'Hoy',
  week: 'Esta semana',
  older: 'Anteriores'
}

const ACTIVITY_KIND_META: Record<
  ActivityKind,
  {
    icon: LucideIcon
    label: string
    accent: 'apply' | 'rate' | 'note'
  }
> = {
  application: {
    icon: UserPlus,
    label: 'Aplicación',
    accent: 'apply'
  },
  rating: {
    icon: Star,
    label: 'Calificación',
    accent: 'rate'
  },
  note: {
    icon: FileText,
    label: 'Nota',
    accent: 'note'
  }
}

function getActivityBucket(value: string): ActivityBucket {
  const date = new Date(value)
  const now = new Date()

  if (Number.isNaN(date.getTime())) {
    return 'older'
  }

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const startOfActivityDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  const daysAgo = Math.floor((startOfToday - startOfActivityDay) / 86_400_000)

  if (daysAgo <= 0) {
    return 'today'
  }

  if (daysAgo <= 6) {
    return 'week'
  }

  return 'older'
}

function activityCounts(activity: DashboardActivityItem[]) {
  return activity.reduce(
    (acc, item) => {
      acc.total += 1
      acc[item.kind] += 1
      return acc
    },
    { total: 0, application: 0, rating: 0, note: 0 }
  )
}

function groupActivity(activity: DashboardActivityItem[]) {
  const groups: Array<{ bucket: ActivityBucket; count: number; items: DashboardActivityItem[] }> = []
  const bucketCounts = activity.reduce<Record<ActivityBucket, number>>(
    (acc, item) => {
      acc[getActivityBucket(item.occurredAt)] += 1
      return acc
    },
    { today: 0, week: 0, older: 0 }
  )

  for (const item of activity) {
    const bucket = getActivityBucket(item.occurredAt)
    const previous = groups.at(-1)

    if (previous?.bucket === bucket) {
      previous.items.push(item)
    } else {
      groups.push({ bucket, count: bucketCounts[bucket], items: [item] })
    }
  }

  return groups
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

  const recentApplications = metrics?.recentApplications ?? []
  const compactApplications = recentApplications.slice(0, 6)

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
          <Button onClick={() => void navigate(WORKSPACE_JOB_CREATE_PATH)}>
            <Plus className="size-4" />
            Publicar vacante
          </Button>
        </div>
      </motion.div>

      <motion.div
        variants={cardReveal}
        className="overflow-hidden rounded-control border border-(--app-border) bg-(--app-border) shadow-[0_1px_2px_rgba(20,40,90,0.04),0_4px_16px_rgba(20,40,90,0.05)] dark:shadow-[0_14px_32px_rgba(0,0,0,0.16)]"
      >
        <div className="grid grid-cols-2 gap-px 2xl:grid-cols-4">
          <KpiStripCell
            accent="brand"
            label="Vacantes abiertas"
            value={stats?.openJobs ?? 0}
            loading={metricsQuery.isLoading}
            helper="Publicadas y recibiendo aplicaciones"
          />
          <KpiStripCell
            accent="violet"
            label="Candidatos activos"
            value={stats?.activeCandidates ?? 0}
            loading={metricsQuery.isLoading}
            helper="En proceso, sin descartar ni contratar"
          />
          <KpiStripCell
            accent="amber"
            label="Entrevistas"
            value={stats?.interviews ?? 0}
            loading={metricsQuery.isLoading}
            helper="Candidatos en etapa de entrevista"
          />
          <KpiStripCell
            accent="green"
            label="Ofertas enviadas"
            value={stats?.offers ?? 0}
            loading={metricsQuery.isLoading}
            helper="Esperando respuesta del candidato"
          />
        </div>
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
                onClick={() => void navigate(WORKSPACE_JOB_CREATE_PATH)}
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

      <motion.div variants={gridStagger} className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(21rem,1fr)]">
        <div className="grid min-w-0 gap-4">
          <motion.div variants={cardReveal} className="min-w-0">
            <Card className="overflow-hidden p-0">
              <CardHeader className="flex flex-row items-start justify-between gap-3 px-4 pt-4 sm:px-5">
                <div className="min-w-0">
                  <CardTitle>Embudo de contratación</CardTitle>
                  <CardDescription>Distribución de candidatos por etapa del pipeline.</CardDescription>
                </div>
                <Button className="h-9 shrink-0 rounded-full px-3 text-xs" variant="ghost" onClick={() => void navigate(surfacePaths.workspace.pipeline)}>
                  Ver detalles
                  <ChevronRight className="size-3.5" />
                </Button>
              </CardHeader>
              <CardContent className="px-4 pb-4 sm:px-5">
                {metricsQuery.isLoading ? (
                  <LoadingRow label="Cargando embudo..." />
                ) : metrics && metrics.funnel.length > 0 ? (
                  <div className="space-y-3.5">
                    {metrics.funnel.map((stage) => (
                      <div key={stage.stageId} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1.5">
                        <span className="min-w-0 truncate text-[0.88rem] font-semibold text-(--app-text)">{stage.name}</span>
                        <span className="text-[0.82rem] tabular-nums text-(--app-text-muted)">
                          <b className="font-semibold text-(--app-text)">
                            <CountUp value={stage.count} duration={1300} />
                          </b>{' '}
                          · <CountUp value={stage.percent} suffix="%" duration={1300} />
                        </span>
                        <div className="col-span-2 h-2.5 overflow-hidden rounded-full bg-(--app-surface-muted)">
                          <motion.div
                            className="h-full rounded-full bg-gradient-to-r from-primary-400 to-primary-600"
                            initial={shouldReduceMotion ? false : { width: 0 }}
                            animate={{ width: `${Math.max(2, Math.round((stage.count / maxFunnelCount) * 100))}%` }}
                            transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1], delay: 0.1 }}
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

          <motion.div variants={cardReveal} className="min-w-0">
            <Card className="overflow-hidden p-0">
              <CardHeader className="flex flex-row items-start justify-between gap-3 px-4 pt-4 sm:px-5">
                <div className="min-w-0">
                  <CardTitle>Aplicaciones recientes</CardTitle>
                  <CardDescription>Las postulaciones más nuevas de tu empresa.</CardDescription>
                </div>
                <Button className="h-9 shrink-0 rounded-full px-3 text-xs" variant="ghost" onClick={() => void navigate(surfacePaths.workspace.applications)}>
                  Ver todas
                  <ChevronRight className="size-3.5" />
                </Button>
              </CardHeader>
              <CardContent className="px-2 pb-2 sm:px-3">
                {metricsQuery.isLoading ? (
                  <div className="px-2 pb-3">
                    <LoadingRow label="Cargando aplicaciones..." />
                  </div>
                ) : metrics && recentApplications.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[42rem] border-collapse text-sm">
                      <thead>
                        <tr className="text-left text-[0.68rem] font-bold uppercase tracking-[0.06em] text-(--app-text-subtle)">
                          <th className="px-3 py-2 font-bold">Candidato</th>
                          <th className="px-3 py-2 font-bold">Posición</th>
                          <th className="px-3 py-2 font-bold">Etapa</th>
                          <th className="px-3 py-2 text-right font-bold">Score</th>
                          <th className="px-3 py-2 text-right font-bold">Aplicó</th>
                        </tr>
                      </thead>
                      <tbody>
                        {compactApplications.map((application, index) => (
                          <ApplicationRow key={application.applicationId} application={application} index={index} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyState title="Sin aplicaciones" description="Aún no hay postulaciones recientes en tus vacantes." />
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        <motion.div variants={cardReveal} className="min-w-0">
          <ActivitySummaryPanel
            isLoading={metricsQuery.isLoading}
            activity={metrics?.recentActivity ?? []}
            onOpenFullActivity={() => void navigate(surfacePaths.workspace.activity)}
          />
        </motion.div>
      </motion.div>
    </motion.div>
  )
}

const kpiDotClassName = {
  brand: 'bg-primary-600',
  violet: 'bg-violet-500',
  amber: 'bg-amber-500',
  green: 'bg-emerald-500'
} as const

function KpiStripCell({
  accent,
  label,
  value,
  loading,
  helper
}: {
  accent: keyof typeof kpiDotClassName
  label: ReactNode
  value: number
  loading: boolean
  helper?: ReactNode
}) {
  return (
    <div className="min-w-0 bg-(--app-surface-elevated) px-3 py-3 sm:px-5 sm:py-3.5">
      <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
        <span className={cn('size-1.5 shrink-0 rounded-[3px] sm:size-2', kpiDotClassName[accent])} />
        <p className="min-w-0 truncate text-[0.62rem] font-semibold uppercase tracking-[0.05em] text-(--app-text-subtle) sm:text-[0.7rem]">{label}</p>
      </div>
      <p className="mt-1.5 text-[1.25rem] font-bold leading-none tracking-tight text-(--app-text) tabular-nums sm:mt-2 sm:text-[1.55rem]">
        {loading ? '—' : <CountUp value={value} />}
      </p>
      {helper ? <p className="mt-1 hidden text-[0.75rem] leading-4 text-(--app-text-subtle) sm:mt-1.5 sm:block">{helper}</p> : null}
    </div>
  )
}

function CountUp({ value, suffix = '', duration = 1600 }: { value: number; suffix?: string; duration?: number }) {
  const shouldReduceMotion = useReducedMotion()
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    if (shouldReduceMotion) {
      return
    }

    let raf = 0
    let start: number | undefined

    const tick = (timestamp: number) => {
      if (start === undefined) {
        start = timestamp
      }

      const progress = Math.min(1, (timestamp - start) / duration)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(value * eased))

      if (progress < 1) {
        raf = requestAnimationFrame(tick)
      }
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, duration, shouldReduceMotion])

  const shown = shouldReduceMotion ? value : display

  return (
    <>
      {shown}
      {suffix}
    </>
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
    <div className="flex flex-col gap-3 rounded-card border border-(--app-border) bg-(--app-surface) p-4">
      <span className="flex size-10 items-center justify-center rounded-card bg-primary-50 text-primary-600 dark:bg-primary-500/12 dark:text-primary-300">
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

const avatarColors = ['bg-[#4869b6]', 'bg-[#7a5cc0]', 'bg-[#b0722f]', 'bg-[#1f9d61]', 'bg-[#c0395f]', 'bg-[#0e8a86]'] as const

const stageAccentClassName = {
  applied: 'border-primary-200 bg-primary-50 text-primary-700 dark:border-primary-500/20 dark:bg-primary-500/12 dark:text-primary-200',
  screen: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-400/20 dark:bg-violet-400/12 dark:text-violet-200',
  interview: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/12 dark:text-amber-200',
  hired: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/12 dark:text-emerald-200',
  rejected: 'border-(--app-border) bg-(--app-surface-muted) text-(--app-text-subtle)'
} as const

function stageAccent(stageCode: string | null, stageName: string | null): keyof typeof stageAccentClassName {
  const value = `${stageCode ?? ''} ${stageName ?? ''}`.toLowerCase()

  if (value.includes('reject') || value.includes('descart')) {
    return 'rejected'
  }

  if (value.includes('hired') || value.includes('contrat')) {
    return 'hired'
  }

  if (value.includes('interview') || value.includes('entrevista')) {
    return 'interview'
  }

  if (value.includes('screen') || value.includes('presele')) {
    return 'screen'
  }

  return 'applied'
}

function ApplicationRow({ application, index }: { application: DashboardRecentApplication; index: number }) {
  const accent = stageAccent(application.stageCode, application.stageName)

  return (
    <tr className="rounded-control transition-colors hover:bg-(--app-surface-muted)">
      <td className="rounded-l-control px-3 py-2">
        <div className="flex items-center gap-2.5">
          <UserAvatar
            name={application.candidateName}
            avatarPath={application.avatarPath}
            className="size-8"
            fallbackClassName={cn('text-white', avatarColors[index % avatarColors.length])}
            textClassName="text-[11px] font-bold"
          />
          <span className="max-w-45 truncate font-semibold text-(--app-text)">{application.candidateName}</span>
        </div>
      </td>
      <td className="max-w-54 truncate px-3 py-2 text-(--app-text-muted)">{application.position}</td>
      <td className="px-3 py-2">
        {application.stageName ? (
          <span className={cn('inline-flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-[0.72rem] font-semibold', stageAccentClassName[accent])}>
            <span className="size-1.5 rounded-full bg-current" />
            {application.stageName}
          </span>
        ) : (
          <span className="text-(--app-text-subtle)">—</span>
        )}
      </td>
      <td className="px-3 py-2 text-right">
        {application.score !== null ? (
          <Badge className="font-bold tabular-nums" variant={scoreVariant(application.score)}>
            {application.score}%
          </Badge>
        ) : (
          <span className="text-(--app-text-subtle)">—</span>
        )}
      </td>
      <td className="rounded-r-control px-3 py-2 text-right text-[0.82rem] tabular-nums text-(--app-text-muted)">{relativeTime(application.submittedAt)}</td>
    </tr>
  )
}

const activityAccentClassName: Record<'apply' | 'rate' | 'note', string> = {
  apply: 'bg-primary-50 text-primary-700 dark:bg-primary-500/16 dark:text-primary-200',
  rate: 'bg-amber-50 text-amber-700 dark:bg-amber-400/12 dark:text-amber-200',
  note: 'bg-violet-50 text-violet-700 dark:bg-violet-400/14 dark:text-violet-200'
} as const

function ActivitySummaryPanel({
  isLoading,
  activity,
  onOpenFullActivity
}: {
  isLoading: boolean
  activity: DashboardActivityItem[]
  onOpenFullActivity: () => void
}) {
  const [filter, setFilter] = useState<ActivityFilter>('all')
  const counts = useMemo(() => activityCounts(activity), [activity])
  const visibleActivity = useMemo(
    () => (filter === 'all' ? activity : activity.filter((item) => item.kind === filter)),
    [activity, filter]
  )
  const groups = useMemo(() => groupActivity(visibleActivity), [visibleActivity])

  return (
    <Card className="flex min-h-96 overflow-hidden p-0 xl:max-h-[calc(100vh-18rem)]">
      <div className="flex min-h-0 flex-1 flex-col">
        <CardHeader className="flex flex-row items-start justify-between gap-3 px-4 pt-4 sm:px-5">
          <div className="min-w-0">
            <CardTitle>Actividad</CardTitle>
            <CardDescription>Últimos eventos de tu proceso de selección.</CardDescription>
          </div>
          <label className="relative shrink-0">
            <span className="sr-only">Filtrar actividad</span>
            <Select
              value={filter}
              onChange={(event) => setFilter(event.target.value as ActivityFilter)}
              className="h-9 w-38 appearance-none rounded-control py-0 pr-8 text-[0.78rem] font-semibold text-(--app-text-muted)"
            >
              {ACTIVITY_FILTERS.map((option) => {
                const count = option.value === 'all' ? counts.total : counts[option.value]

                return (
                  <option key={option.value} value={option.value}>
                    {option.label} {isLoading ? '' : `(${count})`}
                  </option>
                )
              })}
            </Select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-(--app-text-subtle)" />
          </label>
        </CardHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 pt-2 sm:px-4">
          {isLoading ? (
            <div className="px-1 pt-2">
              <LoadingRow label="Cargando actividad..." />
            </div>
          ) : visibleActivity.length > 0 ? (
            <div className="space-y-1">
              {groups.map((group) => (
                <ActivitySummaryGroup key={`${group.bucket}-${group.items[0]?.id}`} group={group} />
              ))}
            </div>
          ) : (
            <EmptyState title="Sin actividad" description="Cuando tu equipo trabaje el pipeline, lo verás aquí." />
          )}
        </div>

        <div className="border-t border-(--app-border) px-4 py-3 sm:px-5">
          <Button variant="ghost" className="h-9 w-full rounded-full text-xs" onClick={onOpenFullActivity}>
            Ver toda la actividad
            <ChevronRight className="size-3.5" />
          </Button>
        </div>
      </div>
    </Card>
  )
}

function ActivitySummaryGroup({
  group
}: {
  group: { bucket: ActivityBucket; count: number; items: DashboardActivityItem[] }
}) {
  return (
    <div>
      <div className="flex items-center gap-2.5 px-1 py-2 text-[0.68rem] font-bold uppercase tracking-[0.06em] text-(--app-text-subtle)">
        <span>{ACTIVITY_BUCKET_LABELS[group.bucket]}</span>
        <span className="text-[0.72rem] font-semibold normal-case tracking-normal">· {group.count}</span>
        <span className="h-px flex-1 bg-(--app-border)" />
      </div>
      <ol className="space-y-0.5">
        {group.items.map((item) => (
          <ActivitySummaryRow key={item.id} item={item} />
        ))}
      </ol>
    </div>
  )
}

function ActivitySummaryRow({ item }: { item: DashboardActivityItem }) {
  const meta = ACTIVITY_KIND_META[item.kind]
  const Icon = meta.icon

  return (
    <li className="flex items-start gap-3 rounded-control px-2 py-2 transition-colors hover:bg-(--app-surface-muted)">
      <span className={cn('mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-control', activityAccentClassName[meta.accent])}>
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[0.84rem] leading-5 text-(--app-text-muted)">
          <span className="font-semibold text-(--app-text)">{item.candidateName}</span> {item.summary}
        </p>
        <p className="mt-0.5 truncate text-[0.76rem] text-(--app-text-subtle)">{item.jobTitle}</p>
      </div>
      <span className="shrink-0 pt-0.5 text-[0.72rem] tabular-nums text-(--app-text-subtle)">{relativeTime(item.occurredAt)}</span>
    </li>
  )
}
