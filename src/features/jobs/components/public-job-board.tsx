import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import type { Variants } from 'motion/react'
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  Bookmark,
  BookmarkCheck,
  Briefcase,
  Building2,
  Check,
  Clock3,
  FileText,
  Globe,
  MapPin,
  Search,
  Share2,
  Sparkles,
  X
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { surfacePaths } from '@/app/router/surface-paths'
import { useAppSession } from '@/app/providers/app-session-provider'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { PageLoader, Spinner } from '@/components/ui/loader'
import { Select } from '@/components/ui/select'
import { Tooltip } from '@/components/ui/tooltip'
import { toErrorMessage } from '@/features/auth/lib/auth-api'
import { listMyApplications } from '@/features/applications/lib/applications-api'
import { fetchMyCandidateProfile } from '@/features/candidate-profile/lib/candidate-profile-api'
import { getPublicJobBySlug, listPublicJobsPage, toggleSavedJob, type JobPostingBundle } from '@/features/jobs/lib/jobs-api'
import { classifySector, getSectorLabel, sectorDefinitions } from '@/features/jobs/lib/sectors'
import { getCompensationTypeLabel, getOpportunityTypeLabel, opportunityTypeOptions } from '@/features/opportunities/lib/opportunity-taxonomy'
import { reportErrorWithToast } from '@/lib/errors/error-reporting'
import { useRealtimeSync } from '@/lib/realtime/use-realtime-sync'
import { cn } from '@/lib/utils/cn'
import {
  softEase,
  smoothCardReveal as cardReveal,
  smoothGridStagger as gridStagger,
  smoothPageStagger as pageStagger
} from '@/shared/ui/card-motion'

type JobRow = JobPostingBundle['jobs'][number]

const PUBLIC_JOBS_QUERY_KEY = ['jobs', 'public-board'] as const
const PAGE_SIZE = 8

const workplaceLabels: Record<string, string> = { remote: 'Remoto', hybrid: 'Híbrido', on_site: 'Presencial' }
const employmentLabels: Record<string, string> = {
  full_time: 'Tiempo completo',
  part_time: 'Medio tiempo',
  contract: 'Por contrato',
  temporary: 'Temporal',
  internship: 'Pasantía'
}

// Paleta rotativa para los logos de empresa (cuadros de color sólido con iniciales),
// indexada de forma estable por el nombre para que cada empresa conserve su color.
const LOGO_COLORS = ['#3b62b8', '#0e8a86', '#6b46c1', '#c2683a', '#1f9d61', '#b8456f', '#2d52a8', '#0f7a9c'] as const

function logoColor(seed: string | null | undefined) {
  const value = (seed ?? '').trim() || 'ASI'
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  }
  return LOGO_COLORS[hash % LOGO_COLORS.length]
}

function workplaceLabel(value: string | null | undefined) {
  return value ? workplaceLabels[value] ?? value : ''
}
function employmentLabel(value: string | null | undefined) {
  return value ? employmentLabels[value] ?? value : ''
}
function locationLabel(job: Pick<JobRow, 'city_name' | 'country_code'>) {
  return [job.city_name, job.country_code].filter(Boolean).join(', ') || 'Ubicación flexible'
}
function companyInitials(name: string | null | undefined) {
  const value = (name ?? '').trim()
  if (!value) return '·'
  return value.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('')
}
function relativeDays(value: string | null | undefined) {
  if (!value) return ''
  const days = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 86_400_000))
  if (days === 0) return 'Hoy'
  if (days === 1) return 'Ayer'
  if (days < 7) return `Hace ${days} días`
  const weeks = Math.round(days / 7)
  return weeks === 1 ? 'Hace 1 semana' : `Hace ${weeks} semanas`
}
function hasSalary(job: Pick<JobRow, 'compensation_type' | 'compensation_min_amount' | 'compensation_max_amount'>) {
  return (
    job.compensation_type !== 'unpaid' &&
    job.compensation_type !== 'donation_based' &&
    job.compensation_type !== 'not_disclosed' &&
    Boolean(job.compensation_min_amount || job.compensation_max_amount)
  )
}
function salaryText(job: Pick<JobRow, 'compensation_type' | 'compensation_min_amount' | 'compensation_max_amount' | 'compensation_currency'>) {
  if (!hasSalary(job)) return getCompensationTypeLabel(job.compensation_type)
  const currency = job.compensation_currency || 'USD'
  const min = job.compensation_min_amount
  const max = job.compensation_max_amount
  if (min && max) return `${currency} ${min.toLocaleString()} – ${max.toLocaleString()}`
  return `${currency} ${(min || max || 0).toLocaleString()}`
}

