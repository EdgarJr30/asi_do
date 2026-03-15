import { useState } from 'react'

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { useAppSession } from '@/app/providers/app-session-provider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  createPrivateFileUrl,
  listMyRecruiterRequests,
  submitRecruiterRequest,
  toErrorMessage,
  uploadPrivateFile
} from '@/features/auth/lib/auth-api'
import { recruiterRequestSchema, type RecruiterRequestValues } from '@/features/auth/lib/auth-schemas'
import { RecruiterRequestStatusBadge } from '@/features/recruiter-requests/components/recruiter-request-status-badge'

const MY_REQUESTS_QUERY_KEY = ['recruiter-requests', 'mine'] as const

export function RecruiterRequestPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const session = useAppSession()
  const [companyLogoFile, setCompanyLogoFile] = useState<File | null>(null)
  const [verificationDocumentFile, setVerificationDocumentFile] = useState<File | null>(null)

  const form = useForm<RecruiterRequestValues>({
    resolver: zodResolver(recruiterRequestSchema),
    defaultValues: {
      requestedCompanyName: '',
      requestedCompanyLegalName: '',
      requestedTenantSlug: '',
      companyWebsiteUrl: '',
      companyEmail: session.authUser?.email ?? '',
      companyPhone: '',
      companyCountryCode: session.profile?.country_code ?? 'DO',
      companyDescription: ''
    }
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
        requestedCompanyName: values.requestedCompanyName,
        requestedCompanyLegalName: values.requestedCompanyLegalName,
        requestedTenantSlug: values.requestedTenantSlug,
        companyWebsiteUrl: values.companyWebsiteUrl,
        companyEmail: values.companyEmail,
        companyPhone: values.companyPhone,
        companyCountryCode: values.companyCountryCode.toUpperCase(),
        companyDescription: values.companyDescription,
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
      form.reset({
        requestedCompanyName: '',
        requestedCompanyLegalName: '',
        requestedTenantSlug: '',
        companyWebsiteUrl: '',
        companyEmail: session.authUser?.email ?? '',
        companyPhone: '',
        companyCountryCode: session.profile?.country_code ?? 'DO',
        companyDescription: ''
      })
    },
    onError: (error) => {
      toast.error('No pudimos enviar la solicitud', {
        description: toErrorMessage(error)
      })
    }
  })

  const requests = myRequestsQuery.data ?? []
  const hasOpenRequest = requests.some((request) => request.status === 'submitted' || request.status === 'under_review')
  const approvedRequest = requests.find((request) => request.status === 'approved')

  async function openPrivateAsset(path: string) {
    try {
      const signedUrl = await createPrivateFileUrl('verification-documents', path)
      window.open(signedUrl, '_blank', 'noopener,noreferrer')
    } catch (error) {
      toast.error('No pudimos abrir el archivo', {
        description: toErrorMessage(error)
      })
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
      <Card className="border-primary-100 bg-[linear-gradient(160deg,#fff7ed,white_38%,#ecfeff)] dark:border-zinc-800 dark:bg-[linear-gradient(160deg,rgba(29,18,10,0.96),rgba(9,9,11,0.94)_40%,rgba(9,23,28,0.95))]">
        <CardHeader>
          <Badge variant="soft">Recruiter request</Badge>
          <CardTitle>Solicita la validacion de tu empresa</CardTitle>
          <CardDescription>
            El admin revisa esta solicitud antes de crear tu tenant y habilitar tu acceso employer.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hasOpenRequest ? (
            <div className="rounded-3xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
              Ya tienes una solicitud abierta. Puedes seguir su estado en la columna derecha mientras el equipo admin la revisa.
            </div>
          ) : (
            <form className="space-y-4" onSubmit={(event) => void form.handleSubmit((values) => submitMutation.mutate(values))(event)}>
              <label className="space-y-2 text-sm font-medium text-zinc-800 dark:text-zinc-100">
                <span>Nombre comercial</span>
                <Input placeholder="Talent Marketplace DR" {...form.register('requestedCompanyName')} />
                <p className="text-xs text-rose-600 dark:text-rose-300">{form.formState.errors.requestedCompanyName?.message}</p>
              </label>

              <label className="space-y-2 text-sm font-medium text-zinc-800 dark:text-zinc-100">
                <span>Razon social</span>
                <Input placeholder="Talent Marketplace Dominicana SRL" {...form.register('requestedCompanyLegalName')} />
              </label>

              <label className="space-y-2 text-sm font-medium text-zinc-800 dark:text-zinc-100">
                <span>Slug del tenant</span>
                <Input placeholder="talent-marketplace-dr" {...form.register('requestedTenantSlug')} />
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
                <span>Descripcion de la empresa</span>
                <Textarea placeholder="Que hace la empresa, como contrata y por que necesita acceso recruiter..." {...form.register('companyDescription')} />
                <p className="text-xs text-rose-600 dark:text-rose-300">{form.formState.errors.companyDescription?.message}</p>
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2 text-sm font-medium text-zinc-800 dark:text-zinc-100">
                  <span>Logo temporal para revision</span>
                  <Input
                    accept="image/png,image/jpeg,image/webp"
                    type="file"
                    onChange={(event) => setCompanyLogoFile(event.target.files?.[0] ?? null)}
                  />
                  <p className="text-xs text-zinc-500">Opcional. Se guarda privado durante la revision.</p>
                </label>

                <label className="space-y-2 text-sm font-medium text-zinc-800 dark:text-zinc-100">
                  <span>Documento de verificacion</span>
                  <Input
                    accept="application/pdf,image/png,image/jpeg,image/webp"
                    type="file"
                    onChange={(event) => setVerificationDocumentFile(event.target.files?.[0] ?? null)}
                  />
                  <p className="text-xs text-zinc-500">Requerido. Solo el solicitante y reviewers admin pueden verlo.</p>
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
                        <p className="text-xs text-zinc-500">{request.requested_tenant_slug}</p>
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
                        <Button onClick={() => void navigate('/workspace')}>Ir al workspace</Button>
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
              <Button className="w-full" onClick={() => void navigate('/workspace')}>
                Abrir workspace
              </Button>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  )
}
