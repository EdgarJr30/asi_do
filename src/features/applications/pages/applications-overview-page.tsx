import { useQuery } from '@tanstack/react-query'
import { motion, useReducedMotion } from 'motion/react'
import { ArrowRight, CalendarClock, ClipboardList, FileText } from 'lucide-react'
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

const dateFormatter = new Intl.DateTimeFormat('es', { day: '2-digit', month: 'short', year: 'numeric' })

function formatSubmittedAt(value?: string | null) {
  if (!value) {
    return 'fecha no disponible'
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'fecha no disponible' : dateFormatter.format(date)
}

export function ApplicationsOverviewPage() {
  const navigate = useNavigate()
  const session = useAppSession()
  const shouldReduceMotion = useReducedMotion()

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

  const applications = myApplicationsQuery.data ?? []

  return (
    <motion.div
      className="space-y-5"
      variants={pageStagger}
      initial={shouldReduceMotion ? false : 'hidden'}
      animate="show"
    >
      <motion.header variants={cardReveal} className="space-y-3">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary-200 bg-primary-50 px-2.5 py-1 text-[0.72rem] font-semibold text-primary-700 dark:border-primary-500/30 dark:bg-primary-500/12 dark:text-primary-300">
          <FileText className="size-3.5" /> Aplicaciones
        </span>
        <div className="space-y-1.5">
          <h1 className="max-w-2xl text-xl font-semibold leading-tight tracking-tight text-(--app-text) sm:text-[1.7rem]">
            Da seguimiento a tus postulaciones sin perder el contexto de cada proceso
          </h1>
          <p className="max-w-2xl text-[0.85rem] text-(--app-text-muted)">
            Consulta el estado más reciente de cada oportunidad y vuelve al detalle de la vacante cuando lo necesites.
          </p>
        </div>
      </motion.header>

      <motion.div variants={cardReveal}>
        <Card>
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-(--app-surface-muted) text-(--app-text-subtle)">
              <ClipboardList className="size-4" />
            </span>
            <div>
              <h2 className="text-[0.95rem] font-semibold tracking-tight text-(--app-text)">Mi historial</h2>
              <p className="text-[0.78rem] text-(--app-text-muted)">Encuentra cada vacante, su compañía y el estado más reciente.</p>
            </div>
          </div>

          {myApplicationsQuery.isLoading ? (
            <div className="mt-4 flex items-center gap-2.5 text-[0.8rem] text-(--app-text-muted)">
              <Spinner size="sm" /> Cargando historial…
            </div>
          ) : myApplicationsQuery.error ? (
            <p className="mt-4 text-[0.8rem] text-rose-600">{toErrorMessage(myApplicationsQuery.error)}</p>
          ) : applications.length ? (
            <motion.ul
              className="mt-4 space-y-2.5"
              variants={gridStagger}
              initial={shouldReduceMotion ? false : 'hidden'}
              animate="show"
            >
              {applications.map((application) => {
                const status = application.status_public
                return (
                  <motion.li
                    key={application.id}
                    variants={cardReveal}
                    className="flex flex-wrap items-center gap-x-4 gap-y-2.5 rounded-xl border border-(--app-border) px-3.5 py-3 transition-colors hover:bg-(--app-surface-muted) sm:flex-nowrap"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-(--app-surface-muted) text-(--app-text-subtle)">
                        <FileText className="size-4.5" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[0.85rem] font-semibold text-(--app-text)">
                          {application.job_posting?.title || 'Vacante'}
                        </p>
                        <p className="truncate text-[0.76rem] text-(--app-text-muted)">
                          {application.job_posting?.company_profile?.display_name || 'Empresa'}
                        </p>
                      </div>
                    </div>

                    <span className="inline-flex shrink-0 items-center gap-1.5 text-[0.78rem] text-(--app-text-muted)">
                      <CalendarClock className="size-3.5" /> Postulado el {formatSubmittedAt(application.submitted_at)}
                    </span>

                    <span
                      className={cn(
                        'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.74rem] font-semibold',
                        applicationStatusPillClass(status)
                      )}
                    >
                      <span className="size-1.5 rounded-full bg-current" />
                      {applicationStatusLabel(status)}
                    </span>

                    <Link
                      to={surfacePaths.public.jobDetail(application.job_posting?.slug ?? '')}
                      className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full border border-(--app-border) bg-(--app-surface) px-3 text-[0.74rem] font-semibold text-(--app-text-muted) transition-colors hover:border-primary-300 hover:text-primary-700 dark:hover:border-primary-400 dark:hover:text-primary-200"
                    >
                      Ver vacante
                      <ArrowRight className="size-3.5" />
                    </Link>
                  </motion.li>
                )
              })}
            </motion.ul>
          ) : (
            <div className="mt-4">
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
