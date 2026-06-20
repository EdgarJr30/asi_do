import { useMemo, useState } from 'react'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  Bookmark,
  BookmarkCheck,
  Briefcase,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Globe,
  MapPin,
  Search,
  SlidersHorizontal,
  Sparkles,
  X
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { surfacePaths } from '@/app/router/surface-paths'
import { useAppSession } from '@/app/providers/app-session-provider'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { PageLoader } from '@/components/ui/loader'
import { Select } from '@/components/ui/select'
import { toErrorMessage } from '@/features/auth/lib/auth-api'
import { listMyApplications } from '@/features/applications/lib/applications-api'
import { fetchMyCandidateProfile } from '@/features/candidate-profile/lib/candidate-profile-api'
import { getPublicJobBySlug, listPublicJobs, toggleSavedJob, type JobPostingBundle } from '@/features/jobs/lib/jobs-api'
import { classifySector, getSectorLabel, sectorDefinitions } from '@/features/jobs/lib/sectors'
import { getCompensationTypeLabel, getOpportunityTypeLabel, opportunityTypeOptions } from '@/features/opportunities/lib/opportunity-taxonomy'
import { reportErrorWithToast } from '@/lib/errors/error-reporting'
import { cn } from '@/lib/utils/cn'

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

const primaryLinkClass =
  'inline-flex h-12 items-center justify-center gap-2 whitespace-nowrap rounded-2xl border border-primary-600 bg-primary-600 px-7 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(43,69,143,0.2)] transition hover:border-primary-700 hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--app-ring) focus-visible:ring-offset-2'

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

