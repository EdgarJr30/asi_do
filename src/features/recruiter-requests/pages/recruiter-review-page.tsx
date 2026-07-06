import { useState } from 'react'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import { useAppSession } from '@/app/providers/app-session-provider'
import { surfacePaths } from '@/app/router/surface-paths'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/loader'
import { Textarea } from '@/components/ui/textarea'
import { AdminAuthorityInvitationsPage } from '@/features/authority-requests/pages/admin-authority-invitations-page'
import {
  createPrivateFileUrl,
  listPendingPastorAuthorityRequests,
  listPendingRecruiterRequests,
  listPendingRegionalAuthorityRequests,
  reviewPastorAuthorityRequest,
  reviewRecruiterRequest,
  reviewRegionalAuthorityRequest,
  toErrorMessage,
} from '@/features/auth/lib/auth-api'
import { getTenantKindLabel } from '@/features/opportunities/lib/opportunity-taxonomy'
import { RecruiterRequestStatusBadge } from '@/features/recruiter-requests/components/recruiter-request-status-badge'
import { AdminPage, AdminStat, AdminStatBar, AdminTabs } from '@/features/internal/components/admin-redesign'
import { reportErrorWithToast } from '@/lib/errors/error-reporting'
import { useRealtimeSync } from '@/lib/realtime/use-realtime-sync'

const PENDING_RECRUITER_REQUESTS_QUERY_KEY = ['recruiter-requests', 'pending'] as const
const PENDING_PASTOR_REQUESTS_QUERY_KEY = ['pastor-authority-requests', 'pending'] as const
const PENDING_REGIONAL_REQUESTS_QUERY_KEY = ['regional-authority-requests', 'pending'] as const
type ApprovalTab = 'queue' | 'authority'

