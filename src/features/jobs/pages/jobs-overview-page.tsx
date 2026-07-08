import { useEffect, useMemo, useState } from 'react'

import { zodResolver } from '@hookform/resolvers/zod'
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion, useDragControls, useReducedMotion } from 'motion/react'
import { useForm, useWatch } from 'react-hook-form'
import { Archive, Banknote, Ban, BriefcaseBusiness, Download, Eye, MapPin, Pencil, Plus, Search, SlidersHorizontal, Users, X } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { surfacePaths } from '@/app/router/surface-paths'
import { useAppSession } from '@/app/providers/app-session-provider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { FieldHelp } from '@/components/ui/field-help'
import { Input } from '@/components/ui/input'
import { KebabMenu, KebabMenuItem } from '@/components/ui/kebab-menu'
import { PageLoader } from '@/components/ui/loader'
import { Pagination } from '@/components/ui/pagination'
import { Select } from '@/components/ui/select'
import { SideSheet } from '@/components/ui/side-sheet'
import { Textarea } from '@/components/ui/textarea'
import { PublicJobBoard } from '@/features/jobs/components/public-job-board'
import {
  createOrUpdateJobPosting,
  listOpportunityStageTemplates,
  listTenantJobs,
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
import { fetchPipelineBoard } from '@/features/pipeline/lib/pipeline-api'
import { fetchWorkspaceBundle, type WorkspaceBundle } from '@/features/tenants/lib/workspace-api'
import { useUrlParamState } from '@/hooks/use-url-param-state'
import { reportErrorWithToast } from '@/lib/errors/error-reporting'
import { useRealtimeSync } from '@/lib/realtime/use-realtime-sync'
import {
  smoothCardReveal as cardReveal,
  smoothPageStagger as pageStagger,
  softEase
} from '@/shared/ui/card-motion'
import { CountryCodeSelect } from '@/shared/ui/location-selects'
import { cn } from '@/lib/utils/cn'

type JobsSort = 'recent' | 'applications' | 'title'
/** Valores válidos de orden; normaliza un `?sort=` manipulado en la URL. */
const JOBS_SORTS: readonly JobsSort[] = ['recent', 'applications', 'title']

const PUBLIC_JOBS_QUERY_KEY = ['jobs', 'public'] as const
const TENANT_JOBS_QUERY_KEY = ['jobs', 'tenant'] as const
const JOB_CREATE_ACTION = 'create'
const CREATE_JOB_SHEET_DELAY_MS = 220

function shouldOpenCreateJobEditor(search: string) {
  return new URLSearchParams(search).get('action') === JOB_CREATE_ACTION
}

function relativeDays(value: string | null | undefined) {
  if (!value) {
    return ''
  }
  const days = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 86_400_000))
  if (days === 0) {
    return 'hoy'
  }
  if (days === 1) {
    return 'hace 1 día'
  }
  return `hace ${days} días`
}

const WORKSPACE_JOBS_PAGE_SIZE = 8

type PendingStatusChange = {
  jobId: string
  jobTitle: string
  action: 'close' | 'archive'
}

function FieldLabelText({ label, help }: { label: string; help?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span>{label}</span>
      {help ? <FieldHelp fieldLabel={label} help={help} /> : null}
    </span>
  )
}

const EMPLOYMENT_LABELS: Record<string, string> = {
  full_time: 'Tiempo completo',
  part_time: 'Medio tiempo',
  contract: 'Por contrato',
  temporary: 'Temporal',
  internship: 'Pasantía'
}

function employmentLabel(value: string | null | undefined) {
  return value ? EMPLOYMENT_LABELS[value] ?? value : 'Sin especificar'
}

type TenantJobRow = JobPostingBundle['jobs'][number]

function jobStatusSuccessLabel(status: TenantJobRow['status']) {
  if (status === 'published') return 'Vacante publicada'
  if (status === 'closed') return 'Vacante cerrada'
  if (status === 'archived') return 'Vacante archivada'
  return 'Vacante guardada como borrador'
}

const WORKPLACE_LABELS: Record<string, string> = {
  remote: 'Remote',
  hybrid: 'Híbrido',
  on_site: 'On-site'
}

function workplaceLabel(value: string | null | undefined) {
  return value ? WORKPLACE_LABELS[value] ?? value : 'Modalidad flexible'
}

function jobLocationLabel(job: Pick<TenantJobRow, 'city_name' | 'country_code'>) {
  return [job.city_name, job.country_code].filter(Boolean).join(', ') || 'Sin ubicación'
}

function jobSalaryLabel(job: TenantJobRow) {
  if (job.salary_visible && (job.salary_min_amount != null || job.salary_max_amount != null)) {
    const currency = job.salary_currency ?? 'USD'
    const format = (amount: number) =>
      new Intl.NumberFormat('es', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)
    if (job.salary_min_amount != null && job.salary_max_amount != null) {
      return `${format(job.salary_min_amount)} – ${format(job.salary_max_amount)}`
    }
    return format((job.salary_min_amount ?? job.salary_max_amount) as number)
  }
  return getCompensationTypeLabel(job.compensation_type) || 'Salario no especificado'
}

function isMutedCompensation(job: TenantJobRow) {
  return !job.salary_visible || (job.salary_min_amount == null && job.salary_max_amount == null)
}

function jobPublishedTimeLabel(job: TenantJobRow) {
  return relativeDays(job.published_at ?? job.updated_at) || 'sin fecha'
}

const linkButtonClassName =
  'inline-flex h-11 items-center justify-center rounded-card border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-900 shadow-sm transition-[transform,box-shadow,background-color,border-color,color] duration-200 ease-out hover:-translate-y-px hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700 hover:shadow-[0_14px_28px_rgba(15,23,42,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:border-primary-500 dark:hover:bg-primary-500/12 dark:hover:text-primary-300'

