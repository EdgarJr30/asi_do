import { useMemo, useState } from 'react'

import { useQuery } from '@tanstack/react-query'
import { motion, useReducedMotion } from 'motion/react'
import { ArrowRight, CalendarDays, Check, Clock3, FileText, Search, Send } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/loader'
import { Pagination } from '@/components/ui/pagination'
import { useAppSession } from '@/app/providers/app-session-provider'
import { surfacePaths } from '@/app/router/surface-paths'
import { toErrorMessage } from '@/features/auth/lib/auth-api'
import { listMyApplications } from '@/features/applications/lib/applications-api'
import { applicationStatusLabel } from '@/features/applications/lib/application-status'
import {
  applicationMatchesFilter,
  buildApplicationFilterCounts,
  type ApplicationFilter,
  type PublicApplicationStatus
} from '@/features/applications/lib/application-overview-filters'
import { cn } from '@/lib/utils/cn'
import { useRealtimeSync } from '@/lib/realtime/use-realtime-sync'
import { cardReveal, gridStagger, pageStagger } from '@/shared/ui/card-motion'

const PAGE_SIZE = 10
const dateFormatter = new Intl.DateTimeFormat('es', { day: '2-digit', month: 'short', year: 'numeric' })

const FILTER_OPTIONS: Array<{ key: ApplicationFilter; label: string }> = [
  { key: 'all', label: 'Todas' },
  { key: 'sent', label: 'Enviadas' },
  { key: 'review', label: 'En revisión' },
  { key: 'hired', label: 'Contratadas' }
]

const FILTER_STATS: Array<{
  key: ApplicationFilter
  label: string
  icon: LucideIcon
  chipClassName: string
}> = [
  {
    key: 'all',
    label: 'Total',
    icon: FileText,
    chipClassName: 'bg-primary-50 text-primary-700 dark:bg-primary-500/12 dark:text-primary-200'
  },
  {
    key: 'sent',
    label: 'Enviadas',
    icon: Send,
    chipClassName: 'bg-[#e8f0fd] text-[#2d6fdb] dark:bg-[#2d6fdb]/15 dark:text-[#9ec0ff]'
  },
  {
    key: 'review',
    label: 'En revisión',
    icon: Clock3,
    chipClassName: 'bg-[#fbf1de] text-[#c5820f] dark:bg-[#c5820f]/16 dark:text-[#f3c56a]'
  },
  {
    key: 'hired',
    label: 'Contratadas',
    icon: Check,
    chipClassName: 'bg-[#e8f6ee] text-[#1f9d61] dark:bg-[#1f9d61]/16 dark:text-[#7ee1a8]'
  }
]

