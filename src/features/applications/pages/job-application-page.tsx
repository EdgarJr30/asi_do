import { useEffect, useMemo, useState } from 'react'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleAlert,
  FileText,
  HelpCircle,
  MessageSquareText,
  SendHorizontal,
  Upload,
  UserRound
} from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { useAppSession } from '@/app/providers/app-session-provider'
import { surfacePaths } from '@/app/router/surface-paths'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PageLoader } from '@/components/ui/loader'
import { Textarea } from '@/components/ui/textarea'
import { toErrorMessage } from '@/features/auth/lib/auth-api'
import { listMyApplications, submitApplication, updateApplicationResume } from '@/features/applications/lib/applications-api'
import { fetchMyCandidateProfile } from '@/features/candidate-profile/lib/candidate-profile-api'
import { getPublicJobBySlug } from '@/features/jobs/lib/jobs-api'
import { CompanyLogo } from '@/features/tenants/components/company-logo'
import { reportErrorWithToast } from '@/lib/errors/error-reporting'
import { cn } from '@/lib/utils/cn'

const TOTAL_STEPS = 4

const workplaceLabels: Record<string, string> = { remote: 'Remoto', hybrid: 'Híbrido', on_site: 'Presencial' }

const steps = [
  { name: 'Tu CV', subtitle: 'Elige el documento a enviar' },
  { name: 'Presentación', subtitle: 'Cuenta por qué encajas' },
  { name: 'Preguntas', subtitle: 'Screening de la vacante' },
  { name: 'Revisar y enviar', subtitle: 'Confirma tu postulación' }
] as const

interface ApplicationDraft {
  selectedResumeId?: string
  coverLetter?: string
  answers?: Record<string, string>
  currentStep?: number
}

function applicationDraftKey(jobSlug: string, userId: string | null | undefined) {
  return userId ? `asi:job-application-draft:${userId}:${jobSlug}` : null
}

function readApplicationDraft(key: string | null): ApplicationDraft | null {
  if (!key || typeof window === 'undefined') {
    return null
  }

  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) {
      return null
    }
    const parsed = JSON.parse(raw) as ApplicationDraft
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

