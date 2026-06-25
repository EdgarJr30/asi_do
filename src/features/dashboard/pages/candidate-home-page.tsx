import { useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, useReducedMotion } from 'motion/react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  LayoutDashboard,
  MoreVertical,
  UserRound
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { useAppSession } from '@/app/providers/app-session-provider'
import { surfacePaths } from '@/app/router/surface-paths'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Spinner } from '@/components/ui/loader'
import { applicationStatusDotClass, applicationStatusLabel } from '@/features/applications/lib/application-status'
import { cardReveal, gridStagger, pageStagger } from '@/shared/ui/card-motion'
import { listMyApplications } from '@/features/applications/lib/applications-api'
import { fetchMyCandidateProfile, type CandidateProfileBundle } from '@/features/candidate-profile/lib/candidate-profile-api'
import type { Database } from '@/shared/types/database'

type PublicStatus = Database['public']['Enums']['application_public_status']

const ACTIVE_STATUSES: PublicStatus[] = ['submitted', 'in_review', 'interviewing', 'offer']

function greetingForNow(date = new Date()) {
  const hour = date.getHours()
  if (hour < 12) {
    return 'Buenos días'
  }
  if (hour < 19) {
    return 'Buenas tardes'
  }
  return 'Buenas noches'
}

function firstName(value: string) {
  return value.trim().split(/\s+/)[0] ?? value
}

function getApplicationDetailPath(application: { job_posting?: { slug?: string | null } | null }) {
  const slug = application.job_posting?.slug?.trim()

  return slug ? surfacePaths.public.jobDetail(slug) : surfacePaths.candidate.applications
}

interface CompletenessItem {
  key: string
  label: string
  done: boolean
}

function computeProfileCompleteness(bundle: CandidateProfileBundle) {
  const profile = bundle.profile
  const items: CompletenessItem[] = [
    { key: 'headline', label: 'Título profesional', done: Boolean(profile?.headline?.trim()) },
    { key: 'summary', label: 'Resumen sobre ti', done: Boolean(profile?.summary?.trim()) },
    {
      key: 'location',
      label: 'Ubicación',
      done: Boolean(profile?.city_name?.trim() || profile?.country_code)
    },
    { key: 'resume', label: 'CV cargado', done: bundle.resumes.length > 0 },
    { key: 'experience', label: 'Experiencia laboral', done: bundle.experiences.length > 0 },
    { key: 'skills', label: 'Habilidades', done: bundle.skills.length > 0 },
    {
      key: 'visibility',
      label: 'Visible para reclutadores',
      done: Boolean(profile?.is_visible_to_recruiters)
    }
  ]
  const completed = items.filter((item) => item.done).length
  const percent = Math.round((completed / items.length) * 100)

  return { items, completed, total: items.length, percent }
}

interface ModuleCard {
  key: string
  icon: LucideIcon
  title: string
  description: string
  cta: string
  onClick: () => void
}

