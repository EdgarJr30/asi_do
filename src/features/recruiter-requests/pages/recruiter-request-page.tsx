import { useState } from 'react'

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm, useWatch } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { useAppSession } from '@/app/providers/app-session-provider'
import { surfacePaths } from '@/app/router/surface-paths'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
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
import { captureClientError } from '@/lib/errors/client-error-logger'
import {
  MAX_UPLOAD_SIZE_LABEL,
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

export function RecruiterRequestPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const session = useAppSession()
  const [companyLogoFile, setCompanyLogoFile] = useState<File | null>(null)
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

  const submitMutation = useMutation({
    mutationFn: async (values: RecruiterRequestValues) => {
      if (!session.authUser) {
        throw new Error('Debes iniciar sesion para enviar esta solicitud.')
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
        description: 'Tu empresa ya quedo en cola de revision administrativa.'
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
        userMessage: 'No pudimos enviar tu solicitud recruiter.',
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

  async function handleCompanyLogoChange(file: File | null) {
    setCompanyLogoFileError(null)
    setCompanyLogoFile(file)

    if (!file) {
      return
    }

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
        userMessage: 'No pudimos abrir el archivo privado.',
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

  return (
    <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
      <Card className="bg-(--app-surface-muted)">
        <CardHeader>
          <Badge variant="soft">Recruiter request</Badge>
          <CardTitle>Solicita la validación de tu tenant</CardTitle>
          <CardDescription>
            El admin revisa el tipo de tenant, sus datos obligatorios y los archivos privados antes de habilitar tu acceso operativo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hasOpenRequest ? (
            <div className="rounded-3xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
              Ya tienes una solicitud abierta. Puedes seguir su estado en la columna derecha mientras el equipo admin la revisa.
            </div>
          ) : (
            <form className="space-y-4" onSubmit={(event) => void form.handleSubmit((values) => submitMutation.mutate(values))(event)}>
              <div className="grid gap-4 sm:grid-cols-[0.85fr_1.15fr]">
                <label className="space-y-2 text-sm font-medium text-zinc-800 dark:text-zinc-100">
                  <span>Tipo de tenant</span>
                  <Select {...form.register('requestedTenantKind')}>
                    {tenantKindOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </label>

                <div className="rounded-3xl border border-zinc-200 bg-white/75 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950/70 dark:text-zinc-300">
                  <p className="font-semibold text-zinc-900 dark:text-zinc-50">Mínimos para {getTenantKindLabel(requestedTenantKind)}</p>
                  <ul className="mt-2 space-y-1">
                    {tenantKindRequirementSummary[requestedTenantKind].map((item) => (
                      <li key={item}>- {item}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <label className="space-y-2 text-sm font-medium text-zinc-800 dark:text-zinc-100">
                <span>{getTenantNameLabel(requestedTenantKind)}</span>
                <Input placeholder="ASI Rep. Dominicana" {...form.register('requestedCompanyName')} />
                <p className="text-xs text-rose-600 dark:text-rose-300">{form.formState.errors.requestedCompanyName?.message}</p>
              </label>

              <label className="space-y-2 text-sm font-medium text-zinc-800 dark:text-zinc-100">
                <span>{getLegalNameLabel(requestedTenantKind)}</span>
                <Input placeholder="ASI Republica Dominicana SRL" {...form.register('requestedCompanyLegalName')} />
                <p className="text-xs text-rose-600 dark:text-rose-300">{form.formState.errors.requestedCompanyLegalName?.message}</p>
              </label>

              <label className="space-y-2 text-sm font-medium text-zinc-800 dark:text-zinc-100">
                <span>Slug del tenant</span>
                <Input placeholder="asi-do-dr" {...form.register('requestedTenantSlug')} />
                <p className="text-xs text-rose-600 dark:text-rose-300">{form.formState.errors.requestedTenantSlug?.message}</p>
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2 text-sm font-medium text-zinc-800 dark:text-zinc-100">
                  <span>Website</span>
                  <Input placeholder="https://empresa.com" {...form.register('companyWebsiteUrl')} />
                  <p className="text-xs text-rose-600 dark:text-rose-300">{form.formState.errors.companyWebsiteUrl?.message}</p>
                </label>

                <label className="space-y-2 text-sm font-medium text-zinc-800 dark:text-zinc-100">
                  <span>Email corporativo</span>
                  <Input placeholder="jobs@empresa.com" {...form.register('companyEmail')} />
                  <p className="text-xs text-rose-600 dark:text-rose-300">{form.formState.errors.companyEmail?.message}</p>
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2 text-sm font-medium text-zinc-800 dark:text-zinc-100">
                  <span>Telefono</span>
                  <Input placeholder="+1 809 000 0000" {...form.register('companyPhone')} />
                </label>

                <label className="space-y-2 text-sm font-medium text-zinc-800 dark:text-zinc-100">
                  <span>Pais</span>
                  <Input maxLength={2} placeholder="DO" {...form.register('companyCountryCode')} />
                  <p className="text-xs text-rose-600 dark:text-rose-300">{form.formState.errors.companyCountryCode?.message}</p>
                </label>
              </div>

              <label className="space-y-2 text-sm font-medium text-zinc-800 dark:text-zinc-100">
                <span>Descripción operativa</span>
                <Textarea placeholder="Qué hace este tenant, cómo operará en ASI y por qué necesita acceso..." {...form.register('companyDescription')} />
                <p className="text-xs text-rose-600 dark:text-rose-300">{form.formState.errors.companyDescription?.message}</p>
              </label>

              {requestedTenantKind === 'ministry' || requestedTenantKind === 'project' ? (
                <label className="space-y-2 text-sm font-medium text-zinc-800 dark:text-zinc-100">
                  <span>Alcance operativo</span>
                  <Textarea
                    placeholder="Países, regiones, población atendida o alcance previsto."
                    {...form.register('operatingScope')}
                  />
                  <p className="text-xs text-rose-600 dark:text-rose-300">{form.formState.errors.operatingScope?.message}</p>
                </label>
              ) : null}

              {requestedTenantKind === 'project' || requestedTenantKind === 'field' ? (
                <label className="space-y-2 text-sm font-medium text-zinc-800 dark:text-zinc-100">
                  <span>Entidad patrocinadora o supervisora</span>
                  <Input placeholder="ASI, ministerio, asociación, campo..." {...form.register('sponsoringEntity')} />
                  <p className="text-xs text-rose-600 dark:text-rose-300">{form.formState.errors.sponsoringEntity?.message}</p>
                </label>
              ) : null}

              {requestedTenantKind === 'field' ? (
                <label className="space-y-2 text-sm font-medium text-zinc-800 dark:text-zinc-100">
                  <span>Campo o región</span>
                  <Input placeholder="Unión Dominicana, Norte, región este..." {...form.register('fieldRegion')} />
                  <p className="text-xs text-rose-600 dark:text-rose-300">{form.formState.errors.fieldRegion?.message}</p>
                </label>
              ) : null}

              {requestedTenantKind === 'generic_profile' ? (
                <label className="space-y-2 text-sm font-medium text-zinc-800 dark:text-zinc-100">
                  <span>Intención de conversión</span>
                  <Textarea
                    placeholder="Describe cómo este perfil podría convertirse luego en empresa, ministerio o proyecto formal."
                    {...form.register('conversionIntent')}
                  />
                  <p className="text-xs text-rose-600 dark:text-rose-300">{form.formState.errors.conversionIntent?.message}</p>
                </label>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2 text-sm font-medium text-zinc-800 dark:text-zinc-100">
                  <span>Logo temporal para revision</span>
                  <Input
                    accept="image/png,image/jpeg,image/webp,image/svg+xml,.svg"
                    type="file"
                    onChange={(event) => void handleCompanyLogoChange(event.target.files?.[0] ?? null)}
                  />
                  <p className="text-xs text-zinc-500">
                    Opcional. Acepta SVG, PNG, JPG y WEBP. Las imagenes raster se comprimen antes de subirlas y el limite es {MAX_UPLOAD_SIZE_LABEL}.
                  </p>
                  <p className="text-xs text-zinc-500">Se guarda privado durante la revision.</p>
                  {isPreparingCompanyLogo ? (
                    <p className="text-xs text-zinc-500">Optimizando logo antes de subir...</p>
                  ) : null}
                  {companyLogoFileError ? (
                    <p className="text-xs text-rose-600 dark:text-rose-300">{companyLogoFileError}</p>
                  ) : null}
                </label>

                <label className="space-y-2 text-sm font-medium text-zinc-800 dark:text-zinc-100">
                  <span>Documento de verificacion</span>
                  <Input
                    accept="application/pdf,image/png,image/jpeg,image/webp"
                    type="file"
                    onChange={(event) => void handleVerificationDocumentChange(event.target.files?.[0] ?? null)}
                  />
                  <p className="text-xs text-zinc-500">
                    Requerido. Acepta PDF, PNG, JPG y WEBP. Las imagenes se optimizan antes de subirlas y el limite es {MAX_UPLOAD_SIZE_LABEL}.
                  </p>
                  <p className="text-xs text-zinc-500">Solo el solicitante y reviewers admin pueden verlo.</p>
                  {isPreparingVerificationDocument ? (
                    <p className="text-xs text-zinc-500">Preparando documento antes de subir...</p>
                  ) : null}
                  {verificationDocumentFileError ? (
                    <p className="text-xs text-rose-600 dark:text-rose-300">{verificationDocumentFileError}</p>
                  ) : null}
                </label>
              </div>

              <Button className="w-full" disabled={submitMutation.isPending} type="submit">
                {submitMutation.isPending ? 'Enviando solicitud...' : 'Enviar solicitud recruiter'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Mis solicitudes</CardTitle>
            <CardDescription>Historial completo de revisiones sobre tu empresa.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {requests.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-zinc-300 px-4 py-6 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                Aun no has enviado solicitudes recruiter.
              </div>
            ) : (
              requests.map((request) => {
                const companyLogoPath = request.company_logo_path
                const verificationDocumentPath = request.verification_document_path

                return (
                  <div key={request.id} className="rounded-3xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/70">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{request.requested_company_name}</p>
                        <p className="text-xs text-zinc-500">
                          {getTenantKindLabel(request.requested_tenant_kind)} · {request.requested_tenant_slug}
                        </p>
                      </div>
                      <RecruiterRequestStatusBadge status={request.status} />
                    </div>

                    <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
                      Enviada {new Date(request.submitted_at).toLocaleString()}.
                    </p>

                    {request.review_notes ? (
                      <p className="mt-2 rounded-2xl bg-white px-3 py-2 text-sm text-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
                        {request.review_notes}
                      </p>
                    ) : null}

                    <div className="mt-3 flex flex-wrap gap-2">
                      {companyLogoPath ? (
                        <Button variant="outline" onClick={() => void openPrivateAsset(companyLogoPath)}>
                          Abrir logo
                        </Button>
                      ) : null}
                      {verificationDocumentPath ? (
                        <Button variant="outline" onClick={() => void openPrivateAsset(verificationDocumentPath)}>
                          Abrir documento
                        </Button>
                      ) : null}
                      {request.status === 'approved' && request.approved_tenant_id ? (
                        <Button onClick={() => void navigate(surfacePaths.workspace.root)}>Ir al workspace</Button>
                      ) : null}
                    </div>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>

        {approvedRequest ? (
          <Card>
            <CardHeader>
              <Badge>Aprobada</Badge>
              <CardTitle>Tu tenant ya fue creado</CardTitle>
              <CardDescription>
                La aprobacion activa tu primer workspace y te asigna como `tenant_owner`.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" onClick={() => void navigate(surfacePaths.workspace.root)}>
                Abrir workspace
              </Button>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  )
}
