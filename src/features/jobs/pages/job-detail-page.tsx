import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'

import { useAppSession } from '@/app/providers/app-session-provider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toErrorMessage } from '@/features/auth/lib/auth-api'
import { fetchMyCandidateProfile } from '@/features/candidate-profile/lib/candidate-profile-api'
import { getPublicJobBySlug, toggleSavedJob } from '@/features/jobs/lib/jobs-api'
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
        route: `/jobs/${jobSlug}`,
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
          <CardDescription>Estamos recuperando el detalle publico de esta oportunidad.</CardDescription>
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
                <Link className={linkButtonClassName} to="/jobs">
                  Volver a jobs
                </Link>
        </CardContent>
      </Card>
    )
  }

  const job = jobQuery.data

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden bg-[var(--app-surface-muted)]">
        <CardHeader className="space-y-3">
          <Badge variant="soft">Public job detail</Badge>
          <CardTitle className="max-w-3xl text-2xl sm:text-3xl">{job.title}</CardTitle>
          <CardDescription>
            {job.company_profile?.display_name || 'Company'} · {job.workplace_type} · {job.employment_type}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <p className="text-base leading-7 text-zinc-700 dark:text-zinc-300">{job.summary}</p>
            <div className="flex flex-wrap gap-2">
              {job.country_code ? <Badge variant="outline">{job.country_code}</Badge> : null}
              {job.experience_level ? <Badge variant="outline">{job.experience_level}</Badge> : null}
              <Badge variant="outline">{job.salary_visible ? 'Salario visible' : 'Salario no visible'}</Badge>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/70 bg-white/88 p-5 dark:border-zinc-800 dark:bg-zinc-950/80">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Acciones</p>
            <div className="mt-4 flex flex-col gap-3">
              <Button disabled>Apply llega en la siguiente fase</Button>
              {session.isAuthenticated ? (
                <Link className={cn(linkButtonClassName, 'bg-primary-500 text-white hover:bg-primary-400 hover:text-white border-transparent')} to={`/jobs/${jobSlug}/apply`}>
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
              <Link className={cn(linkButtonClassName, 'bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-900')} to="/jobs">
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
            <div className="whitespace-pre-wrap text-sm leading-7 text-zinc-700 dark:text-zinc-300">{job.description}</div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Company snapshot</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-zinc-700 dark:text-zinc-300">
              <p className="font-semibold text-zinc-950 dark:text-zinc-50">{job.company_profile?.display_name || 'Company'}</p>
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
                  <div key={question.id} className="rounded-2xl bg-zinc-50 px-4 py-3 text-sm dark:bg-zinc-900/80">
                    <p className="font-semibold text-zinc-950 dark:text-zinc-50">{question.question_text}</p>
                    <p className="mt-1 text-zinc-600 dark:text-zinc-400">
                      {question.answer_type} {question.is_required ? '· requerida' : '· opcional'}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-zinc-600 dark:text-zinc-400">Esta vacante no tiene screening configurado todavia.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  )
}
