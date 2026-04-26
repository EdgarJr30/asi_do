import { useState } from 'react'

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm, useWatch } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { surfacePaths } from '@/app/router/surface-paths'
import { useAppSession } from '@/app/providers/app-session-provider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toErrorMessage } from '@/features/auth/lib/auth-api'
import { fetchMyCandidateProfile } from '@/features/candidate-profile/lib/candidate-profile-api'
import {
  createJobAlert,
  createOrUpdateJobPosting,
  deleteJobAlert,
  listJobAlerts,
  listOpportunityStageTemplates,
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
import {
  compensationTypeOptions,
  getCompensationTypeLabel,
  getOpportunityTypeLabel,
  opportunityTypeOptions
} from '@/features/opportunities/lib/opportunity-taxonomy'
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
  if (
    job.compensation_type === 'unpaid' ||
    job.compensation_type === 'donation_based' ||
    job.compensation_type === 'not_disclosed'
  ) {
    return getCompensationTypeLabel(job.compensation_type)
  }

  if (!job.compensation_min_amount && !job.compensation_max_amount) {
    return getCompensationTypeLabel(job.compensation_type)
  }

  const currency = job.compensation_currency || 'USD'
  const label = getCompensationTypeLabel(job.compensation_type)

  if (job.compensation_min_amount && job.compensation_max_amount) {
    return `${label}: ${currency} ${job.compensation_min_amount.toLocaleString()} - ${job.compensation_max_amount.toLocaleString()}`
  }

  return `${label}: ${currency} ${(job.compensation_min_amount || job.compensation_max_amount || 0).toLocaleString()}`
}

function parseOpportunityMetadata(value: JobPostingBundle['jobs'][number]['opportunity_metadata']) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }

  return {}
}