function formatSubmittedAt(value?: string | null) {
  if (!value) {
    return 'fecha no disponible'
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'fecha no disponible' : dateFormatter.format(date)
}

function getJobDetailPath(slug?: string | null) {
  const normalizedSlug = slug?.trim()

  return normalizedSlug ? surfacePaths.public.jobDetail(normalizedSlug) : surfacePaths.public.jobs
}

function applicationStatusPillClass(status: PublicApplicationStatus) {
  switch (status) {
    case 'submitted':
      return 'bg-[#e8f0fd] text-[#2d6fdb] dark:bg-[#2d6fdb]/15 dark:text-[#9ec0ff]'
    case 'in_review':
    case 'interviewing':
    case 'offer':
      return 'bg-[#fbf1de] text-[#c5820f] dark:bg-[#c5820f]/16 dark:text-[#f3c56a]'
    case 'hired':
      return 'bg-[#e8f6ee] text-[#1f9d61] dark:bg-[#1f9d61]/16 dark:text-[#7ee1a8]'
    case 'rejected':
    case 'withdrawn':
      return 'bg-(--app-surface-muted) text-(--app-text-muted)'
    default:
      return 'bg-primary-50 text-primary-700 dark:bg-primary-500/12 dark:text-primary-200'
  }
}

function applicationMatchesQuery(
  application: Awaited<ReturnType<typeof listMyApplications>>[number],
  query: string
) {
  const normalizedQuery = query.trim().toLowerCase()

  if (!normalizedQuery) {
    return true
  }

  const title = application.job_posting?.title?.toLowerCase() ?? ''
  const company = application.job_posting?.company_profile?.display_name?.toLowerCase() ?? ''

  return title.includes(normalizedQuery) || company.includes(normalizedQuery)
}

export function ApplicationsOverviewPage() {
  const navigate = useNavigate()
  const session = useAppSession()
  const shouldReduceMotion = useReducedMotion()
  const [page, setPage] = useState(0)
  const [activeFilter, setActiveFilter] = useState<ApplicationFilter>('all')
  const [query, setQuery] = useState('')

  const myApplicationsQuery = useQuery({
    queryKey: ['applications', 'mine', session.authUser?.id ?? null],
    enabled: session.isAuthenticated,
    queryFn: async () => listMyApplications(session.authUser!.id)
  })

  // En vivo: el candidato ve cambiar el estado de sus postulaciones en el momento
  // en que la empresa las mueve de etapa. RLS limita los eventos a sus filas.
  useRealtimeSync(
    'my-applications',
    [{ table: 'applications', invalidate: [['applications', 'mine', session.authUser?.id ?? null]] }],
    { enabled: session.isAuthenticated }
  )

  const applications = useMemo(() => myApplicationsQuery.data ?? [], [myApplicationsQuery.data])
  const filterCounts = useMemo(
    () => buildApplicationFilterCounts(applications.map((application) => application.status_public)),
    [applications]
  )
  const filteredApplications = useMemo(
    () =>
      applications.filter(
        (application) =>
          applicationMatchesFilter(application.status_public, activeFilter) && applicationMatchesQuery(application, query)
      ),
    [activeFilter, applications, query]
  )
  const totalPages = Math.max(1, Math.ceil(filteredApplications.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages - 1)
  const paginatedApplications = useMemo(
    () => filteredApplications.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE),
    [filteredApplications, safePage]
  )
  const firstVisible = filteredApplications.length ? safePage * PAGE_SIZE + 1 : 0
  const lastVisible = Math.min(filteredApplications.length, safePage * PAGE_SIZE + PAGE_SIZE)

  function applyFilter(filter: ApplicationFilter) {
    setActiveFilter(filter)
    setPage(0)
  }

  function applyQuery(value: string) {
    setQuery(value)
    setPage(0)
  }

  return (
    <motion.div
      className="mx-auto max-w-[1080px] space-y-4"
      variants={pageStagger}
      initial={shouldReduceMotion ? false : 'hidden'}
      animate="show"
    >
      <motion.header variants={cardReveal} className="space-y-1.5">
        <h1 className="text-xl font-semibold tracking-tight text-(--app-text) sm:text-[1.6rem]">Postulaciones</h1>
        <p className="max-w-2xl text-[0.84rem] leading-relaxed text-(--app-text-muted)">
          Revisa tus postulaciones, el estado actual de cada proceso y vuelve al detalle de la vacante cuando lo necesites.
        </p>
      </motion.header>

      <motion.div variants={cardReveal} className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        {FILTER_STATS.map((stat) => {
          const Icon = stat.icon
          const isActive = stat.key === activeFilter

          return (
            <button
              key={stat.key}
              type="button"
              onClick={() => applyFilter(stat.key)}
              aria-pressed={isActive}
              className={cn(
                'flex min-h-16 items-center gap-3 rounded-xl border border-(--app-border) bg-(--app-surface-elevated) px-4 py-3 text-left transition-[border-color,background-color,box-shadow,transform] hover:border-primary-300 hover:bg-(--app-surface) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--app-ring) focus-visible:ring-offset-2 focus-visible:ring-offset-(--app-canvas)',
                isActive ? 'border-primary-300 shadow-[0_1px_2px_rgba(20,40,90,0.04),0_4px_16px_rgba(20,40,90,0.04)]' : ''
              )}
            >
              <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-[9px]', stat.chipClassName)}>
                <Icon className="size-4.5" />
              </span>
              <span className="min-w-0">
                <span className="block font-sans text-[1.18rem] font-bold leading-none text-(--app-text)">
                  {myApplicationsQuery.isLoading ? '...' : filterCounts[stat.key]}
                </span>
                <span className="mt-1 block text-[0.78rem] text-(--app-text-subtle)">{stat.label}</span>
              </span>
            </button>
          )
        })}
      </motion.div>

      <motion.div variants={cardReveal} className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <label className="flex h-11 min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-(--app-border) bg-(--app-surface-elevated) px-3.5 transition-[border-color,box-shadow] focus-within:border-primary-600 focus-within:ring-3 focus-within:ring-primary-600/10">
          <Search className="size-4.5 shrink-0 text-(--app-text-subtle)" />
          <span className="sr-only">Buscar por puesto o empresa</span>
          <Input
            value={query}
            onChange={(event) => applyQuery(event.target.value)}
            placeholder="Buscar por puesto o empresa"
            className="h-full rounded-none border-0 bg-transparent px-0 text-[0.9rem] shadow-none focus:border-0 focus:bg-transparent focus:ring-0"
          />
        </label>

        <div
          className="flex gap-1.5 overflow-x-auto rounded-xl border border-(--app-border) bg-(--app-surface-elevated) p-1"
          role="tablist"
          aria-label="Filtrar postulaciones por estado"
        >
          {FILTER_OPTIONS.map((option) => {
            const isActive = option.key === activeFilter

            return (
              <button
                key={option.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => applyFilter(option.key)}
                className={cn(
                  'inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg px-3 text-[0.82rem] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--app-ring) focus-visible:ring-offset-2 focus-visible:ring-offset-(--app-canvas) lg:h-10',
                  isActive
                    ? 'bg-primary-600 text-white'
                    : 'text-(--app-text-muted) hover:bg-(--app-surface-muted) hover:text-(--app-text)'
                )}
              >
                {option.label}
                <span className={cn('text-[0.72rem]', isActive ? 'text-white/80' : 'text-(--app-text-subtle)')}>
                  {filterCounts[option.key]}
                </span>
              </button>
            )
          })}
        </div>
      </motion.div>

      {myApplicationsQuery.isLoading ? (
        <motion.div variants={cardReveal}>
          <Card className="flex items-center gap-2.5 text-[0.82rem] text-(--app-text-muted)">
            <Spinner size="sm" /> Cargando historial...
          </Card>
        </motion.div>
      ) : myApplicationsQuery.error ? (
        <motion.div variants={cardReveal}>
          <Card className="text-[0.86rem] text-rose-600">{toErrorMessage(myApplicationsQuery.error)}</Card>
        </motion.div>
      ) : applications.length ? (
        <motion.div variants={cardReveal} className="space-y-1">
          <div className="flex items-baseline justify-between px-0.5 pt-2">
            <p className="text-[0.82rem] text-(--app-text-subtle)">
              <b className="font-semibold text-(--app-text)">{paginatedApplications.length}</b> de{' '}
              <b className="font-semibold text-(--app-text)">{filteredApplications.length}</b> procesos
            </p>
          </div>

          {filteredApplications.length ? (
            <>
              <Card className="overflow-hidden rounded-[14px] p-0 shadow-[0_1px_2px_rgba(20,40,90,0.04),0_4px_16px_rgba(20,40,90,0.04)]">
                <motion.ul
                  className="divide-y divide-(--app-border)"
                  variants={gridStagger}
                  initial={shouldReduceMotion ? false : 'hidden'}
                  animate="show"
                >
                  {paginatedApplications.map((application) => {
                    const status = application.status_public
                    const detailPath = getJobDetailPath(application.job_posting?.slug)

                    return (
                      <motion.li key={application.id} variants={cardReveal}>
                        <Link
                          to={detailPath}
                          className="group grid min-h-16 gap-x-3 gap-y-2 px-4 py-3.5 transition-colors hover:bg-(--app-surface-muted) sm:grid-cols-[minmax(0,1fr)_auto] sm:px-5 lg:grid-cols-[minmax(0,1fr)_8.5rem_8.5rem_7.5rem] lg:items-center lg:gap-4 lg:py-0"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-700 dark:bg-primary-500/12 dark:text-primary-200">
                              <FileText className="size-4.5" />
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-[0.9rem] font-semibold leading-tight text-(--app-text)">
                                {application.job_posting?.title || 'Vacante'}
                              </p>
                              <p className="mt-0.5 truncate text-[0.82rem] text-(--app-text-muted)">
                                {application.job_posting?.company_profile?.display_name || 'Empresa'}
                              </p>
                            </div>
                          </div>

                          <span className="inline-flex items-center gap-1.5 text-[0.82rem] text-(--app-text-subtle) sm:col-start-1 lg:col-start-auto">
                            <CalendarDays className="size-3.5 shrink-0" /> {formatSubmittedAt(application.submitted_at)}
                          </span>

                          <span
                            className={cn(
                              'inline-flex h-7 w-fit items-center gap-1.5 justify-self-end rounded-full px-3 text-[0.78rem] font-semibold sm:col-start-2 sm:row-start-1 lg:col-start-auto lg:row-start-auto lg:justify-self-start',
                              applicationStatusPillClass(status)
                            )}
                          >
                            <span className="size-1.5 rounded-full bg-current" />
                            {applicationStatusLabel(status)}
                          </span>

                          <span className="inline-flex h-11 w-11 items-center justify-center gap-1.5 justify-self-end rounded-lg border border-(--app-border) bg-(--app-surface) text-[0.8rem] font-semibold text-(--app-text-muted) transition-[border-color,background-color,color] group-hover:border-primary-200 group-hover:bg-primary-50 group-hover:text-primary-700 sm:col-start-2 lg:col-start-auto lg:h-9 lg:w-auto lg:px-3.5 dark:group-hover:border-primary-400/40 dark:group-hover:bg-primary-500/12 dark:group-hover:text-primary-200">
                            <span className="hidden lg:inline">Ver vacante</span>
                            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                          </span>
                        </Link>
                      </motion.li>
                    )
                  })}
                </motion.ul>
              </Card>

              <PaginationFooter
                page={safePage}
                totalPages={totalPages}
                firstVisible={firstVisible}
                lastVisible={lastVisible}
                totalItems={filteredApplications.length}
                onGo={setPage}
              />
            </>
          ) : (
            <div className="py-2">
              <EmptyState
                actionLabel="Limpiar filtros"
                description="Prueba con otro término o cambia el filtro de estado para ampliar los resultados."
                title="Sin resultados"
                onAction={() => {
                  applyFilter('all')
                  applyQuery('')
                }}
              />
            </div>
          )}
        </motion.div>
      ) : (
        <motion.div variants={cardReveal}>
          <EmptyState
            actionLabel="Explorar vacantes"
            description="Todavía no has enviado postulaciones. Explora oportunidades y aplica cuando tu perfil esté listo."
            title="Aún no tienes aplicaciones"
            onAction={() => void navigate(surfacePaths.public.jobs)}
          />
        </motion.div>
      )}
    </motion.div>
  )
}

function PaginationFooter({
  page,
  totalPages,
  firstVisible,
  lastVisible,
  totalItems,
  onGo
}: {
  page: number
  totalPages: number
  firstVisible: number
  lastVisible: number
  totalItems: number
  onGo: (page: number) => void
}) {
  if (totalPages <= 1) return null

  return (
    <div className="flex flex-col gap-3 px-0.5 pt-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-[0.82rem] text-(--app-text-subtle)">
        Mostrando {firstVisible}-{lastVisible} de {totalItems}
      </p>
      <Pagination page={page} totalPages={totalPages} onPageChange={onGo} ariaLabel="Paginación de aplicaciones" />
    </div>
  )
}
