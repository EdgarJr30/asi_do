import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion, useDragControls, useReducedMotion } from 'motion/react'
import { Briefcase, KanbanSquare, Search, SlidersHorizontal, UserRound, X } from 'lucide-react'

import { useAppSession } from '@/app/providers/app-session-provider'
import { surfacePaths } from '@/app/router/surface-paths'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { KebabMenu, KebabMenuItem } from '@/components/ui/kebab-menu'
import { Spinner } from '@/components/ui/loader'
import { Select } from '@/components/ui/select'
import {
  countTenantApplications,
  listTenantApplicationsPage,
  type TenantApplicationsSort
} from '@/features/applications/lib/applications-api'
import { listTenantPipelineStages } from '@/features/pipeline/lib/pipeline-api'
import { useRealtimeSync } from '@/lib/realtime/use-realtime-sync'
import { cardReveal, gridStagger, pageStagger, softEase } from '@/shared/ui/card-motion'
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

/** Opciones del filtro por estado (incluye "Todas"). */
const STATUS_FILTERS: Array<{ key: string; label: string }> = [
  { key: '', label: 'Todas' },
  { key: 'submitted', label: 'Aplicó' },
  { key: 'in_review', label: 'En revisión' },
  { key: 'interviewing', label: 'En entrevista' },
  { key: 'hired', label: 'Contratado' },
  { key: 'rejected', label: 'Descartado' }
]

const SORT_LABELS: Record<TenantApplicationsSort, string> = {
  recent: 'Más recientes',
  oldest: 'Más antiguas',
  name: 'Nombre A–Z'
}

const APPLICATIONS_PAGE_SIZE = 12

