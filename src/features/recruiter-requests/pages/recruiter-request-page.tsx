import { useState } from 'react'

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock3,
  FileCheck2,
  FileLock2,
  Globe2,
  History,
  Mail,
  UploadCloud,
} from 'lucide-react'
import { useForm, useWatch } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { useAppSession } from '@/app/providers/app-session-provider'
import { surfacePaths } from '@/app/router/surface-paths'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldHelp } from '@/components/ui/field-help'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/loader'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  createPrivateFileUrl,
  listMyRecruiterRequests,
  submitRecruiterRequest,
  toErrorMessage,
  uploadPrivateFile
} from '@/features/auth/lib/auth-api'
import { recruiterRequestSchema, type RecruiterRequestValues } from '@/features/auth/lib/auth-schemas'
import { getTenantKindLabel, tenantKindOptions, tenantKindRequirementSummary } from '@/features/opportunities/lib/opportunity-taxonomy'
import { RecruiterRequestStatusBadge } from '@/features/recruiter-requests/components/recruiter-request-status-badge'
import { CountryCodeSelect } from '@/shared/ui/location-selects'
import { ImageCropDialog } from '@/shared/ui/image-crop-dialog'
import { captureClientError } from '@/lib/errors/client-error-logger'
import { useRealtimeSync } from '@/lib/realtime/use-realtime-sync'
import {
  MAX_UPLOAD_SIZE_BYTES,
  MAX_UPLOAD_SIZE_LABEL,
  isRasterImageFile,
  prepareUploadFile,
  RECRUITER_DOCUMENT_MIME_TYPES,
  RECRUITER_LOGO_MIME_TYPES,
  UploadConstraintError
} from '@/lib/uploads/media'

const MY_REQUESTS_QUERY_KEY = ['recruiter-requests', 'mine'] as const

function getTenantNameLabel(kind: RecruiterRequestValues['requestedTenantKind']) {
  switch (kind) {
    case 'company':
      return 'Nombre comercial'
    case 'ministry':
      return 'Nombre del ministerio'
    case 'project':
      return 'Nombre del proyecto'
    case 'field':
      return 'Nombre del campo o región'
    default:
      return 'Nombre del perfil'
  }
}

function getLegalNameLabel(kind: RecruiterRequestValues['requestedTenantKind']) {
  return kind === 'company' ? 'Razón social' : 'Nombre legal o institucional'
}

function RequestFieldLabel({ label, help }: { label: string; help?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span>{label}</span>
      {help ? <FieldHelp fieldLabel={label} help={help} /> : null}
    </span>
  )
}

function SectionHeading({
  icon: Icon,
  eyebrow,
  title,
  description,
}: {
  icon: typeof Building2
  eyebrow: string
  title: string
  description: string
}) {
  return (
    <div className="flex items-start gap-3 border-b border-(--app-border) pb-4">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-card bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-200">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary-700 dark:text-primary-300">{eyebrow}</p>
        <h2 className="mt-1 text-base font-semibold text-(--app-text) sm:text-lg">{title}</h2>
        <p className="mt-1 text-sm leading-5 text-(--app-text-muted)">{description}</p>
      </div>
    </div>
  )
}