function writeApplicationDraft(key: string | null, draft: ApplicationDraft) {
  if (!key || typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(key, JSON.stringify(draft))
}

function clearApplicationDraft(key: string | null) {
  if (!key || typeof window === 'undefined') {
    return
  }

  window.localStorage.removeItem(key)
}

function formatFileSize(value: number) {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)} MB`
  }

  return `${Math.max(1, Math.round(value / 1_000))} KB`
}

function formatUploadedAt(value: string) {
  return new Intl.DateTimeFormat('es-DO', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value))
}

function StepDot({ index, currentStep }: { index: number; currentStep: number }) {
  const isDone = index < currentStep
  const isActive = index === currentStep

  return (
    <span
      className={cn(
        'relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border-2 bg-(--app-surface) text-xs font-bold transition',
        isDone && 'border-primary-600 bg-primary-600 text-white',
        isActive && 'border-primary-600 bg-primary-50 text-primary-700 dark:bg-primary-500/12 dark:text-primary-200',
        !isDone && !isActive && 'border-(--app-border) text-(--app-text-subtle)'
      )}
    >
      {isDone ? <Check className="size-4" /> : index + 1}
    </span>
  )
}

function InlineError({ children }: { children: string }) {
  return (
    <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-rose-600 dark:text-rose-300">
      <CircleAlert className="size-3.5" />
      {children}
    </p>
  )
}

export function JobApplicationPage() {
  const { jobSlug = '' } = useParams()
  const session = useAppSession()
  const queryClient = useQueryClient()
  const draftKey = applicationDraftKey(jobSlug, session.authUser?.id)
  const [draftSeed] = useState(() => readApplicationDraft(draftKey))
  const [currentStep, setCurrentStep] = useState(() => draftSeed?.currentStep ?? 0)
  const [maxVisitedStep, setMaxVisitedStep] = useState(() => draftSeed?.currentStep ?? 0)
  const [selectedResumeId, setSelectedResumeId] = useState(() => draftSeed?.selectedResumeId ?? '')
  const [coverLetter, setCoverLetter] = useState(() => draftSeed?.coverLetter ?? '')
  const [answers, setAnswers] = useState<Record<string, string>>(() => draftSeed?.answers ?? {})
  const [showResumeError, setShowResumeError] = useState(false)
  const [questionErrors, setQuestionErrors] = useState<Record<string, boolean>>({})
  const [applicationSubmitted, setApplicationSubmitted] = useState(false)
  const [successKind, setSuccessKind] = useState<'submitted' | 'updated'>('submitted')

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
  const applicationsQuery = useQuery({
    queryKey: ['applications', 'mine', 'job-apply', session.authUser?.id ?? null],
    enabled: session.isAuthenticated,
    queryFn: async () => listMyApplications(session.authUser!.id)
  })

  const profileBundle = candidateProfileQuery.data
  const job = jobQuery.data
  const existingApplication = useMemo(
    () => (job ? (applicationsQuery.data ?? []).find((application) => application.job_posting_id === job.id) ?? null : null),
    [applicationsQuery.data, job]
  )
  const requiredQuestions = useMemo(
    () => job?.job_screening_questions?.filter((question) => question.is_required) ?? [],
    [job?.job_screening_questions]
  )
  const defaultResumeId = profileBundle?.resumes.find((resume) => resume.is_default)?.id ?? profileBundle?.resumes[0]?.id ?? ''
  const activeResumeId = selectedResumeId || existingApplication?.submitted_resume_id || defaultResumeId

  const applyMutation = useMutation({
    mutationFn: async () => {
      if (!job) {
        throw new Error('La vacante ya no está disponible.')
      }

      if (existingApplication) {
        return updateApplicationResume({
          applicationId: existingApplication.id,
          submittedResumeId: activeResumeId
        })
      }

      return submitApplication({
        jobPostingId: job.id,
        submittedResumeId: activeResumeId,
        coverLetter,
        answers:
          job.job_screening_questions?.map((question) => ({
            screeningQuestionId: question.id,
            answerText: answers[question.id] || ''
          })) ?? []
      })
    },
    onSuccess: async () => {
      const nextSuccessKind = existingApplication ? 'updated' : 'submitted'
      toast.success(nextSuccessKind === 'updated' ? 'CV actualizado' : 'Postulación enviada', {
        description:
          nextSuccessKind === 'updated'
            ? 'Actualizamos el CV asociado a esta postulación.'
            : 'Tu perfil y respuestas ya quedaron registrados para esta vacante.'
      })
      await queryClient.invalidateQueries({ queryKey: ['applications', 'mine'] })
      await queryClient.invalidateQueries({ queryKey: ['jobs'] })
      if (!existingApplication) {
        clearApplicationDraft(draftKey)
      }
      setSuccessKind(nextSuccessKind)
      setApplicationSubmitted(true)
      setMaxVisitedStep(TOTAL_STEPS - 1)
    },
    onError: async (error) => {
      await reportErrorWithToast({
        title: existingApplication ? 'No pudimos actualizar el CV de tu postulación' : 'No pudimos enviar tu postulación',
        source: existingApplication ? 'applications.update-resume' : 'applications.submit',
        route: surfacePaths.public.jobApply(jobSlug),
        userId: session.authUser?.id ?? null,
        error
      })
    }
  })

  useEffect(() => {
    if (applicationSubmitted || existingApplication) {
      return
    }

    writeApplicationDraft(draftKey, {
      selectedResumeId: activeResumeId,
      coverLetter,
      answers,
      currentStep
    })
  }, [activeResumeId, answers, applicationSubmitted, coverLetter, currentStep, draftKey, existingApplication])

  if (jobQuery.isLoading || candidateProfileQuery.isLoading || applicationsQuery.isLoading) {
    return <PageLoader label="Preparando postulación" hint="Estamos cargando la vacante, tu perfil y tus CVs disponibles" />
  }

  if (jobQuery.error || !job) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No encontramos esta vacante</CardTitle>
          <CardDescription>{toErrorMessage(jobQuery.error)}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

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

  const selectedResume = profileBundle.resumes.find((resume) => resume.id === activeResumeId) ?? null
  const companyName = job.company_profile?.display_name || 'Empresa'
  const workplaceLabel = job.workplace_type ? workplaceLabels[job.workplace_type] ?? job.workplace_type : 'Modalidad flexible'
  const progress = `${((applicationSubmitted ? TOTAL_STEPS : currentStep + 1) / TOTAL_STEPS) * 100}%`
  const isResumeUpdateMode = Boolean(existingApplication && !applicationSubmitted)

  function validateStep(step: number) {
    if (step === 0) {
      const hasResume = Boolean(selectedResume)
      setShowResumeError(!hasResume)
      return hasResume
    }

    if (step === 2) {
      const nextErrors = requiredQuestions.reduce<Record<string, boolean>>((current, question) => {
        current[question.id] = !answers[question.id]?.trim()
        return current
      }, {})
      setQuestionErrors(nextErrors)
      return !Object.values(nextErrors).some(Boolean)
    }

    return true
  }

  function goToStep(nextStep: number) {
    if (nextStep <= currentStep || nextStep <= maxVisitedStep) {
      setCurrentStep(nextStep)
      return
    }

    for (let step = currentStep; step < nextStep; step += 1) {
      if (!validateStep(step)) {
        setCurrentStep(step)
        return
      }
    }

    setCurrentStep(nextStep)
    setMaxVisitedStep((current) => Math.max(current, nextStep))
  }

  function goNext() {
    if (!validateStep(currentStep)) {
      return
    }

    const nextStep = Math.min(currentStep + 1, TOTAL_STEPS - 1)
    setCurrentStep(nextStep)
    setMaxVisitedStep((current) => Math.max(current, nextStep))
  }

  function submit() {
    if (!validateStep(0) || !validateStep(2)) {
      setCurrentStep(!activeResumeId ? 0 : 2)
      return
    }

    applyMutation.mutate()
  }

  function updateSubmittedResume() {
    if (!validateStep(0)) {
      return
    }

    applyMutation.mutate()
  }

  function updateAnswer(questionId: string, value: string) {
    setAnswers((current) => ({ ...current, [questionId]: value }))
    if (value.trim()) {
      setQuestionErrors((current) => ({ ...current, [questionId]: false }))
    }
  }

  return (
    <div className="mx-auto grid max-w-265 gap-8 lg:grid-cols-[18rem_1fr] xl:gap-10">
      <aside className="space-y-5 lg:sticky lg:top-4 lg:self-start">
        <Link
          to={surfacePaths.public.jobDetail(jobSlug)}
          className="inline-flex items-center gap-2 text-sm font-semibold text-(--app-text-muted) transition hover:text-primary-700 dark:hover:text-primary-200"
        >
          <ArrowLeft className="size-4" />
          Volver a la vacante
        </Link>

        <div className="flex items-center gap-3 rounded-control border border-(--app-border) bg-(--app-surface-elevated) p-3 shadow-[0_1px_2px_rgba(20,40,90,0.04)]">
          <CompanyLogo name={companyName} logoPath={job.company_profile?.logo_path} size="md" />
          <div className="min-w-0">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-(--app-text-subtle)">Postulas a</p>
            <p className="truncate text-sm font-semibold text-(--app-text)">{job.title}</p>
            <p className="truncate text-xs text-(--app-text-muted)">
              {companyName} · {workplaceLabel}
            </p>
          </div>
        </div>

        {isResumeUpdateMode ? (
          <div className="rounded-control border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/12 dark:text-emerald-200">
            <p className="font-semibold">Ya aplicaste a esta vacante</p>
            <p className="mt-1 leading-6">Desde aquí solo puedes actualizar el CV enviado. La carta y las respuestas originales se mantienen.</p>
          </div>
        ) : (
          <ol className="relative flex gap-1 overflow-x-auto pb-1 lg:block lg:overflow-visible lg:pb-0 lg:before:absolute lg:before:bottom-4 lg:before:left-4 lg:before:top-4 lg:before:w-px lg:before:bg-(--app-border)">
            {steps.map((step, index) => {
              const isActive = currentStep === index && !applicationSubmitted
              return (
                <li key={step.name} className="relative min-w-20 flex-1 lg:min-w-0">
                  <button
                    type="button"
                    className="flex w-full flex-col items-center gap-2 rounded-control p-1 text-center transition hover:bg-(--app-surface-muted) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--app-ring) lg:flex-row lg:items-start lg:gap-3 lg:px-0 lg:py-2 lg:text-left"
                    onClick={() => goToStep(index)}
                    disabled={applicationSubmitted}
                  >
                    <StepDot index={index} currentStep={applicationSubmitted ? TOTAL_STEPS : currentStep} />
                    <span className="pt-0.5">
                      <span className={cn('block text-[0.72rem] font-semibold leading-tight lg:text-sm', isActive ? 'text-(--app-text)' : 'text-(--app-text-subtle)')}>
                        {step.name}
                      </span>
                      <span className={cn('mt-0.5 hidden text-xs text-(--app-text-subtle) lg:block', !isActive && 'lg:hidden')}>
                        {step.subtitle}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
        )}
      </aside>

      <main className="mx-auto w-full max-w-145">
        <div className="mb-6 h-1 overflow-hidden rounded-full bg-(--app-border)">
          <div className="h-full rounded-full bg-primary-600 transition-[width] duration-300 ease-out" style={{ width: progress }} />
        </div>

        {applicationSubmitted ? (
          <section className="rounded-card border border-(--app-border) bg-(--app-surface-elevated) p-6 text-center shadow-[0_1px_2px_rgba(20,40,90,0.04)] sm:p-8">
            <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-500/12 dark:text-emerald-300">
              <Check className="size-8" />
            </div>
            <h1 className="mt-5 text-2xl font-semibold tracking-tight text-(--app-text)">
              {successKind === 'updated' ? 'CV actualizado' : 'Postulación enviada'}
            </h1>
            <p className="mt-2 text-sm leading-6 text-(--app-text-muted)">
              {successKind === 'updated'
                ? `Actualizamos el CV enviado al equipo de ${companyName}.`
                : `Enviamos tu perfil, CV y respuestas al equipo de ${companyName}. Puedes revisar el estado desde tus postulaciones.`}
            </p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Link
                to={surfacePaths.public.jobDetail(jobSlug)}
                className="inline-flex h-11 items-center justify-center rounded-control border border-(--app-border) bg-(--app-surface) px-4 text-sm font-semibold text-(--app-text) transition hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700"
              >
                Volver a la vacante
              </Link>
              <Link
                to={surfacePaths.candidate.applications}
                className="inline-flex h-11 items-center justify-center rounded-control border border-primary-600 bg-primary-600 px-4 text-sm font-semibold text-white transition hover:border-primary-700 hover:bg-primary-700"
              >
                Ir a mis postulaciones
              </Link>
            </div>
          </section>
        ) : isResumeUpdateMode ? (
          <section>
            <span className="text-xs font-bold uppercase tracking-[0.08em] text-primary-700 dark:text-primary-200">Postulación existente</span>
            <h1 className="mt-2 text-[1.45rem] font-semibold leading-tight tracking-tight text-(--app-text)">Actualizar CV enviado</h1>
            <p className="mt-2 text-sm leading-6 text-(--app-text-muted)">
              Ya aplicaste a esta vacante. Para evitar cambios accidentales, solo puedes reemplazar el CV asociado a la postulación.
            </p>

            <div className="mt-6 rounded-control border border-(--app-border) bg-(--app-surface-muted) px-4 py-3 text-sm text-(--app-text-muted)">
              CV actual: <span className="font-semibold text-(--app-text)">{existingApplication?.submitted_resume_filename ?? 'Sin CV registrado'}</span>
            </div>

            <div className="mt-6 space-y-2.5">
              {profileBundle.resumes.length ? (
                profileBundle.resumes.map((resume) => {
                  const isSelected = activeResumeId === resume.id
                  return (
                    <button
                      key={resume.id}
                      type="button"
                      className={cn(
                        'flex min-h-17 w-full items-center gap-3 rounded-control border bg-(--app-surface) px-4 py-3 text-left transition hover:border-primary-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--app-ring)',
                        isSelected
                          ? 'border-primary-600 shadow-[0_0_0_3px_rgba(57,85,184,0.16)]'
                          : 'border-(--app-border)'
                      )}
                      onClick={() => {
                        setSelectedResumeId(resume.id)
                        setShowResumeError(false)
                      }}
                    >
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-control bg-primary-50 text-primary-700 dark:bg-primary-500/12 dark:text-primary-200">
                        <FileText className="size-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-(--app-text)">{resume.filename}</span>
                        <span className="mt-0.5 block text-xs text-(--app-text-muted)">
                          Subido el {formatUploadedAt(resume.uploaded_at)} · {formatFileSize(resume.file_size_bytes)}
                        </span>
                      </span>
                      {resume.is_default ? <Badge className="hidden bg-emerald-50 text-emerald-700 sm:inline-flex">Principal</Badge> : null}
                      <span
                        className={cn(
                          'flex size-5 shrink-0 items-center justify-center rounded-full border-2',
                          isSelected ? 'border-primary-600' : 'border-(--app-border)'
                        )}
                      >
                        {isSelected ? <span className="size-2.5 rounded-full bg-primary-600" /> : null}
                      </span>
                    </button>
                  )
                })
              ) : (
                <div className="rounded-control border border-dashed border-(--app-border) bg-(--app-surface-muted) px-4 py-5 text-sm text-(--app-text-muted)">
                  Todavía no tienes un CV guardado en tu perfil.
                </div>
              )}
            </div>

            <Link
              to={surfacePaths.candidate.profile}
              className="mt-3 flex min-h-12 items-center justify-center gap-2 rounded-control border border-dashed border-(--app-border) bg-(--app-surface) px-4 text-sm font-semibold text-(--app-text-muted) transition hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700"
            >
              <Upload className="size-4" />
              Subir otro documento desde mi perfil
            </Link>
            {showResumeError ? <InlineError>Selecciona un CV para actualizar la postulación.</InlineError> : null}

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to={surfacePaths.public.jobDetail(jobSlug)}>
                <Button variant="outline" className="rounded-control">Volver a la vacante</Button>
              </Link>
              <Button className="ml-auto rounded-control" onClick={updateSubmittedResume} disabled={applyMutation.isPending || !selectedResume}>
                {applyMutation.isPending ? (
                  'Actualizando...'
                ) : (
                  <>
                    <FileText className="size-4" /> Actualizar CV
                  </>
                )}
              </Button>
            </div>
          </section>
        ) : (
          <section>
            {currentStep === 0 ? (
              <div>
                <span className="text-xs font-bold uppercase tracking-[0.08em] text-primary-700 dark:text-primary-200">Paso 1 de 4</span>
                <h1 className="mt-2 text-[1.45rem] font-semibold leading-tight tracking-tight text-(--app-text)">Tu CV</h1>
                <p className="mt-2 text-sm leading-6 text-(--app-text-muted)">
                  Usa uno de tus documentos guardados. Tu perfil de ASI viaja con la postulación, así no repites tus datos.
                </p>

                <div className="mt-6 space-y-2.5">
                  {profileBundle.resumes.length ? (
                    profileBundle.resumes.map((resume) => {
                      const isSelected = activeResumeId === resume.id
                      return (
                        <button
                          key={resume.id}
                          type="button"
                          className={cn(
                            'flex min-h-17 w-full items-center gap-3 rounded-control border bg-(--app-surface) px-4 py-3 text-left transition hover:border-primary-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--app-ring)',
                            isSelected
                              ? 'border-primary-600 shadow-[0_0_0_3px_rgba(57,85,184,0.16)]'
                              : 'border-(--app-border)'
                          )}
                          onClick={() => {
                            setSelectedResumeId(resume.id)
                            setShowResumeError(false)
                          }}
                        >
                          <span className="flex size-10 shrink-0 items-center justify-center rounded-control bg-primary-50 text-primary-700 dark:bg-primary-500/12 dark:text-primary-200">
                            <FileText className="size-5" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-(--app-text)">{resume.filename}</span>
                            <span className="mt-0.5 block text-xs text-(--app-text-muted)">
                              Subido el {formatUploadedAt(resume.uploaded_at)} · {formatFileSize(resume.file_size_bytes)}
                            </span>
                          </span>
                          {resume.is_default ? <Badge className="hidden bg-emerald-50 text-emerald-700 sm:inline-flex">Principal</Badge> : null}
                          <span
                            className={cn(
                              'flex size-5 shrink-0 items-center justify-center rounded-full border-2',
                              isSelected ? 'border-primary-600' : 'border-(--app-border)'
                            )}
                          >
                            {isSelected ? <span className="size-2.5 rounded-full bg-primary-600" /> : null}
                          </span>
                        </button>
                      )
                    })
                  ) : (
                    <div className="rounded-control border border-dashed border-(--app-border) bg-(--app-surface-muted) px-4 py-5 text-sm text-(--app-text-muted)">
                      Todavía no tienes un CV guardado en tu perfil.
                    </div>
                  )}
                </div>

                <Link
                  to={surfacePaths.candidate.profile}
                  className="mt-3 flex min-h-12 items-center justify-center gap-2 rounded-control border border-dashed border-(--app-border) bg-(--app-surface) px-4 text-sm font-semibold text-(--app-text-muted) transition hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700"
                >
                  <Upload className="size-4" />
                  Subir otro documento desde mi perfil
                </Link>
                {showResumeError ? <InlineError>Selecciona un CV para continuar.</InlineError> : null}

                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <Link to={surfacePaths.public.jobDetail(jobSlug)}>
                    <Button variant="outline" className="rounded-control">Cancelar</Button>
                  </Link>
                  <Button className="ml-auto rounded-control" onClick={goNext}>
                    Continuar <ArrowRight className="size-4" />
                  </Button>
                </div>
              </div>
            ) : null}

            {currentStep === 1 ? (
              <div>
                <span className="text-xs font-bold uppercase tracking-[0.08em] text-primary-700 dark:text-primary-200">Paso 2 de 4</span>
                <h1 className="mt-2 text-[1.45rem] font-semibold leading-tight tracking-tight text-(--app-text)">Presentación</h1>
                <p className="mt-2 text-sm leading-6 text-(--app-text-muted)">
                  Una nota breve y honesta marca la diferencia. Es opcional, pero suele ayudar al equipo que revisa.
                </p>

                <div className="mt-6 flex gap-3 rounded-control bg-primary-50 p-4 text-sm leading-6 text-primary-900 dark:bg-primary-500/12 dark:text-primary-100">
                  <MessageSquareText className="mt-0.5 size-5 shrink-0 text-primary-700 dark:text-primary-200" />
                  <p>Enfócate en disponibilidad, motivación y experiencia relevante. Evita repetir tu CV completo.</p>
                </div>

                <label className="mt-6 block">
                  <span className="text-sm font-semibold text-(--app-text)">
                    Carta de presentación <span className="font-medium text-(--app-text-subtle)">· opcional</span>
                  </span>
                  <Textarea
                    className="mt-2 min-h-42 rounded-control"
                    maxLength={900}
                    rows={7}
                    value={coverLetter}
                    onChange={(event) => setCoverLetter(event.target.value)}
                    placeholder="Hola, me interesa esta posición porque..."
                  />
                  <span className="mt-1 block text-right text-xs text-(--app-text-subtle)">{coverLetter.length} / 900</span>
                </label>

                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <Button variant="outline" className="rounded-control" onClick={() => goToStep(0)}>
                    <ArrowLeft className="size-4" /> Atrás
                  </Button>
                  <Button className="ml-auto rounded-control" onClick={goNext}>
                    Continuar <ArrowRight className="size-4" />
                  </Button>
                </div>
              </div>
            ) : null}

            {currentStep === 2 ? (
              <div>
                <span className="text-xs font-bold uppercase tracking-[0.08em] text-primary-700 dark:text-primary-200">Paso 3 de 4</span>
                <h1 className="mt-2 text-[1.45rem] font-semibold leading-tight tracking-tight text-(--app-text)">Preguntas</h1>
                <p className="mt-2 text-sm leading-6 text-(--app-text-muted)">
                  {companyName} quiere conocerte mejor. Responde con tus palabras.
                </p>

                <div className="mt-6 space-y-5">
                  {job.job_screening_questions?.length ? (
                    job.job_screening_questions.map((question, index) => (
                      <label key={question.id} className="block">
                        <span className="flex items-start gap-2 text-sm font-semibold text-(--app-text)">
                          <span className="flex size-6 shrink-0 items-center justify-center rounded-control bg-primary-50 text-xs font-bold text-primary-700 dark:bg-primary-500/12 dark:text-primary-200">
                            {index + 1}
                          </span>
                          <span>
                            {question.question_text}{' '}
                            {question.is_required ? (
                              <span className="text-amber-700 dark:text-amber-300">*</span>
                            ) : (
                              <span className="font-medium text-(--app-text-subtle)">· opcional</span>
                            )}
                          </span>
                        </span>
                        <Textarea
                          className="mt-2 rounded-control"
                          rows={question.answer_type === 'long_text' ? 5 : 4}
                          value={answers[question.id] ?? ''}
                          onChange={(event) => updateAnswer(question.id, event.target.value)}
                          placeholder="Escribe tu respuesta"
                        />
                        {questionErrors[question.id] ? <InlineError>Esta pregunta es obligatoria.</InlineError> : null}
                      </label>
                    ))
                  ) : (
                    <div className="rounded-control border border-dashed border-(--app-border) bg-(--app-surface-muted) px-4 py-5 text-sm text-(--app-text-muted)">
                      Esta vacante no tiene screening. Puedes revisar y enviar la postulación.
                    </div>
                  )}
                </div>

                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <Button variant="outline" className="rounded-control" onClick={() => goToStep(1)}>
                    <ArrowLeft className="size-4" /> Atrás
                  </Button>
                  <Button className="ml-auto rounded-control" onClick={goNext}>
                    Revisar <ArrowRight className="size-4" />
                  </Button>
                </div>
              </div>
            ) : null}

            {currentStep === 3 ? (
              <div>
                <span className="text-xs font-bold uppercase tracking-[0.08em] text-primary-700 dark:text-primary-200">Paso 4 de 4</span>
                <h1 className="mt-2 text-[1.45rem] font-semibold leading-tight tracking-tight text-(--app-text)">Revisar y enviar</h1>
                <p className="mt-2 text-sm leading-6 text-(--app-text-muted)">
                  Confirma que todo esté correcto. Podrás ver el estado en Postulaciones.
                </p>

                <div className="mt-6 divide-y divide-(--app-border)">
                  <div className="flex gap-3 py-4 first:pt-0">
                    <FileText className="mt-0.5 size-5 shrink-0 text-(--app-text-subtle)" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-(--app-text-subtle)">CV a enviar</p>
                      <p className="mt-1 text-sm font-semibold text-(--app-text)">{selectedResume?.filename ?? 'Pendiente'}</p>
                    </div>
                    <button type="button" className="text-xs font-semibold text-primary-700 hover:text-primary-800" onClick={() => goToStep(0)}>
                      Editar
                    </button>
                  </div>
                  <div className="flex gap-3 py-4">
                    <MessageSquareText className="mt-0.5 size-5 shrink-0 text-(--app-text-subtle)" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-(--app-text-subtle)">Carta de presentación</p>
                      <p className={cn('mt-1 text-sm leading-6', coverLetter.trim() ? 'text-(--app-text)' : 'text-(--app-text-subtle)')}>
                        {coverLetter.trim() || 'Sin carta, opcional'}
                      </p>
                    </div>
                    <button type="button" className="text-xs font-semibold text-primary-700 hover:text-primary-800" onClick={() => goToStep(1)}>
                      Editar
                    </button>
                  </div>
                  <div className="flex gap-3 py-4">
                    <HelpCircle className="mt-0.5 size-5 shrink-0 text-(--app-text-subtle)" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-(--app-text-subtle)">Respuestas de screening</p>
                      <div className="mt-1 space-y-1 text-sm leading-6 text-(--app-text)">
                        {job.job_screening_questions?.length ? (
                          job.job_screening_questions.map((question, index) => (
                            <p key={question.id}>
                              {index + 1}. {answers[question.id]?.trim() || 'Pendiente'}
                            </p>
                          ))
                        ) : (
                          <p className="text-(--app-text-subtle)">Sin preguntas para esta vacante.</p>
                        )}
                      </div>
                    </div>
                    <button type="button" className="text-xs font-semibold text-primary-700 hover:text-primary-800" onClick={() => goToStep(2)}>
                      Editar
                    </button>
                  </div>
                </div>

                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <Button variant="outline" className="rounded-control" onClick={() => goToStep(2)}>
                    <ArrowLeft className="size-4" /> Atrás
                  </Button>
                  <span className="ml-auto hidden items-center gap-1.5 text-xs font-semibold text-emerald-700 sm:inline-flex dark:text-emerald-300">
                    <Check className="size-3.5" />
                    Borrador local
                  </span>
                  <Button className="rounded-control" onClick={submit} disabled={applyMutation.isPending}>
                    {applyMutation.isPending ? (
                      'Enviando...'
                    ) : (
                      <>
                        <SendHorizontal className="size-4" /> Enviar postulación
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ) : null}
          </section>
        )}

        <div className="mt-8 flex items-center gap-2 rounded-control border border-(--app-border) bg-(--app-surface-muted) px-4 py-3 text-xs text-(--app-text-muted)">
          <UserRound className="size-4 shrink-0" />
          Se enviará tu perfil candidato activo: {session.profile?.display_name ?? session.profile?.full_name ?? 'Perfil ASI'}.
        </div>
      </main>
    </div>
  )
}
