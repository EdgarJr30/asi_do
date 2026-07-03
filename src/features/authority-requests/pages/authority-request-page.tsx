import { useMemo, useState } from 'react'

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, useReducedMotion } from 'motion/react'
import { useForm, useWatch } from 'react-hook-form'
import { AlertCircle, ArrowRight, FileLock2, Inbox, MapPinned, ShieldCheck, UploadCloud } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { useAppSession } from '@/app/providers/app-session-provider'
import { surfacePaths } from '@/app/router/surface-paths'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/page-header'
import { PageLoader } from '@/components/ui/loader'
import { Select } from '@/components/ui/select'
import { SideSheet } from '@/components/ui/side-sheet'
import { StatCard } from '@/components/ui/stat-card'
import { Textarea } from '@/components/ui/textarea'
import {
  consumeAuthorityInvitation,
  createPrivateFileUrl,
  fetchAuthorityHierarchy,
  getAuthorityInvitation,
  listMyPastorAuthorityRequests,
  listMyRegionalAuthorityRequests,
  submitPastorAuthorityRequest,
  submitRegionalAuthorityRequest,
  toErrorMessage,
  uploadPrivateFile,
  type AuthorityInvitationType,
} from '@/features/auth/lib/auth-api'
import {
  pastorAuthorityRequestSchema,
  regionalAuthorityRequestSchema,
  type PastorAuthorityRequestValues,
  type RegionalAuthorityRequestValues,
} from '@/features/auth/lib/auth-schemas'
import { captureClientError } from '@/lib/errors/client-error-logger'
import {
  MAX_UPLOAD_SIZE_LABEL,
  prepareUploadFile,
  RECRUITER_DOCUMENT_MIME_TYPES,
  UploadConstraintError,
} from '@/lib/uploads/media'
import { cardReveal, gridStagger, pageStagger } from '@/shared/ui/card-motion'
import type { Json } from '@/shared/types/database'

const MY_PASTOR_REQUESTS_QUERY_KEY = ['authority-requests', 'pastor', 'mine'] as const
const MY_REGIONAL_REQUESTS_QUERY_KEY = ['authority-requests', 'regional', 'mine'] as const
const AUTHORITY_HIERARCHY_QUERY_KEY = ['authority-hierarchy'] as const
const EMPTY_ITEMS: [] = []

function getReviewStatusLabel(status: string) {
  switch (status) {
    case 'submitted':
      return 'Enviada'
    case 'under_review':
      return 'En revisión'
    case 'needs_more_info':
      return 'Más información'
    case 'approved':
      return 'Aprobada'
    case 'rejected':
      return 'Rechazada'
    default:
      return status
  }
}

function getReviewStatusClassName(status: string) {
  switch (status) {
    case 'approved':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/12 dark:text-emerald-200'
    case 'rejected':
      return 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/25 dark:bg-rose-500/12 dark:text-rose-200'
    case 'needs_more_info':
      return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/25 dark:bg-amber-500/12 dark:text-amber-200'
    case 'under_review':
      return 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/25 dark:bg-sky-500/12 dark:text-sky-200'
    default:
      return ''
  }
}