export function CandidateHomePage() {
  const session = useAppSession()
  const navigate = useNavigate()
  const shouldReduceMotion = useReducedMotion()
  const userId = session.authUser?.id ?? null
  const displayName = session.profile?.display_name ?? session.profile?.full_name ?? session.authUser?.email ?? 'candidato'
  const hasWorkspaceAccess = session.permissions.includes('workspace:read')

  const profileQuery = useQuery({
    queryKey: ['candidate', 'profile', userId],
    enabled: Boolean(userId),
    queryFn: async () => fetchMyCandidateProfile(userId!)
  })

  const applicationsQuery = useQuery({
    queryKey: ['applications', 'mine', userId],
    enabled: Boolean(userId),
    queryFn: async () => listMyApplications(userId!)
  })

  const completeness = useMemo(
    () => (profileQuery.data ? computeProfileCompleteness(profileQuery.data) : null),
    [profileQuery.data]
  )

  const applications = applicationsQuery.data ?? []
  const activeApplications = applications.filter((application) =>
    ACTIVE_STATUSES.includes(application.status_public)
  ).length
  const resumeCount = profileQuery.data?.resumes.length ?? 0

  const RECENT_PAGE_SIZE = 5
  const [recentPage, setRecentPage] = useState(0)
  const recentTotalPages = Math.max(1, Math.ceil(applications.length / RECENT_PAGE_SIZE))
  const recentPageSafe = Math.min(recentPage, recentTotalPages - 1)
  const recentApplications = applications.slice(
    recentPageSafe * RECENT_PAGE_SIZE,
    recentPageSafe * RECENT_PAGE_SIZE + RECENT_PAGE_SIZE
  )

  const moduleCards: ModuleCard[] = [
    {
      key: 'profile',
      icon: UserRound,
      title: 'Perfil & CV',
      description: 'Mantén tu presencia profesional y tu CV listos para aplicar en segundos.',
      cta: 'Editar perfil',
      onClick: () => void navigate(surfacePaths.candidate.profile)
    },
    {
      key: 'jobs',
      icon: BriefcaseBusiness,
      title: 'Explorar vacantes',
      description: 'Descubre oportunidades abiertas y postúlate con tu perfil completo.',
      cta: 'Ver vacantes',
      onClick: () => void navigate(surfacePaths.storefront.jobs)
    },
    {
      key: 'applications',
      icon: FileText,
      title: 'Mis aplicaciones',
      description: 'Sigue el estado de cada postulación sin perder el contexto.',
      cta: 'Ver aplicaciones',
      onClick: () => void navigate(surfacePaths.candidate.applications)
    },
    hasWorkspaceAccess
      ? {
          key: 'workspace',
          icon: LayoutDashboard,
          title: 'Abrir mi workspace',
          description: 'Entra al espacio operativo de tu empresa para gestionar vacantes y talento.',
          cta: 'Ir al workspace',
          onClick: () => void navigate(surfacePaths.workspace.root)
        }
      : {
          key: 'recruiter',
          icon: Building2,
          title: '¿Representas una empresa?',
          description: 'Lleva tu empresa a la plataforma y empieza a publicar vacantes y reclutar.',
          cta: 'Solicitar acceso',
          onClick: () => void navigate(surfacePaths.candidate.recruiterRequest)
        }
  ]

  const greeting = greetingForNow()

  return (
    <motion.div
      className="space-y-4"
      variants={pageStagger}
      initial={shouldReduceMotion ? false : 'hidden'}
      animate="show"
    >
      <motion.div
        variants={cardReveal}
        className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"
      >
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight text-(--app-text) sm:text-[1.6rem]">
            {greeting}, {firstName(displayName)}
          </h1>
          <p className="text-[0.8rem] text-(--app-text-muted)">Todo lo que necesitas para avanzar en tu búsqueda, en un solo lugar.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="h-9 text-[0.8rem]" onClick={() => void navigate(surfacePaths.candidate.profile)}>
            Editar perfil
          </Button>
          <Button className="h-9 text-[0.8rem]" onClick={() => void navigate(surfacePaths.storefront.jobs)}>Explorar vacantes</Button>
        </div>
      </motion.div>

      <motion.div variants={gridStagger} className="grid gap-3 sm:grid-cols-3">
        <motion.div variants={cardReveal} className="h-full">
          <HomeStatCard
            icon={UserRound}
            label="Perfil completo"
            value={completeness ? `${completeness.percent}%` : '—'}
            progress={completeness?.percent ?? null}
            helper={
              completeness && completeness.percent < 100
                ? `${completeness.total - completeness.completed} cosas por completar`
                : 'Tu perfil está listo'
            }
          />
        </motion.div>
        <motion.div variants={cardReveal} className="h-full">
          <HomeStatCard
            icon={BriefcaseBusiness}
            label="Aplicaciones activas"
            value={applicationsQuery.isLoading ? '—' : activeApplications}
            helper="Procesos abiertos en este momento"
          />
        </motion.div>
        <motion.div variants={cardReveal} className="h-full">
          <HomeStatCard
            icon={FileText}
            label="CV cargados"
            value={profileQuery.isLoading ? '—' : resumeCount}
            helper="Documentos listos para postular"
          />
        </motion.div>
      </motion.div>

      <motion.div variants={gridStagger} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {moduleCards.map((module) => {
          const Icon = module.icon
          return (
            <motion.div key={module.key} variants={cardReveal} className="h-full">
            <Card className="flex h-full flex-col">
              <div className="flex items-center gap-2.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600 dark:bg-primary-500/12 dark:text-primary-300">
                  <Icon className="size-4" />
                </span>
                <h3 className="text-[0.9rem] font-semibold tracking-tight text-(--app-text)">{module.title}</h3>
              </div>
              <p className="mt-2.5 flex-1 text-[0.78rem] leading-4.5 text-(--app-text-muted)">{module.description}</p>
              <button
                type="button"
                onClick={module.onClick}
                className="mt-3 inline-flex items-center gap-1 self-start text-[0.8rem] font-semibold text-primary-600 transition-colors hover:text-primary-700 dark:text-primary-300 dark:hover:text-primary-200"
              >
                {module.cta}
                <ArrowRight className="size-4" />
              </button>
            </Card>
            </motion.div>
          )
        })}
      </motion.div>

      <motion.div variants={cardReveal}>
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-(--app-surface-muted) text-(--app-text-subtle)">
              <Clock className="size-4" />
            </span>
            <div>
              <h3 className="text-[0.95rem] font-semibold tracking-tight text-(--app-text)">Aplicaciones recientes</h3>
              <p className="text-[0.78rem] text-(--app-text-muted)">El estado más nuevo de cada proceso.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void navigate(surfacePaths.candidate.applications)}
            className="shrink-0 text-[0.78rem] font-semibold text-primary-600 transition-colors hover:text-primary-700 dark:text-primary-300 dark:hover:text-primary-200"
          >
            Ver todas
          </button>
        </div>

        {applicationsQuery.isLoading ? (
          <div className="mt-4 flex items-center gap-2.5 text-[0.8rem] text-(--app-text-muted)">
            <Spinner size="sm" /> Cargando aplicaciones…
          </div>
        ) : recentApplications.length > 0 ? (
          <div className="mt-4">
            <div className="hidden grid-cols-[1.7fr_1fr_0.8fr_1fr_auto] items-center gap-4 border-b border-(--app-border) px-2 pb-2 text-[0.64rem] font-semibold uppercase tracking-[0.14em] text-(--app-text-subtle) sm:grid">
              <span>Título de la vacante</span>
              <span>Empresa</span>
              <span>Postulado</span>
              <span>Etapa actual</span>
              <span className="sr-only">Acciones</span>
            </div>
            <ul className="divide-y divide-(--app-border)">
              {recentApplications.map((application) => {
                return (
                  <li
                    key={application.id}
                    className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl px-2 py-2.5 transition-colors hover:bg-(--app-surface-muted) sm:grid sm:grid-cols-[1.7fr_1fr_0.8fr_1fr_auto]"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2.5 sm:flex-none">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-(--app-surface-muted) text-(--app-text-subtle)">
                        <Building2 className="size-4" />
                      </span>
                      <p className="truncate text-[0.82rem] font-semibold text-(--app-text)">
                        {application.job_posting?.title || 'Vacante'}
                      </p>
                    </div>
                    <p className="truncate text-[0.78rem] text-(--app-text-muted)">
                      {application.job_posting?.company_profile?.display_name || '—'}
                    </p>
                    <p className="hidden text-[0.78rem] text-(--app-text-muted) sm:block">
                      {formatApplicationDate(application.submitted_at)}
                    </p>
                    <span className="inline-flex items-center gap-1.5 text-[0.78rem] text-(--app-text)">
                      <span className={`size-1.5 rounded-full ${applicationStatusDotClass(application.status_public)}`} />
                      {applicationStatusLabel(application.status_public)}
                    </span>
                    <button
                      type="button"
                      onClick={() => void navigate(getApplicationDetailPath(application))}
                      className="inline-flex h-8 items-center gap-1 rounded-full border border-(--app-border) bg-(--app-surface) px-3 text-[0.74rem] font-semibold text-(--app-text-muted) transition-colors hover:border-primary-300 hover:text-primary-700 dark:hover:border-primary-400 dark:hover:text-primary-200"
                    >
                      Ver detalle
                      <ArrowRight className="size-3.5" />
                    </button>
                  </li>
                )
              })}
            </ul>
            {recentTotalPages > 1 ? (
              <div className="mt-3 flex items-center justify-between gap-3 px-2">
                <p className="text-[0.74rem] text-(--app-text-muted)">
                  Página {recentPageSafe + 1} de {recentTotalPages}
                </p>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setRecentPage((page) => Math.max(0, page - 1))}
                    disabled={recentPageSafe === 0}
                    className="inline-flex size-8 items-center justify-center rounded-full border border-(--app-border) bg-(--app-surface) text-(--app-text-muted) transition-colors hover:border-primary-300 hover:text-primary-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-(--app-border) disabled:hover:text-(--app-text-muted) dark:hover:border-primary-400 dark:hover:text-primary-200"
                    aria-label="Página anterior"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setRecentPage((page) => Math.min(recentTotalPages - 1, page + 1))}
                    disabled={recentPageSafe >= recentTotalPages - 1}
                    className="inline-flex size-8 items-center justify-center rounded-full border border-(--app-border) bg-(--app-surface) text-(--app-text-muted) transition-colors hover:border-primary-300 hover:text-primary-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-(--app-border) disabled:hover:text-(--app-text-muted) dark:hover:border-primary-400 dark:hover:text-primary-200"
                    aria-label="Página siguiente"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="mt-4">
            <EmptyState
              title="Aún no tienes aplicaciones"
              description="Explora oportunidades abiertas y postúlate cuando tu perfil esté listo."
              actionLabel="Explorar vacantes"
              onAction={() => void navigate(surfacePaths.storefront.jobs)}
            />
          </div>
        )}
      </Card>
      </motion.div>
    </motion.div>
  )
}