function CompanyAvatar({ name, size = 'md' }: { name: string | null | undefined; size?: 'md' | 'lg' }) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-2xl bg-primary-50 font-semibold text-primary-700 dark:bg-primary-500/12 dark:text-primary-300',
        size === 'lg' ? 'size-14 text-lg' : 'size-12 text-sm'
      )}
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

  const [filters, setFilters] = useState<Filters>(emptyFilters)
  const [sort, setSort] = useState<'recent' | 'salary'>('recent')
  const [page, setPage] = useState(0)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState(false) // controla móvil: lista ↔ detalle

  function patchFilters(patch: Partial<Filters>) {
    setFilters((current) => ({ ...current, ...patch }))
    setPage(0)
  }

  const candidateProfileQuery = useQuery({
    queryKey: ['candidate-profile', 'mine', 'jobs-board'],
    enabled: session.isAuthenticated,
    queryFn: async () => fetchMyCandidateProfile(session.authUser!.id)
  })
  const candidateProfileId = candidateProfileQuery.data?.profile?.id ?? null

  const jobsQuery = useQuery({
    queryKey: [...PUBLIC_JOBS_QUERY_KEY, candidateProfileId],
    queryFn: async () => listPublicJobs({ candidateProfileId })
  })

  const applicationsQuery = useQuery({
    queryKey: ['applications', 'mine', 'jobs-board', session.authUser?.id ?? null],
    enabled: session.isAuthenticated,
    queryFn: async () => listMyApplications(session.authUser!.id)
  })

  const allJobs = useMemo(() => jobsQuery.data?.jobs ?? [], [jobsQuery.data])
  const savedJobIds = jobsQuery.data?.savedJobIds ?? []
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

  const filteredJobs = useMemo(() => {
    const search = filters.search.trim().toLowerCase()
    const location = filters.location.trim().toLowerCase()
    const result = allJobs.filter((job) => {
      if (search) {
        const haystack = [job.title, job.company_profile?.display_name, job.summary].filter(Boolean).join(' ').toLowerCase()
        if (!haystack.includes(search)) return false
      }
      if (location) {
        const haystack = [job.city_name, job.country_code].filter(Boolean).join(' ').toLowerCase()
        if (!haystack.includes(location)) return false
      }
      if (filters.sector && classifySector(job.company_profile?.industry) !== filters.sector) return false
      if (filters.workplace && job.workplace_type !== filters.workplace) return false
      if (filters.type && job.opportunity_type !== filters.type) return false
      return true
    })
    if (sort === 'salary') {
      result.sort((a, b) => (b.compensation_max_amount ?? b.compensation_min_amount ?? -1) - (a.compensation_max_amount ?? a.compensation_min_amount ?? -1))
    }
    return result
  }, [allJobs, filters, sort])

  const totalPages = Math.max(1, Math.ceil(filteredJobs.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages - 1)
  const pageJobs = filteredJobs.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE)
  const detailJob = filteredJobs.find((job) => job.id === selectedJobId) ?? pageJobs[0] ?? null

  const activeChips = [
    filters.search ? { key: 'search', label: `"${filters.search}"`, clear: () => patchFilters({ search: '' }) } : null,
    filters.location ? { key: 'location', label: filters.location, clear: () => patchFilters({ location: '' }) } : null,
    filters.sector ? { key: 'sector', label: getSectorLabel(filters.sector), clear: () => patchFilters({ sector: '' }) } : null,
    filters.workplace ? { key: 'workplace', label: workplaceLabel(filters.workplace), clear: () => patchFilters({ workplace: '' }) } : null,
    filters.type ? { key: 'type', label: getOpportunityTypeLabel(filters.type), clear: () => patchFilters({ type: '' }) } : null
  ].filter(Boolean) as Array<{ key: string; label: string; clear: () => void }>

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

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-[1.7rem] font-semibold tracking-tight text-(--app-text) sm:text-[2rem]">Empleos</h1>
        <p className="text-sm text-(--app-text-muted)">Encuentra tu próxima oportunidad. Busca, abre una vacante y aplica en un clic.</p>
      </header>

      {/* Búsqueda */}
      <form
        className="flex flex-col gap-2.5 rounded-panel border border-(--app-border) bg-(--app-surface) p-2.5 shadow-[0_10px_30px_rgba(16,25,58,0.06)] sm:flex-row sm:items-center"
        onSubmit={(event) => event.preventDefault()}
        role="search"
      >
        <div className="relative flex-1">
          <Search aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-(--app-text-subtle)" />
          <Input
            className="h-12 border-transparent bg-transparent pl-10 shadow-none focus:bg-(--app-surface-muted)"
            placeholder="Cargo, empresa o palabra clave"
            aria-label="Buscar por cargo, empresa o palabra clave"
            value={filters.search}
            onChange={(event) => patchFilters({ search: event.target.value })}
          />
        </div>
        <div className="relative sm:w-56">
          <MapPin aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-(--app-text-subtle)" />
          <Input
            className="h-12 border-transparent bg-transparent pl-10 shadow-none focus:bg-(--app-surface-muted) sm:border-l sm:border-l-(--app-border) sm:rounded-l-none"
            placeholder="Ciudad o país"
            aria-label="Filtrar por ubicación"
            value={filters.location}
            onChange={(event) => patchFilters({ location: event.target.value })}
          />
        </div>
        <Button type="submit" className="h-12">
          <Search className="size-4" /> Buscar
        </Button>
      </form>

      {/* Controles */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setFiltersOpen((value) => !value)}
          aria-expanded={filtersOpen}
          className="inline-flex h-10 items-center gap-2 rounded-full border border-(--app-border) bg-(--app-surface) px-4 text-sm font-medium text-(--app-text) transition hover:border-primary-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--app-ring)"
        >
          <SlidersHorizontal className="size-4 text-(--app-text-muted)" /> Filtros
          {activeChips.length > 0 ? (
            <span className="rounded-full bg-primary-600 px-1.5 text-xs font-bold text-white">{activeChips.length}</span>
          ) : null}
        </button>
        <span className="text-sm text-(--app-text-muted)">
          {jobsQuery.isLoading ? 'Cargando…' : `${filteredJobs.length} ${filteredJobs.length === 1 ? 'empleo' : 'empleos'}`}
        </span>
        <label className="ml-auto flex items-center gap-2 text-sm text-(--app-text-muted)">
          Ordenar por
          <Select className="h-9 w-auto" value={sort} onChange={(event) => setSort(event.target.value as 'recent' | 'salary')} aria-label="Ordenar resultados">
            <option value="recent">Más recientes</option>
            <option value="salary">Mejor salario</option>
          </Select>
        </label>
      </div>

      {filtersOpen ? (
        <div className="grid gap-3 rounded-panel border border-(--app-border) bg-(--app-surface) p-4 sm:grid-cols-3">
          <label className="text-sm">
            <span className="mb-1.5 block font-medium text-(--app-text-muted)">Sector</span>
            <Select className="h-10" value={filters.sector} onChange={(event) => patchFilters({ sector: event.target.value })}>
              <option value="">Todos los sectores</option>
              {sectorOptions.map((sector) => (
                <option key={sector.id} value={sector.id}>
                  {sector.label} ({sector.count})
                </option>
              ))}
            </Select>
          </label>
          <label className="text-sm">
            <span className="mb-1.5 block font-medium text-(--app-text-muted)">Modalidad</span>
            <Select className="h-10" value={filters.workplace} onChange={(event) => patchFilters({ workplace: event.target.value })}>
              <option value="">Cualquier modalidad</option>
              <option value="remote">Remoto</option>
              <option value="hybrid">Híbrido</option>
              <option value="on_site">Presencial</option>
            </Select>
          </label>
          <label className="text-sm">
            <span className="mb-1.5 block font-medium text-(--app-text-muted)">Tipo</span>
            <Select className="h-10" value={filters.type} onChange={(event) => patchFilters({ type: event.target.value })}>
              <option value="">Todos los tipos</option>
              {opportunityTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </label>
        </div>
      ) : null}

      {activeChips.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {activeChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={chip.clear}
              className="inline-flex items-center gap-1.5 rounded-full border border-primary-200 bg-primary-50 px-3 py-1 text-xs font-medium text-primary-700 transition hover:bg-primary-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--app-ring) dark:border-primary-500/30 dark:bg-primary-500/12 dark:text-primary-300"
            >
              {chip.label}
              <X aria-hidden className="size-3" />
              <span className="sr-only">Quitar filtro</span>
            </button>
          ))}
          <button type="button" onClick={() => { setFilters(emptyFilters); setPage(0) }} className="text-xs font-medium text-(--app-text-muted) underline-offset-2 hover:underline">
            Limpiar todo
          </button>
        </div>
      ) : null}

      {/* Contenido */}
      {jobsQuery.isLoading ? (
        <PageLoader label="Buscando empleos" hint="Cargando las oportunidades disponibles" />
      ) : jobsQuery.error ? (
        <div className="rounded-panel border border-rose-200 bg-rose-50 px-4 py-6 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
          {toErrorMessage(jobsQuery.error)}
        </div>
      ) : filteredJobs.length === 0 ? (
        <EmptyState
          title="No encontramos empleos con estos filtros"
          description="Prueba con menos filtros o cambia las palabras clave para ampliar tu búsqueda."
          actionLabel={activeChips.length > 0 ? 'Limpiar filtros' : undefined}
          onAction={activeChips.length > 0 ? () => { setFilters(emptyFilters); setPage(0) } : undefined}
        />
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
          {/* Lista */}
          <div className={cn(detailOpen ? 'hidden lg:block' : 'block')}>
            <ul className="space-y-3">
              {pageJobs.map((job) => (
                <li key={job.id}>
                  <JobListCard
                    job={job}
                    active={job.id === detailJob?.id}
                    saved={savedJobIds.includes(job.id)}
                    applied={appliedJobIds.has(job.id)}
                    onSelect={() => openJob(job.id)}
                  />
                </li>
              ))}
            </ul>
            {totalPages > 1 ? <Pager page={safePage} totalPages={totalPages} onGo={(p) => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }) }} /> : null}
          </div>

          {/* Detalle */}
          <div className={cn(detailOpen ? 'block' : 'hidden lg:block')}>
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
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}

