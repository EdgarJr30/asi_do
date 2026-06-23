import { useMemo, useState, type ReactNode } from 'react'

import { useQuery } from '@tanstack/react-query'
import { motion, useReducedMotion } from 'motion/react'
import { Activity, CalendarClock, ChevronLeft, ChevronRight, ClipboardList, Search } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { useAppSession } from '@/app/providers/app-session-provider'
import { surfacePaths } from '@/app/router/surface-paths'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { KebabMenu, KebabMenuItem } from '@/components/ui/kebab-menu'
import { Select } from '@/components/ui/select'
import { Spinner } from '@/components/ui/loader'
import { fetchPipelineBoard } from '@/features/pipeline/lib/pipeline-api'
import { useRealtimeSync } from '@/lib/realtime/use-realtime-sync'
import { cardReveal, gridStagger, pageStagger } from '@/shared/ui/card-motion'
import { cn } from '@/lib/utils/cn'

const STATUS_META: Record<string, { label: string; pill: string }> = {
  submitted: { label: 'Aplicó', pill: 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300' },
  in_review: { label: 'En revisión', pill: 'bg-sky-50 text-sky-700 dark:bg-sky-500/12 dark:text-sky-300' },
  interviewing: { label: 'Entrevista', pill: 'bg-violet-50 text-violet-700 dark:bg-violet-500/12 dark:text-violet-300' },
  offer: { label: 'Oferta', pill: 'bg-amber-50 text-amber-700 dark:bg-amber-500/12 dark:text-amber-300' },
  hired: { label: 'Contratado', pill: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/12 dark:text-emerald-300' },
  rejected: { label: 'Descartado', pill: 'bg-rose-50 text-rose-700 dark:bg-rose-500/12 dark:text-rose-300' },
  withdrawn: { label: 'Retirado', pill: 'bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400' }
}

const APPLICATIONS_PAGE_SIZE = 9

function initialsFrom(value: string) {
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

function relativeDays(value: string) {
  const days = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 86_400_000))
  if (days === 0) {
    return 'hoy'
  }
  if (days === 1) {
    return 'hace 1 día'
  }
  return `hace ${days} días`
}

function submittedWithinDays(value: string, days: number) {
  return Date.now() - new Date(value).getTime() <= days * 86_400_000
}

export function WorkspaceApplicationsPage() {
  const session = useAppSession()
  const shouldReduceMotion = useReducedMotion()
  const tenantId = session.activeTenantId
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sort, setSort] = useState<'recent' | 'oldest'>('recent')
  const [page, setPage] = useState(0)

  const boardQuery = useQuery({
    queryKey: ['pipeline-board', tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => fetchPipelineBoard(tenantId!)
  })

  // En vivo: nuevas postulaciones y cambios de etapa aparecen sin recargar.
  useRealtimeSync(
    'workspace-applications',
    [
      { table: 'applications', invalidate: [['pipeline-board', tenantId]] },
      { table: 'application_stage_history', invalidate: [['pipeline-board', tenantId]] }
    ],
    { enabled: Boolean(tenantId) }
  )

  const applications = useMemo(() => boardQuery.data?.applications ?? [], [boardQuery.data])
  const stageNameById = useMemo(
    () => new Map((boardQuery.data?.stages ?? []).map((stage) => [stage.id, stage.name])),
    [boardQuery.data]
  )

  const stats = {
    total: applications.length,
    interviewing: applications.filter((application) => application.status_public === 'interviewing').length,
    recent: applications.filter((application) => submittedWithinDays(application.submitted_at, 7)).length
  }

  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return applications
      .filter((application) => {
        const matchesQuery =
          normalized.length === 0 ||
          application.candidate_display_name_snapshot.toLowerCase().includes(normalized) ||
          (application.job_posting?.title ?? '').toLowerCase().includes(normalized)
        const matchesStatus = statusFilter.length === 0 || application.status_public === statusFilter
        return matchesQuery && matchesStatus
      })
      .sort((left, right) => {
        const diff = new Date(right.submitted_at).getTime() - new Date(left.submitted_at).getTime()
        return sort === 'recent' ? diff : -diff
      })
  }, [applications, query, statusFilter, sort])

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / APPLICATIONS_PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const pageStart = safePage * APPLICATIONS_PAGE_SIZE
  const pageRows = filteredRows.slice(pageStart, pageStart + APPLICATIONS_PAGE_SIZE)
  const isLastPage = safePage >= pageCount - 1

  function resetToFirstPage() {
    setPage(0)
  }

  if (!tenantId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No tienes un workspace operativo activo</CardTitle>
          <CardDescription>Las aplicaciones se habilitan para tenants aprobados con acceso de reclutamiento.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const loading = boardQuery.isLoading

  return (
    <motion.div
      className="space-y-6"
      variants={pageStagger}
      initial={shouldReduceMotion ? false : 'hidden'}
      animate="show"
    >
      <motion.div variants={cardReveal}>
        <h1 className="text-[1.7rem] font-semibold tracking-tight text-(--app-text) sm:text-[2rem]">Aplicaciones</h1>
        <p className="mt-1 text-sm text-(--app-text-muted)">
          {stats.total} {stats.total === 1 ? 'postulación' : 'postulaciones'} en tus vacantes
        </p>
      </motion.div>

      <motion.div variants={gridStagger} className="grid gap-3 sm:grid-cols-3">
        <motion.div variants={cardReveal} className="h-full">
          <AppStatCard icon={ClipboardList} accent="sky" label="Total aplicaciones" value={loading ? '—' : stats.total} helper="En todas tus vacantes" />
        </motion.div>
        <motion.div variants={cardReveal} className="h-full">
          <AppStatCard icon={CalendarClock} accent="violet" label="En entrevista" value={loading ? '—' : stats.interviewing} helper="Candidatos en esta etapa" />
        </motion.div>
        <motion.div variants={cardReveal} className="h-full">
          <AppStatCard icon={Activity} accent="emerald" label="Últimos 7 días" value={loading ? '—' : stats.recent} helper="Nuevas postulaciones" />
        </motion.div>
      </motion.div>

      <motion.div variants={cardReveal} className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
        <div className="flex flex-1 items-center gap-2.5 rounded-2xl border border-(--app-border) bg-(--app-surface) px-3.5">
          <Search aria-hidden="true" className="size-4 text-(--app-text-subtle)" />
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              resetToFirstPage()
            }}
            placeholder="Buscar por candidato o posición..."
            className="h-11 w-full bg-transparent text-sm text-(--app-text) outline-none placeholder:text-(--app-text-subtle)"
          />
        </div>
        <Select
          className="lg:w-52"
          value={statusFilter}
          onChange={(event) => {
            setStatusFilter(event.target.value)
            resetToFirstPage()
          }}
        >
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_META).map(([value, meta]) => (
            <option key={value} value={value}>
              {meta.label}
            </option>
          ))}
        </Select>
        <Select className="lg:w-48" value={sort} onChange={(event) => setSort(event.target.value as 'recent' | 'oldest')}>
          <option value="recent">Más recientes</option>
          <option value="oldest">Más antiguas</option>
        </Select>
      </motion.div>

      <motion.div variants={cardReveal} className="space-y-3">
        <Card className="overflow-hidden">
          {loading ? (
            <div className="flex items-center gap-2.5 px-6 py-10 text-sm text-(--app-text-muted)">
              <Spinner size="sm" /> Cargando aplicaciones…
            </div>
          ) : filteredRows.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[44rem] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-(--app-border) bg-(--app-surface-muted) text-left text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-(--app-text-subtle)">
                    <th className="px-5 py-3 font-semibold">Candidato</th>
                    <th className="px-4 py-3 font-semibold">Posición</th>
                    <th className="px-4 py-3 font-semibold">Etapa</th>
                    <th className="px-4 py-3 font-semibold">Estado</th>
                    <th className="px-4 py-3 text-right font-semibold">Aplicó</th>
                    <th className="px-3 py-3 text-right font-semibold">
                      <span className="sr-only">Acciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((application) => {
                    const statusMeta = STATUS_META[application.status_public] ?? {
                      label: application.status_public,
                      pill: 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300'
                    }
                    const stageName = application.current_stage_id ? stageNameById.get(application.current_stage_id) : null

                    return (
                      <tr key={application.id} className="border-b border-(--app-border)/70 transition-colors last:border-0 hover:bg-(--app-surface-muted)/50">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-(--app-surface-muted) text-[11px] font-semibold text-(--app-text-muted)">
                              {initialsFrom(application.candidate_display_name_snapshot)}
                            </span>
                            <span className="truncate font-medium text-(--app-text)">{application.candidate_display_name_snapshot}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-(--app-text-muted)">{application.job_posting?.title ?? 'Vacante'}</td>
                        <td className="px-4 py-3.5">
                          {stageName ? (
                            <span className="inline-flex items-center rounded-full bg-(--app-surface-muted) px-2.5 py-1 text-[0.72rem] font-medium text-(--app-text-muted)">
                              {stageName}
                            </span>
                          ) : (
                            <span className="text-(--app-text-subtle)">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-[0.72rem] font-semibold', statusMeta.pill)}>
                            {statusMeta.label}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right tabular-nums text-(--app-text-muted)">{relativeDays(application.submitted_at)}</td>
                        <td className="px-3 py-3.5">
                          <div className="flex justify-end">
                            <KebabMenu>
                              <KebabMenuItem to={surfacePaths.workspace.pipeline}>Ver en pipeline</KebabMenuItem>
                            </KebabMenu>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-4">
              <EmptyState title="Sin aplicaciones" description="Aún no hay postulaciones que coincidan con este criterio." />
            </div>
          )}
        </Card>

        {!loading && filteredRows.length > 0 ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-(--app-text-muted)">
              Mostrando {pageStart + 1} a {Math.min(pageStart + APPLICATIONS_PAGE_SIZE, filteredRows.length)} de {filteredRows.length}{' '}
              {filteredRows.length === 1 ? 'aplicación' : 'aplicaciones'}
            </p>
            {pageCount > 1 ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.max(0, current - 1))}
                  disabled={safePage === 0}
                  className="flex size-8 items-center justify-center rounded-lg border border-(--app-border) text-(--app-text-muted) transition-colors hover:text-(--app-text) disabled:opacity-40"
                  aria-label="Página anterior"
                >
                  <ChevronLeft className="size-4" />
                </button>
                {Array.from({ length: pageCount }).map((_, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setPage(index)}
                    className={cn(
                      'flex size-8 items-center justify-center rounded-lg text-[0.8rem] font-medium transition-colors',
                      index === safePage
                        ? 'bg-primary-600 text-white'
                        : 'text-(--app-text-muted) hover:bg-(--app-surface-muted) hover:text-(--app-text)'
                    )}
                  >
                    {index + 1}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}
                  disabled={isLastPage}
                  className="flex size-8 items-center justify-center rounded-lg border border-(--app-border) text-(--app-text-muted) transition-colors hover:text-(--app-text) disabled:opacity-40"
                  aria-label="Página siguiente"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </motion.div>
    </motion.div>
  )
}

const appAccentClassName = {
  sky: 'bg-sky-50 text-sky-600 dark:bg-sky-500/12 dark:text-sky-300',
  violet: 'bg-violet-50 text-violet-600 dark:bg-violet-500/12 dark:text-violet-300',
  emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/12 dark:text-emerald-300'
} as const

function AppStatCard({
  icon: Icon,
  accent,
  label,
  value,
  helper
}: {
  icon: LucideIcon
  accent: keyof typeof appAccentClassName
  label: ReactNode
  value: ReactNode
  helper?: ReactNode
}) {
  return (
    <div className="h-full rounded-panel border border-(--app-border) bg-(--app-surface-elevated) px-3.5 py-3 shadow-[0_10px_26px_rgba(10,18,36,0.06)] dark:shadow-[0_14px_30px_rgba(0,0,0,0.16)]">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-(--app-text-subtle)">{label}</p>
        <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-full', appAccentClassName[accent])}>
          <Icon className="size-4" />
        </span>
      </div>
      <p className="mt-2 text-[1.4rem] font-semibold tracking-tight text-(--app-text)">{value}</p>
      {helper ? <p className="mt-1 text-[0.72rem] leading-4 text-(--app-text-muted)">{helper}</p> : null}
    </div>
  )
}
