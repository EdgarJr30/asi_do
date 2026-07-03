import { useMemo, useRef, useState, type ReactNode } from 'react'

import { useQuery } from '@tanstack/react-query'
import { motion, useReducedMotion } from 'motion/react'
import { Activity, BriefcaseBusiness, ChevronLeft, ChevronRight, Clipboard, Eye, FileText, Star, UserPlus } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { toast } from 'sonner'

import { useAppSession } from '@/app/providers/app-session-provider'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { KebabMenu, KebabMenuItem } from '@/components/ui/kebab-menu'
import { Spinner } from '@/components/ui/loader'
import { fetchWorkspaceDashboardMetrics, type DashboardActivityItem } from '@/features/dashboard/lib/dashboard-api'
import { useRealtimeSync } from '@/lib/realtime/use-realtime-sync'
import { cardReveal, pageStagger } from '@/shared/ui/card-motion'
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
type ActivityBucket = 'today' | 'week' | 'older'

const KIND_META: Record<
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

const PAGE_SIZE = 12

const FILTER_TABS: { value: ActivityFilter; label: string }[] = [
  { value: 'all', label: 'Todo' },
  { value: 'application', label: 'Aplicaciones' },
  { value: 'rating', label: 'Calificaciones' },
  { value: 'note', label: 'Notas' }
]

