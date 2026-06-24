import { useMemo, useState, type ReactNode } from 'react'

import { useQuery } from '@tanstack/react-query'
import { motion, useReducedMotion } from 'motion/react'
import { Activity, FileText, MoreVertical, Star, UserPlus } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { useAppSession } from '@/app/providers/app-session-provider'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Spinner } from '@/components/ui/loader'
import { fetchWorkspaceDashboardMetrics, type DashboardActivityItem } from '@/features/dashboard/lib/dashboard-api'
import { useRealtimeSync } from '@/lib/realtime/use-realtime-sync'
import { cardReveal, gridStagger, pageStagger } from '@/shared/ui/card-motion'
import { cn } from '@/lib/utils/cn'

function relativeTime(value: string) {
  const minutes = Math.round((Date.now() - new Date(value).getTime()) / 60000)
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
  return `hace ${Math.round(hours / 24)} d`
}

type ActivityKind = DashboardActivityItem['kind']
type ActivityFilter = 'all' | ActivityKind

const KIND_META: Record<ActivityKind, { icon: LucideIcon; label: string; badge: string }> = {
  application: {
    icon: UserPlus,
    label: 'Aplicación',
    badge: 'bg-sky-50 text-sky-700 dark:bg-sky-500/12 dark:text-sky-300'
  },
  rating: {
    icon: Star,
    label: 'Calificación',
    badge: 'bg-violet-50 text-violet-700 dark:bg-violet-500/12 dark:text-violet-300'
  },
  note: {
    icon: FileText,
    label: 'Nota',
    badge: 'bg-amber-50 text-amber-700 dark:bg-amber-500/12 dark:text-amber-300'
  }
}

const FILTER_TABS: { value: ActivityFilter; label: string }[] = [
  { value: 'all', label: 'Todo' },
  { value: 'application', label: 'Aplicaciones' },
  { value: 'rating', label: 'Calificaciones' },
  { value: 'note', label: 'Notas' }
]

export function WorkspaceActivityPage() {
  const session = useAppSession()
  const shouldReduceMotion = useReducedMotion()
  const tenantId = session.activeTenantId
  const [filter, setFilter] = useState<ActivityFilter>('all')
  const [sort, setSort] = useState<'recent' | 'oldest'>('recent')

  const dashboardKey = ['workspace', 'dashboard', tenantId] as const
  const metricsQuery = useQuery({
    queryKey: dashboardKey,
    enabled: Boolean(tenantId),
    queryFn: async () => fetchWorkspaceDashboardMetrics(tenantId!)
  })

  // En vivo: la actividad se actualiza sola cuando entran postulaciones, notas o
  // calificaciones de cualquier miembro del equipo. RLS acota los eventos al tenant.
  useRealtimeSync(
    'workspace-activity',
    [
      { table: 'applications', invalidate: [dashboardKey] },
      { table: 'application_notes', invalidate: [dashboardKey] },
      { table: 'application_ratings', invalidate: [dashboardKey] },
      { table: 'application_stage_history', invalidate: [dashboardKey] }
    ],
    { enabled: Boolean(tenantId) }
  )

  const activity = useMemo(() => metricsQuery.data?.recentActivity ?? [], [metricsQuery.data])

  const counts = useMemo(
    () => ({
      total: activity.length,
      application: activity.filter((item) => item.kind === 'application').length,
      rating: activity.filter((item) => item.kind === 'rating').length,
      note: activity.filter((item) => item.kind === 'note').length
    }),
    [activity]
  )

  const visibleActivity = useMemo(() => {
    const filtered = filter === 'all' ? activity : activity.filter((item) => item.kind === filter)
    return [...filtered].sort((a, b) => {
      const diff = new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
      return sort === 'recent' ? diff : -diff
    })
  }, [activity, filter, sort])

  if (!tenantId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No tienes un workspace operativo activo</CardTitle>
          <CardDescription>La actividad se habilita para tenants aprobados con acceso de reclutamiento.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <motion.div
      className="space-y-6"
      variants={pageStagger}
      initial={shouldReduceMotion ? false : 'hidden'}
      animate="show"
    >
      <motion.div variants={cardReveal}>
        <h1 className="text-xl font-semibold tracking-tight text-(--app-text) sm:text-[1.6rem]">Mi actividad</h1>
        <p className="mt-1 text-sm text-(--app-text-muted)">Eventos recientes de tu pipeline de reclutamiento.</p>
      </motion.div>

      <motion.div variants={gridStagger} className="grid gap-3 sm:grid-cols-3">
        <motion.div variants={cardReveal} className="h-full">
          <ActivityStatCard
            icon={UserPlus}
            accent="sky"
            label="Aplicaciones"
            value={metricsQuery.isLoading ? '—' : counts.application}
            helper="Últimos 30 días"
          />
        </motion.div>
        <motion.div variants={cardReveal} className="h-full">
          <ActivityStatCard
            icon={Star}
            accent="violet"
            label="Calificaciones"
            value={metricsQuery.isLoading ? '—' : counts.rating}
            helper="Últimos 30 días"
          />
        </motion.div>
        <motion.div variants={cardReveal} className="h-full">
          <ActivityStatCard
            icon={Activity}
            accent="emerald"
            label="Actividad total"
            value={metricsQuery.isLoading ? '—' : counts.total}
            helper="Últimos 30 días"
          />
        </motion.div>
      </motion.div>

      <motion.div variants={cardReveal}>
        <Card>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-1.5">
              {FILTER_TABS.map((tab) => {
                const isActive = filter === tab.value
                return (
                  <button
                    key={tab.value}
                    type="button"
                    onClick={() => setFilter(tab.value)}
                    className={cn(
                      'inline-flex h-8 items-center rounded-full px-3 text-[0.8rem] font-medium transition-colors',
                      isActive
                        ? 'bg-primary-600 text-white'
                        : 'text-(--app-text-muted) hover:bg-(--app-surface-muted) hover:text-(--app-text)'
                    )}
                  >
                    {tab.label}
                  </button>
                )
              })}
            </div>
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as 'recent' | 'oldest')}
              className="h-8 rounded-full border border-(--app-border) bg-(--app-surface) px-3 text-[0.8rem] font-medium text-(--app-text-muted) outline-none transition-colors hover:text-(--app-text) focus-visible:ring-2 focus-visible:ring-(--app-ring)"
            >
              <option value="recent">Más recientes</option>
              <option value="oldest">Más antiguos</option>
            </select>
          </div>

          <div className="mt-4">
            {metricsQuery.isLoading ? (
              <div className="flex items-center gap-2.5 text-sm text-(--app-text-muted)">
                <Spinner size="sm" /> Cargando actividad…
              </div>
            ) : visibleActivity.length > 0 ? (
              <ol>
                {visibleActivity.map((item, index) => (
                  <ActivityRow key={item.id} item={item} isLast={index === visibleActivity.length - 1} />
                ))}
              </ol>
            ) : (
              <EmptyState
                title="Sin actividad"
                description="Cuando trabajes el pipeline, tu actividad reciente aparecerá aquí."
              />
            )}
          </div>
        </Card>
      </motion.div>
    </motion.div>
  )
}

