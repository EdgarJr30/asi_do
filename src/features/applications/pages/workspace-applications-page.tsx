import { useMemo, useState } from 'react'

import { useQuery } from '@tanstack/react-query'
import { motion, useReducedMotion } from 'motion/react'
import { Briefcase, KanbanSquare, Search, UserRound } from 'lucide-react'

import { useAppSession } from '@/app/providers/app-session-provider'
import { surfacePaths } from '@/app/router/surface-paths'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { KebabMenu, KebabMenuItem } from '@/components/ui/kebab-menu'
import { Pagination } from '@/components/ui/pagination'
import { Select } from '@/components/ui/select'
import { Spinner } from '@/components/ui/loader'
import { fetchPipelineBoard } from '@/features/pipeline/lib/pipeline-api'
import { useRealtimeSync } from '@/lib/realtime/use-realtime-sync'
import { cardReveal, gridStagger, pageStagger } from '@/shared/ui/card-motion'
import { cn } from '@/lib/utils/cn'

/** Etiqueta + color del punto/estado (columna "Estado"), alineado a los tokens del handoff. */
const STATUS_META: Record<string, { label: string; dot: string; text: string }> = {
  submitted: { label: 'Aplicó', dot: '#2d52a8', text: 'text-[#2d52a8] dark:text-[#9ec0ff]' },
  in_review: { label: 'En revisión', dot: '#1f7aa8', text: 'text-[#1f7aa8] dark:text-[#7cc4e6]' },
  interviewing: { label: 'En entrevista', dot: '#6b46c1', text: 'text-[#6b46c1] dark:text-[#c4b0f0]' },
  offer: { label: 'Oferta', dot: '#c5820f', text: 'text-[#c5820f] dark:text-[#f3c56a]' },
  hired: { label: 'Contratado', dot: '#1f9d61', text: 'text-[#1f9d61] dark:text-[#7ee1a8]' },
  rejected: { label: 'Descartado', dot: '#d2455f', text: 'text-[#d2455f] dark:text-[#f0a0b0]' },
  withdrawn: { label: 'Retirado', dot: '#8b97b0', text: 'text-(--app-text-subtle)' }
}

/** Chips de filtro por estado (incluye "Todas"). */
const STATUS_FILTERS: Array<{ key: string; label: string }> = [
  { key: '', label: 'Todas' },
  { key: 'submitted', label: 'Aplicó' },
  { key: 'in_review', label: 'En revisión' },
  { key: 'interviewing', label: 'En entrevista' },
  { key: 'hired', label: 'Contratado' },
  { key: 'rejected', label: 'Descartado' }
]

const APPLICATIONS_PAGE_SIZE = 10

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

/** Avatar alterna entre marca y morado para dar variedad visual como en el diseño. */
function avatarTint(id: string) {
  let hash = 0
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) % 2
  }
  return hash === 0
    ? 'bg-primary-50 text-primary-700 dark:bg-primary-500/12 dark:text-primary-200'
    : 'bg-[#f1ecff] text-[#6b46c1] dark:bg-[#6b46c1]/16 dark:text-[#c4b0f0]'
}

