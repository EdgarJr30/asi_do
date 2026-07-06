import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, useReducedMotion } from 'motion/react'
import {
  ArrowLeft,
  Banknote,
  Bookmark,
  BookmarkCheck,
  Building2,
  Check,
  Clock3,
  FileText,
  Globe,
  HelpCircle,
  MapPin,
  SendHorizontal,
  Sparkles,
  Users
} from 'lucide-react'
import { Link, useParams } from 'react-router-dom'

import { useAppSession } from '@/app/providers/app-session-provider'
import { surfacePaths } from '@/app/router/surface-paths'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PageLoader } from '@/components/ui/loader'
import { listMyApplications } from '@/features/applications/lib/applications-api'
import { toErrorMessage } from '@/features/auth/lib/auth-api'
import { fetchMyCandidateProfile } from '@/features/candidate-profile/lib/candidate-profile-api'
import { getPublicJobBySlug, toggleSavedJob } from '@/features/jobs/lib/jobs-api'
import { getCompensationTypeLabel, getOpportunityTypeLabel } from '@/features/opportunities/lib/opportunity-taxonomy'
import { CompanyLogo } from '@/features/tenants/components/company-logo'
import { reportErrorWithToast } from '@/lib/errors/error-reporting'
import { cn } from '@/lib/utils/cn'
import { cardReveal, gridStagger, pageStagger } from '@/shared/ui/card-motion'

const workplaceLabels: Record<string, string> = { remote: 'Remoto', hybrid: 'Híbrido', on_site: 'Presencial' }
const employmentLabels: Record<string, string> = {
  full_time: 'Tiempo completo',
  part_time: 'Medio tiempo',
  contract: 'Por contrato',
  temporary: 'Temporal',
  internship: 'Pasantía'
}

const linkButtonClassName =
  'inline-flex h-10 w-full items-center justify-center gap-2 rounded-control border border-primary-600 bg-primary-600 px-3.5 text-[0.85rem] font-semibold text-white shadow-[0_10px_20px_rgba(43,69,143,0.18)] transition hover:border-primary-700 hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--app-ring) focus-visible:ring-offset-2 focus-visible:ring-offset-(--app-canvas) sm:h-11 sm:px-4 sm:text-sm'
const outlineLinkButtonClassName =
  'inline-flex h-11 w-full items-center justify-center gap-2 rounded-control border border-(--app-border) bg-(--app-surface) px-4 text-sm font-semibold text-(--app-text) transition hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--app-ring) focus-visible:ring-offset-2 focus-visible:ring-offset-(--app-canvas) dark:hover:border-primary-400 dark:hover:bg-primary-500/12 dark:hover:text-primary-200'
const tagClassName =
  'inline-flex min-h-7 items-center gap-1.5 rounded-full border border-(--app-border) bg-(--app-surface) px-2.5 py-0.5 text-[0.7rem] font-medium text-(--app-text-muted) sm:min-h-8 sm:px-3 sm:py-1 sm:text-[0.75rem]'

function parseMetadata(value: unknown) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }

  return {}
}

function readStringList(metadata: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = metadata[key]

    if (Array.isArray(value)) {
      const items = value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      if (items.length > 0) {
        return items
      }
    }

    if (typeof value === 'string' && value.trim().length > 0) {
      return value
        .split(/\n|;/)
        .map((item) => item.trim())
        .filter(Boolean)
    }
  }

  return []
}

function formatRelativeDate(value: string | null | undefined) {
  if (!value) {
    return 'Fecha no indicada'
  }

  const days = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 86_400_000))
  if (days === 0) {
    return 'Publicado hoy'
  }
  if (days === 1) {
    return 'Publicado hace 1 día'
  }

  return `Publicado hace ${days} días`
}