function JobStatusBadge({ status }: { status: string }) {
  const variant = status === 'published' ? 'soft' : status === 'draft' ? 'outline' : 'default'

  return <Badge variant={variant}>{status}</Badge>
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
  onClear,
  bare = false
}: {
  selectedJob: JobPostingBundle['jobs'][number] | null
  session: ReturnType<typeof useAppSession>
  workspace: WorkspaceBundle
  onSaved: () => Promise<void>
  onClear: () => void
  /** Renderiza solo el formulario, sin el Card/encabezado (p. ej. dentro de un SideSheet). */
  bare?: boolean
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
        description: 'Ya está guardada y lista para publicar cuando quieras.'
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

  const formBody = (
    <form className="space-y-4" onSubmit={(event) => void form.handleSubmit((values) => saveMutation.mutate(values))(event)}>
          <div className="grid gap-4 sm:grid-cols-[0.8fr_1.2fr]">
            <label className="grid gap-2 text-sm">
              <FieldLabelText
                label="Tipo de oportunidad"
                help="Define plantilla y campos."
              />
              <Select {...form.register('opportunityType')}>
                {opportunityTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </label>
            <div className="rounded-card-lg border border-(--app-border) bg-(--app-surface-muted) p-4 text-sm">
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
              <FieldLabelText
                label="Slug de oportunidad"
                help="URL corta y única."
              />
              <Input {...form.register('slug')} />
              <p className="text-xs text-rose-600">{form.formState.errors.slug?.message}</p>
            </label>
          </div>

          <label className="grid gap-2 text-sm">
            <FieldLabelText
              label="Resumen corto"
              help="Texto breve para listados."
            />
            <Textarea rows={3} {...form.register('summary')} />
            <p className="text-xs text-rose-600">{form.formState.errors.summary?.message}</p>
          </label>

          <label className="grid gap-2 text-sm">
            <FieldLabelText
              label="Descripción"
              help="Responsabilidades y requisitos."
            />
            <Textarea rows={8} {...form.register('description')} />
            <p className="text-xs text-rose-600">{form.formState.errors.description?.message}</p>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm">
              <FieldLabelText
                label="Modalidad"
                help="Remota, híbrida o presencial."
              />
              <Select {...form.register('workplaceType')}>
                <option value="remote">Remote</option>
                <option value="hybrid">Hybrid</option>
                <option value="on_site">On-site</option>
              </Select>
            </label>
            <label className="grid gap-2 text-sm">
              <FieldLabelText
                label={opportunityType === 'employment' ? 'Tipo de empleo' : 'Ritmo del engagement'}
                help="Relación o ritmo esperado."
              />
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
              <CountryCodeSelect {...form.register('countryCode')} />
            </label>
            <label className="grid gap-2 text-sm">
              <FieldLabelText
                label="Senioridad"
                help="Junior, Mid, Senior, liderazgo."
              />
              <Input {...form.register('experienceLevel')} placeholder="Junior, Mid, Senior..." />
            </label>
          </div>

          <div className="rounded-card-lg border border-(--app-border) bg-(--app-surface-muted) p-4">
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
                <FieldLabelText
                  label="Tipo de compensación"
                  help="Salario, tarifa u honorarios."
                />
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
                  <Input type="number" inputMode="decimal" {...form.register('compensationMinAmount')} />
                </label>
                <label className="grid gap-2 text-sm">
                  <span>Máximo</span>
                  <Input type="number" inputMode="decimal" {...form.register('compensationMaxAmount')} />
                  <p className="text-xs text-rose-600">{form.formState.errors.compensationMaxAmount?.message}</p>
                </label>
                <label className="grid gap-2 text-sm">
                  <FieldLabelText
                    label="Moneda"
                    help="Ej.: DOP, USD, EUR."
                  />
                  <Input maxLength={3} {...form.register('compensationCurrency')} />
                  <p className="text-xs text-rose-600">{form.formState.errors.compensationCurrency?.message}</p>
                </label>
              </div>
            ) : null}
          </div>

          {opportunityType === 'project' || opportunityType === 'volunteer' ? (
            <label className="grid gap-2 text-sm">
              <FieldLabelText
                label="Alcance operativo"
                help="Entregables o región."
              />
              <Textarea rows={3} {...form.register('operatingScope')} />
              <p className="text-xs text-rose-600">{form.formState.errors.operatingScope?.message}</p>
            </label>
          ) : null}

          {opportunityType === 'project' ? (
            <label className="grid gap-2 text-sm">
              <FieldLabelText
                label="Timeline estimado"
                help="Duración o fechas objetivo."
              />
              <Input placeholder="8 semanas, Q3 2026, entrega continua..." {...form.register('deliveryTimeline')} />
              <p className="text-xs text-rose-600">{form.formState.errors.deliveryTimeline?.message}</p>
            </label>
          ) : null}

          {opportunityType === 'volunteer' ? (
            <label className="grid gap-2 text-sm">
              <FieldLabelText
                label="Modelo de servicio"
                help="Cuándo y cómo participa."
              />
              <Input placeholder="Fines de semana, por eventos, 6 horas semanales..." {...form.register('engagementModel')} />
              <p className="text-xs text-rose-600">{form.formState.errors.engagementModel?.message}</p>
            </label>
          ) : null}

          {opportunityType === 'professional_service' ? (
            <label className="grid gap-2 text-sm">
              <FieldLabelText
                label="Alcance del servicio"
                help="Límites y resultados."
              />
              <Textarea rows={3} {...form.register('serviceScope')} />
              <p className="text-xs text-rose-600">{form.formState.errors.serviceScope?.message}</p>
            </label>
          ) : null}

          <label className="grid gap-2 text-sm">
            <FieldLabelText
              label="Expira el"
              help="Fecha de cierre público."
            />
            <Input type="date" {...form.register('expiresAt')} />
          </label>

          <div className="space-y-3 rounded-card-lg border border-(--app-border) bg-(--app-surface-muted) p-4">
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
              <div key={question.id} className="grid gap-3 rounded-card border border-(--app-border) bg-(--app-surface-elevated) p-3">
                <label className="grid gap-2 text-sm">
                  <FieldLabelText
                    label="Pregunta"
                    help="La verá el candidato."
                  />
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
                    <FieldLabelText
                      label="Tipo de respuesta"
                      help="Formato de revisión."
                    />
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
                  <label className="flex items-center gap-3 rounded-card border border-(--app-border) bg-(--app-surface-elevated) px-4 py-3 text-sm">
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
                    <FieldLabelText
                      label="Opciones, una por línea"
                      help="Una opción por línea."
                    />
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

          <div
            className={cn(
              bare
                ? 'sticky bottom-0 -mx-5 -mb-5 mt-2 flex justify-end gap-3 border-t border-(--app-border) bg-(--app-surface) px-5 py-4 sm:-mx-6 sm:-mb-5 sm:px-6'
                : 'flex flex-wrap gap-3'
            )}
          >
            {bare ? (
              <Button type="button" variant="outline" onClick={onClear}>
                Cancelar
              </Button>
            ) : null}
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Guardando...' : selectedJob ? 'Guardar cambios' : 'Crear draft'}
            </Button>
            {selectedJob && !bare ? (
              <Button type="button" variant="outline" onClick={onClear}>
                Limpiar selección
              </Button>
            ) : null}
          </div>
    </form>
  )

  if (bare) {
    return formBody
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{selectedJob ? 'Editar oportunidad' : 'Nueva oportunidad'}</CardTitle>
        <CardDescription>
          Define el tipo, la compensación y el flujo esperado antes de publicarla al talento aprobado.
        </CardDescription>
      </CardHeader>
      <CardContent>{formBody}</CardContent>
    </Card>
  )
}