function FilePicker({
  id,
  title,
  description,
  accept,
  file,
  required = false,
  isPreparing,
  error,
  onChange,
}: {
  id: string
  title: string
  description: string
  accept: string
  file: File | null
  required?: boolean
  isPreparing: boolean
  error: string | null
  onChange: (file: File | null) => void
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-(--app-text)">{title}</p>
        <Badge variant={required ? 'soft' : 'outline'}>{required ? 'Requerido' : 'Opcional'}</Badge>
      </div>
      <label
        htmlFor={id}
        className="group flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-card-lg border border-dashed border-(--app-border) bg-(--app-surface-muted) px-4 py-5 text-center transition hover:border-primary-300 hover:bg-primary-50/50 focus-within:ring-2 focus-within:ring-(--app-ring) dark:hover:border-primary-500/50 dark:hover:bg-primary-500/5"
      >
        <span className="flex size-10 items-center justify-center rounded-full bg-white text-primary-700 shadow-sm dark:bg-zinc-900 dark:text-primary-300">
          {file ? <FileCheck2 className="size-5" aria-hidden="true" /> : <UploadCloud className="size-5" aria-hidden="true" />}
        </span>
        <span className="mt-3 max-w-full truncate text-sm font-semibold text-(--app-text)">
          {file?.name ?? 'Seleccionar archivo'}
        </span>
        <span className="mt-1 text-xs leading-5 text-(--app-text-muted)">{description}</span>
        <input
          id={id}
          className="sr-only"
          type="file"
          accept={accept}
          onChange={(event) => {
            onChange(event.target.files?.[0] ?? null)
            event.currentTarget.value = ''
          }}
        />
      </label>
      {isPreparing ? (
        <p className="inline-flex items-center gap-2 text-xs text-(--app-text-muted)">
          <Spinner size="sm" /> Preparando archivo…
        </p>
      ) : null}
      {error ? <p className="text-xs text-rose-600 dark:text-rose-300">{error}</p> : null}
    </div>
  )
}