export function AuthorityRequestPage() {
  const { token = '' } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const session = useAppSession()
  const shouldReduceMotion = useReducedMotion()

  const [openForm, setOpenForm] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [pastorIdentityFile, setPastorIdentityFile] = useState<File | null>(null)
  const [pastorIdentityFileError, setPastorIdentityFileError] = useState<string | null>(null)
  const [regionalIdentityFile, setRegionalIdentityFile] = useState<File | null>(null)
  const [regionalIdentityFileError, setRegionalIdentityFileError] = useState<string | null>(null)
  const [regionalAppointmentFile, setRegionalAppointmentFile] = useState<File | null>(null)
  const [regionalAppointmentFileError, setRegionalAppointmentFileError] = useState<string | null>(null)

  const invitationQuery = useQuery({
    queryKey: ['authority-invitation', token],
    queryFn: async () => getAuthorityInvitation(token),
    enabled: Boolean(token) && session.authUser !== null,
  })
  const invitation = invitationQuery.data ?? null
  const authorityType: AuthorityInvitationType = invitation?.authorityType ?? 'pastoral'

  const pastorForm = useForm<PastorAuthorityRequestValues>({
    resolver: zodResolver(pastorAuthorityRequestSchema),
    defaultValues: {
      identityDocumentNumber: '',
      firstNames: session.profile?.full_name?.split(' ').slice(0, -1).join(' ') || '',
      lastNames: session.profile?.full_name?.split(' ').slice(-1).join(' ') || '',
      phoneNumber: session.profile?.phone || '',
      unionId: '',
      associationId: '',
      districtId: '',
      churchIds: [],
      pastorStatusAttestation: false,
      notes: '',
    },
  })

  const regionalForm = useForm<RegionalAuthorityRequestValues>({
    resolver: zodResolver(regionalAuthorityRequestSchema),
    defaultValues: {
      identityDocumentNumber: '',
      firstNames: session.profile?.full_name?.split(' ').slice(0, -1).join(' ') || '',
      lastNames: session.profile?.full_name?.split(' ').slice(-1).join(' ') || '',
      phoneNumber: session.profile?.phone || '',
      adminScopeType: 'association',
      unionId: '',
      associationId: '',
      positionTitle: '',
      notes: '',
    },
  })

  const hierarchyQuery = useQuery({
    queryKey: AUTHORITY_HIERARCHY_QUERY_KEY,
    queryFn: fetchAuthorityHierarchy,
    enabled: session.authUser !== null,
  })

  const pastorRequestsQuery = useQuery({
    queryKey: MY_PASTOR_REQUESTS_QUERY_KEY,
    queryFn: async () => (session.authUser ? listMyPastorAuthorityRequests(session.authUser.id) : []),
    enabled: session.authUser !== null,
  })

  const regionalRequestsQuery = useQuery({
    queryKey: MY_REGIONAL_REQUESTS_QUERY_KEY,
    queryFn: async () => (session.authUser ? listMyRegionalAuthorityRequests(session.authUser.id) : []),
    enabled: session.authUser !== null,
  })

  const unions = hierarchyQuery.data?.unions ?? EMPTY_ITEMS
  const associations = hierarchyQuery.data?.associations ?? EMPTY_ITEMS
  const districts = hierarchyQuery.data?.districts ?? EMPTY_ITEMS
  const churches = hierarchyQuery.data?.churches ?? EMPTY_ITEMS

  const selectedPastorUnionId = useWatch({ control: pastorForm.control, name: 'unionId' })
  const selectedPastorAssociationId = useWatch({ control: pastorForm.control, name: 'associationId' })
  const selectedPastorDistrictId = useWatch({ control: pastorForm.control, name: 'districtId' })
  const selectedPastorChurchIds = useWatch({ control: pastorForm.control, name: 'churchIds' }) ?? []
  const pastorStatusAttestation = useWatch({ control: pastorForm.control, name: 'pastorStatusAttestation' })
  const selectedRegionalScopeType = useWatch({ control: regionalForm.control, name: 'adminScopeType' })
  const selectedRegionalUnionId = useWatch({ control: regionalForm.control, name: 'unionId' })
  const selectedRegionalAssociationId = useWatch({ control: regionalForm.control, name: 'associationId' })

  const filteredAssociations = useMemo(
    () => associations.filter((item) => item.union_id === selectedPastorUnionId),
    [associations, selectedPastorUnionId]
  )
  const filteredDistricts = useMemo(
    () => districts.filter((item) => item.association_id === selectedPastorAssociationId),
    [districts, selectedPastorAssociationId]
  )
  const filteredChurches = useMemo(
    () => churches.filter((item) => item.district_id === selectedPastorDistrictId),
    [churches, selectedPastorDistrictId]
  )
  const filteredRegionalAssociations = useMemo(
    () => associations.filter((item) => item.union_id === selectedRegionalUnionId),
    [associations, selectedRegionalUnionId]
  )

  const pastorMutation = useMutation({
    mutationFn: async (values: PastorAuthorityRequestValues) => {
      if (!session.authUser) {
        throw new Error('Debes iniciar sesión para enviar esta solicitud.')
      }
      if (!pastorIdentityFile) {
        throw new Error('Adjunta la cédula o documento de identidad.')
      }
      const identityDocumentFilePath = await uploadPrivateFile({
        bucket: 'verification-documents',
        ownerUserId: session.authUser.id,
        file: pastorIdentityFile,
        prefix: 'pastor-authority-identity',
      })
      const created = await submitPastorAuthorityRequest({
        requesterUserId: session.authUser.id,
        identityDocumentNumber: values.identityDocumentNumber,
        identityDocumentFilePath,
        firstNames: values.firstNames,
        lastNames: values.lastNames,
        phoneNumber: values.phoneNumber,
        unionId: values.unionId,
        associationId: values.associationId,
        districtId: values.districtId,
        churchIds: values.churchIds,
        pastorStatusAttestation: values.pastorStatusAttestation,
        notes: values.notes,
        submittedFormSnapshot: values as Json,
      })
      await consumeAuthorityInvitation(token, created.id)
      return created
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: MY_PASTOR_REQUESTS_QUERY_KEY })
      toast.success('Solicitud pastoral enviada', {
        description: 'Tu validación pastoral quedó en cola de revisión administrativa.',
      })
      setPastorIdentityFile(null)
      setPastorIdentityFileError(null)
      setOpenForm(false)
      setSubmitted(true)
    },
    onError: async (error) => {
      await captureClientError({
        source: 'authority-request.pastor.submit',
        route: surfacePaths.candidate.authorityRequest,
        userId: session.authUser?.id ?? null,
        userMessage: 'No pudimos enviar tu solicitud pastoral.',
        error,
      })
      toast.error('No pudimos enviar la solicitud pastoral', { description: toErrorMessage(error) })
    },
  })

  const regionalMutation = useMutation({
    mutationFn: async (values: RegionalAuthorityRequestValues) => {
      if (!session.authUser) {
        throw new Error('Debes iniciar sesión para enviar esta solicitud.')
      }
      if (!regionalIdentityFile) {
        throw new Error('Adjunta la cédula o documento de identidad.')
      }
      if (!regionalAppointmentFile) {
        throw new Error('Adjunta el documento de nombramiento o autorización.')
      }
      const [identityDocumentFilePath, appointmentDocumentFilePath] = await Promise.all([
        uploadPrivateFile({
          bucket: 'verification-documents',
          ownerUserId: session.authUser.id,
          file: regionalIdentityFile,
          prefix: 'regional-authority-identity',
        }),
        uploadPrivateFile({
          bucket: 'verification-documents',
          ownerUserId: session.authUser.id,
          file: regionalAppointmentFile,
          prefix: 'regional-authority-appointment',
        }),
      ])
      const created = await submitRegionalAuthorityRequest({
        requesterUserId: session.authUser.id,
        identityDocumentNumber: values.identityDocumentNumber,
        identityDocumentFilePath,
        firstNames: values.firstNames,
        lastNames: values.lastNames,
        phoneNumber: values.phoneNumber,
        adminScopeType: values.adminScopeType,
        unionId: values.unionId,
        associationId: values.adminScopeType === 'association' ? values.associationId : null,
        positionTitle: values.positionTitle,
        appointmentDocumentFilePath,
        notes: values.notes,
        submittedFormSnapshot: values as Json,
      })
      await consumeAuthorityInvitation(token, created.id)
      return created
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: MY_REGIONAL_REQUESTS_QUERY_KEY })
      toast.success('Solicitud regional enviada', {
        description: 'Tu validación regional quedó en cola de revisión administrativa.',
      })
      setRegionalIdentityFile(null)
      setRegionalIdentityFileError(null)
      setRegionalAppointmentFile(null)
      setRegionalAppointmentFileError(null)
      setOpenForm(false)
      setSubmitted(true)
    },
    onError: async (error) => {
      await captureClientError({
        source: 'authority-request.regional.submit',
        route: surfacePaths.candidate.authorityRequest,
        userId: session.authUser?.id ?? null,
        userMessage: 'No pudimos enviar tu solicitud regional.',
        error,
      })
      toast.error('No pudimos enviar la solicitud regional', { description: toErrorMessage(error) })
    },
  })

  const isSubmitting = pastorMutation.isPending || regionalMutation.isPending

  async function prepareDocumentFile(
    file: File | null,
    handlers: { setFile: (file: File | null) => void; setError: (message: string | null) => void; source: string }
  ) {
    handlers.setError(null)
    handlers.setFile(file)
    if (!file) {
      return
    }
    try {
      const preparedFile = await prepareUploadFile(file, {
        acceptedMimeTypes: RECRUITER_DOCUMENT_MIME_TYPES,
        acceptedFormatsLabel: 'PDF, PNG, JPG o WEBP',
        fieldLabel: 'El documento',
        maxImageDimension: 2200,
      })
      handlers.setFile(preparedFile)
    } catch (error) {
      const message = error instanceof UploadConstraintError ? error.userMessage : toErrorMessage(error)
      handlers.setFile(null)
      handlers.setError(message)
      toast.error('No pudimos preparar el documento', { description: message })
      await captureClientError({
        source: handlers.source,
        route: surfacePaths.candidate.authorityRequest,
        userId: session.authUser?.id ?? null,
        userMessage: message,
        error,
        metadata: { fileName: file.name, fileSizeBytes: file.size, fileType: file.type },
      })
    }
  }

  async function openPrivateAsset(path: string) {
    try {
      const signedUrl = await createPrivateFileUrl('verification-documents', path)
      window.open(signedUrl, '_blank', 'noopener,noreferrer')
    } catch (error) {
      toast.error('No pudimos abrir el archivo', { description: toErrorMessage(error) })
    }
  }

  // ── Estados de acceso ────────────────────────────────────────────────────────
  if (invitationQuery.isLoading) {
    return <PageLoader label="Validando tu invitación" hint="Verificando el enlace de autorización" />
  }

  if (!invitation && !submitted) {
    return (
      <Card className="mx-auto max-w-xl border-amber-200 bg-amber-50/70 dark:border-amber-500/30 dark:bg-amber-500/10">
        <CardContent className="mt-0 flex flex-col items-center gap-3 py-10 text-center">
          <AlertCircle className="size-8 text-amber-600 dark:text-amber-300" />
          <div>
            <p className="text-base font-semibold text-(--app-text)">Invitación no válida</p>
            <p className="mt-1 text-sm text-(--app-text-muted)">
              Este enlace de autorización no existe, ya fue usado o venció. Solicita uno nuevo a un administrador.
            </p>
          </div>
          <Button variant="outline" className="mt-2 h-10" onClick={() => void navigate(surfacePaths.candidate.home)}>
            Ir a mi panel <ArrowRight className="size-4" />
          </Button>
        </CardContent>
      </Card>
    )
  }

  const requestTypeLabel = authorityType === 'pastoral' ? 'Solicitud pastoral' : 'Solicitud regional'
  const requestTypeTitle =
    authorityType === 'pastoral' ? 'Solicitar validación como pastor' : 'Solicitar validación como administrador regional'
  const requestTypeDescription =
    authorityType === 'pastoral'
      ? 'Habilita avales y autorizaciones dentro de tu distrito o iglesias aprobadas.'
      : 'Cubre alcance de unión o asociación según el nombramiento validado.'

  return (
    <motion.div
      className="space-y-6"
      variants={pageStagger}
      initial={shouldReduceMotion ? false : 'hidden'}
      animate="show"
    >
      <motion.div variants={cardReveal}>
        <PageHeader
          eyebrow="Cuenta · Autorización territorial"
          title="Autorización territorial"
          description="Completa la solicitud que un administrador habilitó para ti. Valida tu autoridad para avalar y autorizar dentro de tu alcance."
        >
          <StatCard label="Almacenamiento privado" value="Seguro" helper="Cédula y nombramientos en storage privado" />
          <StatCard label="Alcance de validación" value="Por jerarquía" helper="Unión, asociación, distrito o iglesias" />
          <StatCard label="Tamaño máximo" value={MAX_UPLOAD_SIZE_LABEL} helper="Por archivo adjunto" />
        </PageHeader>
      </motion.div>

      {submitted ? (
        <motion.div variants={cardReveal}>
          <Card className="border-emerald-200 bg-emerald-50/70 dark:border-emerald-500/30 dark:bg-emerald-500/10">
            <CardContent className="mt-0 flex flex-col items-center gap-3 py-10 text-center">
              <ShieldCheck className="size-8 text-emerald-600 dark:text-emerald-300" />
              <div>
                <p className="text-base font-semibold text-(--app-text)">Solicitud enviada</p>
                <p className="mt-1 text-sm text-(--app-text-muted)">
                  Tu solicitud quedó en cola de revisión administrativa. Te notificaremos el resultado.
                </p>
              </div>
              <Button className="mt-2 h-10" onClick={() => void navigate(surfacePaths.candidate.home)}>
                Ir a mi panel <ArrowRight className="size-4" />
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <motion.div variants={cardReveal}>
          <Card>
            <CardHeader>
              <Badge variant="soft">Solicita una autorización</Badge>
              <CardTitle>{requestTypeLabel}</CardTitle>
              <CardDescription>
                Un administrador te invitó a validar tu autoridad. Completa el formulario para enviar tu solicitud.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <motion.div variants={gridStagger} initial={shouldReduceMotion ? false : 'hidden'} animate="show" className="grid gap-3 sm:grid-cols-3">
                <motion.div variants={cardReveal} className="rounded-card border border-(--app-border) bg-(--app-surface-muted) p-4">
                  <FileLock2 className="size-5 text-primary-600 dark:text-primary-300" />
                  <p className="mt-2 text-sm font-semibold text-(--app-text)">Documentos privados</p>
                  <p className="mt-0.5 text-xs text-(--app-text-muted)">Tu cédula y nombramientos quedan en storage privado.</p>
                </motion.div>
                <motion.div variants={cardReveal} className="rounded-card border border-(--app-border) bg-(--app-surface-muted) p-4">
                  <MapPinned className="size-5 text-primary-600 dark:text-primary-300" />
                  <p className="mt-2 text-sm font-semibold text-(--app-text)">Alcance por jerarquía</p>
                  <p className="mt-0.5 text-xs text-(--app-text-muted)">El alcance se asigna por unión, asociación, distrito o iglesias.</p>
                </motion.div>
                <motion.div variants={cardReveal} className="rounded-card border border-primary-200 bg-primary-50/60 p-4 dark:border-primary-500/25 dark:bg-primary-500/10">
                  <ShieldCheck className="size-5 text-primary-600 dark:text-primary-300" />
                  <p className="mt-2 text-sm font-semibold text-(--app-text)">{requestTypeLabel}</p>
                  <p className="mt-0.5 text-xs text-(--app-text-muted)">{requestTypeDescription}</p>
                  <Button className="mt-3 h-9 w-full" onClick={() => setOpenForm(true)}>
                    Iniciar solicitud <ArrowRight className="size-4" />
                  </Button>
                </motion.div>
              </motion.div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <motion.div variants={cardReveal}>
        <Card>
          <CardHeader>
            <Badge variant="soft">
              <Inbox className="size-3.5" /> Historial
            </Badge>
            <CardTitle>Mis solicitudes enviadas</CardTitle>
            <CardDescription>El historial muestra estado real; los archivos privados se abren con URL firmada.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(pastorRequestsQuery.data ?? []).map((request) => (
              <div key={request.id} className="rounded-card border border-(--app-border) px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-(--app-text)">Solicitud pastoral</p>
                    <p className="text-sm text-(--app-text-muted)">{new Date(request.submitted_at).toLocaleString()}</p>
                  </div>
                  <Badge variant="outline" className={getReviewStatusClassName(request.status)}>
                    {getReviewStatusLabel(request.status)}
                  </Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="outline" className="h-9" onClick={() => void openPrivateAsset(request.identity_document_file_path)}>
                    Abrir cédula
                  </Button>
                </div>
                {request.review_notes ? <p className="mt-3 text-sm text-(--app-text-muted)">{request.review_notes}</p> : null}
              </div>
            ))}

            {(regionalRequestsQuery.data ?? []).map((request) => (
              <div key={request.id} className="rounded-card border border-(--app-border) px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-(--app-text)">Solicitud regional</p>
                    <p className="text-sm text-(--app-text-muted)">{new Date(request.submitted_at).toLocaleString()}</p>
                  </div>
                  <Badge variant="outline" className={getReviewStatusClassName(request.status)}>
                    {getReviewStatusLabel(request.status)}
                  </Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="outline" className="h-9" onClick={() => void openPrivateAsset(request.identity_document_file_path)}>
                    Abrir cédula
                  </Button>
                  <Button variant="outline" className="h-9" onClick={() => void openPrivateAsset(request.appointment_document_file_path)}>
                    Abrir nombramiento
                  </Button>
                </div>
                {request.review_notes ? <p className="mt-3 text-sm text-(--app-text-muted)">{request.review_notes}</p> : null}
              </div>
            ))}

            {(pastorRequestsQuery.data?.length ?? 0) === 0 && (regionalRequestsQuery.data?.length ?? 0) === 0 ? (
              <div className="rounded-card border border-dashed border-(--app-border) px-4 py-10 text-center text-sm text-(--app-text-muted)">
                Aún no tienes solicitudes enviadas.
              </div>
            ) : null}
          </CardContent>
        </Card>
      </motion.div>

      <SideSheet
        open={openForm}
        onClose={() => setOpenForm(false)}
        title={requestTypeTitle}
        description={requestTypeDescription}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" className="h-10" onClick={() => setOpenForm(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button
              className="h-10"
              disabled={isSubmitting}
              onClick={() => {
                if (authorityType === 'pastoral') {
                  void pastorForm.handleSubmit((values) => pastorMutation.mutate(values))()
                } else {
                  void regionalForm.handleSubmit((values) => regionalMutation.mutate(values))()
                }
              }}
            >
              {isSubmitting ? 'Enviando…' : 'Enviar solicitud'}
            </Button>
          </div>
        }
      >
        {authorityType === 'pastoral' ? (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input inputMode="numeric" placeholder="Cédula o documento" {...pastorForm.register('identityDocumentNumber')} />
              <Input type="tel" inputMode="tel" autoComplete="tel" placeholder="Teléfono principal" {...pastorForm.register('phoneNumber')} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input placeholder="Nombres legales" {...pastorForm.register('firstNames')} />
              <Input placeholder="Apellidos legales" {...pastorForm.register('lastNames')} />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Select
                value={selectedPastorUnionId}
                onChange={(event) => {
                  pastorForm.setValue('unionId', event.target.value, { shouldDirty: true, shouldValidate: true })
                  pastorForm.setValue('associationId', '', { shouldDirty: true, shouldValidate: true })
                  pastorForm.setValue('districtId', '', { shouldDirty: true, shouldValidate: true })
                  pastorForm.setValue('churchIds', [], { shouldDirty: true, shouldValidate: true })
                }}
              >
                <option value="">Selecciona la unión</option>
                {unions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
              <Select
                value={selectedPastorAssociationId}
                onChange={(event) => {
                  pastorForm.setValue('associationId', event.target.value, { shouldDirty: true, shouldValidate: true })
                  pastorForm.setValue('districtId', '', { shouldDirty: true, shouldValidate: true })
                  pastorForm.setValue('churchIds', [], { shouldDirty: true, shouldValidate: true })
                }}
              >
                <option value="">Selecciona la asociación</option>
                {filteredAssociations.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
              <Select
                value={selectedPastorDistrictId}
                onChange={(event) => {
                  pastorForm.setValue('districtId', event.target.value, { shouldDirty: true, shouldValidate: true })
                  pastorForm.setValue('churchIds', [], { shouldDirty: true, shouldValidate: true })
                }}
              >
                <option value="">Selecciona el distrito</option>
                {filteredDistricts.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
            </div>
            <Select
              multiple
              value={selectedPastorChurchIds}
              onChange={(event) => {
                const values = Array.from(event.target.selectedOptions).map((option) => option.value)
                pastorForm.setValue('churchIds', values, { shouldDirty: true, shouldValidate: true })
              }}
              className="min-h-36"
            >
              {filteredChurches.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </Select>
            <label className="flex items-start gap-3 rounded-card border border-(--app-border) px-4 py-3 text-sm text-(--app-text-muted)">
              <input
                type="checkbox"
                checked={pastorStatusAttestation}
                onChange={(event) =>
                  pastorForm.setValue('pastorStatusAttestation', event.target.checked, { shouldDirty: true, shouldValidate: true })
                }
              />
              Confirmo que soy el pastor activo del distrito o iglesias seleccionadas.
            </label>
            <Textarea placeholder="Notas opcionales para el revisor" {...pastorForm.register('notes')} />
            <div className="rounded-card border border-dashed border-(--app-border) px-4 py-4 text-sm text-(--app-text-muted)">
              <p className="inline-flex items-center gap-2 font-medium text-(--app-text)">
                <UploadCloud className="size-4" /> Documento de identidad
              </p>
              <p className="mt-1">Adjunta tu cédula en PDF o imagen.</p>
              <Input
                type="file"
                accept={RECRUITER_DOCUMENT_MIME_TYPES.join(',')}
                className="mt-2"
                onChange={(event) => {
                  void prepareDocumentFile(event.target.files?.[0] ?? null, {
                    setFile: setPastorIdentityFile,
                    setError: setPastorIdentityFileError,
                    source: 'authority-request.pastor.identity',
                  })
                }}
              />
              {pastorIdentityFile ? <p className="mt-2 text-(--app-text)">{pastorIdentityFile.name}</p> : null}
              {pastorIdentityFileError ? <p className="mt-2 text-rose-600">{pastorIdentityFileError}</p> : null}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input inputMode="numeric" placeholder="Cédula o documento" {...regionalForm.register('identityDocumentNumber')} />
              <Input type="tel" inputMode="tel" autoComplete="tel" placeholder="Teléfono principal" {...regionalForm.register('phoneNumber')} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input placeholder="Nombres legales" {...regionalForm.register('firstNames')} />
              <Input placeholder="Apellidos legales" {...regionalForm.register('lastNames')} />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Select
                value={selectedRegionalScopeType}
                onChange={(event) =>
                  regionalForm.setValue('adminScopeType', event.target.value as 'union' | 'association', {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
              >
                <option value="association">Asociación</option>
                <option value="union">Unión</option>
              </Select>
              <Select
                value={selectedRegionalUnionId}
                onChange={(event) => {
                  regionalForm.setValue('unionId', event.target.value, { shouldDirty: true, shouldValidate: true })
                  regionalForm.setValue('associationId', '', { shouldDirty: true, shouldValidate: true })
                }}
              >
                <option value="">Selecciona la unión</option>
                {unions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
              <Select
                disabled={selectedRegionalScopeType !== 'association'}
                value={selectedRegionalAssociationId ?? ''}
                onChange={(event) =>
                  regionalForm.setValue('associationId', event.target.value, { shouldDirty: true, shouldValidate: true })
                }
              >
                <option value="">Selecciona la asociación</option>
                {filteredRegionalAssociations.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
            </div>
            <Input placeholder="Cargo administrativo oficial" {...regionalForm.register('positionTitle')} />
            <Textarea placeholder="Notas opcionales para el revisor" {...regionalForm.register('notes')} />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-card border border-dashed border-(--app-border) px-4 py-4 text-sm text-(--app-text-muted)">
                <p className="font-medium text-(--app-text)">Documento de identidad</p>
                <Input
                  type="file"
                  accept={RECRUITER_DOCUMENT_MIME_TYPES.join(',')}
                  className="mt-2"
                  onChange={(event) => {
                    void prepareDocumentFile(event.target.files?.[0] ?? null, {
                      setFile: setRegionalIdentityFile,
                      setError: setRegionalIdentityFileError,
                      source: 'authority-request.regional.identity',
                    })
                  }}
                />
                {regionalIdentityFile ? <p className="mt-2 text-(--app-text)">{regionalIdentityFile.name}</p> : null}
                {regionalIdentityFileError ? <p className="mt-2 text-rose-600">{regionalIdentityFileError}</p> : null}
              </div>
              <div className="rounded-card border border-dashed border-(--app-border) px-4 py-4 text-sm text-(--app-text-muted)">
                <p className="font-medium text-(--app-text)">Nombramiento o carta</p>
                <Input
                  type="file"
                  accept={RECRUITER_DOCUMENT_MIME_TYPES.join(',')}
                  className="mt-2"
                  onChange={(event) => {
                    void prepareDocumentFile(event.target.files?.[0] ?? null, {
                      setFile: setRegionalAppointmentFile,
                      setError: setRegionalAppointmentFileError,
                      source: 'authority-request.regional.appointment',
                    })
                  }}
                />
                {regionalAppointmentFile ? <p className="mt-2 text-(--app-text)">{regionalAppointmentFile.name}</p> : null}
                {regionalAppointmentFileError ? <p className="mt-2 text-rose-600">{regionalAppointmentFileError}</p> : null}
              </div>
            </div>
          </div>
        )}
      </SideSheet>
    </motion.div>
  )
}
