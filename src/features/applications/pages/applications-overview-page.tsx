import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { motion, useReducedMotion } from 'motion/react'
import { ArrowRight, CalendarDays, Check, Clock3, FileText, Search, Send } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/loader'
import { useAppSession } from '@/app/providers/app-session-provider'
import { surfacePaths } from '@/app/router/surface-paths'
import { toErrorMessage } from '@/features/auth/lib/auth-api'
import { countMyApplications, listMyApplicationsPage } from '@/features/applications/lib/applications-api'
import { applicationStatusLabel } from '@/features/applications/lib/application-status'
import {
  buildApplicationFilterCounts,
  type ApplicationFilter,
  type PublicApplicationStatus
} from '@/features/applications/lib/application-overview-filters'
import { CompanyLogo } from '@/features/tenants/components/company-logo'
import { cn } from '@/lib/utils/cn'
import { useRealtimeSync } from '@/lib/realtime/use-realtime-sync'
import {
  smoothCardReveal as cardReveal,
  smoothGridStagger as gridStagger,
  smoothPageStagger as pageStagger
} from '@/shared/ui/card-motion'
import { CountUp } from '@/shared/ui/count-up'

const PAGE_SIZE = 10
const dateFormatter = new Intl.DateTimeFormat('es', { day: '2-digit', month: 'short', year: 'numeric' })

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

