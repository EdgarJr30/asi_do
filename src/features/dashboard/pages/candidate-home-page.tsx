import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  Circle,
  FileText,
  LayoutDashboard,
  Sparkles,
  UserRound
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { useAppSession } from '@/app/providers/app-session-provider'
import { surfacePaths } from '@/app/router/surface-paths'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Spinner } from '@/components/ui/loader'
import { StatCard } from '@/components/ui/stat-card'
import { listMyApplications } from '@/features/applications/lib/applications-api'
import { fetchMyCandidateProfile, type CandidateProfileBundle } from '@/features/candidate-profile/lib/candidate-profile-api'
import type { Database } from '@/shared/types/database'

type PublicStatus = Database['public']['Enums']['application_public_status']

const ACTIVE_STATUSES: PublicStatus[] = ['submitted', 'in_review', 'interviewing', 'offer']

const statusCopy: Record<PublicStatus, { label: string; variant: 'default' | 'soft' | 'outline' }> = {
  submitted: { label: 'Enviada', variant: 'outline' },
  in_review: { label: 'En revisión', variant: 'soft' },
  interviewing: { label: 'Entrevista', variant: 'default' },
  offer: { label: 'Oferta', variant: 'default' },
  rejected: { label: 'No seleccionada', variant: 'outline' },
  withdrawn: { label: 'Retirada', variant: 'outline' },
  hired: { label: 'Contratada', variant: 'default' }
}

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
  const recentApplications = applications.slice(0, 4)
  const resumeCount = profileQuery.data?.resumes.length ?? 0

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
  const showProfileBanner = completeness !== null && completeness.percent < 100

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <p className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-(--app-text-subtle)">Inicio · Tu espacio</p>
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
      </div>

      <div className="grid gap-2.5 sm:grid-cols-3">
        <StatCard
          label="Perfil completo"
          value={completeness ? `${completeness.percent}%` : '—'}
          helper={
            completeness && completeness.percent < 100
              ? `${completeness.total - completeness.completed} cosas por completar`
              : 'Tu perfil está listo'
          }
        />
        <StatCard label="Aplicaciones activas" value={applicationsQuery.isLoading ? '—' : activeApplications} helper="Procesos abiertos en este momento" />
        <StatCard label="CV cargados" value={profileQuery.isLoading ? '—' : resumeCount} helper="Documentos listos para postular" />
      </div>

      {showProfileBanner ? (
        <Card className="border-primary-200/70 bg-primary-50/60 dark:border-primary-500/25 dark:bg-primary-500/10">
          <CardContent className="mt-0 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex-1 space-y-2.5">
              <div className="flex items-center gap-2">
                <Sparkles className="size-3.5 text-primary-600 dark:text-primary-300" />
                <p className="text-[0.8rem] font-semibold text-(--app-text)">Completa tu perfil para destacar ante los reclutadores</p>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[0.7rem] text-(--app-text-muted)">
                  <span>{completeness.completed} de {completeness.total} completado</span>
                  <span className="tabular-nums font-semibold text-primary-600 dark:text-primary-300">{completeness.percent}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-(--app-surface-muted)">
                  <div
                    className="h-full rounded-full bg-primary-500 transition-[width] duration-500"
                    style={{ width: `${Math.max(4, completeness.percent)}%` }}
                  />
                </div>
              </div>
              <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
                {completeness.items.map((item) => (
                  <li
                    key={item.key}
                    className={cnStatus(item.done)}
                  >
                    {item.done ? <CheckCircle2 className="size-3.5" /> : <Circle className="size-3.5" />}
                    {item.label}
                  </li>
                ))}
              </ul>
            </div>
            <div className="shrink-0">
              <Button className="h-9 text-[0.8rem]" onClick={() => void navigate(surfacePaths.candidate.profile)}>Completar perfil</Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {moduleCards.map((module) => {
          const Icon = module.icon
          return (
            <Card key={module.key} className="flex flex-col">
              <CardHeader>
                <span className="flex size-9 items-center justify-center rounded-xl bg-primary-50 text-primary-600 dark:bg-primary-500/12 dark:text-primary-300">
                  <Icon className="size-4" />
                </span>
                <CardTitle className="mt-2.5">{module.title}</CardTitle>
                <CardDescription>{module.description}</CardDescription>
              </CardHeader>
              <CardContent className="mt-auto pt-3">
                <Button
                  variant="ghost"
                  className="h-9 px-0 text-sm text-primary-600 hover:bg-transparent hover:text-primary-700 dark:text-primary-300"
                  onClick={module.onClick}
                >
                  {module.cta}
                  <ArrowRight className="size-4" />
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Aplicaciones recientes</CardTitle>
              <CardDescription>El estado más nuevo de cada proceso.</CardDescription>
            </div>
            <Button className="h-9 rounded-full px-3 text-xs" variant="ghost" onClick={() => void navigate(surfacePaths.candidate.applications)}>
              Ver todas
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {applicationsQuery.isLoading ? (
            <div className="flex items-center gap-2.5 text-sm text-(--app-text-muted)">
              <Spinner size="sm" /> Cargando aplicaciones…
            </div>
          ) : recentApplications.length > 0 ? (
            <ul className="space-y-2">
              {recentApplications.map((application) => {
                const status = statusCopy[application.status_public]
                return (
                  <li
                    key={application.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-(--app-border) bg-(--app-surface-muted) px-3.5 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[0.8rem] font-semibold text-(--app-text)">
                        {application.job_posting?.title || 'Vacante'}
                      </p>
                      <p className="truncate text-[0.7rem] text-(--app-text-muted)">
                        {application.job_posting?.company_profile?.display_name || 'Empresa'}
                      </p>
                    </div>
                    <Badge variant={status?.variant ?? 'outline'}>{status?.label ?? application.status_public}</Badge>
                  </li>
                )
              })}
            </ul>
          ) : (
            <EmptyState
              title="Aún no tienes aplicaciones"
              description="Explora oportunidades abiertas y postúlate cuando tu perfil esté listo."
              actionLabel="Explorar vacantes"
              onAction={() => void navigate(surfacePaths.storefront.jobs)}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function cnStatus(done: boolean) {
  return done
    ? 'inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400'
    : 'inline-flex items-center gap-1.5 text-xs text-(--app-text-subtle)'
}