const accentClassName = {
  sky: 'bg-sky-50 text-sky-600 dark:bg-sky-500/12 dark:text-sky-300',
  violet: 'bg-violet-50 text-violet-600 dark:bg-violet-500/12 dark:text-violet-300',
  emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/12 dark:text-emerald-300'
} as const

function ActivityStatCard({
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
      <p className="mt-2 text-[1.4rem] font-semibold tracking-tight text-(--app-text)">{value}</p>
      {helper ? <p className="mt-1 text-[0.72rem] leading-4 text-(--app-text-muted)">{helper}</p> : null}
    </div>
  )
}

function ActivityRow({ item, isLast }: { item: DashboardActivityItem; isLast: boolean }) {
  const meta = KIND_META[item.kind]
  const Icon = meta.icon
  return (
    <li className="flex gap-3">
      <div className="flex flex-col items-center">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-(--app-surface-muted) text-(--app-text-muted)">
          <Icon className="size-4" />
        </span>
        {!isLast ? <span className="my-1 w-px flex-1 bg-(--app-border)" /> : null}
      </div>
      <div className={cn('flex flex-1 items-start justify-between gap-3', isLast ? 'pb-1' : 'pb-5')}>
        <p className="min-w-0 pt-1.5 text-sm leading-5 text-(--app-text)">
          <span className="font-semibold">{item.candidateName}</span> {item.summary}
        </p>
        <div className="flex shrink-0 items-center gap-2.5 pt-1">
          <span className={cn('hidden rounded-full px-2.5 py-1 text-[0.7rem] font-semibold sm:inline-flex', meta.badge)}>
            {meta.label}
          </span>
          <span className="whitespace-nowrap text-[0.72rem] text-(--app-text-subtle)">{relativeTime(item.occurredAt)}</span>
          <button
            type="button"
            className="flex size-7 items-center justify-center rounded-lg text-(--app-text-subtle) transition-colors hover:bg-(--app-surface-muted) hover:text-(--app-text)"
            aria-label="Más acciones"
          >
            <MoreVertical className="size-4" />
          </button>
        </div>
      </div>
    </li>
  )
}
