import { useState } from 'react'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import {
  createPrivateFileUrl,
  listPendingRecruiterRequests,
  reviewRecruiterRequest,
  toErrorMessage
} from '@/features/auth/lib/auth-api'
import { reportErrorWithToast } from '@/lib/errors/error-reporting'
import { RecruiterRequestStatusBadge } from '@/features/recruiter-requests/components/recruiter-request-status-badge'
import { useAppSession } from '@/app/providers/app-session-provider'

const PENDING_REQUESTS_QUERY_KEY = ['recruiter-requests', 'pending'] as const

export function RecruiterReviewPage() {
  const session = useAppSession()
  const queryClient = useQueryClient()
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({})

  const pendingRequestsQuery = useQuery({
    queryKey: PENDING_REQUESTS_QUERY_KEY,
    queryFn: listPendingRecruiterRequests
  })

  const reviewMutation = useMutation({
    mutationFn: async (values: {
      requestId: string
      decision: 'approved' | 'rejected'
      reviewNotes: string
    }) => reviewRecruiterRequest(values),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: PENDING_REQUESTS_QUERY_KEY })
      toast.success(variables.decision === 'approved' ? 'Solicitud aprobada' : 'Solicitud rechazada', {
        description:
          variables.decision === 'approved'
            ? 'El tenant y la membership inicial se crearon correctamente.'
            : 'La solicitud se marco como rechazada y queda auditada.'
      })
      setReviewNotes((previous) => ({
        ...previous,
        [variables.requestId]: ''
      }))
    },
    onError: async (error) => {
      await reportErrorWithToast({
        title: 'No pudimos actualizar la solicitud',
        source: 'admin.recruiter-request-review',
        route: '/admin/recruiter-requests',
        userId: session.authUser?.id ?? null,
        error,
        description: toErrorMessage(error),
        userMessage: 'No pudimos actualizar la solicitud recruiter.'
      })
    }
  })

  async function openPrivateAsset(path: string) {
    try {
      const signedUrl = await createPrivateFileUrl('verification-documents', path)
      window.open(signedUrl, '_blank', 'noopener,noreferrer')
    } catch (error) {
      await reportErrorWithToast({
        title: 'No pudimos abrir el archivo',
        source: 'admin.recruiter-request-asset-open',
        route: '/admin/recruiter-requests',
        userId: session.authUser?.id ?? null,
        error,
        description: toErrorMessage(error),
        userMessage: 'No pudimos abrir el archivo privado de la solicitud.',
        metadata: {
          assetPath: path
        }
      })
    }
  }

  const pendingRequests = pendingRequestsQuery.data ?? []

  return (
    <div className="space-y-4">
      <Card className="border-primary-100 bg-[linear-gradient(160deg,#eff6ff,white_42%,#f0fdf4)] dark:border-zinc-800 dark:bg-[linear-gradient(160deg,rgba(11,19,30,0.96),rgba(9,9,11,0.95)_44%,rgba(9,22,16,0.95))]">
        <CardHeader>
          <Badge variant="soft">Admin review</Badge>
          <CardTitle>Revision de solicitudes recruiter</CardTitle>
          <CardDescription>
            Esta vista usa `recruiter_request:review` y la RPC de aprobacion para crear el tenant solo cuando el admin lo confirme.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-3xl border border-zinc-200 bg-white/85 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950/80">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Pendientes</p>
            <p className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{pendingRequests.length}</p>
          </div>
          <div className="rounded-3xl border border-zinc-200 bg-white/85 px-4 py-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-400">
            Al aprobar se crea `tenant`, `company_profile` y la primera `membership` owner.
          </div>
          <div className="rounded-3xl border border-zinc-200 bg-white/85 px-4 py-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-400">
            Los archivos siguen privados y solo se abren con signed URLs temporales.
          </div>
        </CardContent>
      </Card>

      {pendingRequestsQuery.isLoading ? (
        <Card>
          <CardContent className="py-8 text-sm text-zinc-500">Cargando solicitudes pendientes...</CardContent>
        </Card>
      ) : pendingRequests.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-sm text-zinc-500">No hay solicitudes recruiter pendientes en este momento.</CardContent>
        </Card>
      ) : (
        pendingRequests.map((request) => (
          <Card key={request.id}>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <CardTitle>{request.requested_company_name}</CardTitle>
                  <CardDescription>
                    {request.requested_company_legal_name || 'Sin razon social'} · `{request.requested_tenant_slug}`
                  </CardDescription>
                </div>
                <RecruiterRequestStatusBadge status={request.status} />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-3xl bg-zinc-50 px-4 py-3 text-sm text-zinc-700 dark:bg-zinc-900/70 dark:text-zinc-300">
                  <p className="font-semibold text-zinc-900 dark:text-zinc-50">Contacto</p>
                  <p className="mt-1">{request.company_email || 'Sin email corporativo'}</p>
                  <p>{request.company_phone || 'Sin telefono'}</p>
                  <p>{request.company_country_code || 'Sin pais'}</p>
                </div>
                <div className="rounded-3xl bg-zinc-50 px-4 py-3 text-sm text-zinc-700 dark:bg-zinc-900/70 dark:text-zinc-300">
                  <p className="font-semibold text-zinc-900 dark:text-zinc-50">Fechas</p>
                  <p className="mt-1">Enviada: {new Date(request.submitted_at).toLocaleString()}</p>
                  <p>Ultima actualizacion: {new Date(request.updated_at).toLocaleString()}</p>
                </div>
              </div>

              <div className="rounded-3xl bg-zinc-50 px-4 py-3 text-sm text-zinc-700 dark:bg-zinc-900/70 dark:text-zinc-300">
                <p className="font-semibold text-zinc-900 dark:text-zinc-50">Descripcion</p>
                <p className="mt-1 whitespace-pre-wrap">{request.company_description || 'Sin descripcion.'}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                {request.company_logo_path ? (
                  <Button
                    variant="outline"
                    onClick={() => void openPrivateAsset(request.company_logo_path as string)}
                  >
                    Abrir logo temporal
                  </Button>
                ) : null}
                {request.verification_document_path ? (
                  <Button
                    variant="outline"
                    onClick={() => void openPrivateAsset(request.verification_document_path as string)}
                  >
                    Abrir documento de verificacion
                  </Button>
                ) : null}
              </div>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-zinc-800 dark:text-zinc-100">Notas de revision</span>
                <Textarea
                  placeholder="Observaciones de validacion, contexto del rechazo o decisiones tomadas."
                  value={reviewNotes[request.id] ?? ''}
                  onChange={(event) =>
                    setReviewNotes((previous) => ({
                      ...previous,
                      [request.id]: event.target.value
                    }))
                  }
                />
              </label>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  className="sm:flex-1"
                  disabled={reviewMutation.isPending}
                  onClick={() =>
                    reviewMutation.mutate({
                      requestId: request.id,
                      decision: 'approved',
                      reviewNotes: reviewNotes[request.id] ?? ''
                    })
                  }
                >
                  Aprobar y crear tenant
                </Button>
                <Button
                  className="sm:flex-1"
                  disabled={reviewMutation.isPending}
                  variant="danger"
                  onClick={() =>
                    reviewMutation.mutate({
                      requestId: request.id,
                      decision: 'rejected',
                      reviewNotes: reviewNotes[request.id] ?? ''
                    })
                  }
                >
                  Rechazar solicitud
                </Button>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}