function CompanyLogo({ name, size = 'md' }: { name: string | null | undefined; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-xl font-bold leading-none tracking-tight text-white',
        size === 'lg' && 'size-14 rounded-[13px] text-lg',
        size === 'md' && 'size-11 text-sm',
        size === 'sm' && 'size-[42px] text-[0.8rem]'
      )}
      style={{ backgroundColor: logoColor(name) }}
    >
      {companyInitials(name)}
    </span>
  )
}

interface Filters {
  search: string
  location: string
  sector: string
  workplace: string
  type: string
}
const emptyFilters: Filters = { search: '', location: '', sector: '', workplace: '', type: '' }

export function PublicJobBoard() {
  const session = useAppSession()
  const queryClient = useQueryClient()
  const shouldReduceMotion = useReducedMotion()

  const [filters, setFilters] = useState<Filters>(emptyFilters)
  // `submitted` = lo que realmente filtra en el servidor (búsqueda + ubicación).
  // Se aplica al pulsar "Buscar"/Enter o al limpiar el chip; así no disparamos un
  // refetch en cada tecla. Modalidad/tipo/orden sí aplican de inmediato.
  const [submitted, setSubmitted] = useState({ search: '', location: '' })
  const [sort, setSort] = useState<'recent' | 'salary'>('recent')
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState(false) // controla móvil: lista ↔ detalle

  const listScrollRef = useRef<HTMLDivElement | null>(null)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  function clearSelectedJob() {
    setSelectedJobId(null)
    setDetailOpen(false)
  }

  // Esc cierra el detalle de la vacante que se está visualizando.
  useEffect(() => {
    if (!selectedJobId) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setSelectedJobId(null)
        setDetailOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedJobId])

  function patchFilters(patch: Partial<Filters>) {
    setFilters((current) => ({ ...current, ...patch }))
  }

  function applyFilters(patch: Partial<Filters>) {
    clearSelectedJob()
    patchFilters(patch)
  }

  function clearSubmittedFilter(key: 'search' | 'location') {
    clearSelectedJob()
    setFilters((current) => ({ ...current, [key]: '' }))
    setSubmitted((current) => ({ ...current, [key]: '' }))
  }

  function applySort(nextSort: 'recent' | 'salary') {
    clearSelectedJob()
    setSort(nextSort)
  }

  const candidateProfileQuery = useQuery({
    queryKey: ['candidate-profile', 'mine', 'jobs-board'],
    enabled: session.isAuthenticated,
    queryFn: async () => fetchMyCandidateProfile(session.authUser!.id)
  })
  const candidateProfileId = candidateProfileQuery.data?.profile?.id ?? null

  // Paginación real de servidor + scroll infinito: cada página llega vía `range`,
  // no se trae todo de inmediato. La key incluye los filtros de servidor para que
  // un cambio reinicie desde el offset 0.
  const jobsQuery = useInfiniteQuery({
    queryKey: [...PUBLIC_JOBS_QUERY_KEY, candidateProfileId, submitted.search, submitted.location, filters.workplace, filters.type, sort],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) =>
      listPublicJobsPage({
        candidateProfileId,
        query: submitted.search,
        location: submitted.location,
        workplaceType: filters.workplace,
        opportunityType: filters.type,
        sort,
        limit: PAGE_SIZE,
        offset: pageParam
      }),
    getNextPageParam: (lastPage) => lastPage.nextOffset
  })

  const { fetchNextPage, hasNextPage, isFetchingNextPage } = jobsQuery

  // En vivo: cuando una empresa publica/edita una vacante, el board se refresca
  // solo, sin que el candidato tenga que recargar. RLS acota qué filas llegan.
  useRealtimeSync('public-job-board', [
    { table: 'job_postings', invalidate: [PUBLIC_JOBS_QUERY_KEY] }
  ])

  const applicationsQuery = useQuery({
    queryKey: ['applications', 'mine', 'jobs-board', session.authUser?.id ?? null],
    enabled: session.isAuthenticated,
    queryFn: async () => listMyApplications(session.authUser!.id)
  })

  const pages = useMemo(() => jobsQuery.data?.pages ?? [], [jobsQuery.data])
  const allJobs = useMemo(() => pages.flatMap((entry) => entry.jobs), [pages])
  const totalCount = pages[0]?.totalCount ?? 0
  const savedJobIds = useMemo(() => Array.from(new Set(pages.flatMap((entry) => entry.savedJobIds))), [pages])
  const appliedJobIds = useMemo(() => {
    const set = new Set<string>()
    for (const application of applicationsQuery.data ?? []) {
      const id = (application as { job_posting?: { id?: string } }).job_posting?.id
      if (id) set.add(id)
    }
    return set
  }, [applicationsQuery.data])

  const sectorOptions = useMemo(() => {
    const counts = new Map<string, number>()
    for (const job of allJobs) {
      const sector = classifySector(job.company_profile?.industry)
      if (sector) counts.set(sector, (counts.get(sector) ?? 0) + 1)
    }
    return sectorDefinitions
      .map((sector) => ({ id: sector.id, label: sector.label, count: counts.get(sector.id) ?? 0 }))
      .filter((sector) => sector.count > 0)
      .sort((a, b) => b.count - a.count)
  }, [allJobs])

  // El sector clasifica texto libre (`industry`) en cliente, por eso es el único
  // filtro que se aplica sobre las páginas ya cargadas.
  const visibleJobs = useMemo(
    () => (filters.sector ? allJobs.filter((job) => classifySector(job.company_profile?.industry) === filters.sector) : allJobs),
    [allJobs, filters.sector]
  )

  const detailJob = selectedJobId ? visibleJobs.find((job) => job.id === selectedJobId) ?? null : null

  const activeChips = [
    submitted.search ? { key: 'search', label: `"${submitted.search}"`, clear: () => clearSubmittedFilter('search') } : null,
    submitted.location ? { key: 'location', label: submitted.location, clear: () => clearSubmittedFilter('location') } : null,
    filters.sector ? { key: 'sector', label: getSectorLabel(filters.sector), clear: () => applyFilters({ sector: '' }) } : null,
    filters.workplace ? { key: 'workplace', label: workplaceLabel(filters.workplace), clear: () => applyFilters({ workplace: '' }) } : null,
    filters.type ? { key: 'type', label: getOpportunityTypeLabel(filters.type), clear: () => applyFilters({ type: '' }) } : null
  ].filter(Boolean) as Array<{ key: string; label: string; clear: () => void }>

  // Sólo los chips de búsqueda/ubicación se muestran como pastillas: sector,
  // modalidad y tipo ya quedan visibles en sus propios selects de la toolbar.
  const searchChips = activeChips.filter((chip) => chip.key === 'search' || chip.key === 'location')

  function resetFilters() {
    clearSelectedJob()
    setFilters(emptyFilters)
    setSubmitted({ search: '', location: '' })
  }

  const saveJobMutation = useMutation({
    mutationFn: async (input: { jobId: string; shouldSave: boolean }) => {
      if (!candidateProfileId) throw new Error('Necesitas un perfil candidato para guardar vacantes.')
      return toggleSavedJob({ candidateProfileId, jobPostingId: input.jobId, shouldSave: input.shouldSave })
    },
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: PUBLIC_JOBS_QUERY_KEY }),
    onError: async (error) => {
      await reportErrorWithToast({
        title: 'No pudimos actualizar tus vacantes guardadas',
        source: 'jobs.toggle-saved',
        route: surfacePaths.public.jobs,
        userId: session.authUser?.id ?? null,
        error,
        userMessage: session.isAuthenticated
          ? 'No pudimos guardar o quitar esta vacante.'
          : 'Inicia sesión y completa tu perfil candidato para guardar vacantes.'
      })
    }
  })

  function openJob(jobId: string) {
    setSelectedJobId(jobId)
    setDetailOpen(true)
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Scroll infinito: un sentinel al fondo del contenedor pide la siguiente página
  // al acercarse al final de la lista visible.
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
    const root = listScrollRef.current
    // La lista de vacantes tiene scroll propio; la carga observa ese contenedor.
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMore()
        }
      },
      { root, rootMargin: '160px' }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [loadMore, visibleJobs.length])

  const resultCount = filters.sector ? visibleJobs.length : totalCount

  return (
    <motion.div
      className="space-y-4"
      variants={pageStagger}
      initial={shouldReduceMotion ? false : 'hidden'}
      animate="show"
    >
      <motion.header variants={cardReveal}>
        <h1 className="text-2xl font-bold tracking-tight text-(--app-text)">Vacantes</h1>
        <p className="mt-1.5 text-sm text-(--app-text-muted)">
          Descubre oportunidades abiertas y postúlate con tu perfil en minutos.
        </p>
      </motion.header>

      {/* Búsqueda: una sola barra blanca con dos campos separados por un divisor */}
      <motion.form
        variants={cardReveal}
        className="flex flex-col gap-2 rounded-panel border border-(--app-border) bg-(--app-surface) p-1.5 pl-3 shadow-sm md:flex-row md:items-center md:gap-1"
        onSubmit={(event) => {
          event.preventDefault()
          clearSelectedJob()
          setSubmitted({ search: filters.search.trim(), location: filters.location.trim() })
        }}
        role="search"
      >
        <div className="relative flex-1">
          <Search aria-hidden className="pointer-events-none absolute left-2 top-1/2 size-4.5 -translate-y-1/2 text-(--app-text-subtle)" />
          <Input
            className="h-11 border-transparent bg-transparent pl-9 text-sm shadow-none focus:bg-transparent focus-visible:ring-0"
            placeholder="Cargo, empresa o palabra clave"
            aria-label="Buscar por cargo, empresa o palabra clave"
            value={filters.search}
            onChange={(event) => patchFilters({ search: event.target.value })}
          />
        </div>
        <span aria-hidden className="hidden h-6 w-px shrink-0 bg-(--app-border) md:block" />
        <div className="relative md:w-56">
          <MapPin aria-hidden className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-(--app-text-subtle)" />
          <Input
            className="h-11 border-transparent bg-transparent pl-8 text-sm shadow-none focus:bg-transparent focus-visible:ring-0"
            placeholder="Ciudad o país"
            aria-label="Filtrar por ubicación"
            value={filters.location}
            onChange={(event) => patchFilters({ location: event.target.value })}
          />
        </div>
        <Button type="submit" className="h-11 shrink-0 rounded-[0.7rem] px-5 text-sm">
          <Search className="size-4" /> Buscar
        </Button>
      </motion.form>

      {/* Toolbar: filtros inline + chips de búsqueda + contador + orden */}
      <motion.div variants={cardReveal} className="flex flex-wrap items-center gap-2">
        <Select
          className="h-[34px] w-auto rounded-lg text-[0.82rem]"
          value={filters.sector}
          onChange={(event) => applyFilters({ sector: event.target.value })}
          aria-label="Filtrar por sector"
        >
          <option value="">Todos los sectores</option>
          {sectorOptions.map((sector) => (
            <option key={sector.id} value={sector.id}>
              {sector.label} ({sector.count})
            </option>
          ))}
        </Select>
        <Select
          className="h-[34px] w-auto rounded-lg text-[0.82rem]"
          value={filters.workplace}
          onChange={(event) => applyFilters({ workplace: event.target.value })}
          aria-label="Filtrar por modalidad"
        >
          <option value="">Cualquier modalidad</option>
          <option value="remote">Remoto</option>
          <option value="hybrid">Híbrido</option>
          <option value="on_site">Presencial</option>
        </Select>
        <Select
          className="h-[34px] w-auto rounded-lg text-[0.82rem]"
          value={filters.type}
          onChange={(event) => applyFilters({ type: event.target.value })}
          aria-label="Filtrar por tipo"
        >
          <option value="">Todos los tipos</option>
          {opportunityTypeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>

        {searchChips.map((chip) => (
          <button
            key={chip.key}
            type="button"
            onClick={chip.clear}
            className="inline-flex h-[34px] items-center gap-1.5 rounded-lg border border-primary-200 bg-primary-50 px-3 text-[0.82rem] font-medium text-primary-700 transition hover:bg-primary-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--app-ring) dark:border-primary-500/30 dark:bg-primary-500/12 dark:text-primary-300"
          >
            {chip.label}
            <X aria-hidden className="size-3" />
            <span className="sr-only">Quitar filtro</span>
          </button>
        ))}

        {activeChips.length > 0 ? (
          <button type="button" onClick={resetFilters} className="text-[0.82rem] font-medium text-(--app-text-muted) underline-offset-2 hover:underline">
            Limpiar
          </button>
        ) : null}

        <span className="inline-flex items-center gap-2 text-[0.82rem] text-(--app-text-subtle)">
          {jobsQuery.isLoading ? (
            <>
              <Spinner size="sm" /> Cargando…
            </>
          ) : (
            <>
              <b className="font-semibold text-(--app-text)">{resultCount}</b> {resultCount === 1 ? 'empleo' : 'empleos'}
            </>
          )}
        </span>

        <label className="ml-auto flex items-center gap-2 text-[0.82rem] text-(--app-text-subtle)">
          Ordenar por
          <Select className="h-[34px] w-auto rounded-lg text-[0.82rem]" value={sort} onChange={(event) => applySort(event.target.value as 'recent' | 'salary')} aria-label="Ordenar resultados">
            <option value="recent">Más recientes</option>
            <option value="salary">Salario</option>
          </Select>
        </label>
      </motion.div>

      {/* Contenido */}
      {jobsQuery.isLoading ? (
        <motion.div variants={cardReveal}>
          <PageLoader label="Buscando empleos" hint="Cargando las oportunidades disponibles" />
        </motion.div>
      ) : jobsQuery.error ? (
        <motion.div
          variants={cardReveal}
          className="rounded-panel border border-rose-200 bg-rose-50 px-4 py-6 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
        >
          {toErrorMessage(jobsQuery.error)}
        </motion.div>
      ) : visibleJobs.length === 0 && !hasNextPage && !isFetchingNextPage ? (
        <motion.div variants={cardReveal}>
          <EmptyState
            title="No encontramos empleos con estos filtros"
            description="Prueba con menos filtros o cambia las palabras clave para ampliar tu búsqueda."
            actionLabel={activeChips.length > 0 ? 'Limpiar filtros' : undefined}
            onAction={activeChips.length > 0 ? resetFilters : undefined}
          />
        </motion.div>
      ) : (
        <motion.div
          variants={cardReveal}
          className="grid items-start gap-4 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] xl:grid-cols-[minmax(0,380px)_minmax(0,1fr)]"
        >
          {/* Lista de vacantes con scroll independiente + carga infinita */}
          <div className={cn('min-w-0', detailOpen ? 'hidden lg:block' : 'block')}>
            <div ref={listScrollRef} className="tm-scrollbar flex max-h-128 flex-col gap-2 overflow-y-auto overscroll-contain pr-1">
              <motion.ul
                className="flex flex-col gap-2"
                variants={gridStagger}
                initial={shouldReduceMotion ? false : 'hidden'}
                animate="show"
              >
                {visibleJobs.map((job) => (
                  <motion.li key={job.id} variants={cardReveal}>
                    <JobListRow
                      job={job}
                      active={job.id === detailJob?.id}
                      saved={savedJobIds.includes(job.id)}
                      applied={appliedJobIds.has(job.id)}
                      onSelect={() => openJob(job.id)}
                    />
                  </motion.li>
                ))}
              </motion.ul>
              {/* Sentinel: al entrar en viewport pide la siguiente página */}
              <div ref={sentinelRef} aria-hidden className="h-px w-full" />
              {isFetchingNextPage ? (
                <div className="flex items-center justify-center gap-2 py-3 text-[0.78rem] text-(--app-text-subtle)">
                  <Spinner size="sm" /> Cargando más vacantes…
                </div>
              ) : !hasNextPage && visibleJobs.length > 0 ? (
                <p className="py-3 text-center text-[0.74rem] text-(--app-text-subtle)">No hay más vacantes</p>
              ) : null}
            </div>
          </div>

          {/* Detalle */}
          <div className={cn('w-full min-w-0', detailOpen ? 'block' : 'hidden lg:block')}>
            <AnimatePresence mode="wait" initial={false}>
              {detailJob ? (
                <JobDetailPanel
                  key={detailJob.id}
                  job={detailJob}
                  saved={savedJobIds.includes(detailJob.id)}
                  applied={appliedJobIds.has(detailJob.id)}
                  canSave={Boolean(candidateProfileId)}
                  isAuthenticated={session.isAuthenticated}
                  onBack={() => setDetailOpen(false)}
                  onToggleSave={(shouldSave) => saveJobMutation.mutate({ jobId: detailJob.id, shouldSave })}
                  savePending={saveJobMutation.isPending}
                />
              ) : (
                <DetailEmptyState key="empty" />
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}

function JobListRow({
  job,
  active,
  saved,
  applied,
  onSelect
}: {
  job: JobRow
  active: boolean
  saved: boolean
  applied: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'flex h-24 w-full items-center gap-3 rounded-xl border bg-(--app-surface) px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--app-ring)',
        active
          ? 'border-primary-600 shadow-[0_0_0_3px_rgba(45,82,168,0.12)] dark:border-primary-400'
          : 'border-(--app-border) hover:border-primary-200 hover:shadow-[0_4px_14px_rgba(20,40,90,0.06)]'
      )}
    >
      <CompanyLogo name={job.company_profile?.display_name} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <h3 className="truncate text-[0.92rem] font-semibold text-(--app-text)">{job.title}</h3>
          <span className="shrink-0 text-[0.72rem] text-(--app-text-subtle)">{relativeDays(job.published_at ?? job.updated_at)}</span>
        </div>
        <p className="mt-0.5 truncate text-[0.8rem] text-(--app-text-muted)">{job.company_profile?.display_name || 'Empresa'}</p>
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3 text-[0.74rem] text-(--app-text-subtle)">
            <span className="inline-flex min-w-0 items-center gap-1">
              <MapPin aria-hidden className="size-3.5 shrink-0" /> <span className="truncate">{job.city_name || locationLabel(job)}</span>
            </span>
            {job.workplace_type ? (
              <span className="inline-flex shrink-0 items-center gap-1">
                <Clock3 aria-hidden className="size-3.5" /> {workplaceLabel(job.workplace_type)}
              </span>
            ) : null}
          </div>
          {applied ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[0.68rem] font-semibold text-emerald-700 dark:bg-emerald-500/12 dark:text-emerald-300">
              <Check className="size-3" /> Aplicaste
            </span>
          ) : saved ? (
            <BookmarkCheck aria-label="Guardada" className="size-4 shrink-0 text-primary-600 dark:text-primary-300" />
          ) : null}
        </div>
      </div>
    </button>
  )
}

function DetailEmptyState() {
  const shouldReduceMotion = useReducedMotion()
  return (
    <motion.article
      initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 12, filter: 'blur(6px)' }}
      animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, filter: 'blur(0px)' }}
      exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -8, filter: 'blur(6px)' }}
      transition={shouldReduceMotion ? { duration: 0.2 } : { duration: 0.95, ease: softEase }}
      className="flex min-h-80 flex-col items-center justify-center rounded-panel border border-(--app-border) bg-(--app-surface) p-10 text-center shadow-sm lg:min-h-128"
    >
      <span className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary-50 text-primary-600 dark:bg-primary-500/12 dark:text-primary-300">
        <Briefcase className="size-6" />
      </span>
      <h3 className="text-base font-semibold text-(--app-text)">Selecciona una vacante</h3>
      <p className="mt-1.5 max-w-xs text-sm leading-6 text-(--app-text-muted)">
        Elige una oportunidad de la lista para ver el detalle completo y postularte.
      </p>
    </motion.article>
  )
}