function WorkspaceJobViewDialog({
  job,
  applicationCount,
  onClose,
  onEdit
}: {
  job: TenantJobRow | null
  applicationCount: number
  onClose: () => void
  onEdit: (jobId: string) => void
}) {
  if (!job) {
    return null
  }

  const isPublished = job.status === 'published'

  return (
    <Dialog open={Boolean(job)} onClose={onClose} className="relative z-50">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-slate-950/40 transition-opacity duration-200 data-[closed]:opacity-0"
      />
      <div className="fixed inset-0 flex items-center justify-center p-4 sm:p-6">
        <DialogPanel
          transition
          className="flex max-h-[88vh] w-full max-w-xl flex-col overflow-hidden rounded-card border border-(--app-border) bg-(--app-surface) shadow-[0_24px_64px_rgba(15,30,70,0.28)] transition duration-200 ease-out data-[closed]:translate-y-3 data-[closed]:scale-[0.98] data-[closed]:opacity-0"
        >
          <header className="relative border-b border-(--app-border) px-5 py-5 sm:px-6">
            <span
              className={cn(
                'inline-flex h-7 items-center gap-2 rounded-full px-3 text-xs font-semibold',
                isPublished
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/12 dark:text-emerald-300'
                  : 'bg-(--app-surface-muted) text-(--app-text-subtle)'
              )}
            >
              <span className="size-1.5 rounded-full bg-current" />
              {isPublished ? 'Activa' : 'Inactiva'}
            </span>
            <DialogTitle className="mt-3 pr-10 text-[1.3rem] font-bold leading-tight tracking-tight text-(--app-text)">
              {job.title}
            </DialogTitle>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="absolute right-5 top-5 flex size-9 items-center justify-center rounded-control text-(--app-text-subtle) transition-colors hover:bg-(--app-surface-muted) hover:text-(--app-text)"
            >
              <X className="size-4" />
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
            <dl className="grid gap-5 sm:grid-cols-2">
              <div>
                <dt className="text-[0.72rem] font-bold uppercase tracking-[0.05em] text-(--app-text-subtle)">Ubicación</dt>
                <dd className="mt-1.5 flex items-center gap-2 text-sm font-semibold text-(--app-text)">
                  <MapPin className="size-4 text-(--app-text-subtle)" /> {jobLocationLabel(job)}
                </dd>
              </div>
              <div>
                <dt className="text-[0.72rem] font-bold uppercase tracking-[0.05em] text-(--app-text-subtle)">Tipo de empleo</dt>
                <dd className="mt-1.5 flex items-center gap-2 text-sm font-semibold text-(--app-text)">
                  <BriefcaseBusiness className="size-4 text-(--app-text-subtle)" /> {employmentLabel(job.employment_type)}
                </dd>
              </div>
              <div>
                <dt className="text-[0.72rem] font-bold uppercase tracking-[0.05em] text-(--app-text-subtle)">Compensación</dt>
                <dd
                  className={cn(
                    'mt-1.5 flex items-center gap-2 text-sm font-semibold text-(--app-text)',
                    isMutedCompensation(job) && 'font-medium text-(--app-text-subtle)'
                  )}
                >
                  <Banknote className="size-4 text-(--app-text-subtle)" /> {jobSalaryLabel(job)}
                </dd>
              </div>
              <div>
                <dt className="text-[0.72rem] font-bold uppercase tracking-[0.05em] text-(--app-text-subtle)">Postulaciones</dt>
                <dd className="mt-1.5 flex items-center gap-2 text-sm font-semibold text-(--app-text)">
                  <Users className="size-4 text-(--app-text-subtle)" />
                  {applicationCount} {applicationCount === 1 ? 'postulación' : 'postulaciones'} · publicada {jobPublishedTimeLabel(job)}
                </dd>
              </div>
            </dl>

            <section className="mt-6">
              <h3 className="text-[0.72rem] font-bold uppercase tracking-[0.05em] text-(--app-text-subtle)">Resumen</h3>
              <p className="mt-2 text-sm leading-6 text-(--app-text-muted)">
                {job.summary || job.description || 'Esta vacante todavía no tiene un resumen disponible.'}
              </p>
            </section>
          </div>

          <footer className="flex justify-end gap-3 border-t border-(--app-border) px-5 py-4 sm:px-6">
            <Button variant="outline" onClick={onClose}>
              Cerrar
            </Button>
            <Button onClick={() => onEdit(job.id)}>Editar vacante</Button>
          </footer>
        </DialogPanel>
      </div>
    </Dialog>
  )
}