export function WorkspaceApplicationsPage() {
  const session = useAppSession()
  const shouldReduceMotion = useReducedMotion()
  const tenantId = session.activeTenantId
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sort, setSort] = useState<'recent' | 'oldest' | 'name'>('recent')
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

  const statusCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const application of applications) {
      counts.set(application.status_public, (counts.get(application.status_public) ?? 0) + 1)
    }
    return counts
  }, [applications])

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
        if (sort === 'name') {
          return left.candidate_display_name_snapshot.localeCompare(right.candidate_display_name_snapshot, 'es')
        }
        const diff = new Date(right.submitted_at).getTime() - new Date(left.submitted_at).getTime()
        return sort === 'recent' ? diff : -diff
      })
  }, [applications, query, statusFilter, sort])

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / APPLICATIONS_PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const pageStart = safePage * APPLICATIONS_PAGE_SIZE
  const pageRows = filteredRows.slice(pageStart, pageStart + APPLICATIONS_PAGE_SIZE)

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
      className="space-y-5"
      variants={pageStagger}
      initial={shouldReduceMotion ? false : 'hidden'}
      animate="show"
    >
      <motion.div variants={cardReveal} className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-(--app-text) sm:text-[1.6rem]">Aplicaciones</h1>
          <p className="mt-1 text-sm text-(--app-text-muted)">
            <b className="font-semibold text-(--app-text)">{stats.total}</b>{' '}
            {stats.total === 1 ? 'postulación' : 'postulaciones'} en tus vacantes
          </p>
        </div>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 lg:flex lg:shrink-0">
          <MetricChip dot="#2d52a8" value={loading ? '—' : stats.total} label="Total" />
          <MetricChip dot="#6b46c1" value={loading ? '—' : stats.interviewing} label="En entrevista" />
          <MetricChip dot="#1f9d61" value={loading ? '—' : stats.recent} label="Últimos 7 días" />
        </div>
      </motion.div>

      <motion.div variants={cardReveal} className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <div className="flex flex-1 items-center gap-2.5 rounded-control border border-(--app-border) bg-(--app-surface) px-3.5 transition-[border-color,box-shadow] focus-within:border-primary-600 focus-within:ring-3 focus-within:ring-primary-600/10">
          <Search aria-hidden="true" className="size-4 shrink-0 text-(--app-text-subtle)" />
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              resetToFirstPage()
            }}
            placeholder="Buscar por candidato o posición…"
            className="h-11 w-full bg-transparent text-sm text-(--app-text) outline-none placeholder:text-(--app-text-subtle)"
          />
        </div>
        <Select
          className="h-11 rounded-control sm:w-48"
          value={sort}
          onChange={(event) => setSort(event.target.value as 'recent' | 'oldest' | 'name')}
        >
          <option value="recent">Más recientes</option>
          <option value="oldest">Más antiguas</option>
          <option value="name">Nombre A–Z</option>
        </Select>
      </motion.div>

      <motion.div variants={cardReveal} className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((filter) => {
          const isActive = statusFilter === filter.key
          const count = filter.key === '' ? applications.length : statusCounts.get(filter.key) ?? 0
          return (
            <button
              key={filter.key || 'all'}
              type="button"
              aria-pressed={isActive}
              onClick={() => {
                setStatusFilter(filter.key)
                resetToFirstPage()
              }}
              className={cn(
                'inline-flex h-9 items-center gap-2 rounded-full px-3.5 text-[0.82rem] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--app-ring) focus-visible:ring-offset-2 focus-visible:ring-offset-(--app-canvas)',
                isActive
                  ? 'bg-(--app-text) text-(--app-canvas)'
                  : 'border border-(--app-border) bg-(--app-surface-elevated) text-(--app-text-muted) hover:border-(--app-text-subtle) hover:text-(--app-text)'
              )}
            >
              {filter.label}
              <span
                className={cn(
                  'text-[0.72rem] font-bold tabular-nums',
                  isActive ? 'text-(--app-canvas)/70' : 'text-(--app-text-subtle)'
                )}
              >
                {loading ? '·' : count}
              </span>
            </button>
          )
        })}
      </motion.div>

      <motion.div variants={cardReveal} className="space-y-3">
        <Card className="overflow-hidden rounded-card p-0 shadow-[0_1px_2px_rgba(20,40,90,0.04),0_4px_16px_rgba(20,40,90,0.05)]">
          <div className="hidden grid-cols-[minmax(0,2.2fr)_minmax(0,1.5fr)_1fr_1fr_0.9fr_2.5rem] items-center gap-4 border-b border-(--app-border) bg-(--app-surface-muted)/70 px-4 py-3 text-[0.7rem] font-bold uppercase tracking-[0.05em] text-(--app-text-subtle) lg:grid">
            <span>Candidato</span>
            <span className="hidden xl:block">Posición</span>
            <span className="hidden 2xl:block">Etapa</span>
            <span>Estado</span>
            <span className="text-right">Aplicó</span>
            <span className="sr-only">Acciones</span>
          </div>

          {loading ? (
            <div className="flex items-center gap-2.5 px-4 py-12 text-sm text-(--app-text-muted)">
              <Spinner size="sm" /> Cargando aplicaciones…
            </div>
          ) : filteredRows.length > 0 ? (
            <motion.ul
              variants={gridStagger}
              initial={shouldReduceMotion ? false : 'hidden'}
              animate="show"
              className="divide-y divide-(--app-border)"
            >
              {pageRows.map((application) => {
                const statusMeta = STATUS_META[application.status_public] ?? {
                  label: application.status_public,
                  dot: '#8b97b0',
                  text: 'text-(--app-text-subtle)'
                }
                const stageName = application.current_stage_id ? stageNameById.get(application.current_stage_id) : null
                const jobSlug = application.job_posting?.slug

                return (
                  <motion.li
                    key={application.id}
                    variants={cardReveal}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-3.5 transition-colors hover:bg-(--app-surface-muted)/55 lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1.5fr)_1fr_1fr_0.9fr_2.5rem] lg:gap-4"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className={cn(
                          'flex size-9 shrink-0 items-center justify-center rounded-full text-[0.78rem] font-bold',
                          avatarTint(application.id)
                        )}
                      >
                        {initialsFrom(application.candidate_display_name_snapshot)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[0.9rem] font-semibold leading-tight text-(--app-text)">
                          {application.candidate_display_name_snapshot}
                        </p>
                        <p className="mt-0.5 truncate text-[0.8rem] text-(--app-text-subtle) xl:hidden">
                          {application.job_posting?.title ?? 'Vacante'}
                        </p>
                        {stageName ? (
                          <p className="mt-0.5 hidden truncate text-[0.8rem] text-(--app-text-subtle) xl:block 2xl:hidden">
                            {stageName}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <p className="hidden truncate text-sm text-(--app-text-muted) xl:block">
                      {application.job_posting?.title ?? 'Vacante'}
                    </p>

                    <div className="hidden 2xl:block">
                      {stageName ? (
                        <span className="inline-flex items-center rounded-full bg-(--app-surface-muted) px-2.5 py-1 text-[0.74rem] font-semibold text-(--app-text-muted)">
                          {stageName}
                        </span>
                      ) : (
                        <span className="text-(--app-text-subtle)">—</span>
                      )}
                    </div>

                    <span className={cn('col-start-1 inline-flex items-center gap-1.5 text-[0.84rem] font-semibold lg:col-auto', statusMeta.text)}>
                      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: statusMeta.dot }} />
                      {statusMeta.label}
                    </span>

                    <span className="col-start-1 text-[0.82rem] text-(--app-text-subtle) lg:col-auto lg:text-right">
                      {relativeDays(application.submitted_at)}
                    </span>

                    <div className="col-start-2 row-span-3 row-start-1 flex items-start justify-end self-start lg:col-auto lg:row-auto lg:self-center">
                      <KebabMenu label={`Acciones para ${application.candidate_display_name_snapshot}`}>
                        <KebabMenuItem to={surfacePaths.workspace.pipeline}>
                          <KanbanSquare className="mr-2 size-4 text-(--app-text-subtle)" />
                          Ver en pipeline
                        </KebabMenuItem>
                        <KebabMenuItem to={`${surfacePaths.workspace.talent}?candidate=${application.candidate_profile_id}`}>
                          <UserRound className="mr-2 size-4 text-(--app-text-subtle)" />
                          Ver candidato
                        </KebabMenuItem>
                        {jobSlug ? (
                          <KebabMenuItem to={surfacePaths.public.jobDetail(jobSlug)}>
                            <Briefcase className="mr-2 size-4 text-(--app-text-subtle)" />
                            Ir a la vacante
                          </KebabMenuItem>
                        ) : null}
                      </KebabMenu>
                    </div>
                  </motion.li>
                )
              })}
            </motion.ul>
          ) : (
            <div className="px-5 py-16 text-center">
              <div className="mx-auto flex size-14 items-center justify-center rounded-card bg-primary-50 text-primary-700 dark:bg-primary-500/12 dark:text-primary-200">
                <Search className="size-6" />
              </div>
              <h3 className="mt-4 text-base font-bold tracking-tight text-(--app-text)">Sin resultados</h3>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-(--app-text-muted)">
                {applications.length === 0
                  ? 'Aún no hay postulaciones en tus vacantes. Cuando el talento aplique, aparecerá aquí.'
                  : 'No encontramos aplicaciones que coincidan con tu búsqueda o filtros.'}
              </p>
            </div>
          )}
        </Card>

        {!loading && filteredRows.length > 0 ? (
          <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-(--app-text-muted)">
              Mostrando{' '}
              <b className="font-semibold text-(--app-text-muted)">
                {pageStart + 1}–{Math.min(pageStart + APPLICATIONS_PAGE_SIZE, filteredRows.length)}
              </b>{' '}
              de {filteredRows.length} {filteredRows.length === 1 ? 'aplicación' : 'aplicaciones'}
            </p>
            {pageCount > 1 ? (
              <Pagination page={safePage} totalPages={pageCount} onPageChange={setPage} ariaLabel="Paginación de aplicaciones" />
            ) : null}
          </div>
        ) : null}
      </motion.div>
    </motion.div>
  )
}

function MetricChip({ dot, value, label }: { dot: string; value: string | number; label: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-control border border-(--app-border) bg-(--app-surface-elevated) py-2 pl-3 pr-4">
      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: dot }} />
      <span className="min-w-0">
        <span className="block font-sans text-[1.18rem] font-bold leading-none tracking-tight text-(--app-text)">{value}</span>
        <span className="mt-1 block text-[0.62rem] font-semibold uppercase tracking-[0.1em] text-(--app-text-subtle)">{label}</span>
      </span>
    </div>
  )
}
