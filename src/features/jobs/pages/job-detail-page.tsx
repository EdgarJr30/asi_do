import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'

import { useAppSession } from '@/app/providers/app-session-provider'
import { surfacePaths } from '@/app/router/surface-paths'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toErrorMessage } from '@/features/auth/lib/auth-api'
import { fetchMyCandidateProfile } from '@/features/candidate-profile/lib/candidate-profile-api'
import { getPublicJobBySlug, toggleSavedJob } from '@/features/jobs/lib/jobs-api'
import { getCompensationTypeLabel, getOpportunityTypeLabel } from '@/features/opportunities/lib/opportunity-taxonomy'
import { reportErrorWithToast } from '@/lib/errors/error-reporting'
import { cn } from '@/lib/utils/cn'

const linkButtonClassName =
  'inline-flex h-11 items-center justify-center rounded-2xl border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-900 shadow-sm transition-[transform,box-shadow,background-color,border-color,color] duration-200 ease-out hover:-translate-y-px hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700 hover:shadow-[0_14px_28px_rgba(15,23,42,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:border-primary-500 dark:hover:bg-primary-500/12 dark:hover:text-primary-300'

export function JobDetailPage() {
  const { jobSlug = '' } = useParams()
  const session = useAppSession()
  const queryClient = useQueryClient()
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
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cargando vacante</CardTitle>
          <CardDescription>Estamos recuperando el detalle de esta oportunidad.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (jobQuery.error || !jobQuery.data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No encontramos esta vacante</CardTitle>
          <CardDescription>{toErrorMessage(jobQuery.error) || 'El slug no corresponde a una vacante publicada.'}</CardDescription>
        </CardHeader>
        <CardContent>
          <Link className={linkButtonClassName} to={surfacePaths.public.jobs}>
            Volver a jobs
          </Link>
        </CardContent>
      </Card>
    )
  }

  const job = jobQuery.data
  const compensationLabel =
    job.compensation_min_amount || job.compensation_max_amount
      ? `${getCompensationTypeLabel(job.compensation_type)}: ${job.compensation_currency || 'USD'} ${(job.compensation_min_amount || job.compensation_max_amount || 0).toLocaleString()}${job.compensation_min_amount && job.compensation_max_amount ? ` - ${job.compensation_max_amount.toLocaleString()}` : ''}`
      : getCompensationTypeLabel(job.compensation_type)

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden bg-(--app-surface-muted)">
        <CardHeader className="space-y-3">
          <Badge variant="soft">Oportunidad ASI</Badge>
          <CardTitle className="max-w-3xl text-2xl sm:text-3xl">{job.title}</CardTitle>
          <CardDescription>
            {job.company_profile?.display_name || 'Company'} · {getOpportunityTypeLabel(job.opportunity_type)} · {job.workplace_type}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <p className="text-base leading-7 text-(--app-text-muted)">{job.summary}</p>
            <div className="flex flex-wrap gap-2">
              {job.country_code ? <Badge variant="outline">{job.country_code}</Badge> : null}
              {job.experience_level ? <Badge variant="outline">{job.experience_level}</Badge> : null}
              <Badge variant="outline">{compensationLabel}</Badge>
            </div>
          </div>

          <div className="rounded-[28px] border border-(--app-border) bg-(--app-surface-elevated) p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-(--app-text-subtle)">Acciones</p>
            <div className="mt-4 flex flex-col gap-3">
              <Button disabled>Apply llega en la siguiente fase</Button>
              {session.isAuthenticated ? (
                <Link className={cn(linkButtonClassName, 'bg-primary-500 text-white hover:bg-primary-400 hover:text-white border-transparent')} to={surfacePaths.public.jobApply(jobSlug)}>
                  Apply now
                </Link>
              ) : null}
              {session.isAuthenticated ? (
                <Button
                  variant="outline"
                  onClick={() => saveMutation.mutate(!job.isSaved)}
                  disabled={saveMutation.isPending || !candidateProfileQuery.data?.profile}
                >
                  {job.isSaved ? 'Quitar guardado' : 'Guardar vacante'}
                </Button>
              ) : (
                <Link className={linkButtonClassName} to="/auth/sign-in">
                  Inicia sesion para guardar
                </Link>
              )}
              <Link className={cn(linkButtonClassName, 'bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-900')} to={surfacePaths.public.jobs}>
                Volver al discovery
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Descripcion completa</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="whitespace-pre-wrap text-sm leading-7 text-(--app-text-muted)">{job.description}</div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Company snapshot</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-(--app-text-muted)">
              <p className="font-semibold text-(--app-text)">{job.company_profile?.display_name || 'Company'}</p>
              {job.company_profile?.industry ? <p>{job.company_profile.industry}</p> : null}
              {job.company_profile?.description ? <p>{job.company_profile.description}</p> : null}
              {job.company_profile?.website_url ? (
                <a className={linkButtonClassName} href={job.company_profile.website_url} rel="noreferrer" target="_blank">
                  Visitar website
                </a>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Preguntas screening</CardTitle>
              <CardDescription>Quedan visibles desde ya, aunque el apply flow se active en la fase siguiente.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {job.job_screening_questions?.length ? (
                job.job_screening_questions.map((question) => (
                  <div key={question.id} className="rounded-2xl border border-(--app-border) bg-(--app-surface-muted) px-4 py-3 text-sm">
                    <p className="font-semibold text-(--app-text)">{question.question_text}</p>
                    <p className="mt-1 text-(--app-text-muted)">
                      {question.answer_type} {question.is_required ? '· requerida' : '· opcional'}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-(--app-text-muted)">Esta vacante no tiene screening configurado todavia.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  )
}