function getJobInitialValues(selectedJob: JobPostingBundle['jobs'][number] | null, fallbackCountryCode: string) {
  const metadata = selectedJob ? parseOpportunityMetadata(selectedJob.opportunity_metadata) : {}

  if (!selectedJob) {
    return {
      opportunityType: 'employment',
      title: '',
      slug: '',
      summary: '',
      description: '',
      workplaceType: 'remote',
      employmentType: 'full_time',
      cityName: '',
      countryCode: fallbackCountryCode,
      compensationVisible: false,
      compensationType: 'not_disclosed',
      compensationMinAmount: '',
      compensationMaxAmount: '',
      compensationCurrency: 'USD',
      experienceLevel: '',
      expiresAt: '',
      operatingScope: '',
      deliveryTimeline: '',
      engagementModel: '',
      serviceScope: ''
    } satisfies JobPostingFormValues
  }

  return {
    opportunityType: selectedJob.opportunity_type,
    title: selectedJob.title,
    slug: selectedJob.slug,
    summary: selectedJob.summary,
    description: selectedJob.description,
    workplaceType: selectedJob.workplace_type,
    employmentType: selectedJob.employment_type,
    cityName: selectedJob.city_name ?? '',
    countryCode: selectedJob.country_code ?? '',
    compensationVisible:
      selectedJob.compensation_type !== 'not_disclosed' &&
      selectedJob.compensation_type !== 'unpaid' &&
      selectedJob.compensation_type !== 'donation_based',
    compensationType: selectedJob.compensation_type,
    compensationMinAmount: selectedJob.compensation_min_amount?.toString() ?? '',
    compensationMaxAmount: selectedJob.compensation_max_amount?.toString() ?? '',
    compensationCurrency: selectedJob.compensation_currency ?? 'USD',
    experienceLevel: selectedJob.experience_level ?? '',
    expiresAt: selectedJob.expires_at ? selectedJob.expires_at.slice(0, 10) : '',
    operatingScope: typeof metadata.operating_scope === 'string' ? metadata.operating_scope : '',
    deliveryTimeline: typeof metadata.delivery_timeline === 'string' ? metadata.delivery_timeline : '',
    engagementModel: typeof metadata.engagement_model === 'string' ? metadata.engagement_model : '',
    serviceScope: typeof metadata.service_scope === 'string' ? metadata.service_scope : ''
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
    name: 'compensationVisible'
  })
  const opportunityType = useWatch({
    control: form.control,
    name: 'opportunityType'
  })
  const stageTemplatesQuery = useQuery({
    queryKey: ['opportunity-stage-templates', opportunityType],
    queryFn: async () => listOpportunityStageTemplates(opportunityType),
    enabled: Boolean(opportunityType)
  })

  const saveMutation = useMutation({
    mutationFn: async (values: JobPostingFormValues) => {
      if (!session.authUser || !session.activeMembership || !workspace.companyProfile) {
        throw new Error('Necesitas una membresia employer y company profile para gestionar vacantes.')
      }

      return createOrUpdateJobPosting({
        tenantId: session.activeMembership.tenantId,
        companyProfileId: workspace.companyProfile.id,
        actorUserId: session.authUser.id,
        jobId: selectedJob?.id,
        opportunityType: values.opportunityType,
        title: values.title.trim(),
        slug: values.slug.trim(),
        summary: values.summary.trim(),
        description: values.description.trim(),
        workplaceType: values.workplaceType,
        employmentType: values.employmentType,
        cityName: values.cityName?.trim() || undefined,
        countryCode: values.countryCode?.trim() || undefined,
        compensationVisible: values.compensationVisible,
        compensationType: values.compensationType,
        compensationMinAmount: values.compensationMinAmount ? Number(values.compensationMinAmount) : null,
        compensationMaxAmount: values.compensationMaxAmount ? Number(values.compensationMaxAmount) : null,
        compensationCurrency: values.compensationCurrency?.trim() || undefined,
        opportunityMetadata: {
          operating_scope: values.operatingScope?.trim() || null,
          delivery_timeline: values.deliveryTimeline?.trim() || null,
          engagement_model: values.engagementModel?.trim() || null,
          service_scope: values.serviceScope?.trim() || null
        },
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
      toast.success(selectedJob ? 'Oportunidad actualizada' : 'Oportunidad creada', {
        description: 'El registro ya quedó persistido y listo para publicar cuando corresponda.'
      })
      await onSaved()
    },
    onError: async (error) => {
      await reportErrorWithToast({
        title: 'No pudimos guardar la oportunidad',
        source: 'jobs.save',
        route: surfacePaths.public.jobs,
        userId: session.authUser?.id ?? null,
        error
      })
    }
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>{selectedJob ? 'Editar oportunidad' : 'Nueva oportunidad'}</CardTitle>
        <CardDescription>
          Define el tipo, la compensación y el flujo esperado antes de publicarla al talento aprobado.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={(event) => void form.handleSubmit((values) => saveMutation.mutate(values))(event)}>
          <div className="grid gap-4 sm:grid-cols-[0.8fr_1.2fr]">
            <label className="grid gap-2 text-sm">
              <span>Tipo de oportunidad</span>
              <Select {...form.register('opportunityType')}>
                {opportunityTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </label>
            <div className="rounded-[24px] border border-(--app-border) bg-(--app-surface-muted) p-4 text-sm">
              <p className="font-semibold text-(--app-text)">Etapas sugeridas para {getOpportunityTypeLabel(opportunityType)}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {stageTemplatesQuery.data?.map((stage) => (
                  <Badge key={stage.id} variant="outline">
                    {stage.name}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-[1fr_0.7fr]">
            <label className="grid gap-2 text-sm">
              <span>Título</span>
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
              <span>Slug de oportunidad</span>
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
              <span>Modalidad</span>
              <Select {...form.register('workplaceType')}>
                <option value="remote">Remote</option>
                <option value="hybrid">Hybrid</option>
                <option value="on_site">On-site</option>
              </Select>
            </label>
            <label className="grid gap-2 text-sm">
              <span>{opportunityType === 'employment' ? 'Tipo de empleo' : 'Ritmo del engagement'}</span>
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
              <span>País</span>
              <Input maxLength={2} {...form.register('countryCode')} />
            </label>
            <label className="grid gap-2 text-sm">
              <span>Senioridad</span>
              <Input {...form.register('experienceLevel')} placeholder="Junior, Mid, Senior..." />
            </label>
          </div>

          <div className="rounded-[24px] border border-(--app-border) bg-(--app-surface-muted) p-4">
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={salaryVisible}
                onChange={(event) => form.setValue('compensationVisible', event.target.checked)}
              />
              <span>Mostrar compensación a miembros aprobados</span>
            </label>
            <div className="mt-4 grid gap-4 sm:grid-cols-[0.8fr_1.2fr]">
              <label className="grid gap-2 text-sm">
                <span>Tipo de compensación</span>
                <Select {...form.register('compensationType')}>
                  {compensationTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </label>
            </div>
            {salaryVisible ? (
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <label className="grid gap-2 text-sm">
                  <span>Mínimo</span>
                  <Input {...form.register('compensationMinAmount')} />
                </label>
                <label className="grid gap-2 text-sm">
                  <span>Máximo</span>
                  <Input {...form.register('compensationMaxAmount')} />
                  <p className="text-xs text-rose-600">{form.formState.errors.compensationMaxAmount?.message}</p>
                </label>
                <label className="grid gap-2 text-sm">
                  <span>Moneda</span>
                  <Input maxLength={3} {...form.register('compensationCurrency')} />
                  <p className="text-xs text-rose-600">{form.formState.errors.compensationCurrency?.message}</p>
                </label>
              </div>
            ) : null}
          </div>

          {opportunityType === 'project' || opportunityType === 'volunteer' ? (
            <label className="grid gap-2 text-sm">
              <span>Alcance operativo</span>
              <Textarea rows={3} {...form.register('operatingScope')} />
              <p className="text-xs text-rose-600">{form.formState.errors.operatingScope?.message}</p>
            </label>
          ) : null}

          {opportunityType === 'project' ? (
            <label className="grid gap-2 text-sm">
              <span>Timeline estimado</span>
              <Input placeholder="8 semanas, Q3 2026, entrega continua..." {...form.register('deliveryTimeline')} />
              <p className="text-xs text-rose-600">{form.formState.errors.deliveryTimeline?.message}</p>
            </label>
          ) : null}

          {opportunityType === 'volunteer' ? (
            <label className="grid gap-2 text-sm">
              <span>Modelo de servicio</span>
              <Input placeholder="Fines de semana, por eventos, 6 horas semanales..." {...form.register('engagementModel')} />
              <p className="text-xs text-rose-600">{form.formState.errors.engagementModel?.message}</p>
            </label>
          ) : null}

          {opportunityType === 'professional_service' ? (
            <label className="grid gap-2 text-sm">
              <span>Alcance del servicio</span>
              <Textarea rows={3} {...form.register('serviceScope')} />
              <p className="text-xs text-rose-600">{form.formState.errors.serviceScope?.message}</p>
            </label>
          ) : null}

          <label className="grid gap-2 text-sm">
            <span>Expira el</span>
            <Input type="date" {...form.register('expiresAt')} />
          </label>

          <div className="space-y-3 rounded-[24px] border border-(--app-border) bg-(--app-surface-muted) p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-(--app-text)">Preguntas de screening</p>
                <p className="text-sm text-(--app-text-muted)">
                  Déjalas listas desde ahora para pedir información clave cuando la vacante reciba postulaciones.
                </p>
              </div>
              <Button type="button" variant="outline" onClick={() => setQuestions((current) => [...current, createEmptyScreeningQuestion()])}>
                Agregar pregunta
              </Button>
            </div>

            {questions.map((question) => (
              <div key={question.id} className="grid gap-3 rounded-2xl border border-(--app-border) bg-(--app-surface-elevated) p-3">
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
                  <label className="flex items-center gap-3 rounded-2xl border border-(--app-border) bg-(--app-surface-elevated) px-4 py-3 text-sm">
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
    queryKey: ['workspace', 'jobs-page', session.activeTenantId],
    enabled: canManageJobs && Boolean(session.activeTenantId),
    queryFn: async () => fetchWorkspaceBundle(session.activeTenantId!)
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
    queryKey: [...TENANT_JOBS_QUERY_KEY, session.activeTenantId ?? null],
    enabled: canManageJobs && Boolean(session.activeTenantId),
    queryFn: async () => listTenantJobs(session.activeTenantId!)
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
        route: surfacePaths.public.jobs,
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
        route: surfacePaths.public.jobs,
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
        route: surfacePaths.public.jobs,
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
        route: surfacePaths.public.jobs,
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
        route: surfacePaths.public.jobs,
        userId: session.authUser?.id ?? null,
        error
      })
    }
  })

  return (
    <div className="space-y-6">
      <section className="rounded-[30px] border border-(--app-border) bg-white px-6 py-6 shadow-[0_18px_44px_rgba(19,42,97,0.08)] sm:px-7">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary-200 bg-primary-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-700">
              Reclutamiento
            </div>
            <h1 className="mt-4 text-[1.75rem] font-bold tracking-[-0.03em] text-(--app-text) sm:text-[2rem]">
              {canManageJobs ? 'Vacantes y oportunidades desde una sola vista' : 'Explora oportunidades con filtros simples'}
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-(--app-text-muted)">
              {canManageJobs
                ? 'Crea borradores, publica cuando corresponda y mantén ordenado el frente de talento aprobado.'
                : 'Explora oportunidades publicadas para miembros, guarda las más relevantes y vuelve a ellas con menos friccion.'}
            </p>
          </div>
          {canManageJobs ? (
            <div className="rounded-[22px] border border-(--app-border) bg-(--app-surface-muted) px-4 py-3 text-right">
              <p className="text-[0.76rem] font-medium text-(--app-text-muted)">Vacantes del workspace</p>
              <p className="mt-1 text-[1.55rem] font-bold tracking-[-0.03em] text-(--app-text)">{tenantJobsQuery.data?.length ?? 0}</p>
            </div>
          ) : null}
        </div>
      </section>

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
              <CardTitle>Gestión de vacantes</CardTitle>
              <CardDescription>Revisa el inventario actual, publica cuando toque y cierra vacantes sin perder trazabilidad.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {tenantJobsQuery.data?.length ? (
                tenantJobsQuery.data.map((job) => (
                  <div key={job.id} className="rounded-panel border border-(--app-border) bg-(--app-surface-muted) p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-(--app-text)">{job.title}</p>
                        <p className="mt-1 text-sm text-(--app-text-muted)">
                          {getOpportunityTypeLabel(job.opportunity_type)} · {job.summary}
                        </p>
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
                      <Link className={cn(linkButtonClassName, 'bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-900')} to={surfacePaths.public.jobDetail(job.slug)}>
                        Ver oportunidad
                      </Link>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-panel border border-dashed border-(--app-border) bg-(--app-surface-muted) px-4 py-6 text-sm text-(--app-text-muted)">
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
            <CardTitle>Oportunidades para miembros</CardTitle>
            <CardDescription>Busca oportunidades activas, filtra por modalidad o país y guarda las más relevantes.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-[1.2fr_0.8fr_0.55fr]">
              <Input placeholder="Buscar por título o palabra clave" value={publicQuery} onChange={(event) => setPublicQuery(event.target.value)} />
              <Select value={workplaceFilter} onChange={(event) => setWorkplaceFilter(event.target.value)}>
                <option value="">Cualquier modalidad</option>
                <option value="remote">Remote</option>
                <option value="hybrid">Hybrid</option>
                <option value="on_site">On-site</option>
              </Select>
              <Input placeholder="País" maxLength={2} value={countryFilter} onChange={(event) => setCountryFilter(event.target.value.toUpperCase())} />
            </div>

            <div className="space-y-3">
              {publicJobsQuery.isLoading ? (
                <p className="text-sm text-(--app-text-muted)">Cargando oportunidades...</p>
              ) : publicJobsQuery.error ? (
                <p className="text-sm text-rose-600 dark:text-rose-300">{toErrorMessage(publicJobsQuery.error)}</p>
              ) : publicJobsQuery.data?.jobs.length ? (
                publicJobsQuery.data.jobs.map((job) => {
                  const isSaved = publicJobsQuery.data.savedJobIds.includes(job.id)

                  return (
                    <div key={job.id} className="rounded-panel border border-(--app-border) bg-(--app-surface-muted) p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-lg font-semibold text-(--app-text)">{job.title}</p>
                          <p className="mt-1 text-sm text-(--app-text-muted)">
                            {job.company_profile?.display_name || 'Company'} · {getOpportunityTypeLabel(job.opportunity_type)} · {job.workplace_type}
                          </p>
                        </div>
                        <JobStatusBadge status={job.status} />
                      </div>
                      <p className="mt-3 text-sm leading-6 text-(--app-text-muted)">{job.summary}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge variant="outline">{formatCompensation(job)}</Badge>
                        {job.country_code ? <Badge variant="outline">{job.country_code}</Badge> : null}
                        {job.experience_level ? <Badge variant="outline">{job.experience_level}</Badge> : null}
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Link className={cn(linkButtonClassName, 'bg-primary-500 text-white hover:bg-primary-400 hover:text-white border-transparent')} to={surfacePaths.public.jobDetail(job.slug)}>
                          Ver detalle
                        </Link>
                        {session.isAuthenticated ? (
                          <Button
                            variant="outline"
                            onClick={() => saveJobMutation.mutate({ jobId: job.id, shouldSave: !isSaved })}
                            disabled={saveJobMutation.isPending || !candidateProfileQuery.data?.profile}
                          >
                            {isSaved ? 'Quitar guardado' : 'Guardar vacante'}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="rounded-panel border border-dashed border-(--app-border) bg-(--app-surface-muted) px-4 py-6 text-sm text-(--app-text-muted)">
                  No hay oportunidades publicadas que coincidan con estos filtros.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

      </section>

      <Card>
          <CardHeader>
            <CardTitle>Alertas guardadas</CardTitle>
            <CardDescription>
            Guarda búsquedas útiles para reutilizarlas sin reconstruir filtros cada vez.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
          {!candidateProfileQuery.data?.profile ? (
            <div className="rounded-[24px] border border-dashed border-(--app-border) bg-(--app-surface-muted) px-4 py-6 text-sm text-(--app-text-muted)">
              Completa tu perfil para crear alertas y guardar búsquedas que quieras repetir más adelante.
            </div>
          ) : (
            <>
              <div className="grid gap-3 md:grid-cols-[1fr_0.55fr_auto] md:items-end">
                <label className="grid gap-2 text-sm">
                  <span>Etiqueta</span>
                  <Input
                    value={alertLabel}
                    onChange={(event) => setAlertLabel(event.target.value)}
                    placeholder="Ej. Ingeniero eléctrico remoto"
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
                  <p className="text-sm text-(--app-text-muted)">Cargando alertas...</p>
                ) : jobAlertsQuery.error ? (
                  <p className="text-sm text-rose-600 dark:text-rose-300">{toErrorMessage(jobAlertsQuery.error)}</p>
                ) : jobAlertsQuery.data?.length ? (
                  jobAlertsQuery.data.map((alert) => {
                    const criteria = (alert.criteria_json ?? {}) as Record<string, unknown>

                    return (
                      <div key={alert.id} className="rounded-panel border border-(--app-border) bg-(--app-surface-muted) p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-(--app-text)">{alert.label}</p>
                            <p className="mt-1 text-sm text-(--app-text-muted)">
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
