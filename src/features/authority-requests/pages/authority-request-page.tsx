import { useMemo, useState } from 'react'

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm, useWatch } from 'react-hook-form'
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
  fetchAuthorityHierarchy,
  listMyPastorAuthorityRequests,
  listMyRegionalAuthorityRequests,
  submitPastorAuthorityRequest,
  submitRegionalAuthorityRequest,
  toErrorMessage,
  uploadPrivateFile,
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
  const queryClient = useQueryClient()
  const session = useAppSession()
  const [pastorIdentityFile, setPastorIdentityFile] = useState<File | null>(null)
  const [pastorIdentityFileError, setPastorIdentityFileError] = useState<string | null>(null)
  const [regionalIdentityFile, setRegionalIdentityFile] = useState<File | null>(null)
  const [regionalIdentityFileError, setRegionalIdentityFileError] = useState<string | null>(null)
  const [regionalAppointmentFile, setRegionalAppointmentFile] = useState<File | null>(null)
  const [regionalAppointmentFileError, setRegionalAppointmentFileError] = useState<string | null>(null)

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
    queryFn: async () => {
      if (!session.authUser) {
        return []
      }

      return listMyPastorAuthorityRequests(session.authUser.id)
    },
    enabled: session.authUser !== null,
  })

  const regionalRequestsQuery = useQuery({
    queryKey: MY_REGIONAL_REQUESTS_QUERY_KEY,
    queryFn: async () => {
      if (!session.authUser) {
        return []
      }

      return listMyRegionalAuthorityRequests(session.authUser.id)
    },
    enabled: session.authUser !== null,
  })

  const unions = hierarchyQuery.data?.unions ?? EMPTY_ITEMS
  const associations = hierarchyQuery.data?.associations ?? EMPTY_ITEMS
  const districts = hierarchyQuery.data?.districts ?? EMPTY_ITEMS
  const churches = hierarchyQuery.data?.churches ?? EMPTY_ITEMS

  const selectedPastorUnionId = useWatch({
    control: pastorForm.control,
    name: 'unionId',
  })
  const selectedPastorAssociationId = useWatch({
    control: pastorForm.control,
    name: 'associationId',
  })
  const selectedPastorDistrictId = useWatch({
    control: pastorForm.control,
    name: 'districtId',
  })
  const selectedPastorChurchIds = useWatch({
    control: pastorForm.control,
    name: 'churchIds',
  }) ?? []
  const pastorStatusAttestation = useWatch({
    control: pastorForm.control,
    name: 'pastorStatusAttestation',
  })
  const selectedRegionalScopeType = useWatch({
    control: regionalForm.control,
    name: 'adminScopeType',
  })
  const selectedRegionalUnionId = useWatch({
    control: regionalForm.control,
    name: 'unionId',
  })
  const selectedRegionalAssociationId = useWatch({
    control: regionalForm.control,
    name: 'associationId',
  })

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

      return submitPastorAuthorityRequest({
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
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: MY_PASTOR_REQUESTS_QUERY_KEY })
      toast.success('Solicitud pastoral enviada', {
        description: 'Tu validación pastoral quedó en cola de revisión administrativa.',
      })
      setPastorIdentityFile(null)
      setPastorIdentityFileError(null)
      pastorForm.reset({
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
      })
    },
    onError: async (error) => {
      await captureClientError({
        source: 'authority-request.pastor.submit',
        route: surfacePaths.candidate.authorityRequest,
        userId: session.authUser?.id ?? null,
        userMessage: 'No pudimos enviar tu solicitud pastoral.',
        error,
      })
      toast.error('No pudimos enviar la solicitud pastoral', {
        description: toErrorMessage(error),
      })
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

      return submitRegionalAuthorityRequest({
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
      regionalForm.reset({
        identityDocumentNumber: '',
        firstNames: session.profile?.full_name?.split(' ').slice(0, -1).join(' ') || '',
        lastNames: session.profile?.full_name?.split(' ').slice(-1).join(' ') || '',
        phoneNumber: session.profile?.phone || '',
        adminScopeType: 'association',
        unionId: '',
        associationId: '',
        positionTitle: '',
        notes: '',
      })
    },
    onError: async (error) => {
      await captureClientError({
        source: 'authority-request.regional.submit',
        route: surfacePaths.candidate.authorityRequest,
        userId: session.authUser?.id ?? null,
        userMessage: 'No pudimos enviar tu solicitud regional.',
        error,
      })
      toast.error('No pudimos enviar la solicitud regional', {
        description: toErrorMessage(error),
      })
    },
  })

  async function prepareDocumentFile(
    file: File | null,
    handlers: {
      setFile: (file: File | null) => void
      setError: (message: string | null) => void
      source: string
    }
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
      toast.error('No pudimos preparar el documento', {
        description: message,
      })
      await captureClientError({
        source: handlers.source,
        route: surfacePaths.candidate.authorityRequest,
        userId: session.authUser?.id ?? null,
        userMessage: message,
        error,
        metadata: {
          fileName: file.name,
          fileSizeBytes: file.size,
          fileType: file.type,
        },
      })
    }
  }

  async function openPrivateAsset(path: string) {
    try {
      const signedUrl = await createPrivateFileUrl('verification-documents', path)
      window.open(signedUrl, '_blank', 'noopener,noreferrer')
    } catch (error) {
      toast.error('No pudimos abrir el archivo', {
        description: toErrorMessage(error),
      })
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
      <div className="space-y-4">
        <Card className="bg-(--app-surface-muted)">
          <CardHeader>
            <Badge variant="soft">Autorización territorial</Badge>
            <CardTitle>Solicitudes pastorales y regionales</CardTitle>
            <CardDescription>
              Estos formularios validan autoridad territorial. No activan licencias ni crean tenants por sí solos.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-3xl border border-zinc-200 bg-white/85 px-4 py-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-300">
              Cédula y nombramientos quedan en storage privado.
            </div>
            <div className="rounded-3xl border border-zinc-200 bg-white/85 px-4 py-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-300">
              El alcance aprobado se asigna por unión, asociación, distrito o iglesias.
            </div>
            <div className="rounded-3xl border border-zinc-200 bg-white/85 px-4 py-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-300">
              Tamaño máximo por archivo: {MAX_UPLOAD_SIZE_LABEL}.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Badge variant="outline">Formulario pastoral</Badge>
            <CardTitle>Solicitar validación como pastor</CardTitle>
            <CardDescription>
              Esta autorización habilita avales y autorizaciones dentro de tu distrito o iglesias aprobadas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                void pastorForm.handleSubmit((values: PastorAuthorityRequestValues) => pastorMutation.mutate(values))(event)
              }}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Input placeholder="Cédula o documento" {...pastorForm.register('identityDocumentNumber')} />
                <Input placeholder="Teléfono principal" {...pastorForm.register('phoneNumber')} />
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
              <label className="flex items-start gap-3 rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-zinc-700 dark:border-zinc-800 dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={pastorStatusAttestation}
                  onChange={(event) =>
                    pastorForm.setValue('pastorStatusAttestation', event.target.checked, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                />
                Confirmo que soy el pastor activo del distrito o iglesias seleccionadas.
              </label>
              <Textarea placeholder="Notas opcionales para el revisor" {...pastorForm.register('notes')} />
              <div className="rounded-3xl border border-dashed border-zinc-200 px-4 py-4 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
                <p className="font-medium text-zinc-900 dark:text-zinc-100">Documento de identidad</p>
                <p className="mt-1">Adjunta cédula en PDF o imagen.</p>
                <Input
                  type="file"
                  accept={RECRUITER_DOCUMENT_MIME_TYPES.join(',')}
                  onChange={(event) => {
                    void prepareDocumentFile(event.target.files?.[0] ?? null, {
                      setFile: setPastorIdentityFile,
                      setError: setPastorIdentityFileError,
                      source: 'authority-request.pastor.identity',
                    })
                  }}
                />
                {pastorIdentityFile ? <p className="mt-2">{pastorIdentityFile.name}</p> : null}
                {pastorIdentityFileError ? <p className="mt-2 text-red-600">{pastorIdentityFileError}</p> : null}
              </div>
              <Button disabled={pastorMutation.isPending}>
                {pastorMutation.isPending ? 'Enviando...' : 'Enviar solicitud pastoral'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Badge variant="outline">Formulario regional</Badge>
            <CardTitle>Solicitar validación como administrador regional</CardTitle>
            <CardDescription>
              Esta autorización cubre alcance de unión o asociación según el nombramiento validado.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                void regionalForm.handleSubmit((values: RegionalAuthorityRequestValues) => regionalMutation.mutate(values))(event)
              }}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Input placeholder="Cédula o documento" {...regionalForm.register('identityDocumentNumber')} />
                <Input placeholder="Teléfono principal" {...regionalForm.register('phoneNumber')} />
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
                    regionalForm.setValue('associationId', event.target.value, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
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
                <div className="rounded-3xl border border-dashed border-zinc-200 px-4 py-4 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
                  <p className="font-medium text-zinc-900 dark:text-zinc-100">Documento de identidad</p>
                  <Input
                    type="file"
                    accept={RECRUITER_DOCUMENT_MIME_TYPES.join(',')}
                    onChange={(event) => {
                      void prepareDocumentFile(event.target.files?.[0] ?? null, {
                        setFile: setRegionalIdentityFile,
                        setError: setRegionalIdentityFileError,
                        source: 'authority-request.regional.identity',
                      })
                    }}
                  />
                  {regionalIdentityFile ? <p className="mt-2">{regionalIdentityFile.name}</p> : null}
                  {regionalIdentityFileError ? <p className="mt-2 text-red-600">{regionalIdentityFileError}</p> : null}
                </div>
                <div className="rounded-3xl border border-dashed border-zinc-200 px-4 py-4 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
                  <p className="font-medium text-zinc-900 dark:text-zinc-100">Nombramiento o carta</p>
                  <Input
                    type="file"
                    accept={RECRUITER_DOCUMENT_MIME_TYPES.join(',')}
                    onChange={(event) => {
                      void prepareDocumentFile(event.target.files?.[0] ?? null, {
                        setFile: setRegionalAppointmentFile,
                        setError: setRegionalAppointmentFileError,
                        source: 'authority-request.regional.appointment',
                      })
                    }}
                  />
                  {regionalAppointmentFile ? <p className="mt-2">{regionalAppointmentFile.name}</p> : null}
                  {regionalAppointmentFileError ? <p className="mt-2 text-red-600">{regionalAppointmentFileError}</p> : null}
                </div>
              </div>
              <Button disabled={regionalMutation.isPending}>
                {regionalMutation.isPending ? 'Enviando...' : 'Enviar solicitud regional'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <Badge variant="soft">Historial</Badge>
            <CardTitle>Mis solicitudes enviadas</CardTitle>
            <CardDescription>
              El historial muestra estado real y archivos privados solo bajo URL firmada.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(pastorRequestsQuery.data ?? []).map((request) => (
              <div key={request.id} className="rounded-3xl border border-zinc-200 px-4 py-4 dark:border-zinc-800">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">Solicitud pastoral</p>
                    <p className="text-sm text-zinc-500">{new Date(request.submitted_at).toLocaleString()}</p>
                  </div>
                  <Badge variant="outline" className={getReviewStatusClassName(request.status)}>
                    {getReviewStatusLabel(request.status)}
                  </Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => void openPrivateAsset(request.identity_document_file_path)}>
                    Abrir cédula
                  </Button>
                </div>
                {request.review_notes ? <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">{request.review_notes}</p> : null}
              </div>
            ))}

            {(regionalRequestsQuery.data ?? []).map((request) => (
              <div key={request.id} className="rounded-3xl border border-zinc-200 px-4 py-4 dark:border-zinc-800">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">Solicitud regional</p>
                    <p className="text-sm text-zinc-500">{new Date(request.submitted_at).toLocaleString()}</p>
                  </div>
                  <Badge variant="outline" className={getReviewStatusClassName(request.status)}>
                    {getReviewStatusLabel(request.status)}
                  </Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => void openPrivateAsset(request.identity_document_file_path)}>
                    Abrir cédula
                  </Button>
                  <Button variant="outline" onClick={() => void openPrivateAsset(request.appointment_document_file_path)}>
                    Abrir nombramiento
                  </Button>
                </div>
                {request.review_notes ? <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">{request.review_notes}</p> : null}
              </div>
            ))}

            {pastorRequestsQuery.data?.length === 0 && regionalRequestsQuery.data?.length === 0 ? (
              <div className="rounded-3xl border border-zinc-200 px-4 py-6 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                Todavía no has enviado solicitudes de autoridad territorial.
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