const BUCKET_LABELS: Record<ActivityBucket, string> = {
  today: 'Hoy',
  week: 'Esta semana',
  older: 'Anteriores'
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

export function WorkspaceActivityPage() {
  const session = useAppSession()
  const shouldReduceMotion = useReducedMotion()
  const tenantId = session.activeTenantId
  const pageTopRef = useRef<HTMLDivElement>(null)
  const [filter, setFilter] = useState<ActivityFilter>('all')
  const [sort, setSort] = useState<'recent' | 'oldest'>('recent')
  const [page, setPage] = useState(1)

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

  const totalPages = Math.max(1, Math.ceil(visibleActivity.length / PAGE_SIZE))

  const boundedPage = Math.min(page, totalPages)

  const pagedActivity = useMemo(
    () => visibleActivity.slice((boundedPage - 1) * PAGE_SIZE, boundedPage * PAGE_SIZE),
    [visibleActivity, boundedPage]
  )

  const bucketCounts = useMemo(
    () =>
      visibleActivity.reduce<Record<ActivityBucket, number>>(
        (acc, item) => {
          acc[getActivityBucket(item.occurredAt)] += 1
          return acc
        },
        { today: 0, week: 0, older: 0 }
      ),
    [visibleActivity]
  )

  const groupedPagedActivity = useMemo(() => {
    const groups: Array<{ bucket: ActivityBucket; items: DashboardActivityItem[] }> = []

    for (const item of pagedActivity) {
      const bucket = getActivityBucket(item.occurredAt)
      const previous = groups.at(-1)

      if (previous?.bucket === bucket) {
        previous.items.push(item)
      } else {
        groups.push({ bucket, items: [item] })
      }
    }

    return groups
  }, [pagedActivity])

  const firstVisibleItem = visibleActivity.length === 0 ? 0 : (boundedPage - 1) * PAGE_SIZE + 1
  const lastVisibleItem = Math.min(boundedPage * PAGE_SIZE, visibleActivity.length)

  function scrollToPageTop() {
    pageTopRef.current?.scrollIntoView({ behavior: shouldReduceMotion ? 'auto' : 'smooth', block: 'start' })
  }

  function goToPage(nextPage: number) {
    setPage(nextPage)
    window.setTimeout(scrollToPageTop, 0)
  }

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
      ref={pageTopRef}
      className="w-full space-y-6 pb-8"
      variants={pageStagger}
      initial={shouldReduceMotion ? false : 'hidden'}
      animate="show"
    >
      <motion.div variants={cardReveal}>
        <h1 className="text-[1.55rem] font-bold leading-[1.1] tracking-tight text-(--app-text) sm:text-[1.625rem]">Actividad</h1>
        <p className="mt-1.5 text-[0.9rem] text-(--app-text-muted)">Todos los eventos de tu proceso de selección.</p>
      </motion.div>

      <motion.div
        variants={cardReveal}
        className="grid overflow-hidden rounded-control border border-[#e9edf5] bg-white shadow-[0_1px_2px_rgba(20,40,90,0.04),0_4px_16px_rgba(20,40,90,0.05)] dark:border-white/10 dark:bg-(--app-surface-elevated)"
      >
        <div className="grid sm:grid-cols-3">
          <ActivityStatCell
            icon={UserPlus}
            accent="apply"
            label="Aplicaciones"
            value={metricsQuery.isLoading ? '—' : counts.application}
          />
          <ActivityStatCell
            icon={Star}
            accent="rate"
            label="Calificaciones"
            value={metricsQuery.isLoading ? '—' : counts.rating}
          />
          <ActivityStatCell
            icon={Activity}
            accent="total"
            label="Actividad total"
            value={metricsQuery.isLoading ? '—' : counts.total}
          />
        </div>
      </motion.div>

      <motion.section variants={cardReveal} aria-labelledby="workspace-activity-feed">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div
            className="inline-flex w-full flex-wrap items-center gap-1 rounded-control bg-[#eef1f7] p-1 sm:w-auto dark:bg-white/8"
            aria-label="Filtrar actividad"
            role="tablist"
          >
            {FILTER_TABS.map((tab) => {
              const isActive = filter === tab.value
              const count = tab.value === 'all' ? counts.total : counts[tab.value]
              return (
                <button
                  key={tab.value}
                  type="button"
                  aria-selected={isActive}
                  role="tab"
                  onClick={() => {
                    setFilter(tab.value)
                    setPage(1)
                  }}
                  className={cn(
                    'inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-control px-3 text-[0.84rem] font-semibold transition-[background-color,color,box-shadow] sm:flex-none',
                    isActive
                      ? 'bg-white text-[#2d52a8] shadow-[0_1px_2px_rgba(20,40,90,0.04),0_4px_16px_rgba(20,40,90,0.05)] dark:bg-white/12 dark:text-primary-200'
                      : 'text-[#5a6987] hover:text-(--app-text) dark:text-(--app-text-muted)'
                  )}
                >
                  {tab.label}
                  <span
                    className={cn(
                      'inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1.5 text-[0.68rem] font-bold',
                      isActive
                        ? 'bg-[#eef3fc] text-[#2d52a8] dark:bg-primary-500/20 dark:text-primary-200'
                        : 'bg-[rgba(90,105,135,0.16)] text-[#5a6987] dark:bg-white/10 dark:text-(--app-text-muted)'
                    )}
                  >
                    {metricsQuery.isLoading ? '—' : count}
                  </span>
                </button>
              )
            })}
          </div>
          <label className="relative inline-flex w-full sm:w-auto">
            <span className="sr-only">Ordenar actividad</span>
            <select
              value={sort}
              onChange={(event) => {
                setSort(event.target.value as 'recent' | 'oldest')
                setPage(1)
              }}
              className="h-10 w-full appearance-none rounded-control border border-[#e9edf5] bg-white px-3.5 pr-9 text-[0.84rem] font-semibold text-[#5a6987] outline-none transition-colors hover:border-[#cdd6e8] focus-visible:ring-2 focus-visible:ring-(--app-ring) sm:w-44 dark:border-white/10 dark:bg-(--app-surface-elevated) dark:text-(--app-text-muted)"
            >
              <option value="recent">Más recientes</option>
              <option value="oldest">Más antiguos</option>
            </select>
            <ChevronRight aria-hidden className="pointer-events-none absolute right-3 top-1/2 size-3.5 -translate-y-1/2 rotate-90 text-[#8b97b0]" />
          </label>
        </div>

        <div className="mt-5">
          {metricsQuery.isLoading ? (
            <div className="flex items-center gap-2.5 rounded-control border border-dashed border-[#e9edf5] bg-white px-4 py-5 text-sm text-(--app-text-muted) dark:border-white/10 dark:bg-(--app-surface-elevated)">
              <Spinner size="sm" /> Cargando actividad…
            </div>
          ) : visibleActivity.length > 0 ? (
            <>
              <h2 id="workspace-activity-feed" className="sr-only">
                Timeline de actividad
              </h2>
              <div className="space-y-1">
                {groupedPagedActivity.map((group) => (
                  <ActivityDayGroup key={`${group.bucket}-${group.items[0]?.id}`} bucket={group.bucket} count={bucketCounts[group.bucket]} items={group.items} />
                ))}
              </div>
              <div className="mt-5 flex flex-col gap-4 border-t border-[#f0f3f9] pt-4 sm:flex-row sm:items-center sm:justify-between dark:border-white/10">
                <p className="text-[0.84rem] text-[#8b97b0] dark:text-(--app-text-subtle)">
                  Mostrando <b className="font-semibold text-[#5a6987] dark:text-(--app-text-muted)">{firstVisibleItem}-{lastVisibleItem}</b> de{' '}
                  <b className="font-semibold text-[#5a6987] dark:text-(--app-text-muted)">{visibleActivity.length}</b> eventos
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => goToPage(Math.max(1, boundedPage - 1))}
                    disabled={boundedPage <= 1}
                    className="inline-flex h-9 items-center gap-1.5 rounded-control border border-[#e9edf5] bg-white px-3 text-[0.84rem] font-semibold text-[#5a6987] transition-colors hover:border-[#cdd6e8] hover:text-(--app-text) disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-(--app-surface-elevated) dark:text-(--app-text-muted)"
                  >
                    <ChevronLeft className="size-4" /> Anterior
                  </button>
                  <span className="px-1 text-[0.84rem] text-[#8b97b0] dark:text-(--app-text-subtle)">
                    Página <b className="font-semibold text-(--app-text)">{boundedPage}</b> de {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => goToPage(Math.min(totalPages, boundedPage + 1))}
                    disabled={boundedPage >= totalPages}
                    className="inline-flex h-9 items-center gap-1.5 rounded-control border border-[#e9edf5] bg-white px-3 text-[0.84rem] font-semibold text-[#5a6987] transition-colors hover:border-[#cdd6e8] hover:text-(--app-text) disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-(--app-surface-elevated) dark:text-(--app-text-muted)"
                  >
                    Siguiente <ChevronRight className="size-4" />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <ActivityEmptyState />
          )}
        </div>
      </motion.section>
    </motion.div>
  )
}

