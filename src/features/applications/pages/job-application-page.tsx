import { useState } from 'react'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { useAppSession } from '@/app/providers/app-session-provider'
import { surfacePaths } from '@/app/router/surface-paths'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toErrorMessage } from '@/features/auth/lib/auth-api'
import { submitApplication } from '@/features/applications/lib/applications-api'
import { fetchMyCandidateProfile } from '@/features/candidate-profile/lib/candidate-profile-api'
import { getPublicJobBySlug } from '@/features/jobs/lib/jobs-api'
import { reportErrorWithToast } from '@/lib/errors/error-reporting'

export function JobApplicationPage() {
  const { jobSlug = '' } = useParams()
  const navigate = useNavigate()
  const session = useAppSession()
  const queryClient = useQueryClient()
  const [selectedResumeId, setSelectedResumeId] = useState('')
  const [coverLetter, setCoverLetter] = useState('')
  const [answers, setAnswers] = useState<Record<string, string>>({})

  const candidateProfileQuery = useQuery({
    queryKey: ['candidate-profile', 'mine', 'apply'],
    enabled: session.isAuthenticated,
    queryFn: async () => fetchMyCandidateProfile(session.authUser!.id)
  })
  const jobQuery = useQuery({
    queryKey: ['jobs', 'detail', 'apply', jobSlug],
    enabled: jobSlug.length > 0,
    queryFn: async () => getPublicJobBySlug(jobSlug)
  })

  const applyMutation = useMutation({
    mutationFn: async () => {
      if (!jobQuery.data) {
        throw new Error('La vacante ya no esta disponible.')
      }

      return submitApplication({
        jobPostingId: jobQuery.data.id,
        submittedResumeId: selectedResumeId || null,
        coverLetter,
        answers:
          jobQuery.data.job_screening_questions?.map((question) => ({
            screeningQuestionId: question.id,
            answerText: answers[question.id] || ''
          })) ?? []
      })
    },
    onSuccess: async () => {
      toast.success('Postulacion enviada', {
        description: 'Tu perfil y respuestas ya quedaron registradas para esta vacante.'
      })
      // Refresca todas las listas de "mis aplicaciones" (overview, home, board) y el badge "Ya aplicaste".
      await queryClient.invalidateQueries({ queryKey: ['applications', 'mine'] })
      await navigate(surfacePaths.candidate.applications)
    },
    onError: async (error) => {
      await reportErrorWithToast({
        title: 'No pudimos enviar tu postulacion',
        source: 'applications.submit',
        route: surfacePaths.public.jobApply(jobSlug),
        userId: session.authUser?.id ?? null,
        error
      })
    }
  })

  if (jobQuery.isLoading || candidateProfileQuery.isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Preparando postulacion</CardTitle>
          <CardDescription>Estamos cargando la vacante, tu perfil y tus CVs disponibles.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (jobQuery.error || !jobQuery.data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No encontramos esta vacante</CardTitle>
          <CardDescription>{toErrorMessage(jobQuery.error)}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const profileBundle = candidateProfileQuery.data

  if (!profileBundle?.profile) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Necesitas completar tu perfil candidato</CardTitle>
          <CardDescription>
            Antes de aplicar debes tener tu perfil candidato guardado y al menos un CV disponible.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link to={surfacePaths.candidate.profile}>
            <Button>Ir a perfil candidato</Button>
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden bg-(--app-surface-muted)">
        <CardHeader className="space-y-3">
          <Badge variant="soft">Apply flow</Badge>
          <CardTitle>Postula a {jobQuery.data.title}</CardTitle>
          <CardDescription>
            Tu perfil reusable se combina con CV, cover letter y screening para evitar repetir datos innecesarios.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[24px] border border-white/70 bg-white/88 p-4 dark:border-zinc-800 dark:bg-zinc-950/75">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Perfil que se enviara</p>
            <p className="mt-2 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
              {session.profile?.display_name ?? session.profile?.full_name}
            </p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {profileBundle.profile.desired_role || profileBundle.profile.headline || 'Perfil candidato activo'}
            </p>
          </div>
          <div className="rounded-[24px] border border-white/70 bg-white/88 p-4 dark:border-zinc-800 dark:bg-zinc-950/75">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Vacante</p>
            <p className="mt-2 text-lg font-semibold text-zinc-950 dark:text-zinc-50">{jobQuery.data.title}</p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{jobQuery.data.company_profile?.display_name}</p>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-4 xl:grid-cols-[1fr_0.95fr]">
        <Card>
          <CardHeader>
            <CardTitle>Datos de envio</CardTitle>
            <CardDescription>Selecciona el CV que quieres usar y agrega una nota breve si aporta contexto.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="grid gap-2 text-sm">
              <span>CV a enviar</span>
              <Select value={selectedResumeId} onChange={(event) => setSelectedResumeId(event.target.value)}>
                <option value="">Sin CV seleccionado</option>
                {profileBundle.resumes.map((resume) => (
                  <option key={resume.id} value={resume.id}>
                    {resume.filename} {resume.is_default ? '· principal' : ''}
                  </option>
                ))}
              </Select>
            </label>

            <label className="grid gap-2 text-sm">
              <span>Cover letter</span>
              <Textarea
                rows={8}
                value={coverLetter}
                onChange={(event) => setCoverLetter(event.target.value)}
                placeholder="Explica por que encajas para la vacante, tu contexto o disponibilidad."
              />
            </label>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Screening</CardTitle>
            <CardDescription>Responde las preguntas de esta vacante antes de enviar la postulacion.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {jobQuery.data.job_screening_questions?.length ? (
              jobQuery.data.job_screening_questions.map((question) => (
                <label key={question.id} className="grid gap-2 text-sm">
                  <span>
                    {question.question_text}
                    {question.is_required ? ' *' : ''}
                  </span>
                  <Textarea
                    rows={question.answer_type === 'long_text' ? 5 : 3}
                    value={answers[question.id] ?? ''}
                    onChange={(event) =>
                      setAnswers((current) => ({
                        ...current,
                        [question.id]: event.target.value
                      }))
                    }
                    placeholder="Escribe tu respuesta"
                  />
                </label>
              ))
            ) : (
              <div className="rounded-[24px] border border-dashed border-zinc-300 px-4 py-6 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
                Esta vacante no tiene screening. Puedes enviar la postulacion directamente.
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <Button onClick={() => applyMutation.mutate()} disabled={applyMutation.isPending}>
                {applyMutation.isPending ? 'Enviando...' : 'Enviar postulacion'}
              </Button>
              <Link to={surfacePaths.public.jobDetail(jobSlug)}>
                <Button variant="outline">Volver a la vacante</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