export function RecruiterRequestPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const session = useAppSession()
  const [companyLogoFile, setCompanyLogoFile] = useState<File | null>(null)
  const [pendingCompanyLogoCropFile, setPendingCompanyLogoCropFile] = useState<File | null>(null)
  const [verificationDocumentFile, setVerificationDocumentFile] = useState<File | null>(null)
  const [companyLogoFileError, setCompanyLogoFileError] = useState<string | null>(null)
  const [verificationDocumentFileError, setVerificationDocumentFileError] = useState<string | null>(null)
  const [isPreparingCompanyLogo, setIsPreparingCompanyLogo] = useState(false)
  const [isPreparingVerificationDocument, setIsPreparingVerificationDocument] = useState(false)

  const form = useForm<RecruiterRequestValues>({
    resolver: zodResolver(recruiterRequestSchema),
    defaultValues: {
      requestedTenantKind: 'company',
      requestedCompanyName: '',
      requestedCompanyLegalName: '',
      requestedTenantSlug: '',
      companyWebsiteUrl: '',
      companyEmail: session.authUser?.email ?? '',
      companyPhone: '',
      companyCountryCode: session.profile?.country_code ?? 'DO',
      companyDescription: '',
      operatingScope: '',
      sponsoringEntity: '',
      fieldRegion: '',
      conversionIntent: ''
    }
  })
  const requestedTenantKind = useWatch({
    control: form.control,
    name: 'requestedTenantKind'
  })
  const requestDraft = useWatch({ control: form.control })

  const myRequestsQuery = useQuery({
    queryKey: MY_REQUESTS_QUERY_KEY,
    queryFn: async () => {
      if (!session.authUser) {
        return []
      }

      return listMyRecruiterRequests(session.authUser.id)
    },
    enabled: session.authUser !== null
  })

  // El solicitante ve el cambio de estado (aprobada / rechazada / más información) en
  // vivo cuando un admin la revisa, sin recargar. RLS acota a sus propias solicitudes.
  useRealtimeSync(
    'my-recruiter-requests',
    [{ table: 'recruiter_requests', invalidate: [MY_REQUESTS_QUERY_KEY] }],
    { enabled: session.authUser !== null }
  )

  const submitMutation = useMutation({
    mutationFn: async (values: RecruiterRequestValues) => {
      if (!session.authUser) {
        throw new Error('Debes iniciar sesión para enviar esta solicitud.')
      }

      if (!verificationDocumentFile) {
        throw new Error('Adjunta al menos un documento de verificacion.')
      }

      const companyLogoPath = companyLogoFile
        ? await uploadPrivateFile({
            bucket: 'verification-documents',
            ownerUserId: session.authUser.id,
            file: companyLogoFile,
            prefix: 'company-logo'
          })
        : null

      const verificationDocumentPath = await uploadPrivateFile({
        bucket: 'verification-documents',
        ownerUserId: session.authUser.id,
        file: verificationDocumentFile,
        prefix: 'verification'
      })

      return submitRecruiterRequest({
        requesterUserId: session.authUser.id,
        requestedTenantKind: values.requestedTenantKind,
        requestedCompanyName: values.requestedCompanyName,
        requestedCompanyLegalName: values.requestedCompanyLegalName,
        requestedTenantSlug: values.requestedTenantSlug,
        companyWebsiteUrl: values.companyWebsiteUrl,
        companyEmail: values.companyEmail,
        companyPhone: values.companyPhone,
        companyCountryCode: values.companyCountryCode.toUpperCase(),
        companyDescription: values.companyDescription,
        requestMetadata: {
          operating_scope: values.operatingScope?.trim() || null,
          sponsoring_entity: values.sponsoringEntity?.trim() || null,
          field_region: values.fieldRegion?.trim() || null,
          conversion_intent: values.conversionIntent?.trim() || null
        },
        companyLogoPath,
        verificationDocumentPath
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: MY_REQUESTS_QUERY_KEY })
      toast.success('Solicitud enviada', {
        description: 'Tu empresa ya quedó en cola de revisión administrativa.'
      })
      setCompanyLogoFile(null)
      setVerificationDocumentFile(null)
      setCompanyLogoFileError(null)
      setVerificationDocumentFileError(null)
      form.reset({
        requestedTenantKind: 'company',
        requestedCompanyName: '',
        requestedCompanyLegalName: '',
        requestedTenantSlug: '',
        companyWebsiteUrl: '',
        companyEmail: session.authUser?.email ?? '',
        companyPhone: '',
        companyCountryCode: session.profile?.country_code ?? 'DO',
        companyDescription: '',
        operatingScope: '',
        sponsoringEntity: '',
        fieldRegion: '',
        conversionIntent: ''
      })
    },
    onError: async (error) => {
      await captureClientError({
        source: 'recruiter-request.submit',
        route: surfacePaths.candidate.recruiterRequest,
        userId: session.authUser?.id ?? null,
        userMessage: 'No pudimos enviar la solicitud de tu organización.',
        error,
        metadata: {
          hasCompanyLogoFile: companyLogoFile !== null,
          hasVerificationDocumentFile: verificationDocumentFile !== null
        }
      })
      toast.error('No pudimos enviar la solicitud', {
        description: toErrorMessage(error)
      })
    }
  })

  const requests = myRequestsQuery.data ?? []
  const hasOpenRequest = requests.some((request) => request.status === 'submitted' || request.status === 'under_review')
  const approvedRequest = requests.find((request) => request.status === 'approved')
  const contextualRequirements =
    requestedTenantKind === 'ministry'
      ? [requestDraft.requestedCompanyLegalName, requestDraft.operatingScope]
      : requestedTenantKind === 'project'
        ? [requestDraft.operatingScope, requestDraft.sponsoringEntity]
        : requestedTenantKind === 'field'
          ? [requestDraft.sponsoringEntity, requestDraft.fieldRegion]
          : requestedTenantKind === 'generic_profile'
            ? [requestDraft.conversionIntent]
            : [requestDraft.requestedCompanyLegalName]
  const progressRequirements = [
    requestDraft.requestedCompanyName,
    requestDraft.requestedTenantSlug,
    requestDraft.companyEmail,
    requestDraft.companyCountryCode,
    requestDraft.companyDescription,
    ...contextualRequirements,
    verificationDocumentFile,
  ]
  const completedRequirements = progressRequirements.filter((value) =>
    typeof value === 'string' ? value.trim().length > 0 : Boolean(value),
  ).length
  const requestProgress = Math.round((completedRequirements / progressRequirements.length) * 100)

  async function prepareCompanyLogoFile(file: File) {
    setCompanyLogoFileError(null)
    setCompanyLogoFile(file)

    setIsPreparingCompanyLogo(true)

    try {
      const preparedFile = await prepareUploadFile(file, {
        acceptedMimeTypes: RECRUITER_LOGO_MIME_TYPES,
        acceptedFormatsLabel: 'SVG, PNG, JPG o WEBP',
        fieldLabel: 'El logo',
        maxImageDimension: 1600
      })

      setCompanyLogoFile(preparedFile)
    } catch (error) {
      const message =
        error instanceof UploadConstraintError ? error.userMessage : toErrorMessage(error)

      setCompanyLogoFile(null)
      setCompanyLogoFileError(message)
      toast.error('No pudimos preparar el logo', {
        description: message
      })
      await captureClientError({
        source: 'recruiter-request.company-logo',
        route: surfacePaths.candidate.recruiterRequest,
        userId: session.authUser?.id ?? null,
        userMessage: message,
        error,
        metadata: {
          fileName: file.name,
          fileSizeBytes: file.size,
          fileType: file.type
        }
      })
    } finally {
      setIsPreparingCompanyLogo(false)
    }
  }

  async function handleCompanyLogoChange(file: File | null) {
    setCompanyLogoFileError(null)

    if (!file) {
      setCompanyLogoFile(null)
      setPendingCompanyLogoCropFile(null)
      return
    }

    if (isRasterImageFile(file) && file.size <= MAX_UPLOAD_SIZE_BYTES) {
      setCompanyLogoFile(null)
      setPendingCompanyLogoCropFile(file)
      return
    }

    await prepareCompanyLogoFile(file)
  }

  async function confirmCompanyLogoCrop(file: File) {
    setPendingCompanyLogoCropFile(null)
    await prepareCompanyLogoFile(file)
  }

  async function handleVerificationDocumentChange(file: File | null) {
    setVerificationDocumentFileError(null)
    setVerificationDocumentFile(file)

    if (!file) {
      return
    }

    setIsPreparingVerificationDocument(true)

    try {
      const preparedFile = await prepareUploadFile(file, {
        acceptedMimeTypes: RECRUITER_DOCUMENT_MIME_TYPES,
        acceptedFormatsLabel: 'PDF, PNG, JPG o WEBP',
        fieldLabel: 'El documento',
        maxImageDimension: 2200
      })

      setVerificationDocumentFile(preparedFile)
    } catch (error) {
      const message =
        error instanceof UploadConstraintError ? error.userMessage : toErrorMessage(error)

      setVerificationDocumentFile(null)
      setVerificationDocumentFileError(message)
      toast.error('No pudimos preparar el documento', {
        description: message
      })
      await captureClientError({
        source: 'recruiter-request.verification-document',
        route: surfacePaths.candidate.recruiterRequest,
        userId: session.authUser?.id ?? null,
        userMessage: message,
        error,
        metadata: {
          fileName: file.name,
          fileSizeBytes: file.size,
          fileType: file.type
        }
      })
    } finally {
      setIsPreparingVerificationDocument(false)
    }
  }

  async function openPrivateAsset(path: string) {
    try {
      const signedUrl = await createPrivateFileUrl('verification-documents', path)
      window.open(signedUrl, '_blank', 'noopener,noreferrer')
    } catch (error) {
      await captureClientError({
        source: 'recruiter-request.asset-open',
        route: surfacePaths.candidate.recruiterRequest,
        userId: session.authUser?.id ?? null,
        userMessage: 'No pudimos abrir el documento.',
        error,
        metadata: {
          assetPath: path
        }
      })
      toast.error('No pudimos abrir el archivo', {
        description: toErrorMessage(error)
      })
    }
  }

  function submitRequest(values: RecruiterRequestValues) {
    if (!verificationDocumentFile) {
      setVerificationDocumentFileError('Adjunta un documento que respalde la identidad de la organización.')
      return
    }

    submitMutation.mutate(values)
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-panel border border-primary-100 bg-gradient-to-br from-primary-50 via-white to-sky-50 p-5 shadow-[0_18px_48px_rgba(35,78,150,0.08)] sm:p-6 lg:p-8 dark:border-primary-500/20 dark:from-primary-950/50 dark:via-zinc-950 dark:to-sky-950/30">
        <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="max-w-3xl">
            <Badge variant="soft">Empresas que desean reclutar</Badge>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight text-(--app-text) sm:text-3xl">
              Solicita acceso para reclutar con tu empresa
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-(--app-text-muted) sm:text-base">
              Cuéntanos sobre tu organización y comparte un documento que confirme su identidad. Revisaremos la información antes de habilitar las herramientas de reclutamiento.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs text-(--app-text-muted) sm:gap-4">
            {[
              [Building2, 'Completa tus datos'],
              [FileCheck2, 'Envía la solicitud'],
              [CheckCircle2, 'Comienza a reclutar'],
            ].map(([Icon, label], index) => (
              <div key={String(label)} className="flex max-w-28 flex-col items-center gap-2">
                <span className="flex size-9 items-center justify-center rounded-full border border-primary-200 bg-white text-primary-700 dark:border-primary-500/30 dark:bg-zinc-900 dark:text-primary-300">
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <span>{index + 1}. {String(label)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div>
          {hasOpenRequest ? (
            <Card className="border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-950/30">
              <div className="flex items-start gap-3">
                <Clock3 className="mt-0.5 size-5 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden="true" />
                <div>
                  <CardTitle>Tu solicitud está en proceso</CardTitle>
                  <CardDescription className="mt-1 text-amber-800 dark:text-amber-200">
                    No necesitas enviarla nuevamente. Consulta el estado y cualquier comentario del equipo de revisión en el historial.
                  </CardDescription>
                </div>
              </div>
            </Card>
          ) : (
            <form className="space-y-6" onSubmit={(event) => void form.handleSubmit(submitRequest)(event)}>
              <Card className="p-4 sm:p-6">
                <SectionHeading
                  icon={Building2}
                  eyebrow="Paso 1"
                  title="Datos de la organización"
                  description="Identifica la entidad que publicará oportunidades y gestionará candidatos."
                />
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <label className="space-y-2 text-sm font-medium text-(--app-text)">
                    <RequestFieldLabel label="Tipo de organización" help="Selecciona la opción que mejor representa a la entidad solicitante." />
                    <Select {...form.register('requestedTenantKind')}>
                      {tenantKindOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </Select>
                  </label>
                  <div className="rounded-card-lg border border-primary-100 bg-primary-50/70 px-4 py-3 text-sm dark:border-primary-500/20 dark:bg-primary-500/5">
                    <p className="font-semibold text-(--app-text)">Información necesaria</p>
                    <p className="mt-1 text-xs leading-5 text-(--app-text-muted)">{tenantKindRequirementSummary[requestedTenantKind].join(' · ')}</p>
                  </div>
                  <label className="space-y-2 text-sm font-medium text-(--app-text)">
                    <RequestFieldLabel label={getTenantNameLabel(requestedTenantKind)} help="Es el nombre que verán candidatos y colaboradores." />
                    <Input autoComplete="organization" placeholder="Ej. ASI República Dominicana" {...form.register('requestedCompanyName')} />
                    <p className="text-xs text-rose-600 dark:text-rose-300">{form.formState.errors.requestedCompanyName?.message}</p>
                  </label>
                  <label className="space-y-2 text-sm font-medium text-(--app-text)">
                    <RequestFieldLabel label={getLegalNameLabel(requestedTenantKind)} help="Escribe el nombre tal como aparece en los documentos oficiales." />
                    <Input placeholder="Ej. ASI República Dominicana, SRL" {...form.register('requestedCompanyLegalName')} />
                    <p className="text-xs text-rose-600 dark:text-rose-300">{form.formState.errors.requestedCompanyLegalName?.message}</p>
                  </label>
                  <label className="space-y-2 text-sm font-medium text-(--app-text) sm:col-span-2">
                    <RequestFieldLabel label="Dirección de tu espacio" help="Será la dirección corta con la que tu equipo identificará el espacio de la organización. Usa minúsculas y guiones." />
                    <div className="flex rounded-card border border-(--app-border) bg-(--app-surface-elevated) focus-within:border-primary-400 focus-within:ring-2 focus-within:ring-(--app-ring)">
                      <span className="flex items-center border-r border-(--app-border) px-3 text-sm text-(--app-text-muted)">asi.do/</span>
                      <Input className="border-0 shadow-none focus:ring-0" placeholder="asi-republica-dominicana" {...form.register('requestedTenantSlug')} />
                    </div>
                    <p className="text-xs text-rose-600 dark:text-rose-300">{form.formState.errors.requestedTenantSlug?.message}</p>
                  </label>
                </div>
              </Card>

              <Card className="p-4 sm:p-6">
                <SectionHeading
                  icon={Globe2}
                  eyebrow="Paso 2"
                  title="Contacto y presencia digital"
                  description="Indica cómo podemos contactar a la organización y validar su presencia."
                />
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <label className="space-y-2 text-sm font-medium text-(--app-text)">
                    <RequestFieldLabel label="Sitio web" help="Opcional. Ayuda a conocer y validar públicamente tu organización." />
                    <Input type="url" inputMode="url" placeholder="https://empresa.com" {...form.register('companyWebsiteUrl')} />
                    <p className="text-xs text-rose-600 dark:text-rose-300">{form.formState.errors.companyWebsiteUrl?.message}</p>
                  </label>
                  <label className="space-y-2 text-sm font-medium text-(--app-text)">
                    <RequestFieldLabel label="Correo de la organización" help="Usaremos este correo si necesitamos confirmar algún dato de la solicitud." />
                    <Input type="email" autoComplete="email" placeholder="talento@empresa.com" {...form.register('companyEmail')} />
                    <p className="text-xs text-rose-600 dark:text-rose-300">{form.formState.errors.companyEmail?.message}</p>
                  </label>
                  <label className="space-y-2 text-sm font-medium text-(--app-text)">
                    <span>Teléfono de contacto</span>
                    <Input type="tel" inputMode="tel" autoComplete="tel" placeholder="+1 809 000 0000" {...form.register('companyPhone')} />
                  </label>
                  <label className="space-y-2 text-sm font-medium text-(--app-text)">
                    <span>País</span>
                    <CountryCodeSelect {...form.register('companyCountryCode')} />
                    <p className="text-xs text-rose-600 dark:text-rose-300">{form.formState.errors.companyCountryCode?.message}</p>
                  </label>
                </div>
              </Card>

              <Card className="p-4 sm:p-6">
                <SectionHeading
                  icon={Mail}
                  eyebrow="Paso 3"
                  title="Presentación de la empresa"
                  description="Ayúdanos a entender qué hace la organización y cómo utilizará ASI DO para reclutar."
                />
                <div className="mt-5 space-y-4">
                  <label className="space-y-2 text-sm font-medium text-(--app-text)">
                    <RequestFieldLabel label="Acerca de la organización" help="Incluye su actividad principal, el tipo de talento que busca y quién gestionará las oportunidades." />
                    <Textarea className="min-h-32" placeholder="Ej. Somos una organización dedicada a… Buscamos incorporar talento para…" {...form.register('companyDescription')} />
                    <p className="text-xs text-rose-600 dark:text-rose-300">{form.formState.errors.companyDescription?.message}</p>
                  </label>

                  {requestedTenantKind === 'ministry' || requestedTenantKind === 'project' ? (
                    <label className="space-y-2 text-sm font-medium text-(--app-text)">
                      <RequestFieldLabel label="Alcance de la organización" help="Indica las regiones, comunidades o grupos a los que sirve." />
                      <Textarea placeholder="Países, regiones, población atendida o alcance previsto." {...form.register('operatingScope')} />
                      <p className="text-xs text-rose-600 dark:text-rose-300">{form.formState.errors.operatingScope?.message}</p>
                    </label>
                  ) : null}
                  {requestedTenantKind === 'project' || requestedTenantKind === 'field' ? (
                    <label className="space-y-2 text-sm font-medium text-(--app-text)">
                      <RequestFieldLabel label="Entidad que respalda la solicitud" help="Nombre de la organización que patrocina o supervisa esta iniciativa." />
                      <Input placeholder="Ej. Asociación Dominicana…" {...form.register('sponsoringEntity')} />
                      <p className="text-xs text-rose-600 dark:text-rose-300">{form.formState.errors.sponsoringEntity?.message}</p>
                    </label>
                  ) : null}
                  {requestedTenantKind === 'field' ? (
                    <label className="space-y-2 text-sm font-medium text-(--app-text)">
                      <RequestFieldLabel label="Campo o región" help="Indica el área geográfica que representa la solicitud." />
                      <Input placeholder="Ej. Región Norte" {...form.register('fieldRegion')} />
                      <p className="text-xs text-rose-600 dark:text-rose-300">{form.formState.errors.fieldRegion?.message}</p>
                    </label>
                  ) : null}
                  {requestedTenantKind === 'generic_profile' ? (
                    <label className="space-y-2 text-sm font-medium text-(--app-text)">
                      <RequestFieldLabel label="Evolución prevista" help="Explica cómo esta iniciativa podría formalizarse más adelante." />
                      <Textarea placeholder="Describe cómo podría convertirse en una empresa, ministerio o proyecto formal." {...form.register('conversionIntent')} />
                      <p className="text-xs text-rose-600 dark:text-rose-300">{form.formState.errors.conversionIntent?.message}</p>
                    </label>
                  ) : null}
                </div>
              </Card>

              <Card className="p-4 sm:p-6">
                <SectionHeading
                  icon={FileLock2}
                  eyebrow="Paso 4"
                  title="Verificación de la empresa"
                  description="Los archivos se mantienen privados y se utilizan únicamente para revisar esta solicitud."
                />
                <div className="mt-5 grid gap-5 sm:grid-cols-2">
                  <FilePicker
                    id="company-logo"
                    title="Logo de la organización"
                    description={`SVG, PNG, JPG o WEBP · Máximo ${MAX_UPLOAD_SIZE_LABEL}`}
                    accept="image/png,image/jpeg,image/webp,image/svg+xml,.svg"
                    file={companyLogoFile}
                    isPreparing={isPreparingCompanyLogo}
                    error={companyLogoFileError}
                    onChange={(file) => void handleCompanyLogoChange(file)}
                  />
                  <FilePicker
                    id="verification-document"
                    title="Documento de respaldo"
                    description={`Registro mercantil, documento fiscal o equivalente · PDF o imagen · Máximo ${MAX_UPLOAD_SIZE_LABEL}`}
                    accept="application/pdf,image/png,image/jpeg,image/webp"
                    file={verificationDocumentFile}
                    required
                    isPreparing={isPreparingVerificationDocument}
                    error={verificationDocumentFileError}
                    onChange={(file) => void handleVerificationDocumentChange(file)}
                  />
                </div>
              </Card>

              <div className="sticky bottom-4 z-10 rounded-panel border border-(--app-border) bg-(--app-surface-elevated)/95 p-3 shadow-[0_16px_44px_rgba(10,18,36,0.14)] backdrop-blur sm:flex sm:items-center sm:justify-between sm:gap-4 sm:p-4">
                <div className="mb-3 flex items-center gap-3 sm:mb-0">
                  <CheckCircle2 className="size-5 shrink-0 text-primary-700 dark:text-primary-300" aria-hidden="true" />
                  <p className="text-xs leading-5 text-(--app-text-muted)">Al enviar, confirmas que la información pertenece a la organización que representas.</p>
                </div>
                <Button className="w-full shrink-0 sm:w-auto" disabled={submitMutation.isPending || isPreparingCompanyLogo || isPreparingVerificationDocument} type="submit">
                  {submitMutation.isPending ? <><Spinner size="sm" /> Enviando…</> : <>Enviar solicitud <ArrowRight className="size-4" aria-hidden="true" /></>}
                </Button>
              </div>
            </form>
          )}
        </div>

        <aside className="grid gap-4 xl:sticky xl:top-24">
          {!hasOpenRequest ? (
            <Card className="p-4 sm:p-5">
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle>Progreso de la solicitud</CardTitle>
                  <span className="text-sm font-semibold text-primary-700 dark:text-primary-300">{requestProgress}%</span>
                </div>
                <CardDescription>Completa los datos esenciales antes de enviarla.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800" aria-label={`${requestProgress}% completado`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={requestProgress}>
                  <div className="h-full rounded-full bg-primary-600 transition-[width] duration-300" style={{ width: `${requestProgress}%` }} />
                </div>
                <div className="mt-4 space-y-3 text-sm">
                  <p className="flex items-center gap-2 text-(--app-text-muted)"><CheckCircle2 className="size-4 text-primary-600" aria-hidden="true" /> Información de la organización</p>
                  <p className="flex items-center gap-2 text-(--app-text-muted)"><FileLock2 className="size-4 text-primary-600" aria-hidden="true" /> Un documento de respaldo</p>
                  <p className="flex items-center gap-2 text-(--app-text-muted)"><Clock3 className="size-4 text-primary-600" aria-hidden="true" /> Revisión antes de la activación</p>
                </div>
              </CardContent>
            </Card>
          ) : null}

          <Card className="p-4 sm:p-5">
            <CardHeader>
              <span className="flex size-9 items-center justify-center rounded-full bg-(--app-surface-muted) text-(--app-text-muted)"><History className="size-4" aria-hidden="true" /></span>
              <CardTitle className="pt-2">Historial de solicitudes</CardTitle>
              <CardDescription>Consulta el estado y las observaciones de cada revisión.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {myRequestsQuery.isPending ? (
                <div className="flex items-center justify-center gap-2 rounded-card-lg border border-(--app-border) px-4 py-6 text-sm text-(--app-text-muted)">
                  <Spinner size="sm" /> Consultando historial…
                </div>
              ) : myRequestsQuery.isError ? (
                <div className="rounded-card-lg border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-950/30 dark:text-rose-200">
                  No pudimos consultar tus solicitudes. Intenta nuevamente en unos minutos.
                </div>
              ) : requests.length === 0 ? (
                <div className="rounded-card-lg border border-dashed border-(--app-border) px-4 py-6 text-center">
                  <p className="text-sm font-medium text-(--app-text)">Todavía no hay solicitudes</p>
                  <p className="mt-1 text-xs leading-5 text-(--app-text-muted)">Cuando envíes la primera, podrás seguir su avance desde aquí.</p>
                </div>
              ) : requests.map((request) => (
                <div key={request.id} className="rounded-card-lg border border-(--app-border) bg-(--app-surface-muted) p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-(--app-text)">{request.requested_company_name}</p>
                      <p className="mt-1 text-xs text-(--app-text-muted)">{getTenantKindLabel(request.requested_tenant_kind)} · Enviada {new Date(request.submitted_at).toLocaleDateString()}</p>
                    </div>
                    <RecruiterRequestStatusBadge status={request.status} />
                  </div>
                  {request.review_notes ? <p className="mt-3 rounded-card bg-(--app-surface-elevated) px-3 py-2 text-sm text-(--app-text-muted)">{request.review_notes}</p> : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {request.company_logo_path ? <Button variant="outline" onClick={() => void openPrivateAsset(request.company_logo_path!)}>Ver logo</Button> : null}
                    {request.verification_document_path ? <Button variant="outline" onClick={() => void openPrivateAsset(request.verification_document_path!)}>Ver documento</Button> : null}
                    {request.status === 'approved' && request.approved_tenant_id ? <Button onClick={() => void navigate(surfacePaths.workspace.root)}>Gestionar oportunidades</Button> : null}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {approvedRequest ? (
            <Card className="border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/30 dark:bg-emerald-950/30 sm:p-5">
              <CheckCircle2 className="size-6 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />
              <CardTitle className="mt-3">Tu empresa ya puede reclutar</CardTitle>
              <CardDescription className="mt-1">Publica oportunidades y organiza candidatos desde el panel de tu empresa.</CardDescription>
              <Button className="mt-4 w-full" onClick={() => void navigate(surfacePaths.workspace.root)}>Ir al panel de reclutamiento</Button>
            </Card>
          ) : null}
        </aside>
      </div>
      <ImageCropDialog
        open={Boolean(pendingCompanyLogoCropFile)}
        file={pendingCompanyLogoCropFile}
        title="Encuadrar logo"
        description="Ajusta cómo se verá la imagen de tu empresa."
        shape="rounded"
        outputWidth={768}
        outputHeight={768}
        confirmLabel="Usar logo"
        onConfirm={confirmCompanyLogoCrop}
        onCancel={() => setPendingCompanyLogoCropFile(null)}
      />
    </div>
  )
}