function JobListCard({
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
        'flex w-full gap-3.5 rounded-panel border bg-(--app-surface) p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--app-ring)',
        active
          ? 'border-primary-400 ring-1 ring-primary-300 dark:border-primary-500/50 dark:ring-primary-500/25'
          : 'border-(--app-border) hover:border-primary-200'
      )}
    >
      <CompanyAvatar name={job.company_profile?.display_name} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="truncate text-[0.98rem] font-semibold text-(--app-text)">{job.title}</h3>
          {saved ? <BookmarkCheck aria-label="Guardada" className="size-4 shrink-0 text-primary-600 dark:text-primary-300" /> : null}
        </div>
        <p className="mt-0.5 truncate text-sm text-(--app-text-muted)">{job.company_profile?.display_name || 'Empresa'}</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-(--app-text-muted)">
          <span className="inline-flex items-center gap-1">
            <MapPin aria-hidden className="size-3.5" /> {locationLabel(job)}
          </span>
          {job.workplace_type ? (
            <span className="inline-flex items-center gap-1">
              <Globe aria-hidden className="size-3.5" /> {workplaceLabel(job.workplace_type)}
            </span>
          ) : null}
        </div>
        <div className="mt-2.5 flex items-center justify-between gap-2">
          {hasSalary(job) ? (
            <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{salaryText(job)}</span>
          ) : (
            <span className="text-xs text-(--app-text-subtle)">Salario no divulgado</span>
          )}
          <span className="text-xs text-(--app-text-subtle)">{relativeDays(job.published_at ?? job.updated_at)}</span>
        </div>
        {applied ? (
          <span className="mt-2.5 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[0.7rem] font-semibold text-emerald-700 dark:bg-emerald-500/12 dark:text-emerald-300">
            <CheckCircle2 className="size-3" /> Ya aplicaste
          </span>
        ) : null}
      </div>
    </button>
  )
}

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
  const questionsCount = detail?.job_screening_questions?.length ?? 0
  const applyHint = questionsCount > 0 ? `Postulación rápida · ${questionsCount} ${questionsCount === 1 ? 'pregunta' : 'preguntas'}` : 'Aplica con tu perfil en un paso'

  return (
    <article className="overflow-hidden rounded-panel border border-(--app-border) bg-(--app-surface) shadow-[0_8px_24px_rgba(15,23,42,0.05)] lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
      <div className="border-b border-(--app-border) bg-(--app-surface-muted) p-5 sm:p-6">
        <button type="button" onClick={onBack} className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-(--app-text-muted) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--app-ring) lg:hidden">
          <ArrowLeft aria-hidden className="size-4" /> Volver a resultados
        </button>
        <div className="flex items-start gap-4">
          <CompanyAvatar name={job.company_profile?.display_name} size="lg" />
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-semibold leading-tight tracking-tight text-(--app-text) sm:text-2xl">{job.title}</h2>
            <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-(--app-text-muted)">
              <Building2 aria-hidden className="size-4" /> {job.company_profile?.display_name || 'Empresa'}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-(--app-text-muted)">
          <span className="inline-flex items-center gap-1.5"><MapPin aria-hidden className="size-4" /> {locationLabel(job)}</span>
          {job.workplace_type ? <span className="inline-flex items-center gap-1.5"><Globe aria-hidden className="size-4" /> {workplaceLabel(job.workplace_type)}</span> : null}
          <span className="inline-flex items-center gap-1.5"><Briefcase aria-hidden className="size-4" /> {employmentLabel(job.employment_type) || getOpportunityTypeLabel(job.opportunity_type)}</span>
          {job.experience_level ? <span className="inline-flex items-center gap-1.5"><Sparkles aria-hidden className="size-4" /> {job.experience_level}</span> : null}
          <span className={cn('inline-flex items-center gap-1.5', hasSalary(job) && 'font-semibold text-emerald-600 dark:text-emerald-400')}>
            <Banknote aria-hidden className="size-4" /> {salaryText(job)}
          </span>
          <span className="inline-flex items-center gap-1.5"><CalendarClock aria-hidden className="size-4" /> {relativeDays(job.published_at ?? job.updated_at)}</span>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          {applied ? (
            <span className="inline-flex h-12 items-center gap-2 rounded-2xl bg-emerald-50 px-6 text-sm font-semibold text-emerald-700 dark:bg-emerald-500/12 dark:text-emerald-300">
              <CheckCircle2 className="size-5" /> Ya aplicaste
            </span>
          ) : isAuthenticated ? (
            <Link className={primaryLinkClass} to={surfacePaths.public.jobApply(job.slug)}>
              Aplicar ahora <ArrowRight className="size-4" />
            </Link>
          ) : (
            <Link className={primaryLinkClass} to="/auth/sign-in">
              Inicia sesión para aplicar
            </Link>
          )}
          {isAuthenticated && !applied ? (
            <Button variant="outline" className="h-12 w-12 p-0" aria-label={saved ? 'Quitar de guardadas' : 'Guardar vacante'} onClick={() => onToggleSave(!saved)} disabled={savePending || !canSave}>
              {saved ? <BookmarkCheck className="size-5" /> : <Bookmark className="size-5" />}
            </Button>
          ) : null}
          {!applied ? <p className="text-xs text-(--app-text-subtle)">{detailQuery.isLoading ? 'Cargando detalles…' : applyHint}</p> : null}
        </div>
      </div>

      <div className="space-y-6 p-5 sm:p-6">
        {job.summary ? <p className="text-sm leading-7 text-(--app-text-muted)">{job.summary}</p> : null}

        <section>
          <h3 className="text-sm font-semibold text-(--app-text)">Sobre el rol</h3>
          <div className="mt-2 whitespace-pre-wrap text-sm leading-7 text-(--app-text-muted)">
            {job.description || 'La empresa aún no agregó una descripción detallada.'}
          </div>
        </section>

        <section className="rounded-2xl border border-(--app-border) bg-(--app-surface-muted) p-4">
          <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-(--app-text)"><Building2 aria-hidden className="size-4" /> Sobre la empresa</h3>
          {sector ? (
            <span className="mt-2 inline-flex items-center rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700 dark:bg-primary-500/12 dark:text-primary-300">
              {getSectorLabel(sector)}
            </span>
          ) : null}
          <p className="mt-2 text-sm font-medium text-(--app-text)">{job.company_profile?.display_name || 'Empresa'}</p>
          {job.company_profile?.industry ? <p className="mt-0.5 text-sm text-(--app-text-muted)">{job.company_profile.industry}</p> : null}
          {detail?.company_profile?.description ? <p className="mt-2 text-sm leading-6 text-(--app-text-muted)">{detail.company_profile.description}</p> : null}
          {detail?.company_profile?.website_url ? (
            <a className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:underline dark:text-primary-300" href={detail.company_profile.website_url} rel="noreferrer" target="_blank">
              <Globe aria-hidden className="size-4" /> Visitar sitio web
            </a>
          ) : null}
        </section>

        {questionsCount > 0 ? (
          <section>
            <h3 className="text-sm font-semibold text-(--app-text)">Qué te preguntarán al aplicar</h3>
            <ul className="mt-2 space-y-2">
              {detail!.job_screening_questions!.map((question) => (
                <li key={question.id} className="rounded-2xl border border-(--app-border) bg-(--app-surface-muted) px-4 py-3 text-sm">
                  <p className="font-medium text-(--app-text)">{question.question_text}</p>
                  <p className="mt-0.5 text-xs text-(--app-text-subtle)">{question.is_required ? 'Requerida' : 'Opcional'}</p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </article>
  )
}

function Pager({ page, totalPages, onGo }: { page: number; totalPages: number; onGo: (page: number) => void }) {
  const pages: Array<number | 'dots'> = []
  for (let i = 0; i < totalPages; i++) {
    if (i === 0 || i === totalPages - 1 || Math.abs(i - page) <= 1) pages.push(i)
    else if (Math.abs(i - page) === 2) pages.push('dots')
  }
  const btn = 'inline-flex h-9 min-w-9 items-center justify-center rounded-xl border px-2.5 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--app-ring)'
  return (
    <nav className="mt-4 flex items-center justify-center gap-1.5" aria-label="Paginación">
      <button type="button" className={cn(btn, 'border-(--app-border) disabled:opacity-40')} onClick={() => onGo(page - 1)} disabled={page === 0} aria-label="Página anterior">
        <ChevronLeft className="size-4" />
      </button>
      {pages.map((p, index) =>
        p === 'dots' ? (
          <span key={`dots-${index}`} className="px-1 text-(--app-text-subtle)">…</span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onGo(p)}
            aria-current={p === page ? 'page' : undefined}
            className={cn(btn, p === page ? 'border-primary-600 bg-primary-600 font-semibold text-white' : 'border-(--app-border) text-(--app-text) hover:border-primary-200')}
          >
            {p + 1}
          </button>
        )
      )}
      <button type="button" className={cn(btn, 'border-(--app-border) disabled:opacity-40')} onClick={() => onGo(page + 1)} disabled={page === totalPages - 1} aria-label="Página siguiente">
        <ChevronRight className="size-4" />
      </button>
    </nav>
  )
}