const accentClassName: Record<'apply' | 'rate' | 'note' | 'total', string> = {
  apply: 'bg-[#eef4ff] text-[#2d52a8] dark:bg-primary-500/16 dark:text-primary-200',
  rate: 'bg-[#fff5e6] text-[#b06a00] dark:bg-amber-400/12 dark:text-amber-200',
  note: 'bg-[#f1ecff] text-[#6b46c1] dark:bg-violet-400/14 dark:text-violet-200',
  total: 'bg-[#e9f7ef] text-[#1f9d61] dark:bg-emerald-400/12 dark:text-emerald-200'
} as const

function ActivityStatCell({
  icon: Icon,
  accent,
  label,
  value
}: {
  icon: LucideIcon
  accent: keyof typeof accentClassName
  label: ReactNode
  value: ReactNode
}) {
  return (
    <div className="relative flex items-center gap-3.5 border-t border-[#e9edf5] px-5 py-4 first:border-t-0 sm:border-l sm:border-t-0 sm:first:border-l-0 dark:border-white/10">
      <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-control', accentClassName[accent])}>
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="text-2xl font-bold leading-none tracking-tight text-(--app-text)">{value}</p>
        <p className="mt-1 text-[0.78rem] text-[#8b97b0] dark:text-(--app-text-subtle)">
          {label} · <b className="font-semibold text-[#5a6987] dark:text-(--app-text-muted)">últimos 30 días</b>
        </p>
      </div>
    </div>
  )
}

