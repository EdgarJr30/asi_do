import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, useReducedMotion } from 'motion/react'
import {
  Banknote,
  Bookmark,
  BookmarkCheck,
  Building2,
  Eye,
  FileText,
  Globe,
  HelpCircle,
  MapPin,
  SendHorizontal,
  Sparkles
} from 'lucide-react'
import { Link, useParams } from 'react-router-dom'

import { useAppSession } from '@/app/providers/app-session-provider'
import { surfacePaths } from '@/app/router/surface-paths'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PageLoader } from '@/components/ui/loader'
import { toErrorMessage } from '@/features/auth/lib/auth-api'
import { fetchMyCandidateProfile } from '@/features/candidate-profile/lib/candidate-profile-api'
import { getPublicJobBySlug, toggleSavedJob } from '@/features/jobs/lib/jobs-api'
import { getCompensationTypeLabel, getOpportunityTypeLabel } from '@/features/opportunities/lib/opportunity-taxonomy'
import { reportErrorWithToast } from '@/lib/errors/error-reporting'
import { cn } from '@/lib/utils/cn'
import { cardReveal, gridStagger, pageStagger } from '@/shared/ui/card-motion'

const workplaceLabels: Record<string, string> = { remote: 'remoto', hybrid: 'híbrido', on_site: 'presencial' }

const metaChip =
  'inline-flex items-center gap-1.5 rounded-full border border-(--app-border) bg-(--app-surface) px-3 py-1 text-[0.74rem] text-(--app-text-muted)'
const actionPrimary =
  'inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-primary-600 bg-primary-600 px-4 text-[0.85rem] font-semibold text-white shadow-[0_12px_24px_rgba(43,69,143,0.2)] transition hover:border-primary-700 hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--app-ring) focus-visible:ring-offset-2'