function SectionTitle({ icon: Icon, children }: { icon: typeof FileText; children: string }) {
  return (
    <h2 className="flex items-center gap-2 text-[0.95rem] font-semibold tracking-tight text-(--app-text) sm:text-base">
      <span className="flex size-6 items-center justify-center rounded-control bg-primary-50 text-primary-700 sm:size-7 dark:bg-primary-500/12 dark:text-primary-200">
        <Icon className="size-3.5 sm:size-4" />
      </span>
      {children}
    </h2>
  )
}

export function JobDetailPage() {
  const { jobSlug = '' } = useParams()
  const session = useAppSession()
  const queryClient = useQueryClient()
  const shouldReduceMotion = useReducedMotion()
  const candidateProfileQuery = useQuery({
    queryKey: ['candidate-profile', 'mine', 'job-detail'],
    enabled: session.isAuthenticated,
    queryFn: async () => fetchMyCandidateProfile(session.authUser!.id)
  })
  const jobQuery = useQuery({
    queryKey: ['jobs', 'detail', jobSlug, candidateProfileQuery.data?.profile?.id ?? null],
    enabled: jobSlug.length > 0,
    queryFn: async () => getPublicJobBySlug(jobSlug, candidateProfileQuery.data?.profile?.id ?? null)
  })
  const applicationsQuery = useQuery({
    queryKey: ['applications', 'mine', 'job-detail', session.authUser?.id ?? null],
    enabled: session.isAuthenticated,
    queryFn: async () => listMyApplications(session.authUser!.id)
  })

  const saveMutation = useMutation({
    mutationFn: async (shouldSave: boolean) => {
      const candidateProfileId = candidateProfileQuery.data?.profile?.id

      if (!candidateProfileId || !jobQuery.data) {
        throw new Error('Necesitas un perfil candidato para guardar esta vacante.')
      }

      return toggleSavedJob({
        candidateProfileId,
        jobPostingId: jobQuery.data.id,
        shouldSave
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['jobs'] })
    },
    onError: async (error) => {
      await reportErrorWithToast({
        title: 'No pudimos actualizar esta vacante guardada',
        source: 'jobs.detail.toggle-saved',
        route: surfacePaths.public.jobDetail(jobSlug),
        userId: session.authUser?.id ?? null,
        error
      })
    }
  })

  if (jobQuery.isLoading) {
    return <PageLoader label="Cargando vacante" hint="Estamos recuperando el detalle de esta oportunidad" />
  }

  if (jobQuery.error || !jobQuery.data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No encontramos esta vacante</CardTitle>
          <CardDescription>{toErrorMessage(jobQuery.error) || 'El slug no corresponde a una vacante publicada.'}</CardDescription>
        </CardHeader>
        <div className="mt-4">
          <Link className={outlineLinkButtonClassName} to={surfacePaths.public.jobs}>
            Volver a empleos
          </Link>
        </div>
      </Card>
    )
  }

  const job = jobQuery.data
  const metadata = parseMetadata(job.opportunity_metadata)
  const responsibilities = readStringList(metadata, ['responsibilities', 'key_responsibilities', 'responsabilidades'])
  const descriptionParagraphs = (job.description || 'La empresa aún no agregó una descripción detallada.')
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
  const hasSalaryAmount = Boolean(job.compensation_min_amount || job.compensation_max_amount)
  const compensationLabel = hasSalaryAmount
    ? `${job.compensation_currency || 'USD'} ${(job.compensation_min_amount || job.compensation_max_amount || 0).toLocaleString()}${job.compensation_min_amount && job.compensation_max_amount ? ` - ${job.compensation_max_amount.toLocaleString()}` : ''}`
    : getCompensationTypeLabel(job.compensation_type)
  const locationLabel = [job.city_name, job.country_code].filter(Boolean).join(', ') || 'Ubicación flexible'
  const workplaceLabel = job.workplace_type ? workplaceLabels[job.workplace_type] ?? job.workplace_type : 'Sin modalidad'
  const opportunityLabel = getOpportunityTypeLabel(job.opportunity_type)
  const employmentLabel = employmentLabels[job.employment_type] ?? job.employment_type
  const companyName = job.company_profile?.display_name || 'Empresa'
  const existingApplication = (applicationsQuery.data ?? []).find((application) => application.job_posting_id === job.id) ?? null
  const applicationPath = session.isAuthenticated ? surfacePaths.public.jobApply(jobSlug) : surfacePaths.auth.signIn
  const applicationLabel = existingApplication
    ? 'Actualizar CV enviado'
    : session.isAuthenticated
      ? 'Aplicar ahora'
      : 'Inicia sesión para aplicar'
  const isSaveDisabled = saveMutation.isPending || !candidateProfileQuery.data?.profile

  const saveButton = (
    <Button
      type="button"
      variant="outline"
      className="h-11 w-full rounded-control"
      onClick={() => saveMutation.mutate(!job.isSaved)}
      disabled={isSaveDisabled}
    >
      {job.isSaved ? <BookmarkCheck className="size-4" /> : <Bookmark className="size-4" />}
      {job.isSaved ? 'Quitar guardado' : 'Guardar vacante'}
    </Button>
  )

  return (
    <motion.div
      className="mx-auto max-w-260 pb-36 lg:pb-4"
      variants={pageStagger}
      initial={shouldReduceMotion ? false : 'hidden'}
      animate="show"
    >
      <motion.div variants={cardReveal}>
        <Link
          to={surfacePaths.public.jobs}
          className="mb-3 inline-flex items-center gap-1.5 text-[0.82rem] font-semibold text-(--app-text-muted) transition hover:text-primary-700 dark:hover:text-primary-200 sm:mb-4 sm:text-sm"
        >
          <ArrowLeft className="size-3.5 sm:size-4" />
          Volver a vacantes
        </Link>
      </motion.div>

      <motion.header variants={cardReveal} className="border-b border-(--app-border) pb-4 sm:pb-5">
        <div className="flex flex-col gap-3 min-[860px]:flex-row min-[860px]:items-start">
          <CompanyLogo name={companyName} logoPath={job.company_profile?.logo_path} size="lg" className="size-11 rounded-card shadow-sm sm:size-12" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="gap-1.5 bg-primary-50 text-primary-700 dark:bg-primary-500/12 dark:text-primary-200">
                <Sparkles className="size-3.5" />
                Oportunidad ASI
              </Badge>
              {existingApplication ? (
                <Badge className="gap-1.5 border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/12 dark:text-emerald-300">
                  <Check className="size-3.5" />
                  Ya aplicaste
                </Badge>
              ) : null}
            </div>
            <h1 className="mt-2 max-w-3xl text-[1.22rem] font-semibold leading-tight tracking-tight text-(--app-text) sm:text-[1.5rem]">
              {job.title}
            </h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[0.82rem] font-medium text-(--app-text-muted) sm:text-sm">
              <span className="inline-flex items-center gap-1.5">
                <Building2 className="size-3.5 text-(--app-text-subtle) sm:size-4" /> {companyName}
              </span>
              <span className="size-1 rounded-full bg-(--app-text-subtle)" />
              <span>{opportunityLabel}</span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-1.5 sm:gap-2">
              <span className={tagClassName}>
                <MapPin className="size-3.5" /> {locationLabel}
              </span>
              {job.experience_level ? (
                <span className={tagClassName}>
                  <Users className="size-3.5" /> {job.experience_level}
                </span>
              ) : null}
              <span className={cn(tagClassName, hasSalaryAmount && 'border-emerald-200 text-emerald-700 dark:border-emerald-500/30 dark:text-emerald-300')}>
                <Banknote className="size-3.5" /> {compensationLabel}
              </span>
              <span className={tagClassName}>
                <Clock3 className="size-3.5" /> {formatRelativeDate(job.published_at)}
              </span>
            </div>
          </div>
        </div>
      </motion.header>

      <motion.div variants={gridStagger} className="mt-5 grid gap-5 xl:grid-cols-[1fr_18rem]">
        <motion.main variants={gridStagger} className="space-y-5 sm:space-y-6">
          <motion.section variants={cardReveal} className="space-y-2.5">
            <SectionTitle icon={FileText}>Descripción del puesto</SectionTitle>
            <div className="space-y-2.5 text-[0.88rem] leading-6 text-(--app-text-muted) sm:text-[0.94rem]">
              {descriptionParagraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </motion.section>

          <motion.section variants={cardReveal} className="space-y-2.5">
            <SectionTitle icon={Check}>Responsabilidades</SectionTitle>
            {responsibilities.length > 0 ? (
              <div className="space-y-1.5 sm:space-y-2">
                {responsibilities.map((responsibility) => (
                  <div
                    key={responsibility}
                    className="flex items-start gap-2.5 rounded-control border border-(--app-border) bg-(--app-surface) px-3 py-2.5 text-[0.86rem] shadow-[0_1px_2px_rgba(20,40,90,0.04)] transition hover:border-primary-200 hover:bg-primary-50/40 sm:gap-3 sm:px-3.5 sm:py-3 sm:text-sm dark:hover:border-primary-500/30 dark:hover:bg-primary-500/8"
                  >
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-700 sm:size-6 dark:bg-primary-500/12 dark:text-primary-200">
                      <Check className="size-3 sm:size-3.5" />
                    </span>
                    <span className="font-medium leading-5 text-(--app-text) sm:leading-6">{responsibility}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-control border border-dashed border-(--app-border) bg-(--app-surface-muted) px-3.5 py-4 text-sm text-(--app-text-muted)">
                La empresa todavía no detalló responsabilidades específicas para esta vacante.
              </p>
            )}
          </motion.section>

          <motion.section variants={cardReveal} className="space-y-2.5">
            <SectionTitle icon={HelpCircle}>Preguntas de filtrado</SectionTitle>
            <p className="text-[0.86rem] text-(--app-text-muted) sm:text-sm">Visibles desde ahora; las responderás al aplicar a la vacante.</p>
            <div className="space-y-1.5 sm:space-y-2">
              {job.job_screening_questions?.length ? (
                job.job_screening_questions.map((question, index) => (
                  <div
                    key={question.id}
                    className="flex items-start gap-2.5 rounded-control border border-(--app-border) bg-(--app-surface) px-3 py-2.5 text-[0.86rem] shadow-[0_1px_2px_rgba(20,40,90,0.04)] sm:gap-3 sm:px-3.5 sm:py-3 sm:text-sm"
                  >
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-control bg-primary-50 text-[0.68rem] font-bold text-primary-700 sm:size-6 sm:text-xs dark:bg-primary-500/12 dark:text-primary-200">
                      {index + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-semibold text-(--app-text)">{question.question_text}</span>
                      <span className="mt-1 block text-[0.75rem] text-(--app-text-subtle)">
                        <span className={question.is_required ? 'font-semibold text-amber-700 dark:text-amber-300' : ''}>
                          {question.is_required ? 'Obligatoria' : 'Opcional'}
                        </span>{' '}
                        · respuesta abierta
                      </span>
                    </span>
                  </div>
                ))
              ) : (
                <p className="rounded-control border border-dashed border-(--app-border) bg-(--app-surface-muted) px-3.5 py-4 text-sm text-(--app-text-muted)">
                  Esta vacante no tiene preguntas de filtrado.
                </p>
              )}
            </div>
          </motion.section>
        </motion.main>

        <motion.aside variants={gridStagger} className="space-y-3.5 xl:sticky xl:top-4 xl:self-start">
          <motion.div variants={cardReveal} className="hidden min-[860px]:block">
            <Card className="rounded-control p-3.5">
              <div className="flex flex-col gap-2">
                <Link className={linkButtonClassName} to={applicationPath}>
                  {existingApplication ? <FileText className="size-4" /> : <SendHorizontal className="size-4" />}
                  {applicationLabel}
                </Link>
                {session.isAuthenticated && !existingApplication ? saveButton : null}
                {existingApplication ? (
                  <p className="rounded-control bg-emerald-50 px-3 py-2 text-xs font-medium leading-5 text-emerald-700 dark:bg-emerald-500/12 dark:text-emerald-300">
                    Ya aplicaste a esta vacante. Solo puedes actualizar el CV asociado.
                  </p>
                ) : null}
              </div>
              <dl className="mt-3 divide-y divide-(--app-border)">
                <div className="flex items-center justify-between gap-3 py-2.5 text-[0.86rem]">
                  <dt className="text-(--app-text-subtle)">Modalidad</dt>
                  <dd className="font-semibold text-(--app-text)">{workplaceLabel}</dd>
                </div>
                <div className="flex items-center justify-between gap-3 py-2.5 text-[0.86rem]">
                  <dt className="text-(--app-text-subtle)">Tipo</dt>
                  <dd className="text-right font-semibold text-(--app-text)">{employmentLabel}</dd>
                </div>
                <div className="flex items-center justify-between gap-3 py-2.5 text-[0.86rem]">
                  <dt className="text-(--app-text-subtle)">Oportunidad</dt>
                  <dd className="text-right font-semibold text-(--app-text)">{opportunityLabel}</dd>
                </div>
                <div className="flex items-center justify-between gap-3 py-2.5 text-[0.86rem]">
                  <dt className="text-(--app-text-subtle)">Preguntas</dt>
                  <dd className="font-semibold text-(--app-text)">{job.job_screening_questions?.length ?? 0}</dd>
                </div>
              </dl>
            </Card>
          </motion.div>

          <motion.div variants={cardReveal}>
            <Card className="rounded-control p-3.5">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-(--app-text-subtle)">Sobre la empresa</p>
              <div className="mt-3 flex items-center gap-2.5">
                <CompanyLogo name={companyName} logoPath={job.company_profile?.logo_path} size="md" className="size-9" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-(--app-text)">{companyName}</p>
                  {job.company_profile?.industry ? (
                    <p className="text-xs text-(--app-text-muted)">{job.company_profile.industry}</p>
                  ) : null}
                </div>
              </div>
              {job.company_profile?.description ? (
                <p className="mt-2.5 line-clamp-3 text-[0.86rem] leading-5 text-(--app-text-muted)">{job.company_profile.description}</p>
              ) : null}
              {job.company_profile?.website_url ? (
                <a
                  className="mt-3 inline-flex items-center gap-2 text-[0.86rem] font-semibold text-primary-700 transition hover:text-primary-800 dark:text-primary-200 dark:hover:text-primary-100"
                  href={job.company_profile.website_url}
                  rel="noreferrer"
                  target="_blank"
                >
                  <Globe className="size-4" /> Visitar sitio web
                </a>
              ) : null}
            </Card>
          </motion.div>
        </motion.aside>
      </motion.div>

      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-40 flex gap-2 border-t border-(--app-border) bg-(--app-surface)/95 px-3 py-2.5 shadow-[0_-8px_20px_rgba(24,39,78,0.12)] backdrop-blur min-[860px]:hidden">
        {session.isAuthenticated && !existingApplication ? (
          <Button
            type="button"
            variant="outline"
            className="size-10 shrink-0 rounded-control px-0"
            aria-label={job.isSaved ? 'Quitar guardado' : 'Guardar vacante'}
            onClick={() => saveMutation.mutate(!job.isSaved)}
            disabled={isSaveDisabled}
          >
            {job.isSaved ? <BookmarkCheck className="size-4" /> : <Bookmark className="size-4" />}
          </Button>
        ) : null}
        <Link className={linkButtonClassName} to={applicationPath}>
          {existingApplication ? <FileText className="size-4" /> : null}
          {applicationLabel}
        </Link>
      </div>
    </motion.div>
  )
}