function ActivityDayGroup({ bucket, count, items }: { bucket: ActivityBucket; count: number; items: DashboardActivityItem[] }) {
  return (
    <div>
      <div className="flex items-center gap-2.5 px-1 py-2 text-[0.72rem] font-bold uppercase tracking-[0.06em] text-[#8b97b0] dark:text-(--app-text-subtle)">
        <span>{BUCKET_LABELS[bucket]}</span>
        <span className="text-xs font-semibold normal-case tracking-normal">· {count}</span>
        <span className="h-px flex-1 bg-[#f0f3f9] dark:bg-white/10" />
      </div>
      <ol className="space-y-0.5">
        {items.map((item) => (
          <ActivityRow key={item.id} item={item} />
        ))}
      </ol>
    </div>
  )
}

function ActivityRow({ item }: { item: DashboardActivityItem }) {
  const meta = KIND_META[item.kind]
  const Icon = meta.icon

  async function copyActivityLink() {
    try {
      const url =
        typeof window === 'undefined'
          ? ''
          : `${window.location.origin}${window.location.pathname}${window.location.search}#${item.id}`

      await navigator.clipboard.writeText(url)
      toast.success('Enlace de actividad copiado', {
        description: 'Ya puedes compartir este evento con tu equipo.'
      })
    } catch {
      toast.error('No pudimos copiar el enlace', {
        description: 'Tu navegador bloqueó el acceso al portapapeles. Inténtalo de nuevo.'
      })
    }
  }

  return (
    <li
      id={item.id}
      className="group scroll-mt-24 flex items-center gap-3.5 rounded-control px-3 py-2.5 transition-[background-color,box-shadow] duration-150 hover:bg-white hover:shadow-[0_1px_2px_rgba(20,40,90,0.04),0_4px_16px_rgba(20,40,90,0.05)] dark:hover:bg-white/6"
    >
      <span className={cn('flex size-[38px] shrink-0 items-center justify-center rounded-control', accentClassName[meta.accent])}>
        <Icon className="size-[19px]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[0.9rem] leading-snug text-[#5a6987] dark:text-(--app-text-muted)">
          <b className="font-semibold text-[#18223b] dark:text-(--app-text)">{item.candidateName}</b> {item.summary}
        </p>
        <div className="mt-0.5 flex min-w-0 items-center gap-2 text-[0.8rem]">
          <span className={cn('inline-flex h-[19px] shrink-0 items-center rounded-full px-2 text-[0.72rem] font-semibold', accentClassName[meta.accent])}>
            {meta.label}
          </span>
          <span className="min-w-0 truncate font-medium text-[#5a6987] dark:text-(--app-text-muted)">{item.jobTitle}</span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <span className="hidden whitespace-nowrap text-[0.78rem] text-[#8b97b0] sm:inline dark:text-(--app-text-subtle)">{relativeTime(item.occurredAt)}</span>
        <span className="opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
          <KebabMenu className="size-8 rounded-control" label={`Acciones para ${item.candidateName}`}>
            <KebabMenuItem>
              <Eye className="mr-2 size-4 text-(--app-text-subtle)" />
              Ver detalle
            </KebabMenuItem>
            <KebabMenuItem>
              <BriefcaseBusiness className="mr-2 size-4 text-(--app-text-subtle)" />
              Ir a la vacante
            </KebabMenuItem>
            <KebabMenuItem onClick={() => void copyActivityLink()}>
              <Clipboard className="mr-2 size-4 text-(--app-text-subtle)" />
              Copiar enlace
            </KebabMenuItem>
          </KebabMenu>
        </span>
      </div>
    </li>
  )
}

function ActivityEmptyState() {
  return (
    <div className="px-4 py-14 text-center">
      <span className="mx-auto flex size-[54px] items-center justify-center rounded-card bg-[#eef3fc] text-[#2d52a8] dark:bg-primary-500/16 dark:text-primary-200">
        <Activity className="size-6" />
      </span>
      <h3 className="mt-4 text-[1.03rem] font-bold tracking-tight text-(--app-text)">Sin actividad todavía</h3>
      <p className="mx-auto mt-2 max-w-[300px] text-sm leading-6 text-[#5a6987] dark:text-(--app-text-muted)">
        Cuando trabajes el pipeline, tu actividad reciente aparecerá aquí.
      </p>
    </div>
  )
}