const actionOutline =
  'inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-(--app-border) bg-(--app-surface) px-4 text-[0.82rem] font-medium text-(--app-text) transition hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--app-ring) disabled:cursor-not-allowed disabled:opacity-60 dark:hover:border-primary-400 dark:hover:bg-primary-500/12 dark:hover:text-primary-200'

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
          <Link className={actionOutline} to={surfacePaths.public.jobs}>
            Volver a empleos
          </Link>
        </div>
      </Card>
    )
  }

  const job = jobQuery.data
  const hasSalaryAmount = Boolean(job.compensation_min_amount || job.compensation_max_amount)
  const compensationLabel = hasSalaryAmount
    ? `${getCompensationTypeLabel(job.compensation_type)}: ${job.compensation_currency || 'USD'} ${(job.compensation_min_amount || job.compensation_max_amount || 0).toLocaleString()}${job.compensation_min_amount && job.compensation_max_amount ? ` - ${job.compensation_max_amount.toLocaleString()}` : ''}`
    : getCompensationTypeLabel(job.compensation_type)
  const locationLabel = [job.city_name, job.country_code].filter(Boolean).join(', ') || 'Ubicación flexible'
  const workplaceLabel = job.workplace_type ? workplaceLabels[job.workplace_type] ?? job.workplace_type : ''

  return (
    <motion.div
      className="space-y-5"
      variants={pageStagger}
      initial={shouldReduceMotion ? false : 'hidden'}
      animate="show"
    >
      <motion.div variants={cardReveal}>
        <Card>
          <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
            {/* Información */}
            <div className="space-y-3">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary-200 bg-primary-50 px-2.5 py-1 text-[0.7rem] font-semibold text-primary-700 dark:border-primary-500/30 dark:bg-primary-500/12 dark:text-primary-300">
                <Sparkles className="size-3.5" /> Oportunidad ASI
              </span>
              <h1 className="max-w-2xl text-2xl font-semibold leading-tight tracking-tight text-(--app-text) sm:text-[1.7rem]">
                {job.title}
              </h1>
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[0.82rem] text-(--app-text-muted)">
                <span className="inline-flex items-center gap-1.5">
                  <Building2 className="size-4" /> {job.company_profile?.display_name || 'Empresa'}
                </span>
                <span className="text-(--app-text-subtle)">·</span>
                <span>{getOpportunityTypeLabel(job.opportunity_type)}{workplaceLabel ? ` ${workplaceLabel}` : ''}</span>
              </div>
              {job.summary ? <p className="max-w-2xl text-[0.85rem] leading-6 text-(--app-text-muted)">{job.summary}</p> : null}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className={metaChip}><MapPin className="size-3.5" /> {locationLabel}</span>
                {job.experience_level ? <span className={metaChip}><Sparkles className="size-3.5" /> {job.experience_level}</span> : null}
                <span className={cn(metaChip, hasSalaryAmount && 'border-emerald-200 font-semibold text-emerald-700 dark:border-emerald-500/30 dark:text-emerald-300')}>
                  <Banknote className="size-3.5" /> {compensationLabel}
                </span>
              </div>
            </div>

            {/* Acciones */}
            <div className="rounded-xl border border-(--app-border) bg-(--app-surface-muted) p-4">
              <p className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-(--app-text-subtle)">Acciones</p>
              <div className="mt-3 flex flex-col gap-2.5">
                {session.isAuthenticated ? (
                  <Link className={actionPrimary} to={surfacePaths.public.jobApply(jobSlug)}>
                    <SendHorizontal className="size-4" /> Aplicar ahora
                  </Link>
                ) : (
                  <Link className={actionPrimary} to="/auth/sign-in">
                    <SendHorizontal className="size-4" /> Inicia sesión para aplicar
                  </Link>
                )}
                {session.isAuthenticated ? (
                  <button
                    type="button"
                    className={actionOutline}
                    onClick={() => saveMutation.mutate(!job.isSaved)}
                    disabled={saveMutation.isPending || !candidateProfileQuery.data?.profile}
                  >
                    {job.isSaved ? <BookmarkCheck className="size-4" /> : <Bookmark className="size-4" />}
                    {job.isSaved ? 'Quitar guardado' : 'Guardar vacante'}
                  </button>
                ) : null}
                <Link className={actionOutline} to={surfacePaths.public.jobs}>
                  <Eye className="size-4" /> Volver al discovery
                </Link>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      <motion.section variants={gridStagger} className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
        <motion.div variants={cardReveal}>
          <Card>
            <h2 className="inline-flex items-center gap-2 text-[0.95rem] font-semibold tracking-tight text-(--app-text)">
              <FileText className="size-4 text-(--app-text-subtle)" /> Descripción completa
            </h2>
            <div className="mt-3 whitespace-pre-wrap text-[0.82rem] leading-6 text-(--app-text-muted)">
              {job.description || 'La empresa aún no agregó una descripción detallada.'}
            </div>
          </Card>
        </motion.div>

        <motion.div variants={gridStagger} className="space-y-4">
          <motion.div variants={cardReveal}>
            <Card>
              <h2 className="inline-flex items-center gap-2 text-[0.95rem] font-semibold tracking-tight text-(--app-text)">
                <Building2 className="size-4 text-(--app-text-subtle)" /> Resumen de la empresa
              </h2>
              <p className="mt-3 text-[0.85rem] font-semibold text-(--app-text)">{job.company_profile?.display_name || 'Empresa'}</p>
              {job.company_profile?.industry ? <p className="mt-0.5 text-[0.78rem] text-(--app-text-muted)">{job.company_profile.industry}</p> : null}
              {job.company_profile?.description ? <p className="mt-2 text-[0.8rem] leading-6 text-(--app-text-muted)">{job.company_profile.description}</p> : null}
              {job.company_profile?.website_url ? (
                <a className={cn(actionOutline, 'mt-3 w-auto px-3.5')} href={job.company_profile.website_url} rel="noreferrer" target="_blank">
                  <Globe className="size-4" /> Visitar website
                </a>
              ) : null}
            </Card>
          </motion.div>

          <motion.div variants={cardReveal}>
            <Card>
              <h2 className="inline-flex items-center gap-2 text-[0.95rem] font-semibold tracking-tight text-(--app-text)">
                <HelpCircle className="size-4 text-(--app-text-subtle)" /> Preguntas de filtrado
              </h2>
              <p className="mt-1 text-[0.78rem] text-(--app-text-muted)">Visibles desde ya; las responderás al aplicar a la vacante.</p>
              <div className="mt-3 space-y-2">
                {job.job_screening_questions?.length ? (
                  job.job_screening_questions.map((question) => (
                    <div key={question.id} className="flex items-start gap-2 rounded-xl border border-(--app-border) bg-(--app-surface-muted) px-3.5 py-2.5 text-[0.82rem]">
                      <FileText className="mt-0.5 size-4 shrink-0 text-(--app-text-subtle)" />
                      <span>
                        <span className="block font-medium text-(--app-text)">{question.question_text}</span>
                        <span className="mt-0.5 block text-[0.72rem] text-(--app-text-subtle)">{question.is_required ? 'Requerida' : 'Opcional'}</span>
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-[0.8rem] text-(--app-text-muted)">Esta vacante no tiene preguntas de filtrado.</p>
                )}
              </div>
            </Card>
          </motion.div>
        </motion.div>
      </motion.section>
    </motion.div>
  )
}
