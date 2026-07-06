import { useState } from 'react'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Banknote,
  Building2,
  CheckCircle2,
  Mail,
  Paperclip,
  Phone,
  UploadCloud
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
  createMembershipReceiptUrl,
  fetchMembershipPaymentSettings,
  fetchPastorMembershipQueue,
  getCategoryDue,
  reviewMembershipApplication,
  submitMembershipPaymentReceipt,
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
  const [showUpload, setShowUpload] = useState(false)

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

        {payment?.receipt_path ? <ReceiptViewLink receiptPath={payment.receipt_path} /> : null}

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

        <div className="border-t border-(--app-border) pt-3">
          {showUpload ? (
            <PastorReceiptUpload application={application} onUploaded={onChanged} />
          ) : (
            <Button variant="ghost" className="h-9" onClick={() => setShowUpload(true)}>
              <UploadCloud className="size-4" /> Subir comprobante por el miembro
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function ReceiptViewLink({ receiptPath }: { receiptPath: string }) {
  const openMutation = useMutation({
    mutationFn: async () => createMembershipReceiptUrl(receiptPath),
    onSuccess: (url) => window.open(url, '_blank', 'noopener,noreferrer'),
    onError: (error) => toast.error(toErrorMessage(error))
  })

  return (
    <Button variant="outline" className="h-9" disabled={openMutation.isPending} onClick={() => openMutation.mutate()}>
      <Paperclip className="size-4" /> {openMutation.isPending ? 'Abriendo…' : 'Ver comprobante del miembro'}
    </Button>
  )
}

const ACCEPTED_RECEIPT_TYPES = 'application/pdf,image/png,image/jpeg,image/webp'

function PastorReceiptUpload({
  application,
  onUploaded
}: {
  application: PastorQueueItem['application']
  onUploaded: () => void
}) {
  const session = useAppSession()
  const [file, setFile] = useState<File | null>(null)
  const [referenceNote, setReferenceNote] = useState('')

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!application.requester_user_id) {
        throw new Error('Esta solicitud no tiene un miembro asociado.')
      }
      if (!file) {
        throw new Error('Selecciona el archivo del comprobante.')
      }
      const settings = await fetchMembershipPaymentSettings()
      const due = getCategoryDue(settings, application.category_slug)
      return submitMembershipPaymentReceipt({
        applicationId: application.id,
        memberUserId: application.requester_user_id,
        categorySlug: application.category_slug,
        amount: due?.amount ?? null,
        currency: settings?.currency ?? 'USD',
        file,
        referenceNote,
        uploadedByUserId: session.authUser?.id
      })
    },
    onSuccess: () => {
      toast.success('Comprobante subido. Un administrador lo verificará.')
      setFile(null)
      setReferenceNote('')
      onUploaded()
    },
    onError: (error) => toast.error(toErrorMessage(error))
  })

  return (
    <div className="rounded-card border border-(--app-border) bg-(--app-surface-muted) p-4">
      <p className="text-sm font-semibold text-(--app-text)">Subir comprobante por el miembro</p>
      <p className="mt-0.5 text-xs text-(--app-text-muted)">PDF o imagen (PNG, JPG, WebP), máximo 10 MB.</p>
      <input
        type="file"
        accept={ACCEPTED_RECEIPT_TYPES}
        onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        disabled={uploadMutation.isPending}
        className="mt-3 block w-full text-sm text-(--app-text-muted) file:mr-3 file:rounded-control file:border-0 file:bg-(--app-surface) file:px-3 file:py-2 file:text-sm file:font-semibold file:text-(--app-text) hover:file:bg-(--app-border)"
      />
      <input
        type="text"
        value={referenceNote}
        onChange={(event) => setReferenceNote(event.target.value)}
        disabled={uploadMutation.isPending}
        placeholder="Referencia o número de transferencia (opcional)"
        className="mt-3 block w-full rounded-control border border-(--app-border) bg-(--app-surface) px-3 py-2 text-sm text-(--app-text) placeholder:text-(--app-text-subtle) focus:border-primary-500 focus:outline-none"
      />
      <Button className="mt-3 h-10" disabled={!file || uploadMutation.isPending} onClick={() => uploadMutation.mutate()}>
        <UploadCloud className="size-4" /> {uploadMutation.isPending ? 'Subiendo…' : 'Enviar comprobante'}
      </Button>
    </div>
  )
}
