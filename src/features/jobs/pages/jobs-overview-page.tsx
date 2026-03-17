import { useState } from 'react'

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm, useWatch } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { useAppSession } from '@/app/providers/app-session-provider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/page-header'
import { Select } from '@/components/ui/select'
import { StatCard } from '@/components/ui/stat-card'
import { Textarea } from '@/components/ui/textarea'
import { toErrorMessage } from '@/features/auth/lib/auth-api'
import { fetchMyCandidateProfile } from '@/features/candidate-profile/lib/candidate-profile-api'
import {
  createJobAlert,
  createOrUpdateJobPosting,
  deleteJobAlert,
  listJobAlerts,
  listPublicJobs,
  listTenantJobs,
  toggleSavedJob,
  updateJobAlert,
  updateJobPostingStatus,
  type JobPostingBundle
} from '@/features/jobs/lib/jobs-api'
import {
  createEmptyScreeningQuestion,
  jobPostingSchema,
  sanitizeScreeningQuestions,
  toJobSlug,
  type JobPostingFormValues,
  type JobScreeningQuestionDraft
} from '@/features/jobs/lib/job-schemas'
import { fetchWorkspaceBundle, type WorkspaceBundle } from '@/features/tenants/lib/workspace-api'
import { reportErrorWithToast } from '@/lib/errors/error-reporting'
import { cn } from '@/lib/utils/cn'

const PUBLIC_JOBS_QUERY_KEY = ['jobs', 'public'] as const
const TENANT_JOBS_QUERY_KEY = ['jobs', 'tenant'] as const

const linkButtonClassName =
  'inline-flex h-11 items-center justify-center rounded-2xl border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-900 shadow-sm transition-[transform,box-shadow,background-color,border-color,color] duration-200 ease-out hover:-translate-y-px hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700 hover:shadow-[0_14px_28px_rgba(15,23,42,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:border-primary-500 dark:hover:bg-primary-500/12 dark:hover:text-primary-300'

function JobStatusBadge({ status }: { status: string }) {
  const variant = status === 'published' ? 'soft' : status === 'draft' ? 'outline' : 'default'

  return <Badge variant={variant}>{status}</Badge>
}

function formatCompensation(job: JobPostingBundle['jobs'][number]) {
  if (!job.salary_visible || (!job.salary_min_amount && !job.salary_max_amount)) {
    return 'Salario no visible'
  }

  const currency = job.salary_currency || 'USD'

  if (job.salary_min_amount && job.salary_max_amount) {
    return `${currency} ${job.salary_min_amount.toLocaleString()} - ${job.salary_max_amount.toLocaleString()}`
  }

  return `${currency} ${(job.salary_min_amount || job.salary_max_amount || 0).toLocaleString()}`
}

function getJobInitialValues(selectedJob: JobPostingBundle['jobs'][number] | null, fallbackCountryCode: string) {
  if (!selectedJob) {
    return {
      title: '',
      slug: '',
      summary: '',
      description: '',
      workplaceType: 'remote',
      employmentType: 'full_time',
      cityName: '',
      countryCode: fallbackCountryCode,
      salaryVisible: false,
      salaryMinAmount: '',
      salaryMaxAmount: '',
      salaryCurrency: 'USD',
      experienceLevel: '',
      expiresAt: ''
    } satisfies JobPostingFormValues
  }

  return {
    title: selectedJob.title,
    slug: selectedJob.slug,
    summary: selectedJob.summary,
    description: selectedJob.description,
    workplaceType: selectedJob.workplace_type,
    employmentType: selectedJob.employment_type,
    cityName: selectedJob.city_name ?? '',
    countryCode: selectedJob.country_code ?? '',
    salaryVisible: selectedJob.salary_visible,
    salaryMinAmount: selectedJob.salary_min_amount?.toString() ?? '',
    salaryMaxAmount: selectedJob.salary_max_amount?.toString() ?? '',
    salaryCurrency: selectedJob.salary_currency ?? 'USD',
    experienceLevel: selectedJob.experience_level ?? '',
    expiresAt: selectedJob.expires_at ? selectedJob.expires_at.slice(0, 10) : ''
  } satisfies JobPostingFormValues
}

