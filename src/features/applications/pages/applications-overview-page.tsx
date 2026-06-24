import { useMemo, useState } from 'react'

import { useQuery } from '@tanstack/react-query'
import { motion, useReducedMotion } from 'motion/react'
import { ArrowRight, CalendarClock, ChevronLeft, ChevronRight, FileText } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Spinner } from '@/components/ui/loader'
import { useAppSession } from '@/app/providers/app-session-provider'
import { surfacePaths } from '@/app/router/surface-paths'
import { toErrorMessage } from '@/features/auth/lib/auth-api'
import { listMyApplications } from '@/features/applications/lib/applications-api'
import {
  applicationStatusLabel,
  applicationStatusPillClass
} from '@/features/applications/lib/application-status'
import { cn } from '@/lib/utils/cn'
import { useRealtimeSync } from '@/lib/realtime/use-realtime-sync'
import { cardReveal, gridStagger, pageStagger } from '@/shared/ui/card-motion'

const PAGE_SIZE = 10
const dateFormatter = new Intl.DateTimeFormat('es', { day: '2-digit', month: 'short', year: 'numeric' })

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

export function ApplicationsOverviewPage() {
  const navigate = useNavigate()
  const session = useAppSession()
  const shouldReduceMotion = useReducedMotion()
  const [page, setPage] = useState(0)

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
  const totalPages = Math.max(1, Math.ceil(applications.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages - 1)
  const paginatedApplications = useMemo(
    () => applications.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE),
    [applications, safePage]
  )
  const firstVisible = applications.length ? safePage * PAGE_SIZE + 1 : 0
  const lastVisible = Math.min(applications.length, safePage * PAGE_SIZE + PAGE_SIZE)

  return (
    <motion.div
      className="space-y-4"
      variants={pageStagger}
      initial={shouldReduceMotion ? false : 'hidden'}
      animate="show"
    >
      <motion.div variants={cardReveal}>
        <Card className="overflow-hidden p-0">
          <div className="flex flex-col gap-3 border-b border-(--app-border) px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="space-y-1">
              <h1 className="text-[1rem] font-semibold tracking-tight text-(--app-text)">Historial de postulaciones</h1>
              <p className="text-[0.78rem] text-(--app-text-muted)">
                {applications.length
                  ? `${applications.length} ${applications.length === 1 ? 'proceso registrado' : 'procesos registrados'}`
                  : 'Sin postulaciones registradas'}
              </p>
            </div>
            {applications.length ? (
              <span className="inline-flex w-fit rounded-full border border-(--app-border) bg-(--app-surface-muted) px-3 py-1 text-[0.72rem] font-semibold text-(--app-text-muted)">
                {firstVisible}-{lastVisible} de {applications.length}
              </span>
            ) : null}
          </div>

          {myApplicationsQuery.isLoading ? (
            <div className="flex items-center gap-2.5 px-4 py-6 text-[0.8rem] text-(--app-text-muted) sm:px-5">
              <Spinner size="sm" /> Cargando historial…
            </div>
          ) : myApplicationsQuery.error ? (
            <p className="px-4 py-6 text-[0.8rem] text-rose-600 sm:px-5">{toErrorMessage(myApplicationsQuery.error)}</p>
          ) : applications.length ? (
            <>
              <motion.ul
                className="divide-y divide-(--app-border)"
                variants={gridStagger}
                initial={shouldReduceMotion ? false : 'hidden'}
                animate="show"
              >
                {paginatedApplications.map((application) => {
                  const status = application.status_public
                  return (
                    <motion.li
                      key={application.id}
                      variants={cardReveal}
                      className="grid gap-3 px-4 py-4 transition-colors hover:bg-(--app-surface-muted) sm:px-5 lg:grid-cols-[minmax(0,1fr)_auto_auto_auto] lg:items-center"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-(--app-border) bg-(--app-surface-muted) text-(--app-text-subtle)">
                          <FileText className="size-4.5" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-[0.9rem] font-semibold text-(--app-text)">
                            {application.job_posting?.title || 'Vacante'}
                          </p>
                          <p className="truncate text-[0.76rem] text-(--app-text-muted)">
                            {application.job_posting?.company_profile?.display_name || 'Empresa'}
                          </p>
                        </div>
                      </div>

                      <span className="inline-flex items-center gap-1.5 text-[0.76rem] text-(--app-text-muted)">
                        <CalendarClock className="size-3.5" /> {formatSubmittedAt(application.submitted_at)}
                      </span>

                      <span
                        className={cn(
                          'inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.74rem] font-semibold',
                          applicationStatusPillClass(status)
                        )}
                      >
                        <span className="size-1.5 rounded-full bg-current" />
                        {applicationStatusLabel(status)}
                      </span>

                      <Link
                        to={getJobDetailPath(application.job_posting?.slug)}
                        className="inline-flex h-9 w-fit items-center gap-1.5 rounded-full border border-(--app-border) bg-(--app-surface) px-3.5 text-[0.76rem] font-semibold text-(--app-text-muted) transition-colors hover:border-primary-300 hover:text-primary-700 dark:hover:border-primary-400 dark:hover:text-primary-200"
                      >
                        Ver vacante
                        <ArrowRight className="size-3.5" />
                      </Link>
                    </motion.li>
                  )
                })}
              </motion.ul>

              <PaginationFooter
                page={safePage}
                totalPages={totalPages}
                firstVisible={firstVisible}
                lastVisible={lastVisible}
                totalItems={applications.length}
                onGo={setPage}
              />
            </>
          ) : (
            <div className="px-4 py-5 sm:px-5">
              <EmptyState
                actionLabel="Explorar vacantes"
                description="Todavía no has enviado postulaciones. Explora oportunidades y aplica cuando tu perfil esté listo."
                title="Aún no tienes aplicaciones"
                onAction={() => void navigate(surfacePaths.public.jobs)}
              />
            </div>
          )}
        </Card>
      </motion.div>
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
    <div className="flex flex-col gap-3 border-t border-(--app-border) px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <p className="text-[0.76rem] text-(--app-text-muted)">
        Mostrando {firstVisible}-{lastVisible} de {totalItems}
      </p>
      <nav className="flex items-center gap-2" aria-label="Paginación de aplicaciones">
        <button
          type="button"
          onClick={() => onGo(Math.max(0, page - 1))}
          disabled={page === 0}
          className="inline-flex size-9 items-center justify-center rounded-full border border-(--app-border) bg-(--app-surface) text-(--app-text-muted) transition hover:border-primary-300 hover:text-primary-700 disabled:pointer-events-none disabled:opacity-45"
          aria-label="Página anterior"
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="min-w-18 text-center text-[0.78rem] font-semibold text-(--app-text-muted)">
          {page + 1} / {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onGo(Math.min(totalPages - 1, page + 1))}
          disabled={page >= totalPages - 1}
          className="inline-flex size-9 items-center justify-center rounded-full border border-(--app-border) bg-(--app-surface) text-(--app-text-muted) transition hover:border-primary-300 hover:text-primary-700 disabled:pointer-events-none disabled:opacity-45"
          aria-label="Página siguiente"
        >
          <ChevronRight className="size-4" />
        </button>
      </nav>
    </div>
  )
}