interface HomeStatCardProps {
  icon: LucideIcon
  label: string
  value: ReactNode
  helper?: ReactNode
  progress?: number | null
}

function HomeStatCard({ icon: Icon, label, value, helper, progress = null }: HomeStatCardProps) {
  return (
    <div className="h-full rounded-2xl border border-(--app-border) bg-(--app-surface-elevated) p-4 shadow-[0_10px_26px_rgba(10,18,36,0.06)] dark:shadow-[0_14px_30px_rgba(0,0,0,0.16)]">
      <div className="flex items-start justify-between">
        <span className="flex size-9 items-center justify-center rounded-full bg-primary-50 text-primary-600 dark:bg-primary-500/12 dark:text-primary-300">
          <Icon className="size-4" />
        </span>
        <span className="-mr-1 -mt-1 flex size-7 items-center justify-center rounded-lg text-(--app-text-subtle)">
          <MoreVertical className="size-4" />
        </span>
      </div>
      <p className="mt-2.5 text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-(--app-text-subtle)">{label}</p>
      <p className="mt-1 text-[1.4rem] font-semibold tracking-tight text-(--app-text)">{value}</p>
      {progress !== null ? (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-(--app-surface-muted)">
          <div
            className="h-full rounded-full bg-primary-500 transition-[width] duration-500"
            style={{ width: `${Math.max(4, progress)}%` }}
          />
        </div>
      ) : null}
      {helper ? <p className="mt-2 text-[0.72rem] leading-4 text-(--app-text-muted)">{helper}</p> : null}
    </div>
  )
}

const applicationDateFormatter = new Intl.DateTimeFormat('es', { day: '2-digit', month: 'short', year: 'numeric' })

function formatApplicationDate(value?: string | null) {
  if (!value) {
    return '—'
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : applicationDateFormatter.format(date)
}