function WorkspaceJobsFilterSheet({
  open,
  onClose,
  search,
  onSearchChange,
  employmentFilter,
  onEmploymentChange,
  locationFilter,
  onLocationChange,
  locationOptions,
  sort,
  onSortChange,
  resultCount,
  hasActive,
  onReset
}: {
  open: boolean
  onClose: () => void
  search: string
  onSearchChange: (value: string) => void
  employmentFilter: string
  onEmploymentChange: (value: string) => void
  locationFilter: string
  onLocationChange: (value: string) => void
  locationOptions: string[]
  sort: 'recent' | 'applications' | 'title'
  onSortChange: (value: 'recent' | 'applications' | 'title') => void
  resultCount: number
  hasActive: boolean
  onReset: () => void
}) {
  // La barrita superior (grabber) inicia el arrastre; el cuerpo con scroll no,
  // para que deslizar sobre el formulario no cierre la hoja por accidente.
  const dragControls = useDragControls()

  return (
    <AnimatePresence>
      {open ? (
        <Dialog static open onClose={onClose} className="relative z-50 lg:hidden">
          <motion.div
            className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: softEase }}
          />
          <div className="fixed inset-x-0 bottom-0 flex max-h-[90dvh] flex-col justify-end">
            <DialogPanel
              as={motion.div}
              drag="y"
              dragControls={dragControls}
              dragListener={false}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.9 }}
              onDragEnd={(_event, info) => {
                if (info.offset.y > 140 || info.velocity.y > 700) onClose()
              }}
              variants={{
                hidden: { y: '100%' },
                visible: { y: 0, transition: { type: 'spring', damping: 34, stiffness: 340 } },
                exit: { y: '100%', transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } }
              }}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="flex max-h-[90dvh] flex-col rounded-t-card border-t border-(--app-border) bg-(--app-surface) shadow-[0_-20px_60px_rgba(15,23,42,0.28)]"
            >
              <header
                onPointerDown={(event) => dragControls.start(event)}
                className="shrink-0 cursor-grab touch-none select-none border-b border-(--app-border) px-5 pb-3 pt-2.5 active:cursor-grabbing"
              >
                <span aria-hidden className="mx-auto mb-3 block h-1.5 w-10 rounded-full bg-(--app-border)" />
                <div className="flex items-center justify-between gap-4">
                  <DialogTitle className="text-[1.05rem] font-semibold tracking-tight text-(--app-text)">Buscar y filtrar</DialogTitle>
                  <button
                    type="button"
                    onClick={onClose}
                    onPointerDown={(event) => event.stopPropagation()}
                    aria-label="Cerrar"
                    className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-control text-(--app-text-subtle) transition-colors hover:bg-(--app-surface-muted) hover:text-(--app-text)"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              </header>

              <form
                id="workspace-jobs-filters-form"
                className="flex-1 space-y-4 overflow-y-auto px-5 py-4"
                onSubmit={(event) => {
                  event.preventDefault()
                  onClose()
                }}
              >
                <label className="block space-y-1.5">
                  <span className="text-[0.8rem] font-medium text-(--app-text)">Búsqueda</span>
                  <div className="relative">
                    <Search aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-(--app-text-subtle)" />
                    <Input
                      className="h-11 pl-9 text-sm"
                      placeholder="Título, área o ubicación"
                      value={search}
                      onChange={(event) => onSearchChange(event.target.value)}
                    />
                  </div>
                </label>

                <label className="block space-y-1.5">
                  <span className="text-[0.8rem] font-medium text-(--app-text)">Tipo de empleo</span>
                  <Select
                    className="h-11 w-full rounded-control text-sm"
                    value={employmentFilter}
                    onChange={(event) => onEmploymentChange(event.target.value)}
                  >
                    <option value="">Todos los tipos</option>
                    {Object.entries(EMPLOYMENT_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </label>

                <label className="block space-y-1.5">
                  <span className="text-[0.8rem] font-medium text-(--app-text)">Ubicación</span>
                  <Select
                    className="h-11 w-full rounded-control text-sm"
                    value={locationFilter}
                    onChange={(event) => onLocationChange(event.target.value)}
                  >
                    <option value="">Todas las ubicaciones</option>
                    {locationOptions.map((locationOption) => (
                      <option key={locationOption} value={locationOption}>
                        {locationOption}
                      </option>
                    ))}
                  </Select>
                </label>

                <label className="block space-y-1.5">
                  <span className="text-[0.8rem] font-medium text-(--app-text)">Ordenar por</span>
                  <Select
                    className="h-11 w-full rounded-control text-sm"
                    value={sort}
                    onChange={(event) => onSortChange(event.target.value as 'recent' | 'applications' | 'title')}
                  >
                    <option value="recent">Recientes</option>
                    <option value="applications">Más postulaciones</option>
                    <option value="title">A-Z</option>
                  </Select>
                </label>
              </form>

              <footer className="flex shrink-0 items-center gap-3 border-t border-(--app-border) px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
                <Button type="button" variant="outline" className="h-11 rounded-control px-4" onClick={onReset} disabled={!hasActive}>
                  Limpiar
                </Button>
                <Button type="submit" form="workspace-jobs-filters-form" className="h-11 flex-1 rounded-control">
                  Ver {resultCount} {resultCount === 1 ? 'vacante' : 'vacantes'}
                </Button>
              </footer>
            </DialogPanel>
          </div>
        </Dialog>
      ) : null}
    </AnimatePresence>
  )
}

