import { useState } from 'react'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Banknote,
  Building2,
  CheckCircle2,
  Mail,
  Phone
} from 'lucide-react'
import { toast } from 'sonner'

import { useAppSession } from '@/app/providers/app-session-provider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Spinner } from '@/components/ui/loader'
import { PageHeader } from '@/components/ui/page-header'
import { Textarea } from '@/components/ui/textarea'
import { toErrorMessage } from '@/features/auth/lib/auth-api'
import {
  fetchPastorMembershipQueue,
  reviewMembershipApplication,
  type MembershipReviewDecision,
  type PastorQueueItem
} from '@/features/membership/lib/membership-api'
import { useRealtimeSync } from '@/lib/realtime/use-realtime-sync'

const QUEUE_QUERY_KEY = ['membership', 'pastor-queue'] as const

const workflowLabels: Record<string, string> = {
  submitted: 'Enviada',
  under_review: 'En revisión',
  needs_more_info: 'Falta información',
  approved: 'Aprobada',
  rejected: 'Rechazada',
  cancelled: 'Cancelada'
}

const paymentLabels: Record<string, string> = {
  submitted: 'Comprobante recibido',
  verified: 'Pago verificado',
  rejected: 'Comprobante rechazado'
}

function workflowBadgeClass(status: string) {
  switch (status) {
    case 'approved':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/12 dark:text-emerald-200'
    case 'rejected':
    case 'cancelled':
      return 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/25 dark:bg-rose-500/12 dark:text-rose-200'
    case 'needs_more_info':
      return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/25 dark:bg-amber-500/12 dark:text-amber-200'
    default:
      return 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/25 dark:bg-sky-500/12 dark:text-sky-200'
  }
}

export function PastorMembershipQueuePage() {
  const session = useAppSession()
  const queryClient = useQueryClient()

  const queueQuery = useQuery({
    queryKey: QUEUE_QUERY_KEY,
    enabled: session.isMembershipReviewerPastor,
    queryFn: fetchPastorMembershipQueue
  })

  // La cola del pastor se refresca en vivo cuando un miembro envía su solicitud o
  // sube un comprobante, sin necesidad de recargar.
  useRealtimeSync(
    'pastor-membership-queue',
    [
      { table: 'institutional_membership_applications', invalidate: [QUEUE_QUERY_KEY] },
      { table: 'membership_payments', invalidate: [QUEUE_QUERY_KEY] }
    ],
    { enabled: session.isMembershipReviewerPastor }
  )

  const items = queueQuery.data ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Pastoral"
        title="Solicitudes de membresía de tus iglesias"
        description="Revisa la referencia pastoral de cada solicitante de tus iglesias: aprueba, solicita más información o rechaza. La validación del pago y la activación final las realiza un administrador."
      />

      {!session.isMembershipReviewerPastor ? (
        <EmptyState
          title="No tienes una iglesia asignada"
          description="Esta bandeja es para pastores con autoridad sobre una o más iglesias. Solicita tu autorización territorial para recibir solicitudes."
        />
      ) : queueQuery.isLoading ? (
        <div className="flex items-center gap-2.5 text-sm text-(--app-text-muted)">
          <Spinner size="sm" /> Cargando solicitudes…
        </div>
      ) : queueQuery.error ? (
        <p className="text-sm text-rose-600">{toErrorMessage(queueQuery.error)}</p>
      ) : items.length === 0 ? (
        <EmptyState
          title="Sin solicitudes pendientes"
          description="Cuando un miembro de tus iglesias envíe su solicitud, aparecerá aquí para tu revisión."
        />
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <QueueCard
              key={item.application.id}
              item={item}
              onChanged={() => void queryClient.invalidateQueries({ queryKey: QUEUE_QUERY_KEY })}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function QueueCard({ item, onChanged }: { item: PastorQueueItem; onChanged: () => void }) {
  const { application, payment } = item
  const [reviewNotes, setReviewNotes] = useState('')

  const reviewMutation = useMutation({
    mutationFn: async (decision: MembershipReviewDecision) =>
      reviewMembershipApplication({
        applicationId: application.id,
        decision,
        pastoralReference: decision === 'approved' ? 'endorsed' : decision === 'rejected' ? 'declined' : undefined,
        reviewNotes
      }),
    onSuccess: (_data, decision) => {
      toast.success(
        decision === 'approved'
          ? 'Solicitud aprobada. Un administrador validará el pago y activará la cuenta.'
          : decision === 'rejected'
            ? 'Solicitud rechazada.'
            : 'Se solicitó más información al miembro.'
      )
      onChanged()
    },
    onError: (error) => toast.error(toErrorMessage(error))
  })

  const fullName = `${application.applicant_first_name} ${application.applicant_last_name}`.trim()
  const isBusy = reviewMutation.isPending

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle>{fullName || 'Solicitante'}</CardTitle>
            <CardDescription>
              {application.category_name} · Cuota {application.dues}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className={workflowBadgeClass(application.status)}>
              {workflowLabels[application.status] ?? application.status}
            </Badge>
            {payment ? (
              <Badge variant="outline" className={payment.status === 'verified' ? workflowBadgeClass('approved') : ''}>
                <Banknote className="size-3.5" /> {paymentLabels[payment.status] ?? payment.status}
              </Badge>
            ) : (
              <Badge variant="outline">Sin pago</Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-2 text-sm text-(--app-text-muted) sm:grid-cols-2">
          <span className="inline-flex items-center gap-2">
            <Building2 className="size-4" /> {application.home_church_name} · {application.church_city}, {application.church_state_province}
          </span>
          <span className="inline-flex items-center gap-2">
            <Mail className="size-4" /> {application.applicant_email}
          </span>
          <span className="inline-flex items-center gap-2">
            <Phone className="size-4" /> {application.applicant_phone}
          </span>
          {application.review_notes ? (
            <span className="sm:col-span-2 text-(--app-text)">Nota previa: {application.review_notes}</span>
          ) : null}
        </div>

        <div>
          <label className="text-sm font-medium text-(--app-text)">Notas de revisión (opcional)</label>
          <Textarea
            value={reviewNotes}
            onChange={(event) => setReviewNotes(event.target.value)}
            disabled={isBusy}
            rows={2}
            placeholder="Comparte contexto para el administrador o el miembro."
            className="mt-1.5"
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button className="sm:flex-1" disabled={isBusy} onClick={() => reviewMutation.mutate('approved')}>
            <CheckCircle2 className="size-4" /> Aprobar referencia
          </Button>
          <Button className="sm:flex-1" variant="outline" disabled={isBusy} onClick={() => reviewMutation.mutate('needs_more_info')}>
            Solicitar más información
          </Button>
          <Button className="sm:flex-1" variant="danger" disabled={isBusy} onClick={() => reviewMutation.mutate('rejected')}>
            Rechazar
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