function statusLabel(key: string) {
  return STATUS_META[key]?.label ?? STATUS_FILTERS.find((filter) => filter.key === key)?.label ?? key
}

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

  const [search, setSearch] = useState('')
  // `submittedSearch` es lo que realmente filtra en el servidor: se aplica al
  // pulsar Enter (escritorio) o "Ver resultados" (hoja móvil), no en cada tecla.
  const [submittedSearch, setSubmittedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sort, setSort] = useState<TenantApplicationsSort>('recent')
  const [filtersSheetOpen, setFiltersSheetOpen] = useState(false)

  const sentinelRef = useRef<HTMLDivElement | null>(null)

  const statsQuery = useQuery({
    queryKey: ['tenant-applications', 'stats', tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => countTenantApplications(tenantId!)
  })

  const stagesQuery = useQuery({
    queryKey: ['tenant-applications', 'stages', tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => listTenantPipelineStages(tenantId!)
  })

  // Paginación real de servidor + scroll infinito: cada página llega vía `range`.
  // La key incluye los filtros de servidor para reiniciar desde el offset 0.
  const applicationsQuery = useInfiniteQuery({
    queryKey: ['tenant-applications', 'page', tenantId, statusFilter, submittedSearch, sort],
    enabled: Boolean(tenantId),
    initialPageParam: 0,
    queryFn: async ({ pageParam }) =>
      listTenantApplicationsPage({
        tenantId: tenantId!,
        status: statusFilter,
        query: submittedSearch,
        sort,
        limit: APPLICATIONS_PAGE_SIZE,
        offset: pageParam
      }),
    getNextPageParam: (lastPage) => lastPage.nextOffset
  })

  const { fetchNextPage, hasNextPage, isFetchingNextPage } = applicationsQuery

  // En vivo: nuevas postulaciones y cambios de etapa aparecen sin recargar.
  useRealtimeSync(
    'workspace-applications',
    [
      { table: 'applications', invalidate: [['tenant-applications']] },
      { table: 'application_stage_history', invalidate: [['tenant-applications']] }
    ],
    { enabled: Boolean(tenantId) }
  )

  const pages = useMemo(() => applicationsQuery.data?.pages ?? [], [applicationsQuery.data])
  const rows = useMemo(() => pages.flatMap((page) => page.applications), [pages])
  const totalCount = pages[0]?.totalCount ?? 0
  const stageNameById = useMemo(
    () => new Map((stagesQuery.data ?? []).map((stage) => [stage.id, stage.name])),
    [stagesQuery.data]
  )

  const stats = statsQuery.data
  const statusCount = useCallback(
    (key: string) => (key === '' ? stats?.total ?? 0 : stats?.byStatus[key] ?? 0),
    [stats]
  )

  const activeChips = useMemo(
    () =>
      [
        submittedSearch
          ? {
              key: 'search',
              label: `"${submittedSearch}"`,
              clear: () => {
                setSearch('')
                setSubmittedSearch('')
              }
            }
          : null,
        statusFilter
          ? { key: 'status', label: statusLabel(statusFilter), clear: () => setStatusFilter('') }
          : null
      ].filter(Boolean) as Array<{ key: string; label: string; clear: () => void }>,
    [submittedSearch, statusFilter]
  )
  const activeFilterCount = activeChips.length

  function applyDesktopSearch() {
    setSubmittedSearch(search.trim())
  }

  function applyMobileFilters() {
    setSubmittedSearch(search.trim())
    setFiltersSheetOpen(false)
  }

  function resetFilters() {
    setSearch('')
    setSubmittedSearch('')
    setStatusFilter('')
    setSort('recent')
  }

  // Scroll infinito: un sentinel al fondo de la lista pide la siguiente página al
  // acercarse al final. El scroll es a nivel de página (root por defecto).
  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage()
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) {
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMore()
        }
      },
      { rootMargin: '320px' }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [loadMore, rows.length])

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

  const loading = applicationsQuery.isLoading

  return (
    <motion.div
      className="space-y-4"
      variants={pageStagger}
      initial={shouldReduceMotion ? false : 'hidden'}
      animate="show"
    >
      <motion.div variants={cardReveal} className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-(--app-text) sm:text-[1.6rem]">Aplicaciones</h1>
          <p className="mt-1 text-sm text-(--app-text-muted)">
            <b className="font-semibold text-(--app-text)">{stats?.total ?? 0}</b>{' '}
            {(stats?.total ?? 0) === 1 ? 'postulación' : 'postulaciones'} en tus vacantes
          </p>
        </div>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 lg:flex lg:shrink-0">
          <MetricChip dot="#2d52a8" value={stats ? stats.total : '—'} label="Total" />
          <MetricChip dot="#6b46c1" value={stats ? stats.interviewing : '—'} label="En entrevista" />
          <MetricChip dot="#1f9d61" value={stats ? stats.recent7d : '—'} label="Últimos 7 días" />
        </div>
      </motion.div>

      {/* Móvil: barra compacta que abre una hoja inferior con búsqueda y filtros */}
      <motion.div variants={cardReveal} className="space-y-2 lg:hidden">
        <button
          type="button"
          onClick={() => setFiltersSheetOpen(true)}
          className="flex h-11 w-full items-center gap-2.5 rounded-card border border-(--app-border) bg-(--app-surface) pl-3 pr-1.5 text-left shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--app-ring)"
        >
          <Search aria-hidden className="size-4 shrink-0 text-(--app-text-subtle)" />
          <span className={cn('min-w-0 flex-1 truncate text-sm', submittedSearch ? 'text-(--app-text)' : 'text-(--app-text-subtle)')}>
            {submittedSearch || 'Buscar por candidato o posición'}
          </span>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-control bg-(--app-surface-muted) px-2.5 py-1.5 text-[0.78rem] font-semibold text-(--app-text)">
            <SlidersHorizontal aria-hidden className="size-4" />
            Filtros
            {activeFilterCount > 0 ? (
              <span className="inline-flex min-w-[1.1rem] items-center justify-center rounded-full bg-primary-600 px-1 text-[0.68rem] font-semibold leading-none text-white">
                {activeFilterCount}
              </span>
            ) : null}
          </span>
        </button>

        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-2 text-[0.82rem] text-(--app-text-subtle)">
            {loading ? (
              <>
                <Spinner size="sm" /> Cargando…
              </>
            ) : (
              <>
                <b className="font-semibold text-(--app-text)">{totalCount}</b>{' '}
                {totalCount === 1 ? 'aplicación' : 'aplicaciones'}
              </>
            )}
          </span>
          <label className="flex items-center gap-1.5 text-[0.82rem] text-(--app-text-subtle)">
            Ordenar
            <Select
              className="h-[34px] w-auto rounded-control text-[0.82rem]"
              value={sort}
              onChange={(event) => setSort(event.target.value as TenantApplicationsSort)}
              aria-label="Ordenar aplicaciones"
            >
              {(Object.keys(SORT_LABELS) as TenantApplicationsSort[]).map((key) => (
                <option key={key} value={key}>
                  {SORT_LABELS[key]}
                </option>
              ))}
            </Select>
          </label>
        </div>

        {activeChips.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {activeChips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={chip.clear}
                className="inline-flex h-8 items-center gap-1.5 rounded-control border border-(--app-border) bg-(--app-surface) px-2.5 text-[0.78rem] font-medium text-(--app-text-muted) transition hover:text-(--app-text) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--app-ring)"
              >
                {chip.label}
                <X aria-hidden className="size-3" />
                <span className="sr-only">Quitar filtro</span>
              </button>
            ))}
            <button type="button" onClick={resetFilters} className="px-1 text-[0.78rem] font-medium text-(--app-text-muted) underline-offset-2 hover:underline">
              Limpiar
            </button>
          </div>
        ) : null}
      </motion.div>

      {/* Escritorio: búsqueda + filtros inline */}
      <motion.div variants={cardReveal} className="hidden flex-col gap-2.5 lg:flex lg:flex-row lg:items-center">
        <form
          className="relative min-w-60 flex-1"
          role="search"
          onSubmit={(event) => {
            event.preventDefault()
            applyDesktopSearch()
          }}
        >
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-(--app-text-subtle)" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onBlur={applyDesktopSearch}
            placeholder="Buscar por candidato o posición…"
            className="h-11 rounded-control pl-10"
          />
        </form>
        <div className="grid gap-2.5 sm:grid-cols-2 lg:flex lg:shrink-0">
          <Select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="h-11 min-w-44 rounded-control"
            aria-label="Filtrar por estado"
          >
            {STATUS_FILTERS.map((filter) => (
              <option key={filter.key || 'all'} value={filter.key}>
                {filter.label} ({statusCount(filter.key)})
              </option>
            ))}
          </Select>
          <Select
            value={sort}
            onChange={(event) => setSort(event.target.value as TenantApplicationsSort)}
            className="h-11 min-w-48 rounded-control"
            aria-label="Ordenar aplicaciones"
          >
            {(Object.keys(SORT_LABELS) as TenantApplicationsSort[]).map((key) => (
              <option key={key} value={key}>
                Ordenar por: {SORT_LABELS[key]}
              </option>
            ))}
          </Select>
        </div>
      </motion.div>

      <motion.div variants={cardReveal}>
        <Card className="overflow-hidden rounded-card p-0 shadow-[0_1px_2px_rgba(20,40,90,0.04),0_4px_16px_rgba(20,40,90,0.05)]">
          <div className="hidden grid-cols-[minmax(0,2.2fr)_minmax(0,1.5fr)_150px_88px_44px] items-center gap-4 border-b border-(--app-border) bg-(--app-surface-muted)/70 px-4 py-2.5 text-[0.68rem] font-bold uppercase tracking-[0.05em] text-(--app-text-subtle) lg:grid">
            <span>Candidato</span>
            <span>Posición</span>
            <span>Estado</span>
            <span className="text-right">Aplicó</span>
            <span className="sr-only">Acciones</span>
          </div>

          {loading ? (
            <div className="flex items-center gap-2.5 px-4 py-12 text-sm text-(--app-text-muted)">
              <Spinner size="sm" /> Cargando aplicaciones…
            </div>
          ) : rows.length > 0 ? (
            <motion.ul
              variants={gridStagger}
              initial={shouldReduceMotion ? false : 'hidden'}
              animate="show"
              className="divide-y divide-(--app-border)"
            >
              {rows.map((application) => {
                const statusMeta = STATUS_META[application.status_public] ?? {
                  label: application.status_public,
                  dot: '#8b97b0',
                  text: 'text-(--app-text-subtle)'
                }
                const stageName = application.current_stage_id ? stageNameById.get(application.current_stage_id) : null
                const jobTitle = application.job_posting?.title ?? 'Vacante'
                const jobSlug = application.job_posting?.slug

                return (
                  <motion.li
                    key={application.id}
                    variants={cardReveal}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-1.5 px-3 py-2.5 transition-colors hover:bg-(--app-surface-muted)/55 lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1.5fr)_150px_88px_44px] lg:gap-4 lg:px-4 lg:py-2.5"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className={cn(
                          'flex size-8 shrink-0 items-center justify-center rounded-full text-[0.72rem] font-bold',
                          avatarTint(application.id)
                        )}
                      >
                        {initialsFrom(application.candidate_display_name_snapshot)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[0.85rem] font-semibold leading-tight text-(--app-text)">
                          {application.candidate_display_name_snapshot}
                        </p>
                        <p className="mt-0.5 truncate text-[0.76rem] text-(--app-text-subtle) lg:hidden">{jobTitle}</p>
                      </div>
                    </div>

                    <div className="hidden min-w-0 lg:block">
                      <p className="truncate text-[0.82rem] text-(--app-text-muted)">{jobTitle}</p>
                      {stageName ? <p className="mt-0.5 truncate text-[0.72rem] text-(--app-text-subtle)">{stageName}</p> : null}
                    </div>

                    <span className={cn('col-start-1 inline-flex items-center gap-1.5 text-[0.8rem] font-semibold lg:col-auto', statusMeta.text)}>
                      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: statusMeta.dot }} />
                      {statusMeta.label}
                    </span>

                    <span className="col-start-1 text-[0.78rem] text-(--app-text-subtle) lg:col-auto lg:text-right">
                      {relativeDays(application.submitted_at)}
                    </span>

                    <div className="col-start-2 row-span-2 row-start-1 flex items-start justify-end self-start lg:col-auto lg:row-auto lg:self-center">
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
                {activeFilterCount === 0
                  ? 'Aún no hay postulaciones en tus vacantes. Cuando el talento aplique, aparecerá aquí.'
                  : 'No encontramos aplicaciones que coincidan con tu búsqueda o filtros.'}
              </p>
            </div>
          )}

          {/* Sentinel: al entrar en viewport pide la siguiente página */}
          {!loading && rows.length > 0 ? <div ref={sentinelRef} aria-hidden className="h-px w-full" /> : null}

          {isFetchingNextPage ? (
            <div className="flex items-center justify-center gap-2 border-t border-(--app-border) py-3 text-[0.78rem] text-(--app-text-subtle)">
              <Spinner size="sm" /> Cargando más aplicaciones…
            </div>
          ) : !loading && rows.length > 0 && !hasNextPage ? (
            <p className="border-t border-(--app-border) py-3 text-center text-[0.74rem] text-(--app-text-subtle)">No hay más aplicaciones</p>
          ) : null}
        </Card>
      </motion.div>

      <MobileFilterSheet
        open={filtersSheetOpen}
        onClose={() => setFiltersSheetOpen(false)}
        search={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        sort={sort}
        onSortChange={setSort}
        statusCount={statusCount}
        resultCount={totalCount}
        isLoading={loading}
        hasActive={activeFilterCount > 0}
        onApply={applyMobileFilters}
        onReset={resetFilters}
      />
    </motion.div>
  )
}