function WorkspaceJobsManager() {
  const session = useAppSession()
  const queryClient = useQueryClient()
  const location = useLocation()
  const navigate = useNavigate()
  const shouldReduceMotion = useReducedMotion()
  const isWorkspaceContext = location.pathname.startsWith('/workspace')
  const canManageJobs = session.permissions.includes('job:create') || session.permissions.includes('job:update')
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  // Filtros/tab/búsqueda/orden respaldados por la URL: sobreviven a navegación,
  // back/forward y recarga, y son compartibles por enlace
  // (?tab=&q=&employment=&location=&sort=). La página es paginación efímera de
  // cliente (se reinicia con cada filtro), por eso queda en estado local.
  const [statusTabParam, setStatusTab] = useUrlParamState<'active' | 'inactive'>('tab', 'active')
  const statusTab: 'active' | 'inactive' = statusTabParam === 'inactive' ? 'inactive' : 'active'
  const [search, setSearch] = useUrlParamState('q')
  const [employmentFilter, setEmploymentFilter] = useUrlParamState('employment')
  const [locationFilter, setLocationFilter] = useUrlParamState('location')
  const [sortParam, setSort] = useUrlParamState<JobsSort>('sort', 'recent')
  const sort: JobsSort = JOBS_SORTS.includes(sortParam) ? sortParam : 'recent'
  const [page, setPage] = useState(0)
  const [viewJobId, setViewJobId] = useState<string | null>(null)
  const [pendingStatusChange, setPendingStatusChange] = useState<PendingStatusChange | null>(null)
  const [filtersSheetOpen, setFiltersSheetOpen] = useState(false)

  const workspaceQuery = useQuery({
    queryKey: ['workspace', 'jobs-page', session.activeTenantId],
    enabled: canManageJobs && Boolean(session.activeTenantId),
    queryFn: async () => fetchWorkspaceBundle(session.activeTenantId!)
  })
  const tenantJobsQuery = useQuery({
    queryKey: [...TENANT_JOBS_QUERY_KEY, session.activeTenantId ?? null],
    enabled: canManageJobs && Boolean(session.activeTenantId),
    queryFn: async () => listTenantJobs(session.activeTenantId!)
  })
  // En vivo: la lista de vacantes y sus contadores de postulaciones se mantienen
  // al día cuando el equipo publica/edita vacantes o entran nuevas aplicaciones.
  useRealtimeSync(
    'workspace-jobs',
    [
      { table: 'job_postings', invalidate: [TENANT_JOBS_QUERY_KEY, PUBLIC_JOBS_QUERY_KEY] },
      { table: 'applications', invalidate: [['jobs', 'application-counts', session.activeTenantId ?? null]] }
    ],
    { enabled: canManageJobs && Boolean(session.activeTenantId) }
  )

  const jobApplicationsQuery = useQuery({
    queryKey: ['jobs', 'application-counts', session.activeTenantId ?? null],
    enabled: canManageJobs && isWorkspaceContext && Boolean(session.activeTenantId),
    queryFn: async () => {
      const board = await fetchPipelineBoard(session.activeTenantId!)
      const counts = new Map<string, number>()
      for (const application of board.applications) {
        const jobId = application.job_posting?.id
        if (jobId) {
          counts.set(jobId, (counts.get(jobId) ?? 0) + 1)
        }
      }
      return counts
    }
  })
  const applicationCounts = useMemo(() => jobApplicationsQuery.data ?? new Map<string, number>(), [jobApplicationsQuery.data])
  const isInitialWorkspaceJobsLoading =
    isWorkspaceContext &&
    canManageJobs &&
    Boolean(session.activeTenantId) &&
    (workspaceQuery.isLoading || tenantJobsQuery.isLoading || jobApplicationsQuery.isLoading)

  const tenantJobs = useMemo(() => tenantJobsQuery.data ?? [], [tenantJobsQuery.data])
  const manageableJobs = useMemo(() => tenantJobs.filter((job) => job.status !== 'archived'), [tenantJobs])
  const activeJobsCount = manageableJobs.filter((job) => job.status === 'published').length
  const inactiveJobsCount = manageableJobs.length - activeJobsCount
  const selectedJob = tenantJobs.find((job) => job.id === selectedJobId) ?? null
  const viewJob = tenantJobs.find((job) => job.id === viewJobId) ?? null

  const locationOptions = useMemo(() => {
    const set = new Set<string>()
    for (const job of manageableJobs) {
      const label = jobLocationLabel(job)
      if (label !== 'Sin ubicación') {
        set.add(label)
      }
    }
    return [...set].sort()
  }, [manageableJobs])

  const filteredJobs = useMemo(() => {
    const query = search.trim().toLowerCase()
    const list = manageableJobs.filter((job) => {
      const matchesTab = statusTab === 'active' ? job.status === 'published' : job.status !== 'published'
      if (!matchesTab) {
        return false
      }
      if (employmentFilter && job.employment_type !== employmentFilter) {
        return false
      }
      if (locationFilter && jobLocationLabel(job) !== locationFilter) {
        return false
      }
      if (query) {
        const haystack =
          `${job.title} ${job.city_name ?? ''} ${job.country_code ?? ''} ${employmentLabel(job.employment_type)} ${getOpportunityTypeLabel(job.opportunity_type)}`.toLowerCase()
        if (!haystack.includes(query)) {
          return false
        }
      }
      return true
    })
    return list.sort((a, b) => {
      if (sort === 'applications') {
        return (applicationCounts.get(b.id) ?? 0) - (applicationCounts.get(a.id) ?? 0)
      }
      if (sort === 'title') {
        return a.title.localeCompare(b.title)
      }
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    })
  }, [manageableJobs, statusTab, employmentFilter, locationFilter, search, sort, applicationCounts])

  const pageCount = Math.max(1, Math.ceil(filteredJobs.length / WORKSPACE_JOBS_PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const pageStart = safePage * WORKSPACE_JOBS_PAGE_SIZE
  const pageJobs = filteredJobs.slice(pageStart, pageStart + WORKSPACE_JOBS_PAGE_SIZE)

  useEffect(() => {
    if (!shouldOpenCreateJobEditor(location.search)) {
      return
    }

    const delay = shouldReduceMotion ? 0 : CREATE_JOB_SHEET_DELAY_MS
    const timeoutId = window.setTimeout(() => {
      setViewJobId(null)
      setSelectedJobId(null)
      setIsEditorOpen(true)
      window.scrollTo({ top: 0, behavior: shouldReduceMotion ? 'auto' : 'smooth' })
    }, delay)

    return () => window.clearTimeout(timeoutId)
  }, [location.search, shouldReduceMotion])

  const activeFilterChips = useMemo(
    () =>
      [
        employmentFilter
          ? {
              key: 'employment',
              label: employmentLabel(employmentFilter),
              clear: () => {
                setEmploymentFilter('')
                setPage(0)
              }
            }
          : null,
        locationFilter
          ? {
              key: 'location',
              label: locationFilter,
              clear: () => {
                setLocationFilter('')
                setPage(0)
              }
            }
          : null
      ].filter(Boolean) as Array<{ key: string; label: string; clear: () => void }>,
    [employmentFilter, locationFilter, setEmploymentFilter, setLocationFilter]
  )
  const hasActiveFilters = Boolean(search || employmentFilter || locationFilter || sort !== 'recent')

  function resetToFirstPage() {
    setPage(0)
  }

  function resetFilters() {
    setSearch('')
    setEmploymentFilter('')
    setLocationFilter('')
    setSort('recent')
    setPage(0)
  }

  function clearCreateJobAction() {
    if (!shouldOpenCreateJobEditor(location.search)) {
      return
    }

    const params = new URLSearchParams(location.search)
    params.delete('action')
    const search = params.toString()
    void navigate(
      {
        pathname: location.pathname,
        search: search ? `?${search}` : ''
      },
      { replace: true }
    )
  }

  function closeJobEditor() {
    setSelectedJobId(null)
    setIsEditorOpen(false)
    clearCreateJobAction()
  }

  function openJobEditor(jobId: string | null) {
    setViewJobId(null)
    setSelectedJobId(jobId)
    setIsEditorOpen(true)
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  function requestStatusChange(job: TenantJobRow, action: PendingStatusChange['action']) {
    setPendingStatusChange({
      jobId: job.id,
      jobTitle: job.title,
      action
    })
  }

  const statusMutation = useMutation({
    mutationFn: updateJobPostingStatus,
    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: PUBLIC_JOBS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: TENANT_JOBS_QUERY_KEY })
      ])
      toast.success(jobStatusSuccessLabel(variables.status), {
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

  if (isInitialWorkspaceJobsLoading) {
    return (
      <PageLoader
        label="Cargando vacantes"
        hint="Estamos preparando las vacantes, postulaciones y datos de tu empresa"
      />
    )
  }

  return (
    <motion.div
      className="space-y-6"
      variants={pageStagger}
      initial={shouldReduceMotion ? false : 'hidden'}
      animate="show"
    >
      {isWorkspaceContext && canManageJobs ? (
        <motion.section variants={cardReveal} className="w-full space-y-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-[1.6rem] font-bold leading-tight tracking-tight text-(--app-text)">Vacantes</h1>
              <p className="mt-1 text-[0.92rem] text-(--app-text-muted)">Gestiona y publica las posiciones abiertas en tu empresa.</p>
            </div>
            <div className="flex w-full flex-wrap gap-2.5 sm:w-auto sm:flex-nowrap">
              <Button className="h-10 flex-1 rounded-control sm:flex-none" variant="outline" onClick={() => toast.info('Exportación próximamente')}>
                <Download className="size-4" />
                Exportar
              </Button>
              <Button className="h-10 flex-1 rounded-control sm:flex-none" onClick={() => openJobEditor(null)}>
                <Plus className="size-4" />
                Publicar vacante
              </Button>
            </div>
          </div>
          <div className="flex border-b border-(--app-border)">
            {(
              [
                { value: 'active', label: 'Activas', count: activeJobsCount },
                { value: 'inactive', label: 'Inactivas', count: inactiveJobsCount }
              ] as const
            ).map((tab) => {
              const isActive = statusTab === tab.value
              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => {
                    setStatusTab(tab.value)
                    resetToFirstPage()
                  }}
                  className={cn(
                    'relative mr-5 inline-flex items-center gap-2 px-0 py-3 text-sm font-semibold transition-colors',
                    isActive
                      ? 'text-primary-700 after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full after:bg-primary-600'
                      : 'text-(--app-text-muted) hover:bg-(--app-surface-muted) hover:text-(--app-text)'
                  )}
                >
                  {tab.label}
                  <span
                    className={cn(
                      'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold tabular-nums',
                      isActive ? 'bg-primary-50 text-primary-700' : 'bg-(--app-surface-muted) text-(--app-text-subtle)'
                    )}
                  >
                    {tab.count}
                  </span>
                </button>
              )
            })}
          </div>
        </motion.section>
      ) : (
        <section className="rounded-card-lg border border-(--app-border) bg-white px-6 py-6 shadow-[0_18px_44px_rgba(19,42,97,0.08)] sm:px-7">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary-200 bg-primary-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-700">
                Reclutamiento
              </div>
              <h1 className="mt-3 text-xl font-semibold tracking-tight text-(--app-text) sm:text-[1.6rem]">
                {canManageJobs ? 'Vacantes y oportunidades desde una sola vista' : 'Explora oportunidades con filtros simples'}
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-(--app-text-muted)">
                {canManageJobs
                  ? 'Crea borradores, publica cuando corresponda y mantén ordenado el frente de talento aprobado.'
                  : 'Explora oportunidades publicadas para miembros, guarda las más relevantes y vuelve a ellas con menos friccion.'}
              </p>
            </div>
            {canManageJobs ? (
              <div className="rounded-card-lg border border-(--app-border) bg-(--app-surface-muted) px-4 py-3 text-right">
                <p className="text-[0.76rem] font-medium text-(--app-text-muted)">Vacantes del workspace</p>
                <p className="mt-1 text-[1.55rem] font-bold tracking-[-0.03em] text-(--app-text)">{tenantJobs.length}</p>
              </div>
            ) : null}
          </div>
        </section>
      )}

      {canManageJobs && workspaceQuery.data && isWorkspaceContext ? (
        <motion.section variants={cardReveal} className="w-full space-y-4">
          <SideSheet
            open={isEditorOpen}
            onClose={closeJobEditor}
            title={selectedJob ? 'Editar vacante' : 'Publicar vacante'}
            description={
              selectedJob
                ? 'Actualiza los detalles de esta posición.'
                : 'Crea una posición y publícala cuando esté lista.'
            }
            widthClassName="max-w-xl"
          >
            <JobEditor
              key={selectedJob?.id ?? 'new-job'}
              bare
              selectedJob={selectedJob}
              session={session}
              workspace={workspaceQuery.data}
              onClear={closeJobEditor}
              onSaved={async () => {
                await Promise.all([
                  queryClient.invalidateQueries({ queryKey: PUBLIC_JOBS_QUERY_KEY }),
                  queryClient.invalidateQueries({ queryKey: TENANT_JOBS_QUERY_KEY })
                ])
                closeJobEditor()
              }}
            />
          </SideSheet>

          <WorkspaceJobViewDialog
            job={viewJob}
            applicationCount={viewJob ? applicationCounts.get(viewJob.id) ?? 0 : 0}
            onClose={() => setViewJobId(null)}
            onEdit={openJobEditor}
          />

          <WorkspaceJobsFilterSheet
            open={filtersSheetOpen}
            onClose={() => setFiltersSheetOpen(false)}
            search={search}
            onSearchChange={(value) => {
              setSearch(value)
              setPage(0)
            }}
            employmentFilter={employmentFilter}
            onEmploymentChange={(value) => {
              setEmploymentFilter(value)
              setPage(0)
            }}
            locationFilter={locationFilter}
            onLocationChange={(value) => {
              setLocationFilter(value)
              setPage(0)
            }}
            locationOptions={locationOptions}
            sort={sort}
            onSortChange={setSort}
            resultCount={filteredJobs.length}
            hasActive={hasActiveFilters}
            onReset={resetFilters}
          />

          {/* Móvil: barra compacta que abre una hoja inferior con búsqueda y filtros */}
          <div className="space-y-2 lg:hidden">
            <button
              type="button"
              onClick={() => setFiltersSheetOpen(true)}
              className="flex h-11 w-full items-center gap-2.5 rounded-card border border-(--app-border) bg-(--app-surface) pl-3 pr-1.5 text-left shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--app-ring)"
            >
              <Search aria-hidden className="size-4 shrink-0 text-(--app-text-subtle)" />
              <span className={cn('min-w-0 flex-1 truncate text-sm', search ? 'text-(--app-text)' : 'text-(--app-text-subtle)')}>
                {search || 'Busca por título, área o ubicación'}
              </span>
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-control bg-(--app-surface-muted) px-2.5 py-1.5 text-[0.78rem] font-semibold text-(--app-text)">
                <SlidersHorizontal aria-hidden className="size-4" />
                Filtros
                {activeFilterChips.length > 0 ? (
                  <span className="inline-flex min-w-[1.1rem] items-center justify-center rounded-full bg-primary-600 px-1 text-[0.68rem] font-semibold leading-none text-white">
                    {activeFilterChips.length}
                  </span>
                ) : null}
              </span>
            </button>

            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2 text-[0.82rem] text-(--app-text-subtle)">
                <b className="font-semibold text-(--app-text)">{filteredJobs.length}</b>{' '}
                {filteredJobs.length === 1 ? 'vacante' : 'vacantes'}
              </span>
              <label className="flex items-center gap-1.5 text-[0.82rem] text-(--app-text-subtle)">
                Ordenar
                <Select
                  className="h-[34px] w-auto rounded-control text-[0.82rem]"
                  value={sort}
                  onChange={(event) => setSort(event.target.value as 'recent' | 'applications' | 'title')}
                  aria-label="Ordenar vacantes"
                >
                  <option value="recent">Recientes</option>
                  <option value="applications">Más postulaciones</option>
                  <option value="title">A-Z</option>
                </Select>
              </label>
            </div>

            {activeFilterChips.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5">
                {activeFilterChips.map((chip) => (
                  <button
                    key={chip.key}
                    type="button"
                    onClick={chip.clear}
                    className="inline-flex h-8 items-center gap-1.5 rounded-control border border-(--app-border) bg-(--app-surface) px-2.5 text-[0.78rem] font-medium text-(--app-text-muted) transition hover:text-(--app-text) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--app-ring)"
                  >
                    {chip.label}
                    <X aria-hidden className="size-3" />
                    <span className="sr-only">Quitar filtro</span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={resetFilters}
                  className="px-1 text-[0.78rem] font-medium text-(--app-text-muted) underline-offset-2 hover:underline"
                >
                  Limpiar
                </button>
              </div>
            ) : null}
          </div>

          {/* Escritorio: búsqueda + filtros inline */}
          <div className="hidden flex-col gap-2.5 lg:flex lg:flex-row lg:items-center">
            <div className="relative min-w-60 flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-(--app-text-subtle)" />
              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  resetToFirstPage()
                }}
                placeholder="Busca por título, área o ubicación"
                className="h-11 rounded-control pl-10"
              />
            </div>
            <div className="grid gap-2.5 sm:grid-cols-3 lg:flex lg:shrink-0">
              <Select
                value={employmentFilter}
                onChange={(event) => {
                  setEmploymentFilter(event.target.value)
                  resetToFirstPage()
                }}
                className="h-11 min-w-40 rounded-control"
              >
                <option value="">Tipo de empleo</option>
                {Object.entries(EMPLOYMENT_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
              <Select
                value={locationFilter}
                onChange={(event) => {
                  setLocationFilter(event.target.value)
                  resetToFirstPage()
                }}
                className="h-11 min-w-40 rounded-control"
              >
                <option value="">Ubicación</option>
                {locationOptions.map((locationOption) => (
                  <option key={locationOption} value={locationOption}>
                    {locationOption}
                  </option>
                ))}
              </Select>
              <Select
                value={sort}
                onChange={(event) => setSort(event.target.value as 'recent' | 'applications' | 'title')}
                className="h-11 min-w-48 rounded-control"
              >
                <option value="recent">Ordenar por: Recientes</option>
                <option value="applications">Más postulaciones</option>
                <option value="title">A-Z</option>
              </Select>
            </div>
          </div>

          <div className="overflow-hidden rounded-card border border-(--app-border) bg-(--app-surface) shadow-[0_1px_2px_rgba(20,40,90,0.04),0_4px_16px_rgba(20,40,90,0.05)]">
            <div className="hidden grid-cols-[minmax(0,1fr)_180px_130px_116px] items-center gap-4 border-b border-(--app-border) bg-(--app-surface-muted)/70 px-5 py-3 text-[0.72rem] font-bold uppercase tracking-[0.05em] text-(--app-text-subtle) lg:grid">
              <span>Vacante</span>
              <span>Compensación</span>
              <span>Postulaciones</span>
              <span className="text-right">Acciones</span>
            </div>

            {pageJobs.length ? (
              pageJobs.map((job) => {
                const count = applicationCounts.get(job.id) ?? 0
                const isPublished = job.status === 'published'
                const compensationIsMuted = isMutedCompensation(job)
                const iconButtonClassName =
                  'flex size-9 items-center justify-center rounded-control text-(--app-text-muted) transition-colors hover:bg-primary-50 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--app-ring) lg:size-10 dark:hover:bg-primary-500/12 dark:hover:text-primary-200'

                return (
                  <motion.div
                    variants={cardReveal}
                    key={job.id}
                    className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-2.5 gap-y-1 border-b border-(--app-border) px-3 py-2 transition-colors last:border-b-0 hover:bg-(--app-surface-muted)/55 lg:grid-cols-[minmax(0,1fr)_180px_130px_116px] lg:items-center lg:gap-4 lg:px-5 lg:py-4"
                  >
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2 lg:gap-2.5">
                        <span
                          className={cn(
                            'size-1.5 shrink-0 rounded-full lg:size-2',
                            isPublished
                              ? 'bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.14)]'
                              : 'bg-slate-400 shadow-[0_0_0_3px_rgba(148,163,184,0.18)]'
                          )}
                        />
                        <h3 className="truncate text-[0.85rem] font-semibold text-(--app-text) lg:text-[0.97rem]">{job.title}</h3>
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 pl-3.5 text-[0.72rem] text-(--app-text-muted) lg:mt-1.5 lg:gap-x-4 lg:gap-y-1 lg:pl-5 lg:text-[0.82rem]">
                        <span className="inline-flex min-w-0 items-center gap-1.5">
                          <MapPin className="size-3 shrink-0 text-(--app-text-subtle) lg:size-3.5" />
                          <span className="truncate">{jobLocationLabel(job)}</span>
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <BriefcaseBusiness className="size-3 text-(--app-text-subtle) lg:size-3.5" />
                          {employmentLabel(job.employment_type)}
                        </span>
                        <span className="inline-flex items-center gap-1.5 lg:hidden">
                          <span className="size-1 rounded-full bg-(--app-text-subtle)" />
                          {workplaceLabel(job.workplace_type)}
                        </span>
                      </div>
                    </div>

                    <p
                      className={cn(
                        'col-start-1 pl-3.5 text-[0.8rem] font-semibold text-(--app-text) lg:col-auto lg:pl-0 lg:text-sm',
                        compensationIsMuted && 'font-medium text-(--app-text-subtle)'
                      )}
                    >
                      {jobSalaryLabel(job)}
                    </p>

                    <div className="col-start-1 pl-3.5 lg:col-auto lg:pl-0">
                      <p className={cn('text-[0.8rem] font-semibold text-(--app-text) lg:text-sm', count === 0 && 'font-medium text-(--app-text-subtle)')}>
                        {count} {count === 1 ? 'postulación' : 'postulaciones'}
                      </p>
                      <p className="mt-0.5 text-[0.7rem] text-(--app-text-subtle) lg:text-xs">Publicada {jobPublishedTimeLabel(job)}</p>
                    </div>

                    <div className="col-start-2 row-span-3 row-start-1 flex items-start justify-end gap-0.5 self-start lg:col-auto lg:row-auto lg:gap-1 lg:self-center">
                      <button
                        type="button"
                        aria-label={`Ver ${job.title}`}
                        className={iconButtonClassName}
                        onClick={() => setViewJobId(job.id)}
                      >
                        <Eye className="size-4" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Editar ${job.title}`}
                        className={iconButtonClassName}
                        onClick={() => openJobEditor(job.id)}
                      >
                        <Pencil className="size-4" />
                      </button>
                      <KebabMenu className="size-9 rounded-control lg:size-10" label={`Más acciones para ${job.title}`}>
                        <KebabMenuItem onClick={() => openJobEditor(job.id)}>
                          <Pencil className="mr-2 size-4 text-(--app-text-subtle)" />
                          Editar
                        </KebabMenuItem>
                        <KebabMenuItem onClick={() => setViewJobId(job.id)}>
                          <Eye className="mr-2 size-4 text-(--app-text-subtle)" />
                          Ver oportunidad
                        </KebabMenuItem>
                        {isPublished ? (
                          <KebabMenuItem onClick={() => requestStatusChange(job, 'close')}>
                            <Ban className="mr-2 size-4 text-(--app-text-subtle)" />
                            Cerrar
                          </KebabMenuItem>
                        ) : (
                          <KebabMenuItem onClick={() => statusMutation.mutate({ jobId: job.id, status: 'published' })}>
                            <BriefcaseBusiness className="mr-2 size-4 text-(--app-text-subtle)" />
                            Publicar
                          </KebabMenuItem>
                        )}
                        <KebabMenuItem danger onClick={() => requestStatusChange(job, 'archive')}>
                          <Archive className="mr-2 size-4" />
                          Archivar
                        </KebabMenuItem>
                      </KebabMenu>
                    </div>
                  </motion.div>
                )
              })
            ) : (
              <div className="px-5 py-16 text-center">
                <div className="mx-auto flex size-14 items-center justify-center rounded-card bg-primary-50 text-primary-700 dark:bg-primary-500/12 dark:text-primary-200">
                  <Search className="size-6" />
                </div>
                <h3 className="mt-4 text-base font-bold tracking-tight text-(--app-text)">Sin resultados</h3>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-(--app-text-muted)">
                  {manageableJobs.length === 0
                    ? 'Todavía no hay vacantes en este espacio. Usa “Publicar vacante” para crear la primera.'
                    : 'Ajusta la búsqueda o los filtros para encontrar otra vacante.'}
                </p>
              </div>
            )}
          </div>

          {filteredJobs.length > 0 ? (
            <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-(--app-text-muted)">
                Mostrando <b className="font-semibold text-(--app-text-muted)">{pageStart + 1} a {Math.min(pageStart + WORKSPACE_JOBS_PAGE_SIZE, filteredJobs.length)}</b> de {filteredJobs.length} vacantes
              </p>
              {pageCount > 1 ? (
                <Pagination page={safePage} totalPages={pageCount} onPageChange={setPage} ariaLabel="Paginación de vacantes" />
              ) : null}
            </div>
          ) : null}
        </motion.section>
      ) : canManageJobs && workspaceQuery.data ? (
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
              {tenantJobs.length ? (
                tenantJobs.map((job) => (
                  <div key={job.id} className="rounded-card border border-(--app-border) bg-(--app-surface-muted) p-4">
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
                        <Button variant="outline" onClick={() => requestStatusChange(job, 'close')}>
                          Cerrar
                        </Button>
                      )}
                      {job.status !== 'archived' ? (
                        <Button variant="outline" onClick={() => requestStatusChange(job, 'archive')}>
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
                <div className="rounded-card border border-dashed border-(--app-border) bg-(--app-surface-muted) px-4 py-6 text-sm text-(--app-text-muted)">
                  Todavia no hay vacantes en este espacio.
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      ) : null}

      <ConfirmDialog
        open={pendingStatusChange !== null}
        variant={pendingStatusChange?.action === 'archive' ? 'danger' : 'primary'}
        title={pendingStatusChange?.action === 'archive' ? '¿Archivar esta vacante?' : '¿Cerrar esta vacante?'}
        description={
          pendingStatusChange?.action === 'archive'
            ? `Antes de continuar, confirma si deseas archivar "${pendingStatusChange.jobTitle}". La vacante saldrá del inventario visible y dejará de mostrarse públicamente.`
            : `Antes de continuar, confirma si deseas cerrar "${pendingStatusChange?.jobTitle ?? 'esta vacante'}". La vacante dejará de aceptar nuevas postulaciones y ya no se mostrará públicamente.`
        }
        confirmLabel={pendingStatusChange?.action === 'archive' ? 'Sí, archivar' : 'Sí, cerrar vacante'}
        cancelLabel="No, mantener vacante"
        loading={statusMutation.isPending}
        onCancel={() => setPendingStatusChange(null)}
        onConfirm={() => {
          if (!pendingStatusChange) return
          statusMutation.mutate(
            {
              jobId: pendingStatusChange.jobId,
              status: pendingStatusChange.action === 'archive' ? 'archived' : 'closed'
            },
            { onSettled: () => setPendingStatusChange(null) }
          )
        }}
      />
    </motion.div>
  )
}

/**
 * `/account/jobs` muestra solo el board del usuario (buscar y aplicar).
 * La gestión de vacantes del empleador vive en `/workspace/jobs`.
 */
export function JobsOverviewPage() {
  const location = useLocation()
  const isWorkspaceContext = location.pathname.startsWith('/workspace')

  return isWorkspaceContext ? <WorkspaceJobsManager /> : <PublicJobBoard />
}