function JobEditor({
  selectedJob,
  session,
  workspace,
  onSaved,
  onClear
}: {
  selectedJob: JobPostingBundle['jobs'][number] | null
  session: ReturnType<typeof useAppSession>
  workspace: WorkspaceBundle
  onSaved: () => Promise<void>
  onClear: () => void
}) {
  const [questions, setQuestions] = useState<JobScreeningQuestionDraft[]>([createEmptyScreeningQuestion()])
  const form = useForm<JobPostingFormValues>({
    resolver: zodResolver(jobPostingSchema),
    defaultValues: getJobInitialValues(selectedJob, session.profile?.country_code ?? 'DO')
  })
  const salaryVisible = useWatch({
    control: form.control,
    name: 'salaryVisible'
  })

  const saveMutation = useMutation({
    mutationFn: async (values: JobPostingFormValues) => {
      if (!session.authUser || !session.primaryMembership || !workspace.companyProfile) {
        throw new Error('Necesitas una membresia employer y company profile para gestionar vacantes.')
      }

      return createOrUpdateJobPosting({
        tenantId: session.primaryMembership.tenantId,
        companyProfileId: workspace.companyProfile.id,
        actorUserId: session.authUser.id,
        jobId: selectedJob?.id,
        title: values.title.trim(),
        slug: values.slug.trim(),
        summary: values.summary.trim(),
        description: values.description.trim(),
        workplaceType: values.workplaceType,
        employmentType: values.employmentType,
        cityName: values.cityName?.trim() || undefined,
        countryCode: values.countryCode?.trim() || undefined,
        salaryVisible: values.salaryVisible,
        salaryMinAmount: values.salaryMinAmount ? Number(values.salaryMinAmount) : null,
        salaryMaxAmount: values.salaryMaxAmount ? Number(values.salaryMaxAmount) : null,
        salaryCurrency: values.salaryCurrency?.trim() || undefined,
        experienceLevel: values.experienceLevel?.trim() || undefined,
        expiresAt: values.expiresAt || undefined,
        questions: sanitizeScreeningQuestions(questions).map((question) => ({
          questionText: question.questionText,
          answerType: question.answerType,
          helperText: question.helperText || undefined,
          isRequired: question.isRequired,
          optionsJson: question.optionList
        }))
      })
    },
    onSuccess: async () => {
      toast.success(selectedJob ? 'Vacante actualizada' : 'Vacante creada', {
        description: 'El registro ya quedo persistido y listo para publish cuando corresponda.'
      })
      await onSaved()
    },
    onError: async (error) => {
      await reportErrorWithToast({
        title: 'No pudimos guardar la vacante',
        source: 'jobs.save',
        route: '/jobs',
        userId: session.authUser?.id ?? null,
        error
      })
    }
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>{selectedJob ? 'Editar vacante' : 'Nueva vacante'}</CardTitle>
        <CardDescription>
          Prepara cada vacante con calma y publícala solo cuando esté lista para mostrarse al talento.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={(event) => void form.handleSubmit((values) => saveMutation.mutate(values))(event)}>
          <div className="grid gap-4 sm:grid-cols-[1fr_0.7fr]">
            <label className="grid gap-2 text-sm">
              <span>Titulo</span>
              <Input
                {...form.register('title')}
                onChange={(event) => {
                  form.setValue('title', event.target.value)
                  if (!selectedJob) {
                    form.setValue('slug', toJobSlug(event.target.value))
                  }
                }}
              />
              <p className="text-xs text-rose-600">{form.formState.errors.title?.message}</p>
            </label>
            <label className="grid gap-2 text-sm">
              <span>Slug publico</span>
              <Input {...form.register('slug')} />
              <p className="text-xs text-rose-600">{form.formState.errors.slug?.message}</p>
            </label>
          </div>

          <label className="grid gap-2 text-sm">
            <span>Resumen corto</span>
            <Textarea rows={3} {...form.register('summary')} />
            <p className="text-xs text-rose-600">{form.formState.errors.summary?.message}</p>
          </label>

          <label className="grid gap-2 text-sm">
            <span>Descripcion</span>
            <Textarea rows={8} {...form.register('description')} />
            <p className="text-xs text-rose-600">{form.formState.errors.description?.message}</p>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm">
              <span>Workplace</span>
              <Select {...form.register('workplaceType')}>
                <option value="remote">Remote</option>
                <option value="hybrid">Hybrid</option>
                <option value="on_site">On-site</option>
              </Select>
            </label>
            <label className="grid gap-2 text-sm">
              <span>Tipo de empleo</span>
              <Select {...form.register('employmentType')}>
                <option value="full_time">Full-time</option>
                <option value="part_time">Part-time</option>
                <option value="contract">Contract</option>
                <option value="temporary">Temporary</option>
                <option value="internship">Internship</option>
              </Select>
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="grid gap-2 text-sm">
              <span>Ciudad</span>
              <Input {...form.register('cityName')} />
            </label>
            <label className="grid gap-2 text-sm">
              <span>Pais</span>
              <Input maxLength={2} {...form.register('countryCode')} />
            </label>
            <label className="grid gap-2 text-sm">
              <span>Senioridad</span>
              <Input {...form.register('experienceLevel')} placeholder="Junior, Mid, Senior..." />
            </label>
          </div>

          <div className="rounded-[24px] border border-zinc-200 p-4 dark:border-zinc-800">
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={salaryVisible}
                onChange={(event) => form.setValue('salaryVisible', event.target.checked)}
              />
              <span>Mostrar rango salarial en la vista pública</span>
            </label>
            {salaryVisible ? (
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <label className="grid gap-2 text-sm">
                  <span>Minimo</span>
                  <Input {...form.register('salaryMinAmount')} />
                </label>
                <label className="grid gap-2 text-sm">
                  <span>Maximo</span>
                  <Input {...form.register('salaryMaxAmount')} />
                  <p className="text-xs text-rose-600">{form.formState.errors.salaryMaxAmount?.message}</p>
                </label>
                <label className="grid gap-2 text-sm">
                  <span>Moneda</span>
                  <Input maxLength={3} {...form.register('salaryCurrency')} />
                </label>
              </div>
            ) : null}
          </div>

          <label className="grid gap-2 text-sm">
            <span>Expira el</span>
            <Input type="date" {...form.register('expiresAt')} />
          </label>

          <div className="space-y-3 rounded-[24px] border border-zinc-200 p-4 dark:border-zinc-800">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">Preguntas screening</p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Las dejamos preparadas ahora para usarlas en la fase de applications.
                </p>
              </div>
              <Button type="button" variant="outline" onClick={() => setQuestions((current) => [...current, createEmptyScreeningQuestion()])}>
                Agregar pregunta
              </Button>
            </div>

            {questions.map((question) => (
              <div key={question.id} className="grid gap-3 rounded-2xl bg-zinc-50 p-3 dark:bg-zinc-900/80">
                <label className="grid gap-2 text-sm">
                  <span>Pregunta</span>
                  <Input
                    value={question.questionText}
                    onChange={(event) =>
                      setQuestions((current) =>
                        current.map((item) => (item.id === question.id ? { ...item, questionText: event.target.value } : item))
                      )
                    }
                  />
                </label>
                <div className="grid gap-3 sm:grid-cols-[0.55fr_0.45fr]">
                  <label className="grid gap-2 text-sm">
                    <span>Tipo de respuesta</span>
                    <Select
                      value={question.answerType}
                      onChange={(event) =>
                        setQuestions((current) =>
                          current.map((item) =>
                            item.id === question.id
                              ? { ...item, answerType: event.target.value as JobScreeningQuestionDraft['answerType'] }
                              : item
                          )
                        )
                      }
                    >
                      <option value="short_text">Texto corto</option>
                      <option value="long_text">Texto largo</option>
                      <option value="yes_no">Si / No</option>
                      <option value="single_select">Seleccion unica</option>
                    </Select>
                  </label>
                  <label className="flex items-center gap-3 rounded-2xl border border-zinc-200 px-4 py-3 text-sm dark:border-zinc-700">
                    <input
                      type="checkbox"
                      checked={question.isRequired}
                      onChange={(event) =>
                        setQuestions((current) =>
                          current.map((item) => (item.id === question.id ? { ...item, isRequired: event.target.checked } : item))
                        )
                      }
                    />
                    <span>Requerida</span>
                  </label>
                </div>
                {question.answerType === 'single_select' ? (
                  <label className="grid gap-2 text-sm">
                    <span>Opciones, una por linea</span>
                    <Textarea
                      rows={3}
                      value={question.optionList}
                      onChange={(event) =>
                        setQuestions((current) =>
                          current.map((item) => (item.id === question.id ? { ...item, optionList: event.target.value } : item))
                        )
                      }
                    />
                  </label>
                ) : null}
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Guardando...' : selectedJob ? 'Guardar cambios' : 'Crear draft'}
            </Button>
            {selectedJob ? (
              <Button type="button" variant="outline" onClick={onClear}>
                Limpiar seleccion
              </Button>
            ) : null}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

export function JobsOverviewPage() {
  const session = useAppSession()
  const queryClient = useQueryClient()
  const canManageJobs = session.permissions.includes('job:create') || session.permissions.includes('job:update')
  const [publicQuery, setPublicQuery] = useState('')
  const [workplaceFilter, setWorkplaceFilter] = useState('')
  const [countryFilter, setCountryFilter] = useState('')
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [alertLabel, setAlertLabel] = useState('')
  const [alertFrequency, setAlertFrequency] = useState('weekly')

  const candidateProfileQuery = useQuery({
    queryKey: ['candidate-profile', 'mine', 'jobs-page'],
    enabled: session.isAuthenticated,
    queryFn: async () => fetchMyCandidateProfile(session.authUser!.id)
  })
  const workspaceQuery = useQuery({
    queryKey: ['workspace', 'jobs-page', session.primaryMembership?.tenantId],
    enabled: canManageJobs && Boolean(session.primaryMembership?.tenantId),
    queryFn: async () => fetchWorkspaceBundle(session.primaryMembership!.tenantId)
  })
  const jobAlertsQuery = useQuery({
    queryKey: ['job-alerts', candidateProfileQuery.data?.profile?.id ?? null],
    enabled: Boolean(candidateProfileQuery.data?.profile?.id),
    queryFn: async () => listJobAlerts(candidateProfileQuery.data!.profile!.id)
  })
  const publicJobsQuery = useQuery({
    queryKey: [
      ...PUBLIC_JOBS_QUERY_KEY,
      publicQuery,
      workplaceFilter,
      countryFilter,
      candidateProfileQuery.data?.profile?.id ?? null
    ],
    queryFn: async () =>
      listPublicJobs({
        query: publicQuery,
        workplaceType: workplaceFilter ? (workplaceFilter as JobPostingBundle['jobs'][number]['workplace_type']) : undefined,
        countryCode: countryFilter || undefined,
        candidateProfileId: candidateProfileQuery.data?.profile?.id ?? null
      })
  })
  const tenantJobsQuery = useQuery({
    queryKey: [...TENANT_JOBS_QUERY_KEY, session.primaryMembership?.tenantId ?? null],
    enabled: canManageJobs && Boolean(session.primaryMembership?.tenantId),
    queryFn: async () => listTenantJobs(session.primaryMembership!.tenantId)
  })

  const selectedJob = tenantJobsQuery.data?.find((job) => job.id === selectedJobId) ?? null

  const statusMutation = useMutation({
    mutationFn: updateJobPostingStatus,
    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: PUBLIC_JOBS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: TENANT_JOBS_QUERY_KEY })
      ])
      toast.success(`Vacante ${variables.status}`, {
        description: 'El estado de la vacante ya fue actualizado.'
      })
    },
    onError: async (error) => {
      await reportErrorWithToast({
        title: 'No pudimos actualizar el estado de la vacante',
        source: 'jobs.update-status',
        route: '/jobs',
        userId: session.authUser?.id ?? null,
        error
      })
    }
  })

  const saveJobMutation = useMutation({
    mutationFn: async (input: { jobId: string; shouldSave: boolean }) => {
      const candidateProfileId = candidateProfileQuery.data?.profile?.id

      if (!candidateProfileId) {
        throw new Error('Necesitas un perfil candidato para guardar vacantes.')
      }

      return toggleSavedJob({
        candidateProfileId,
        jobPostingId: input.jobId,
        shouldSave: input.shouldSave
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: PUBLIC_JOBS_QUERY_KEY })
    },
    onError: async (error) => {
      await reportErrorWithToast({
        title: 'No pudimos actualizar tus vacantes guardadas',
        source: 'jobs.toggle-saved',
        route: '/jobs',
        userId: session.authUser?.id ?? null,
        error,
        userMessage: session.isAuthenticated
          ? 'No pudimos guardar o quitar esta vacante.'
          : 'Inicia sesion y completa tu perfil candidato para guardar vacantes.'
      })
    }
  })

  const createJobAlertMutation = useMutation({
    mutationFn: async () => {
      const candidateProfileId = candidateProfileQuery.data?.profile?.id

      if (!candidateProfileId) {
        throw new Error('Necesitas un perfil candidato para crear alertas de jobs.')
      }

      return createJobAlert({
        candidateProfileId,
        alert: {
          label: alertLabel,
          frequency: alertFrequency,
          query: publicQuery,
          workplaceType: workplaceFilter,
          countryCode: countryFilter
        }
      })
    },
    onSuccess: async () => {
      setAlertLabel('')
      setAlertFrequency('weekly')
      await queryClient.invalidateQueries({ queryKey: ['job-alerts'] })
      toast.success('Alerta guardada', {
        description: 'Tus filtros quedaron guardados para reutilizarlos cuando quieras.'
      })
    },
    onError: async (error) => {
      await reportErrorWithToast({
        title: 'No pudimos crear la alerta',
        source: 'jobs.create-alert',
        route: '/jobs',
        userId: session.authUser?.id ?? null,
        error
      })
    }
  })

  const toggleJobAlertMutation = useMutation({
    mutationFn: async (input: { alertId: string; isActive: boolean }) => {
      const candidateProfileId = candidateProfileQuery.data?.profile?.id

      if (!candidateProfileId) {
        throw new Error('Necesitas un perfil candidato para actualizar alertas.')
      }

      return updateJobAlert({
        jobAlertId: input.alertId,
        candidateProfileId,
        patch: {
          isActive: input.isActive
        }
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['job-alerts'] })
    },
    onError: async (error) => {
      await reportErrorWithToast({
        title: 'No pudimos actualizar la alerta',
        source: 'jobs.toggle-alert',
        route: '/jobs',
        userId: session.authUser?.id ?? null,
        error
      })
    }
  })

  const deleteJobAlertMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const candidateProfileId = candidateProfileQuery.data?.profile?.id

      if (!candidateProfileId) {
        throw new Error('Necesitas un perfil candidato para eliminar alertas.')
      }

      return deleteJobAlert({
        jobAlertId: alertId,
        candidateProfileId
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['job-alerts'] })
      toast.success('Alerta eliminada', {
        description: 'La alerta ya no seguira activa para este perfil candidato.'
      })
    },
    onError: async (error) => {
      await reportErrorWithToast({
        title: 'No pudimos eliminar la alerta',
        source: 'jobs.delete-alert',
        route: '/jobs',
        userId: session.authUser?.id ?? null,
        error
      })
    }
  })

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Jobs"
        title={canManageJobs ? 'Gestiona tus vacantes y compártelas con una experiencia clara y atractiva' : 'Descubre oportunidades con una experiencia clara y directa'}
        description={
          canManageJobs
            ? 'Publica, actualiza y comparte tus vacantes desde un solo lugar sin perder claridad entre lo interno y lo público.'
            : 'Explora vacantes publicadas, guarda las que te interesan y revisa detalles sin distracciones.'
        }
      >
        <StatCard label="Mercado" value={`${publicJobsQuery.data?.jobs.length ?? 0} jobs`} helper="Vacantes publicadas visibles para nuevos candidatos." />
        <StatCard label="Tus vacantes" value={tenantJobsQuery.data?.length ?? 0} helper="Borradores, publicadas o cerradas para tu empresa." />
        <StatCard label="Guardadas" value={publicJobsQuery.data?.savedJobIds.length ?? 0} helper="Vacantes guardadas para volver más tarde." />
        <StatCard
          className="bg-[var(--app-surface-muted)]"
          label="Publicacion"
          value="Estado real"
          helper="Controla cuándo una vacante sale a público y cuándo sigue en preparación."
        />
      </PageHeader>

      {canManageJobs && workspaceQuery.data ? (
        <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <JobEditor
            key={selectedJob?.id ?? 'new-job'}
            selectedJob={selectedJob}
            session={session}
            workspace={workspaceQuery.data}
            onClear={() => setSelectedJobId(null)}
            onSaved={async () => {
              await Promise.all([
                queryClient.invalidateQueries({ queryKey: PUBLIC_JOBS_QUERY_KEY }),
                queryClient.invalidateQueries({ queryKey: TENANT_JOBS_QUERY_KEY })
              ])
              setSelectedJobId(null)
            }}
          />

          <Card>
            <CardHeader>
              <CardTitle>Gestion de vacantes</CardTitle>
              <CardDescription>Publica, cierra o archiva vacantes según el ritmo real de tu búsqueda.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {tenantJobsQuery.data?.length ? (
                tenantJobsQuery.data.map((job) => (
                  <div key={job.id} className="rounded-[24px] border border-zinc-200 p-4 dark:border-zinc-800">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">{job.title}</p>
                        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{job.summary}</p>
                      </div>
                      <JobStatusBadge status={job.status} />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button variant="outline" onClick={() => setSelectedJobId(job.id)}>
                        Editar
                      </Button>
                      {job.status !== 'published' ? (
                        <Button variant="outline" onClick={() => statusMutation.mutate({ jobId: job.id, status: 'published' })}>
                          Publicar
                        </Button>
                      ) : (
                        <Button variant="outline" onClick={() => statusMutation.mutate({ jobId: job.id, status: 'closed' })}>
                          Cerrar
                        </Button>
                      )}
                      {job.status !== 'archived' ? (
                        <Button variant="outline" onClick={() => statusMutation.mutate({ jobId: job.id, status: 'archived' })}>
                          Archivar
                        </Button>
                      ) : null}
                      <Link className={cn(linkButtonClassName, 'bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-900')} to={`/jobs/${job.slug}`}>
                        Ver publico
                      </Link>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[24px] border border-dashed border-zinc-300 px-4 py-6 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
                  Todavia no hay vacantes en este espacio.
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Discovery publico</CardTitle>
            <CardDescription>Filtra vacantes publicadas y guarda las que quieras revisar luego.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <Input placeholder="Buscar por titulo o keyword" value={publicQuery} onChange={(event) => setPublicQuery(event.target.value)} />
              <Select value={workplaceFilter} onChange={(event) => setWorkplaceFilter(event.target.value)}>
                <option value="">Cualquier modalidad</option>
                <option value="remote">Remote</option>
                <option value="hybrid">Hybrid</option>
                <option value="on_site">On-site</option>
              </Select>
              <Input placeholder="Pais" maxLength={2} value={countryFilter} onChange={(event) => setCountryFilter(event.target.value.toUpperCase())} />
            </div>

            <div className="space-y-3">
              {publicJobsQuery.isLoading ? (
                <p className="text-sm text-zinc-600 dark:text-zinc-400">Cargando vacantes publicas...</p>
              ) : publicJobsQuery.error ? (
                <p className="text-sm text-rose-600 dark:text-rose-300">{toErrorMessage(publicJobsQuery.error)}</p>
              ) : publicJobsQuery.data?.jobs.length ? (
                publicJobsQuery.data.jobs.map((job) => {
                  const isSaved = publicJobsQuery.data.savedJobIds.includes(job.id)

                  return (
                    <div key={job.id} className="rounded-[24px] border border-zinc-200 p-4 dark:border-zinc-800">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">{job.title}</p>
                          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                            {job.company_profile?.display_name || 'Company'} · {job.workplace_type} · {job.employment_type}
                          </p>
                        </div>
                        <JobStatusBadge status={job.status} />
                      </div>
                      <p className="mt-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">{job.summary}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge variant="outline">{formatCompensation(job)}</Badge>
                        {job.country_code ? <Badge variant="outline">{job.country_code}</Badge> : null}
                        {job.experience_level ? <Badge variant="outline">{job.experience_level}</Badge> : null}
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Link className={cn(linkButtonClassName, 'bg-primary-500 text-white hover:bg-primary-400 hover:text-white border-transparent')} to={`/jobs/${job.slug}`}>
                          Ver detalle
                        </Link>
                        {session.isAuthenticated ? (
                          <Button
                            variant="outline"
                            onClick={() => saveJobMutation.mutate({ jobId: job.id, shouldSave: !isSaved })}
                            disabled={saveJobMutation.isPending || !candidateProfileQuery.data?.profile}
                          >
                            {isSaved ? 'Quitar guardado' : 'Guardar job'}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="rounded-[24px] border border-dashed border-zinc-300 px-4 py-6 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
                  No hay vacantes publicadas que coincidan con estos filtros.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Estado de la experiencia pública</CardTitle>
            <CardDescription>Todo lo necesario para mostrar vacantes con claridad y ayudar al talento a volver cuando quiera.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-[24px] bg-zinc-50 px-4 py-4 text-sm text-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-300">
              <p className="font-semibold text-zinc-950 dark:text-zinc-50">Detalle listo para compartir</p>
              <p className="mt-1">Cada vacante publicada tiene su propia página pública lista para enviar y promocionar.</p>
            </div>
            <div className="rounded-[24px] bg-zinc-50 px-4 py-4 text-sm text-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-300">
              <p className="font-semibold text-zinc-950 dark:text-zinc-50">Vacantes guardadas</p>
              <p className="mt-1">Los candidatos ya pueden guardar vacantes para volver más tarde cuando estén listos.</p>
            </div>
            <div className="rounded-[24px] bg-zinc-50 px-4 py-4 text-sm text-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-300">
              <p className="font-semibold text-zinc-950 dark:text-zinc-50">Preparación de filtros</p>
              <p className="mt-1">Las preguntas clave quedan listas para usarse cuando quieras profundizar el proceso.</p>
            </div>
            <div className="rounded-[24px] bg-zinc-50 px-4 py-4 text-sm text-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-300">
              <p className="font-semibold text-zinc-950 dark:text-zinc-50">Alertas de vacantes</p>
              <p className="mt-1">Los candidatos pueden guardar criterios básicos y activarlos o pausarlos desde esta misma vista.</p>
            </div>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Alertas guardadas</CardTitle>
          <CardDescription>
            Guarda filtros básicos para volver rápido a las vacantes que más se parecen a lo que estás buscando.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!candidateProfileQuery.data?.profile ? (
            <div className="rounded-[24px] border border-dashed border-zinc-300 px-4 py-6 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
              Completa tu perfil para crear alertas y guardar búsquedas que quieras repetir más adelante.
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-[1fr_0.5fr_auto] sm:items-end">
                <label className="grid gap-2 text-sm">
                  <span>Etiqueta</span>
                  <Input
                    value={alertLabel}
                    onChange={(event) => setAlertLabel(event.target.value)}
                    placeholder="Ingeniero electrico remoto"
                  />
                </label>
                <label className="grid gap-2 text-sm">
                  <span>Frecuencia</span>
                  <Select value={alertFrequency} onChange={(event) => setAlertFrequency(event.target.value)}>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                  </Select>
                </label>
                <Button
                  onClick={() => createJobAlertMutation.mutate()}
                  disabled={createJobAlertMutation.isPending || alertLabel.trim().length === 0}
                >
                  {createJobAlertMutation.isPending ? 'Guardando...' : 'Guardar alerta actual'}
                </Button>
              </div>

              <div className="space-y-3">
                {jobAlertsQuery.isLoading ? (
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">Cargando alertas...</p>
                ) : jobAlertsQuery.error ? (
                  <p className="text-sm text-rose-600 dark:text-rose-300">{toErrorMessage(jobAlertsQuery.error)}</p>
                ) : jobAlertsQuery.data?.length ? (
                  jobAlertsQuery.data.map((alert) => {
                    const criteria = (alert.criteria_json ?? {}) as Record<string, unknown>

                    return (
                      <div key={alert.id} className="rounded-[24px] border border-zinc-200 p-4 dark:border-zinc-800">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">{alert.label}</p>
                            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                              {alert.frequency} · {(criteria.query as string | null) || 'sin keyword'} ·{' '}
                              {(criteria.workplaceType as string | null) || 'cualquier modalidad'} ·{' '}
                              {(criteria.countryCode as string | null) || 'cualquier pais'}
                            </p>
                          </div>
                          <Badge variant={alert.is_active ? 'soft' : 'outline'}>
                            {alert.is_active ? 'Activa' : 'Pausada'}
                          </Badge>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            onClick={() =>
                              toggleJobAlertMutation.mutate({
                                alertId: alert.id,
                                isActive: !alert.is_active
                              })
                            }
                            disabled={toggleJobAlertMutation.isPending}
                          >
                            {alert.is_active ? 'Pausar' : 'Activar'}
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => deleteJobAlertMutation.mutate(alert.id)}
                            disabled={deleteJobAlertMutation.isPending}
                          >
                            Eliminar
                          </Button>
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <div className="rounded-[24px] border border-dashed border-zinc-300 px-4 py-6 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
                    Todavia no has guardado job alerts para este perfil.
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
