import { useState } from 'react'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Banknote, Building2, CheckCircle2, Mail, Paperclip, Sparkles } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Spinner } from '@/components/ui/loader'
import { PageHeader } from '@/components/ui/page-header'
import { Textarea } from '@/components/ui/textarea'
import { toErrorMessage } from '@/features/auth/lib/auth-api'
import {
  activateMember,
  createMembershipReceiptUrl,
  fetchAdminMembershipApplications,
  reviewMembershipApplication,
  verifyMembershipPayment,
  type AdminMembershipRow,
  type MembershipReviewDecision
} from '@/features/membership/lib/membership-api'

const CONSOLE_QUERY_KEY = ['membership', 'admin-console'] as const

const workflowLabels: Record<string, string> = {
  submitted: 'Enviada',
  under_review: 'En revisión',
  needs_more_info: 'Falta información',
  approved: 'Aprobada',
  rejected: 'Rechazada',
  cancelled: 'Cancelada'
}

const paymentLabels: Record<string, string> = {
  submitted: 'Comprobante por verificar',
  verified: 'Pago verificado',
  rejected: 'Comprobante rechazado'
}

function positiveBadge(active: boolean) {
  return active
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/12 dark:text-emerald-200'
    : ''
}

export function MembershipConsolePage() {
  const queryClient = useQueryClient()
  const consoleQuery = useQuery({ queryKey: CONSOLE_QUERY_KEY, queryFn: fetchAdminMembershipApplications })
  const rows = consoleQuery.data ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Membresía"
        title="Consola de membresía"
        description="Revisa solicitudes, valida los comprobantes de pago y activa las cuentas. La activación exige solicitud aprobada y pago verificado."
      />

      {consoleQuery.isLoading ? (
        <div className="flex items-center gap-2.5 text-sm text-(--app-text-muted)">
          <Spinner size="sm" /> Cargando solicitudes…
        </div>
      ) : consoleQuery.error ? (
        <p className="text-sm text-rose-600">{toErrorMessage(consoleQuery.error)}</p>
      ) : rows.length === 0 ? (
        <EmptyState
          title="Sin solicitudes en curso"
          description="Cuando un miembro envíe su solicitud o un pago, aparecerá aquí para tu gestión."
        />
      ) : (
        <div className="space-y-4">
          {rows.map((row) => (
            <ConsoleCard
              key={row.application.id}
              row={row}
              onChanged={() => void queryClient.invalidateQueries({ queryKey: CONSOLE_QUERY_KEY })}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ConsoleCard({ row, onChanged }: { row: AdminMembershipRow; onChanged: () => void }) {
  const { application, payment, member } = row
  const [notes, setNotes] = useState('')

  const isActivated = member?.asi_membership_status === 'active'
  const appOpen = ['submitted', 'under_review', 'needs_more_info'].includes(application.status)
  const canActivate = application.status === 'approved' && payment?.status === 'verified' && !isActivated

  const reviewMutation = useMutation({
    mutationFn: async (decision: MembershipReviewDecision) =>
      reviewMembershipApplication({
        applicationId: application.id,
        decision,
        pastoralReference: decision === 'approved' ? 'endorsed' : decision === 'rejected' ? 'declined' : undefined,
        reviewNotes: notes
      }),
    onSuccess: () => {
      toast.success('Solicitud actualizada.')
      onChanged()
    },
    onError: (error) => toast.error(toErrorMessage(error))
  })

  const paymentMutation = useMutation({
    mutationFn: async (decision: 'verified' | 'rejected') => {
      if (!payment) {
        throw new Error('No hay un comprobante para validar.')
      }
      return verifyMembershipPayment({ paymentId: payment.id, decision, notes })
    },
    onSuccess: (_data, decision) => {
      toast.success(decision === 'verified' ? 'Pago verificado.' : 'Comprobante rechazado.')
      onChanged()
    },
    onError: (error) => toast.error(toErrorMessage(error))
  })

  const activateMutation = useMutation({
    mutationFn: async () => activateMember({ applicationId: application.id, notes }),
    onSuccess: () => {
      toast.success('Cuenta activada. El miembro ya tiene acceso a la plataforma.')
      onChanged()
    },
    onError: (error) => toast.error(toErrorMessage(error))
  })

  const busy = reviewMutation.isPending || paymentMutation.isPending || activateMutation.isPending
  const fullName = `${application.applicant_first_name} ${application.applicant_last_name}`.trim()

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
            {isActivated ? (
              <Badge variant="outline" className={positiveBadge(true)}>
                <Sparkles className="size-3.5" /> Cuenta activada
              </Badge>
            ) : null}
            <Badge variant="outline" className={positiveBadge(application.status === 'approved')}>
              {workflowLabels[application.status] ?? application.status}
            </Badge>
            {payment ? (
              <Badge variant="outline" className={positiveBadge(payment.status === 'verified')}>
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
            <Building2 className="size-4" /> {application.home_church_name} · {application.church_city}
          </span>
          <span className="inline-flex items-center gap-2">
            <Mail className="size-4" /> {application.applicant_email}
          </span>
          {application.review_notes ? (
            <span className="sm:col-span-2 text-(--app-text)">Notas: {application.review_notes}</span>
          ) : null}
        </div>

        {payment?.receipt_path ? <ReceiptViewLink receiptPath={payment.receipt_path} /> : null}

        <div>
          <label className="text-sm font-medium text-(--app-text)">Notas (se adjuntan a la acción)</label>
          <Textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            disabled={busy}
            rows={2}
            placeholder="Contexto para el expediente o para el miembro."
            className="mt-1.5"
          />
        </div>

        {/* Revisión de la solicitud */}
        {appOpen ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-(--app-text-subtle)">Solicitud</p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button className="sm:flex-1" disabled={busy} onClick={() => reviewMutation.mutate('approved')}>
                <CheckCircle2 className="size-4" /> Aprobar
              </Button>
              <Button className="sm:flex-1" variant="outline" disabled={busy} onClick={() => reviewMutation.mutate('needs_more_info')}>
                Pedir más info
              </Button>
              <Button className="sm:flex-1" variant="danger" disabled={busy} onClick={() => reviewMutation.mutate('rejected')}>
                Rechazar
              </Button>
            </div>
          </div>
        ) : null}

        {/* Verificación del pago */}
        {payment && payment.status === 'submitted' ? (
          <div className="space-y-2 border-t border-(--app-border) pt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-(--app-text-subtle)">Pago</p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button className="sm:flex-1" disabled={busy} onClick={() => paymentMutation.mutate('verified')}>
                <Banknote className="size-4" /> Verificar pago
              </Button>
              <Button className="sm:flex-1" variant="danger" disabled={busy} onClick={() => paymentMutation.mutate('rejected')}>
                Rechazar comprobante
              </Button>
            </div>
          </div>
        ) : null}

        {/* Activación */}
        {!isActivated ? (
          <div className="border-t border-(--app-border) pt-3">
            <Button className="h-11 w-full sm:w-auto" disabled={busy || !canActivate} onClick={() => activateMutation.mutate()}>
              <Sparkles className="size-4" /> Activar cuenta
            </Button>
            {!canActivate ? (
              <p className="mt-1.5 text-xs text-(--app-text-muted)">
                Disponible cuando la solicitud esté aprobada y el pago verificado.
              </p>
            ) : null}
          </div>
        ) : null}
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
      <Paperclip className="size-4" /> {openMutation.isPending ? 'Abriendo…' : 'Ver comprobante'}
    </Button>
  )
}