export function ApplicationsOverviewPage() {
  const navigate = useNavigate()
  const session = useAppSession()
  const shouldReduceMotion = useReducedMotion()
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const [activeFilter, setActiveFilter] = useState<ApplicationFilter>('all')
  const [query, setQuery] = useState('')
  const userId = session.authUser?.id ?? null

  const filterCountsQuery = useQuery({
    queryKey: ['applications', 'mine', userId, 'overview-counts', query],
    enabled: session.isAuthenticated,
    queryFn: async () => countMyApplications({ userId: session.authUser!.id, query })
  })

  const myApplicationsQuery = useInfiniteQuery({
    queryKey: ['applications', 'mine', userId, 'overview', activeFilter, query],
    enabled: session.isAuthenticated,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) =>
      listMyApplicationsPage({
        userId: session.authUser!.id,
        filter: activeFilter,
        query,
        limit: PAGE_SIZE,
        offset: pageParam
      }),
    getNextPageParam: (lastPage) => lastPage.nextOffset
  })
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = myApplicationsQuery

  // En vivo: el candidato ve cambiar el estado de sus postulaciones en el momento
  // en que la empresa las mueve de etapa. RLS limita los eventos a sus filas.
  useRealtimeSync(
    'my-applications',
    [{ table: 'applications', invalidate: [['applications', 'mine', userId]] }],
    { enabled: session.isAuthenticated }
  )

  const pages = useMemo(() => myApplicationsQuery.data?.pages ?? [], [myApplicationsQuery.data])
  const visibleApplications = useMemo(() => pages.flatMap((page) => page.applications), [pages])
  const totalCount = pages[0]?.totalCount ?? 0
  const filterCounts = filterCountsQuery.data ?? buildApplicationFilterCounts([])
  const hasLoadedFirstPage = pages.length > 0

  function applyFilter(filter: ApplicationFilter) {
    setActiveFilter(filter)
  }

  function applyQuery(value: string) {
    setQuery(value)
  }

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
      { rootMargin: '180px' }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [loadMore, visibleApplications.length])

  return (
    <motion.div
      className="space-y-4"
      variants={pageStagger}
      initial={shouldReduceMotion ? false : 'hidden'}
      animate="show"
    >
      <motion.header variants={cardReveal} className="space-y-1.5">
        <h1 className="text-xl font-semibold tracking-tight text-(--app-text) sm:text-[1.6rem]">Postulaciones</h1>
        <p className="max-w-2xl text-[0.84rem] leading-relaxed text-(--app-text-muted)">
          Revisa tus postulaciones y el estado actual de cada proceso.
        </p>
      </motion.header>

      <motion.div variants={cardReveal} className="grid grid-cols-4 gap-2 sm:grid-cols-2 sm:gap-2.5 xl:grid-cols-4">
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
                'flex flex-col items-center justify-center gap-1 rounded-control border border-(--app-border) bg-(--app-surface-elevated) px-1.5 py-2 text-center transition-[border-color,background-color,box-shadow,transform] hover:border-primary-300 hover:bg-(--app-surface) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--app-ring) focus-visible:ring-offset-2 focus-visible:ring-offset-(--app-canvas) sm:min-h-14 sm:py-3',
                isActive ? 'border-primary-300 shadow-[0_1px_2px_rgba(20,40,90,0.04),0_4px_16px_rgba(20,40,90,0.04)]' : ''
              )}
            >
              <span className="flex items-center gap-1">
                <span
                  className={cn(
                    'flex size-5 shrink-0 items-center justify-center rounded-control sm:size-6',
                    stat.chipClassName
                  )}
                >
                  <Icon className="size-3 sm:size-3.5" />
                </span>
                <span className="font-sans text-base font-bold leading-none tabular-nums text-(--app-text) sm:text-xl">
                  {filterCountsQuery.isLoading ? '...' : <CountUp value={filterCounts[stat.key]} />}
                </span>
              </span>
              <span className="text-[0.64rem] leading-tight text-(--app-text-subtle) sm:text-[0.7rem]">
                {stat.label}
              </span>
            </button>
          )
        })}
      </motion.div>

      <motion.div variants={cardReveal}>
        <label className="flex h-11 min-w-0 flex-1 items-center gap-2.5 rounded-control border border-(--app-border) bg-(--app-surface-elevated) px-3.5 transition-[border-color,box-shadow] focus-within:border-primary-600 focus-within:ring-3 focus-within:ring-primary-600/10">
          <Search className="size-4.5 shrink-0 text-(--app-text-subtle)" />
          <span className="sr-only">Buscar por puesto o empresa</span>
          <Input
            value={query}
            onChange={(event) => applyQuery(event.target.value)}
            placeholder="Buscar por puesto o empresa"
            className="h-full rounded-none border-0 bg-transparent px-0 text-[0.9rem] shadow-none focus:border-0 focus:bg-transparent focus:ring-0"
          />
        </label>
      </motion.div>

      {myApplicationsQuery.isLoading && !hasLoadedFirstPage ? (
        <motion.div variants={cardReveal}>
          <Card className="flex items-center gap-2.5 text-[0.82rem] text-(--app-text-muted)">
            <Spinner size="sm" /> Cargando historial...
          </Card>
        </motion.div>
      ) : myApplicationsQuery.error ? (
        <motion.div variants={cardReveal}>
          <Card className="text-[0.86rem] text-rose-600">{toErrorMessage(myApplicationsQuery.error)}</Card>
        </motion.div>
      ) : totalCount > 0 || visibleApplications.length > 0 ? (
        <motion.div variants={cardReveal} className="space-y-1">
          <div className="flex items-baseline justify-between px-0.5 pt-2">
            <p className="text-[0.82rem] text-(--app-text-subtle)">
              <b className="font-semibold text-(--app-text)">{visibleApplications.length}</b> de{' '}
              <b className="font-semibold text-(--app-text)">{totalCount}</b> procesos
            </p>
          </div>

          {visibleApplications.length ? (
            <>
              <Card className="overflow-hidden rounded-control p-0 shadow-[0_1px_2px_rgba(20,40,90,0.04),0_4px_16px_rgba(20,40,90,0.04)]">
                <motion.ul
                  className="divide-y divide-(--app-border)"
                  variants={gridStagger}
                  initial={shouldReduceMotion ? false : 'hidden'}
                  animate="show"
                >
                  {visibleApplications.map((application) => {
                    const status = application.status_public
                    const detailPath = getJobDetailPath(application.job_posting?.slug)

                    return (
                      <motion.li key={application.id} variants={cardReveal}>
                        <Link
                          to={detailPath}
                          className="group grid grid-cols-[minmax(0,1fr)_2.25rem] items-center gap-x-2.5 gap-y-1 px-3 py-2.5 transition-colors hover:bg-(--app-surface-muted) sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-x-3 sm:gap-y-2 sm:px-5 sm:py-3.5 lg:min-h-16 lg:grid-cols-[minmax(0,1.8fr)_9rem_10rem_9.5rem] lg:gap-4 lg:py-0 xl:grid-cols-[minmax(0,2fr)_10rem_11rem_10rem]"
                        >
                          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
                            <CompanyLogo
                              name={application.job_posting?.company_profile?.display_name}
                              logoPath={application.job_posting?.company_profile?.logo_path}
                              size="sm"
                              className="size-8 text-[0.68rem] sm:size-10 sm:text-[0.8rem]"
                            />
                            <div className="min-w-0">
                              <p className="truncate text-[0.84rem] font-semibold leading-tight text-(--app-text) sm:text-[0.9rem]">
                                {application.job_posting?.title || 'Vacante'}
                              </p>
                              <p className="mt-0.5 truncate text-[0.74rem] text-(--app-text-muted) sm:text-[0.82rem]">
                                {application.job_posting?.company_profile?.display_name || 'Empresa'}
                              </p>
                              <span className="mt-1 flex min-w-0 items-center gap-1.5 text-[0.7rem] text-(--app-text-subtle) sm:hidden">
                                <CalendarDays className="size-3.5 shrink-0" />
                                <span className="truncate tabular-nums">{formatSubmittedAt(application.submitted_at)}</span>
                                <span
                                  className={cn(
                                    'inline-flex h-5 shrink-0 items-center gap-1 rounded-full px-2 text-[0.66rem] font-semibold',
                                    applicationStatusPillClass(status)
                                  )}
                                >
                                  <span className="size-1.5 rounded-full bg-current" />
                                  {applicationStatusLabel(status)}
                                </span>
                              </span>
                            </div>
                          </div>

                          <span className="hidden items-center gap-1.5 text-[0.82rem] text-(--app-text-subtle) sm:col-start-1 sm:inline-flex lg:col-start-auto">
                            <CalendarDays className="size-3.5 shrink-0" /> {formatSubmittedAt(application.submitted_at)}
                          </span>

                          <span
                            className={cn(
                              'hidden h-7 w-fit items-center gap-1.5 justify-self-end rounded-full px-3 text-[0.78rem] font-semibold sm:col-start-2 sm:row-start-1 sm:inline-flex lg:col-start-auto lg:row-start-auto lg:justify-self-start',
                              applicationStatusPillClass(status)
                            )}
                          >
                            <span className="size-1.5 rounded-full bg-current" />
                            {applicationStatusLabel(status)}
                          </span>

                          <span className="row-span-2 inline-flex size-9 items-center justify-center gap-1.5 justify-self-end whitespace-nowrap rounded-control border border-(--app-border) bg-(--app-surface) text-[0.8rem] font-semibold text-(--app-text-muted) transition-[border-color,background-color,color] group-hover:border-primary-200 group-hover:bg-primary-50 group-hover:text-primary-700 sm:col-start-2 sm:row-span-1 sm:size-auto sm:h-11 sm:w-auto sm:px-3.5 lg:col-start-auto lg:h-9 dark:group-hover:border-primary-400/40 dark:group-hover:bg-primary-500/12 dark:group-hover:text-primary-200">
                            <span className="hidden sm:inline">Ver vacante</span>
                            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                          </span>
                        </Link>
                      </motion.li>
                    )
                  })}
                </motion.ul>
              </Card>

              <div ref={sentinelRef} className="flex min-h-12 items-center justify-center px-2 py-3">
                {myApplicationsQuery.isFetchingNextPage ? (
                  <span className="inline-flex items-center gap-2 text-[0.8rem] text-(--app-text-muted)">
                    <Spinner size="sm" /> Cargando más postulaciones...
                  </span>
                ) : myApplicationsQuery.hasNextPage ? (
                  <span className="text-[0.76rem] text-(--app-text-subtle)">Desplázate para cargar más</span>
                ) : (
                  <span className="text-[0.76rem] text-(--app-text-subtle)">No hay más postulaciones</span>
                )}
              </div>
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