function getWorkflowBadgeClassName(status: string) {
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

function getWorkflowLabel(status: string) {
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

function ApprovalActionRow({
  disabled,
  onApprove,
  onNeedsMoreInfo,
  onReject,
  approveLabel = 'Aprobar',
}: {
  disabled: boolean
  onApprove: () => void
  onNeedsMoreInfo: () => void
  onReject: () => void
  approveLabel?: string
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Button className="h-9 rounded-control text-[0.82rem] sm:flex-1" disabled={disabled} onClick={onApprove}>
        {approveLabel}
      </Button>
      <Button className="h-9 rounded-control text-[0.82rem] sm:flex-1" disabled={disabled} variant="outline" onClick={onNeedsMoreInfo}>
        Solicitar más información
      </Button>
      <Button className="h-9 rounded-control text-[0.82rem] sm:flex-1" disabled={disabled} variant="danger" onClick={onReject}>
        Rechazar
      </Button>
    </div>
  )
}

export function RecruiterReviewPage() {
  const session = useAppSession()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({})
  const [tab, setTab] = useState<ApprovalTab>(searchParams.get('tab') === 'authority' ? 'authority' : 'queue')
  const handleTabChange = (nextTab: ApprovalTab) => {
    setTab(nextTab)
    setSearchParams({ tab: nextTab }, { replace: true })
  }

  const canReviewRecruiterRequests = session.permissions.includes('recruiter_request:review')
  const canReviewPastorRequests = session.permissions.includes('pastor_authority_request:review')
  const canReviewRegionalRequests = session.permissions.includes('regional_authority_request:review')

  const recruiterRequestsQuery = useQuery({
    queryKey: PENDING_RECRUITER_REQUESTS_QUERY_KEY,
    queryFn: listPendingRecruiterRequests,
    enabled: canReviewRecruiterRequests,
  })

  const pastorRequestsQuery = useQuery({
    queryKey: PENDING_PASTOR_REQUESTS_QUERY_KEY,
    queryFn: listPendingPastorAuthorityRequests,
    enabled: canReviewPastorRequests,
  })

  const regionalRequestsQuery = useQuery({
    queryKey: PENDING_REGIONAL_REQUESTS_QUERY_KEY,
    queryFn: listPendingRegionalAuthorityRequests,
    enabled: canReviewRegionalRequests,
  })

  // Las colas de aprobación se llenan en vivo cuando un usuario envía una solicitud
  // (o cuando otro revisor la resuelve), sin recargar.
  useRealtimeSync(
    'recruiter-authority-review',
    [
      { table: 'recruiter_requests', invalidate: [PENDING_RECRUITER_REQUESTS_QUERY_KEY] },
      { table: 'pastor_authority_requests', invalidate: [PENDING_PASTOR_REQUESTS_QUERY_KEY] },
      { table: 'regional_administrator_authority_requests', invalidate: [PENDING_REGIONAL_REQUESTS_QUERY_KEY] }
    ],
    { enabled: canReviewRecruiterRequests || canReviewPastorRequests || canReviewRegionalRequests }
  )

  const recruiterReviewMutation = useMutation({
    mutationFn: async (values: { requestId: string; decision: 'approved' | 'rejected'; reviewNotes: string }) =>
      reviewRecruiterRequest(values),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: PENDING_RECRUITER_REQUESTS_QUERY_KEY })
      toast.success(variables.decision === 'approved' ? 'Solicitud aprobada' : 'Solicitud rechazada', {
        description:
          variables.decision === 'approved'
            ? 'El tenant y la membership inicial se crearon correctamente.'
            : 'La solicitud se marcó como rechazada y queda auditada.',
      })
      setReviewNotes((previous) => ({ ...previous, [variables.requestId]: '' }))
    },
    onError: async (error) => {
      await reportErrorWithToast({
        title: 'No pudimos actualizar la solicitud',
        source: 'admin.recruiter-request-review',
        route: surfacePaths.admin.approvals,
        userId: session.authUser?.id ?? null,
        error,
        description: toErrorMessage(error),
        userMessage: 'No pudimos actualizar la solicitud de operador.',
      })
    },
  })

  const pastorReviewMutation = useMutation({
    mutationFn: async (values: {
      requestId: string
      decision: 'approved' | 'needs_more_info' | 'rejected'
      reviewNotes: string
    }) => reviewPastorAuthorityRequest(values),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: PENDING_PASTOR_REQUESTS_QUERY_KEY })
      toast.success('Solicitud pastoral actualizada', {
        description: `La solicitud quedó en estado ${getWorkflowLabel(variables.decision).toLowerCase()}.`,
      })
      setReviewNotes((previous) => ({ ...previous, [variables.requestId]: '' }))
    },
  })

  const regionalReviewMutation = useMutation({
    mutationFn: async (values: {
      requestId: string
      decision: 'approved' | 'needs_more_info' | 'rejected'
      reviewNotes: string
    }) => reviewRegionalAuthorityRequest(values),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: PENDING_REGIONAL_REQUESTS_QUERY_KEY })
      toast.success('Solicitud regional actualizada', {
        description: `La solicitud quedó en estado ${getWorkflowLabel(variables.decision).toLowerCase()}.`,
      })
      setReviewNotes((previous) => ({ ...previous, [variables.requestId]: '' }))
    },
  })

  async function openPrivateAsset(path: string) {
    try {
      const signedUrl = await createPrivateFileUrl('verification-documents', path)
      window.open(signedUrl, '_blank', 'noopener,noreferrer')
    } catch (error) {
      await reportErrorWithToast({
        title: 'No pudimos abrir el archivo',
        source: 'admin.approvals-asset-open',
        route: surfacePaths.admin.approvals,
        userId: session.authUser?.id ?? null,
        error,
        description: toErrorMessage(error),
        userMessage: 'No pudimos abrir el archivo privado asociado a la solicitud.',
        metadata: {
          assetPath: path,
        },
      })
    }
  }

  const pendingRecruiterRequests = recruiterRequestsQuery.data ?? []
  const pendingPastorRequests = pastorRequestsQuery.data ?? []
  const pendingRegionalRequests = regionalRequestsQuery.data ?? []
  const totalQueues =
    pendingRecruiterRequests.length +
    pendingPastorRequests.length +
    pendingRegionalRequests.length

  return (
    <AdminPage
      eyebrow="Admin · Aprobaciones"
      title="Aprobaciones"
      description="Cola unificada de solicitudes y generación de invitaciones para validar autoridad pastoral o regional."
    >
      <div className="space-y-5">
        <AdminTabs
          value={tab}
          onChange={handleTabChange}
          tabs={[
            { value: 'queue', label: 'Cola', count: totalQueues },
            { value: 'authority', label: 'Autorización territorial' }
          ]}
        />

        {tab === 'authority' ? <AdminAuthorityInvitationsPage embedded /> : null}

        {tab === 'queue' ? (
          <div className="space-y-3">
            <AdminStatBar columns={4}>
              <AdminStat label="Total pendientes" value={totalQueues} />
              <AdminStat label="Operador" value={pendingRecruiterRequests.length} tone="blue" />
              <AdminStat label="Pastoral" value={pendingPastorRequests.length} tone="teal" />
              <AdminStat label="Regional" value={pendingRegionalRequests.length} tone="violet" />
            </AdminStatBar>

      {canReviewRecruiterRequests ? (
        <Card>
          <CardHeader>
            <Badge variant="outline">Operadores</Badge>
            <CardTitle>Solicitudes de operador</CardTitle>
            <CardDescription>Aprueba la creación del tenant solo cuando la verificación administrativa esté completa.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {recruiterRequestsQuery.isLoading ? (
              <p className="inline-flex items-center gap-2 text-sm text-zinc-500">
                <Spinner size="sm" /> Cargando solicitudes pendientes...
              </p>
            ) : pendingRecruiterRequests.length === 0 ? (
              <p className="text-sm text-zinc-500">No hay solicitudes de operador pendientes.</p>
            ) : (
              pendingRecruiterRequests.map((request) => {
                const requestMetadata =
                  request.request_metadata && typeof request.request_metadata === 'object' && !Array.isArray(request.request_metadata)
                    ? (request.request_metadata as Record<string, unknown>)
                    : {}

                return (
                  <div key={request.id} className="space-y-3 rounded-card border border-(--app-border) px-3.5 py-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-1">
                        <p className="text-[0.95rem] font-semibold text-(--app-text)">{request.requested_company_name}</p>
                        <p className="text-sm text-zinc-500">
                          {getTenantKindLabel(request.requested_tenant_kind)} · {request.requested_company_legal_name || 'Sin razón social'} · `{request.requested_tenant_slug}`
                        </p>
                      </div>
                      <RecruiterRequestStatusBadge status={request.status} />
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-control bg-(--app-surface-muted) px-3 py-2.5 text-[0.78rem] text-(--app-text-muted)">
                        <p className="font-semibold text-zinc-900 dark:text-zinc-50">Contacto</p>
                        <p className="mt-1">{request.company_email || 'Sin email corporativo'}</p>
                        <p>{request.company_phone || 'Sin teléfono'}</p>
                        <p>{request.company_country_code || 'Sin país'}</p>
                      </div>
                      <div className="rounded-control bg-(--app-surface-muted) px-3 py-2.5 text-[0.78rem] text-(--app-text-muted)">
                        <p className="font-semibold text-zinc-900 dark:text-zinc-50">Datos de tipo</p>
                        <p className="mt-1">Website: {request.company_website_url || 'Sin website'}</p>
                        {typeof requestMetadata.operating_scope === 'string' ? <p>Alcance: {requestMetadata.operating_scope}</p> : null}
                        {typeof requestMetadata.sponsoring_entity === 'string' ? <p>Patrocinador: {requestMetadata.sponsoring_entity}</p> : null}
                        {typeof requestMetadata.field_region === 'string' ? <p>Campo o región: {requestMetadata.field_region}</p> : null}
                        {typeof requestMetadata.conversion_intent === 'string' ? <p>Conversión futura: {requestMetadata.conversion_intent}</p> : null}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {request.company_logo_path ? (
                          <Button variant="outline" className="h-8 rounded-control text-[0.8rem]" onClick={() => void openPrivateAsset(request.company_logo_path as string)}>
                          Abrir logo temporal
                        </Button>
                      ) : null}
                      {request.verification_document_path ? (
                          <Button variant="outline" className="h-8 rounded-control text-[0.8rem]" onClick={() => void openPrivateAsset(request.verification_document_path as string)}>
                          Abrir documento de verificación
                        </Button>
                      ) : null}
                    </div>

                    <label className="block space-y-1.5">
                      <span className="text-[0.8rem] font-medium text-(--app-text)">Notas de revisión</span>
                      <Textarea
                        placeholder="Observaciones de validación, contexto del rechazo o decisiones tomadas."
                        value={reviewNotes[request.id] ?? ''}
                        onChange={(event) => setReviewNotes((previous) => ({ ...previous, [request.id]: event.target.value }))}
                      />
                    </label>

                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button
                        className="h-9 rounded-control text-[0.82rem] sm:flex-1"
                        disabled={recruiterReviewMutation.isPending}
                        onClick={() =>
                          recruiterReviewMutation.mutate({
                            requestId: request.id,
                            decision: 'approved',
                            reviewNotes: reviewNotes[request.id] ?? '',
                          })
                        }
                      >
                        Aprobar y crear tenant
                      </Button>
                      <Button
                        className="h-9 rounded-control text-[0.82rem] sm:flex-1"
                        disabled={recruiterReviewMutation.isPending}
                        variant="danger"
                        onClick={() =>
                          recruiterReviewMutation.mutate({
                            requestId: request.id,
                            decision: 'rejected',
                            reviewNotes: reviewNotes[request.id] ?? '',
                          })
                        }
                      >
                        Rechazar solicitud
                      </Button>
                    </div>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>
      ) : null}

      {canReviewPastorRequests ? (
        <Card>
          <CardHeader>
            <Badge variant="outline">Pastores</Badge>
            <CardTitle>Solicitudes pastorales</CardTitle>
            <CardDescription>Valida la autoridad distrital o de iglesias antes de crear el scope aprobado.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {pastorRequestsQuery.isLoading ? (
              <p className="inline-flex items-center gap-2 text-sm text-zinc-500">
                <Spinner size="sm" /> Cargando solicitudes pastorales...
              </p>
            ) : pendingPastorRequests.length === 0 ? (
              <p className="text-sm text-zinc-500">No hay solicitudes pastorales pendientes.</p>
            ) : (
              pendingPastorRequests.map((request) => (
                <div key={request.id} className="space-y-4 rounded-card-lg border border-zinc-200 px-4 py-4 dark:border-zinc-800">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-[0.95rem] font-semibold text-(--app-text)">
                        {request.first_names} {request.last_names}
                      </p>
                      <p className="text-sm text-zinc-500">{request.phone_number}</p>
                    </div>
                    <Badge variant="outline" className={getWorkflowBadgeClassName(request.status)}>
                      {getWorkflowLabel(request.status)}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" className="h-8 rounded-control text-[0.8rem]" onClick={() => void openPrivateAsset(request.identity_document_file_path)}>
                      Abrir cédula
                    </Button>
                  </div>

                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-zinc-800 dark:text-zinc-100">Notas de revisión</span>
                    <Textarea
                      placeholder="Indica el alcance aprobado o la evidencia faltante."
                      value={reviewNotes[request.id] ?? ''}
                      onChange={(event) => setReviewNotes((previous) => ({ ...previous, [request.id]: event.target.value }))}
                    />
                  </label>

                  <ApprovalActionRow
                    disabled={pastorReviewMutation.isPending}
                    approveLabel="Aprobar alcance pastoral"
                    onApprove={() =>
                      pastorReviewMutation.mutate({
                        requestId: request.id,
                        decision: 'approved',
                        reviewNotes: reviewNotes[request.id] ?? '',
                      })
                    }
                    onNeedsMoreInfo={() =>
                      pastorReviewMutation.mutate({
                        requestId: request.id,
                        decision: 'needs_more_info',
                        reviewNotes: reviewNotes[request.id] ?? '',
                      })
                    }
                    onReject={() =>
                      pastorReviewMutation.mutate({
                        requestId: request.id,
                        decision: 'rejected',
                        reviewNotes: reviewNotes[request.id] ?? '',
                      })
                    }
                  />
                </div>
              ))
            )}
          </CardContent>
        </Card>
      ) : null}

      {canReviewRegionalRequests ? (
        <Card>
          <CardHeader>
            <Badge variant="outline">Regionales</Badge>
            <CardTitle>Solicitudes regionales</CardTitle>
            <CardDescription>Valida el territorio y el nombramiento oficial antes de crear el scope regional.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {regionalRequestsQuery.isLoading ? (
              <p className="inline-flex items-center gap-2 text-sm text-zinc-500">
                <Spinner size="sm" /> Cargando solicitudes regionales...
              </p>
            ) : pendingRegionalRequests.length === 0 ? (
              <p className="text-sm text-zinc-500">No hay solicitudes regionales pendientes.</p>
            ) : (
              pendingRegionalRequests.map((request) => (
                <div key={request.id} className="space-y-4 rounded-card-lg border border-zinc-200 px-4 py-4 dark:border-zinc-800">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-[0.95rem] font-semibold text-(--app-text)">
                        {request.first_names} {request.last_names}
                      </p>
                      <p className="text-sm text-zinc-500">
                        {request.position_title} · {request.admin_scope_type}
                      </p>
                    </div>
                    <Badge variant="outline" className={getWorkflowBadgeClassName(request.status)}>
                      {getWorkflowLabel(request.status)}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" className="h-8 rounded-control text-[0.8rem]" onClick={() => void openPrivateAsset(request.identity_document_file_path)}>
                      Abrir cédula
                    </Button>
                    <Button variant="outline" className="h-8 rounded-control text-[0.8rem]" onClick={() => void openPrivateAsset(request.appointment_document_file_path)}>
                      Abrir nombramiento
                    </Button>
                  </div>

                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-zinc-800 dark:text-zinc-100">Notas de revisión</span>
                    <Textarea
                      placeholder="Indica el territorio aprobado o la evidencia faltante."
                      value={reviewNotes[request.id] ?? ''}
                      onChange={(event) => setReviewNotes((previous) => ({ ...previous, [request.id]: event.target.value }))}
                    />
                  </label>

                  <ApprovalActionRow
                    disabled={regionalReviewMutation.isPending}
                    approveLabel="Aprobar alcance regional"
                    onApprove={() =>
                      regionalReviewMutation.mutate({
                        requestId: request.id,
                        decision: 'approved',
                        reviewNotes: reviewNotes[request.id] ?? '',
                      })
                    }
                    onNeedsMoreInfo={() =>
                      regionalReviewMutation.mutate({
                        requestId: request.id,
                        decision: 'needs_more_info',
                        reviewNotes: reviewNotes[request.id] ?? '',
                      })
                    }
                    onReject={() =>
                      regionalReviewMutation.mutate({
                        requestId: request.id,
                        decision: 'rejected',
                        reviewNotes: reviewNotes[request.id] ?? '',
                      })
                    }
                  />
                </div>
              ))
            )}
          </CardContent>
        </Card>
      ) : null}

      {!canReviewRecruiterRequests &&
      !canReviewPastorRequests &&
      !canReviewRegionalRequests ? (
        <Card>
          <CardContent className="py-8 text-sm text-zinc-500">
            Tu sesión no tiene permisos de revisión para ninguna de las colas activas.
          </CardContent>
        </Card>
      ) : null}
          </div>
        ) : null}
      </div>
    </AdminPage>
  )
}