function MobileFilterSheet({
  open,
  onClose,
  search,
  onSearchChange,
  statusFilter,
  onStatusChange,
  sort,
  onSortChange,
  statusCount,
  resultCount,
  isLoading,
  hasActive,
  onApply,
  onReset
}: {
  open: boolean
  onClose: () => void
  search: string
  onSearchChange: (value: string) => void
  statusFilter: string
  onStatusChange: (value: string) => void
  sort: TenantApplicationsSort
  onSortChange: (value: TenantApplicationsSort) => void
  statusCount: (key: string) => number
  resultCount: number
  isLoading: boolean
  hasActive: boolean
  onApply: () => void
  onReset: () => void
}) {
  // La barrita superior (grabber) inicia el arrastre; el cuerpo con scroll no,
  // para que deslizar sobre el formulario no cierre la hoja por accidente.
  const dragControls = useDragControls()

  return (
    <AnimatePresence>
      {open ? (
        <Dialog static open onClose={onClose} className="relative z-50 lg:hidden">
          <motion.div
            className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: softEase }}
          />
          <div className="fixed inset-x-0 bottom-0 flex max-h-[90dvh] flex-col justify-end">
            <DialogPanel
              as={motion.div}
              drag="y"
              dragControls={dragControls}
              dragListener={false}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.9 }}
              onDragEnd={(_event, info) => {
                if (info.offset.y > 140 || info.velocity.y > 700) onClose()
              }}
              variants={{
                hidden: { y: '100%' },
                visible: { y: 0, transition: { type: 'spring', damping: 34, stiffness: 340 } },
                exit: { y: '100%', transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } }
              }}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="flex max-h-[90dvh] flex-col rounded-t-card border-t border-(--app-border) bg-(--app-surface) shadow-[0_-20px_60px_rgba(15,23,42,0.28)]"
            >
              <header
                onPointerDown={(event) => dragControls.start(event)}
                className="shrink-0 cursor-grab touch-none select-none border-b border-(--app-border) px-5 pb-3 pt-2.5 active:cursor-grabbing"
              >
                <span aria-hidden className="mx-auto mb-3 block h-1.5 w-10 rounded-full bg-(--app-border)" />
                <div className="flex items-center justify-between gap-4">
                  <DialogTitle className="text-[1.05rem] font-semibold tracking-tight text-(--app-text)">Buscar y filtrar</DialogTitle>
                  <button
                    type="button"
                    onClick={onClose}
                    onPointerDown={(event) => event.stopPropagation()}
                    aria-label="Cerrar"
                    className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-control text-(--app-text-subtle) transition-colors hover:bg-(--app-surface-muted) hover:text-(--app-text)"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              </header>

              <form
                id="workspace-applications-filters-form"
                className="flex-1 space-y-4 overflow-y-auto px-5 py-4"
                onSubmit={(event) => {
                  event.preventDefault()
                  onApply()
                }}
              >
                <label className="block space-y-1.5">
                  <span className="text-[0.8rem] font-medium text-(--app-text)">Búsqueda</span>
                  <div className="relative">
                    <Search aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-(--app-text-subtle)" />
                    <Input
                      className="h-11 pl-9 text-sm"
                      placeholder="Candidato o posición"
                      value={search}
                      onChange={(event) => onSearchChange(event.target.value)}
                    />
                  </div>
                </label>

                <label className="block space-y-1.5">
                  <span className="text-[0.8rem] font-medium text-(--app-text)">Estado</span>
                  <Select
                    className="h-11 w-full rounded-control text-sm"
                    value={statusFilter}
                    onChange={(event) => onStatusChange(event.target.value)}
                  >
                    {STATUS_FILTERS.map((filter) => (
                      <option key={filter.key || 'all'} value={filter.key}>
                        {filter.label} ({statusCount(filter.key)})
                      </option>
                    ))}
                  </Select>
                </label>

                <label className="block space-y-1.5">
                  <span className="text-[0.8rem] font-medium text-(--app-text)">Ordenar por</span>
                  <Select
                    className="h-11 w-full rounded-control text-sm"
                    value={sort}
                    onChange={(event) => onSortChange(event.target.value as TenantApplicationsSort)}
                  >
                    {(Object.keys(SORT_LABELS) as TenantApplicationsSort[]).map((key) => (
                      <option key={key} value={key}>
                        {SORT_LABELS[key]}
                      </option>
                    ))}
                  </Select>
                </label>
              </form>

              <footer className="flex shrink-0 items-center gap-3 border-t border-(--app-border) px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
                <Button type="button" variant="outline" className="h-11 rounded-control px-4" onClick={onReset} disabled={!hasActive}>
                  Limpiar
                </Button>
                <Button type="submit" form="workspace-applications-filters-form" className="h-11 flex-1 rounded-control">
                  {isLoading ? <Spinner size="sm" /> : `Ver ${resultCount} ${resultCount === 1 ? 'aplicación' : 'aplicaciones'}`}
                </Button>
              </footer>
            </DialogPanel>
          </div>
        </Dialog>
      ) : null}
    </AnimatePresence>
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