const detailTagClass =
  'inline-flex h-[30px] items-center gap-1.5 rounded-lg border border-(--app-border) bg-(--app-surface-muted) px-3 text-[0.78rem] font-medium text-(--app-text-muted)'

// Entrada suave del panel de detalle: el card entra con un sutil desenfoque,
// escala y desplazamiento, y su contenido se asienta en cascada.
const detailPanelVariants: Variants = {
  hidden: { opacity: 0, y: 16, scale: 0.985, filter: 'blur(8px)' },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: 'blur(0px)',
    transition: { duration: 0.95, ease: softEase, when: 'beforeChildren', staggerChildren: 0.13, delayChildren: 0.08 }
  },
  exit: { opacity: 0, y: -10, scale: 0.992, filter: 'blur(6px)', transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } }
}

const detailBlockVariants: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.95, ease: softEase } }
}

const applyLinkClass =
  'inline-flex h-11 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-primary-600 bg-primary-600 px-5 text-sm font-semibold text-white shadow-[0_10px_20px_rgba(43,69,143,0.18)] transition hover:border-primary-700 hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--app-ring) focus-visible:ring-offset-2'

function JobDetailPanel({
  job,
  saved,
  applied,
  canSave,
  isAuthenticated,
  onBack,
  onToggleSave,
  savePending
}: {
  job: JobRow
  saved: boolean
  applied: boolean
  canSave: boolean
  isAuthenticated: boolean
  onBack: () => void
  onToggleSave: (shouldSave: boolean) => void
  savePending: boolean
}) {
  const detailQuery = useQuery({
    queryKey: ['jobs', 'detail-panel', job.slug],
    enabled: job.slug.length > 0,
    queryFn: async () => getPublicJobBySlug(job.slug)
  })
  const detail = detailQuery.data
  const sector = classifySector(job.company_profile?.industry)
  const shouldReduceMotion = useReducedMotion()

  // En "reduce motion" mantenemos sólo un fundido discreto, sin desplazamiento,
  // escala ni desenfoque, respetando la preferencia del sistema.
  const panelMotion = shouldReduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.2 } }
    : { variants: detailPanelVariants, initial: 'hidden' as const, animate: 'show' as const, exit: 'exit' as const }
  const blockVariants = shouldReduceMotion ? undefined : detailBlockVariants

  async function handleShare() {
    const url = typeof window !== 'undefined' ? `${window.location.origin}${surfacePaths.public.jobDetail(job.slug)}` : ''
    const shareData = { title: job.title, text: `${job.title} · ${job.company_profile?.display_name ?? 'ASI'}`, url }
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share(shareData)
        return
      }
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(url)
        toast.success('Enlace copiado al portapapeles')
      }
    } catch {
      // El usuario canceló el diálogo de compartir: no es un error que reportar.
    }
  }

  return (
    <motion.article
      {...panelMotion}
      style={{ willChange: 'transform, filter, opacity' }}
      className="overflow-hidden rounded-panel border border-(--app-border) bg-(--app-surface) shadow-sm lg:sticky lg:top-4 lg:max-h-[calc(100vh-9rem)] lg:overflow-y-auto"
    >
      <motion.div variants={blockVariants} className="border-b border-(--app-border) p-6">
        <button type="button" onClick={onBack} className="mb-3 inline-flex items-center gap-1.5 text-[0.82rem] font-medium text-(--app-text-muted) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--app-ring) lg:hidden">
          <ArrowLeft aria-hidden className="size-4" /> Volver a resultados
        </button>
        <div className="flex items-start gap-4">
          <CompanyLogo name={job.company_profile?.display_name} size="lg" />
          <div className="min-w-0 flex-1">
            <h2 className="text-balance text-xl font-bold leading-tight tracking-tight text-(--app-text)">{job.title}</h2>
            <p className="mt-1.5 inline-flex items-center gap-1.5 text-sm font-medium text-(--app-text-muted)">
              <Building2 aria-hidden className="size-4" /> {job.company_profile?.display_name || 'Empresa'}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className={detailTagClass}><MapPin aria-hidden className="size-3.5 text-(--app-text-subtle)" /> {locationLabel(job)}</span>
          {job.workplace_type ? <span className={detailTagClass}><Clock3 aria-hidden className="size-3.5 text-(--app-text-subtle)" /> {workplaceLabel(job.workplace_type)}</span> : null}
          <span className={detailTagClass}><Briefcase aria-hidden className="size-3.5 text-(--app-text-subtle)" /> {employmentLabel(job.employment_type) || getOpportunityTypeLabel(job.opportunity_type)}</span>
          {job.experience_level ? <span className={detailTagClass}><Sparkles aria-hidden className="size-3.5 text-(--app-text-subtle)" /> {job.experience_level}</span> : null}
          <span className={cn(detailTagClass, hasSalary(job) && 'border-emerald-200 text-emerald-700 dark:border-emerald-500/30 dark:text-emerald-300')}>
            <Banknote aria-hidden className="size-3.5" /> {salaryText(job)}
          </span>
        </div>
      </motion.div>

      {/* Barra de acciones */}
      <motion.div variants={blockVariants} className="flex items-center gap-2.5 border-b border-(--app-border) px-6 py-4">
        {applied ? (
          <Link className={applyLinkClass} to={surfacePaths.public.jobApply(job.slug)}>
            <FileText className="size-4" /> Actualizar CV
          </Link>
        ) : isAuthenticated ? (
          <Link className={applyLinkClass} to={surfacePaths.public.jobApply(job.slug)}>
            Postularme ahora <ArrowRight className="size-4" />
          </Link>
        ) : (
          <Link className={applyLinkClass} to="/auth/sign-in">
            Inicia sesión para postularte
          </Link>
        )}
        {isAuthenticated && !applied ? (
          <Tooltip label={saved ? 'Quitar de guardadas' : 'Guardar vacante'}>
            <Button
              variant="outline"
              className="size-11 shrink-0 rounded-xl p-0"
              aria-label={saved ? 'Quitar de guardadas' : 'Guardar vacante'}
              onClick={() => onToggleSave(!saved)}
              disabled={savePending || !canSave}
            >
              {saved ? <BookmarkCheck className="size-5" /> : <Bookmark className="size-5" />}
            </Button>
          </Tooltip>
        ) : null}
        <Tooltip label="Compartir">
          <Button variant="outline" className="size-11 shrink-0 rounded-xl p-0" aria-label="Compartir vacante" onClick={() => void handleShare()}>
            <Share2 className="size-5" />
          </Button>
        </Tooltip>
      </motion.div>

      <motion.div variants={blockVariants} className="divide-y divide-(--app-border)">
        <section className="px-6 py-5">
          <h4 className="mb-3 text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-(--app-text-subtle)">Descripción del puesto</h4>
          {job.summary ? (
            <p className="text-sm leading-7 text-(--app-text-muted)">{job.summary}</p>
          ) : (
            <p className="line-clamp-4 whitespace-pre-wrap text-sm leading-7 text-(--app-text-muted)">
              {job.description || 'La empresa aún no agregó una descripción detallada.'}
            </p>
          )}
          <Link
            to={surfacePaths.public.jobDetail(job.slug)}
            className="mt-3 inline-flex items-center gap-1.5 text-[0.82rem] font-medium text-primary-600 hover:underline dark:text-primary-300"
          >
            Ver vacante completa <ArrowRight aria-hidden className="size-3.5" />
          </Link>
        </section>

        <section className="px-6 py-5">
          <h4 className="mb-3 inline-flex items-center gap-2 text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-(--app-text-subtle)">
            <Building2 aria-hidden className="size-3.5" /> Sobre la empresa
          </h4>
          {sector ? (
            <span className="mb-2 inline-flex items-center rounded-full bg-primary-50 px-2.5 py-0.5 text-[0.7rem] font-semibold text-primary-700 dark:bg-primary-500/12 dark:text-primary-300">
              {getSectorLabel(sector)}
            </span>
          ) : null}
          <p className="text-[0.85rem] font-medium text-(--app-text)">{job.company_profile?.display_name || 'Empresa'}</p>
          {job.company_profile?.industry ? <p className="mt-0.5 text-[0.8rem] text-(--app-text-muted)">{job.company_profile.industry}</p> : null}
          {detail?.company_profile?.website_url ? (
            <a className="mt-3 inline-flex items-center gap-1.5 text-[0.82rem] font-medium text-primary-600 hover:underline dark:text-primary-300" href={detail.company_profile.website_url} rel="noreferrer" target="_blank">
              <Globe aria-hidden className="size-4" /> Visitar sitio web
            </a>
          ) : null}
        </section>
      </motion.div>
    </motion.article>
  )
}
