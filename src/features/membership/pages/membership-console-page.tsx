import { useMemo, useState } from 'react'

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Banknote, CheckCircle2, Paperclip, Power, Search, Sparkles } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/loader'
import { Textarea } from '@/components/ui/textarea'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { AdminPage, AdminStat, AdminStatBar, AdminTabs } from '@/features/internal/components/admin-redesign'
import { toErrorMessage } from '@/features/auth/lib/auth-api'
import {
  activateMember,
  createMembershipReceiptUrl,
  deactivateMember,
  fetchAdminMembershipCounts,
  fetchAdminMembershipPage,
  reviewMembershipApplication,
  verifyMembershipPayment,
  type AdminMembershipFilter,
  type AdminMembershipRow,
  type MembershipReviewDecision
} from '@/features/membership/lib/membership-api'
import { useInfiniteScroll } from '@/shared/ui/use-infinite-scroll'
import { useRealtimeSync } from '@/lib/realtime/use-realtime-sync'

const CONSOLE_QUERY_KEY = ['membership', 'admin-console'] as const
const CONSOLE_COUNTS_QUERY_KEY = ['membership', 'admin-console-counts'] as const
const MEMBERSHIP_PAGE_SIZE = 10
type MembershipFilter = AdminMembershipFilter

const workflowLabels: Record<string, string> = {
  submitted: 'Enviada',
  under_review: 'En revisión',
  needs_more_info: 'Falta información',
  approved: 'Aprobada',
  rejected: 'Rechazada',
  cancelled: 'Cancelada'
}

const paymentLabels: Record<string, string> = {
  initiated: 'Pago iniciado',
  submitted: 'Comprobante por verificar',
  verified: 'Pago verificado',
  rejected: 'Comprobante rechazado',
  failed: 'Pago fallido',
  cancelled: 'Pago cancelado'
}

const membershipStatusLabels: Record<string, string> = {
  none: 'Sin membresía',
  pending: 'Membresía pendiente',
  active: 'Membresía activa',
  grace_period: 'Membresía en gracia',
  expired: 'Membresía vencida',
  suspended: 'Membresía inactiva',
  revoked: 'Membresía revocada'
}

function positiveBadge(active: boolean) {
  return active
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/12 dark:text-emerald-200'
    : ''
}

export function MembershipConsolePage() {
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<MembershipFilter>('all')
  const [search, setSearch] = useState('')
  // El input responde en vivo, pero la búsqueda paginada solo golpea el servidor
  // ~300 ms tras dejar de teclear (no en cada carácter).
  const debouncedSearch = useDebouncedValue(search.trim())

  const consoleQuery = useInfiniteQuery({
    queryKey: [...CONSOLE_QUERY_KEY, filter, debouncedSearch],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      fetchAdminMembershipPage({ filter, search: debouncedSearch, limit: MEMBERSHIP_PAGE_SIZE, offset: pageParam }),
    getNextPageParam: (lastPage) => lastPage.nextOffset
  })

  const countsQuery = useQuery({ queryKey: CONSOLE_COUNTS_QUERY_KEY, queryFn: fetchAdminMembershipCounts })
  const counts = countsQuery.data

  const { fetchNextPage, hasNextPage, isFetchingNextPage } = consoleQuery
  const pages = useMemo(() => consoleQuery.data?.pages ?? [], [consoleQuery.data])
  const rows = useMemo(() => pages.flatMap((entry) => entry.rows), [pages])
  const totalCount = pages[0]?.totalCount ?? 0

  const sentinelRef = useInfiniteScroll({
    hasNextPage: Boolean(hasNextPage),
    isFetchingNextPage,
    onLoadMore: () => void fetchNextPage(),
    deps: [rows.length]
  })

  const invalidateConsole = () =>
    void Promise.all([
      queryClient.invalidateQueries({ queryKey: CONSOLE_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: CONSOLE_COUNTS_QUERY_KEY })
    ])

  // Actualiza la consola en vivo cuando llegan solicitudes/pagos nuevos o cuando
  // otro admin actúa sobre la misma cola, sin que nadie tenga que recargar.
  useRealtimeSync('admin-membership-console', [
    { table: 'institutional_membership_applications', invalidate: [CONSOLE_QUERY_KEY, CONSOLE_COUNTS_QUERY_KEY] },
    { table: 'membership_payments', invalidate: [CONSOLE_QUERY_KEY, CONSOLE_COUNTS_QUERY_KEY] },
    { table: 'memberships', invalidate: [CONSOLE_QUERY_KEY, CONSOLE_COUNTS_QUERY_KEY] }
  ])

  return (
    <AdminPage
      eyebrow="Admin · Membresías"
      title="Administración de membresías"
      description="Revisa solicitudes, valida pagos, activa membresías y puede inactivar una membresía activa cuando el administrador lo necesite."
    >
      <div className="space-y-4">
        <AdminStatBar columns={4}>
          <AdminStat label="En revisión" value={counts?.review ?? '—'} tone="amber" />
          <AdminStat label="Aprobadas" value={counts?.approved ?? '—'} tone="green" />
          <AdminStat label="Activas" value={counts?.active ?? '—'} tone="teal" />
          <AdminStat label="Inactivas" value={counts?.inactive ?? '—'} tone="rose" />
        </AdminStatBar>

        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
          <AdminTabs
            value={filter}
            onChange={setFilter}
            tabs={[
              { value: 'all', label: 'Todas', count: counts?.all },
              { value: 'review', label: 'En revisión', count: counts?.review },
              { value: 'approved', label: 'Aprobadas', count: counts?.approved },
              { value: 'active', label: 'Activas', count: counts?.active },
              { value: 'inactive', label: 'Inactivas', count: counts?.inactive }
            ]}
          />
          <div className="relative lg:max-w-sm lg:flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-(--app-text-subtle)" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nombre, email, categoría…"
              className="h-10 rounded-control pl-9"
            />
          </div>
        </div>

      {consoleQuery.isLoading ? (
        <div className="flex items-center gap-2.5 text-sm text-(--app-text-muted)">
          <Spinner size="sm" /> Cargando solicitudes…
        </div>
      ) : consoleQuery.error ? (
        <p className="text-sm text-rose-600">{toErrorMessage(consoleQuery.error)}</p>
      ) : rows.length === 0 ? (
        <EmptyState
          title={search.trim() || filter !== 'all' ? 'Sin resultados' : 'Sin solicitudes en curso'}
          description={
            search.trim() || filter !== 'all'
              ? 'No encontramos solicitudes con ese filtro o búsqueda.'
              : 'Cuando un miembro envíe su solicitud o un pago, aparecerá aquí para tu gestión.'
          }
        />
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <ConsoleCard key={row.application.id} row={row} onChanged={invalidateConsole} />
          ))}

          <div ref={sentinelRef} aria-hidden className="h-px w-full" />
          {isFetchingNextPage ? (
            <div className="flex items-center justify-center gap-2 py-3 text-[0.78rem] text-(--app-text-subtle)">
              <Spinner size="sm" /> Cargando más solicitudes…
            </div>
          ) : !hasNextPage && rows.length > 0 ? (
            <p className="py-3 text-center text-[0.74rem] text-(--app-text-subtle)">
              {totalCount} {totalCount === 1 ? 'solicitud' : 'solicitudes'} · no hay más
            </p>
          ) : null}
        </div>
      )}
      </div>
    </AdminPage>
  )
}

function ConsoleCard({ row, onChanged }: { row: AdminMembershipRow; onChanged: () => void }) {
  const { application, payment, member } = row
  const [notes, setNotes] = useState('')
  const [notesOpen, setNotesOpen] = useState(false)

  const isActivated = member?.asi_membership_status === 'active'
  const appOpen = ['submitted', 'under_review', 'needs_more_info'].includes(application.status)
  const canActivate = application.status === 'approved' && payment?.status === 'verified' && !isActivated
  const memberStatus = member?.asi_membership_status ?? 'none'

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

  const deactivateMutation = useMutation({
    mutationFn: async () => {
      if (!member) {
        throw new Error('No hay un usuario vinculado para inactivar.')
      }
      return deactivateMember({ userId: member.id, notes })
    },
    onSuccess: () => {
      toast.success('Membresía inactivada. El miembro ya no tiene acceso protegido.')
      onChanged()
    },
    onError: (error) => toast.error(toErrorMessage(error))
  })

  const busy = reviewMutation.isPending || paymentMutation.isPending || activateMutation.isPending || deactivateMutation.isPending
  const fullName = `${application.applicant_first_name} ${application.applicant_last_name}`.trim()

  return (
    <Card className="rounded-card p-3.5 sm:p-4">
      <CardHeader className="pb-1">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-0.5">
            <CardTitle className="text-[0.9rem]">{fullName || 'Solicitante'}</CardTitle>
            <CardDescription className="text-[0.78rem]">
              {application.category_name} · Cuota {application.dues} · {application.home_church_name} · {application.church_city}
            </CardDescription>
            <p className="text-[0.72rem] text-(--app-text-muted)">{application.applicant_email}</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {isActivated ? (
              <Badge variant="outline" className={positiveBadge(true)}>
                <Sparkles className="size-3.5" /> Membresía activa
              </Badge>
            ) : member ? (
              <Badge variant="outline">
                {membershipStatusLabels[memberStatus] ?? memberStatus}
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

      <CardContent className="mt-2.5 space-y-2.5">
        <div className="grid gap-1.5 text-[0.8rem] text-(--app-text-muted) sm:grid-cols-2">
          {member ? (
            <>
              <span>Acceso: {membershipStatusLabels[memberStatus] ?? memberStatus}</span>
              <span>
                Vigencia:{' '}
                {member.membership_expires_at ? new Date(member.membership_expires_at).toLocaleDateString('es-DO') : 'Sin fecha'}
              </span>
            </>
          ) : null}
          {application.review_notes ? (
            <span className="sm:col-span-2 text-(--app-text)">Notas: {application.review_notes}</span>
          ) : null}
        </div>

        {payment?.receipt_path ? <ReceiptViewLink receiptPath={payment.receipt_path} /> : null}

        <Button variant="ghost" className="h-8 rounded-control px-3 text-[0.8rem]" onClick={() => setNotesOpen((value) => !value)}>
          Notas
        </Button>

        {notesOpen ? (
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
        ) : null}

        {/* Revisión de la solicitud */}
        {appOpen ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-(--app-text-subtle)">Solicitud</p>
            <div className="flex flex-wrap gap-2">
              <Button className="h-8 rounded-control px-3 text-[0.8rem]" disabled={busy} onClick={() => reviewMutation.mutate('approved')}>
                <CheckCircle2 className="size-4" /> Aprobar
              </Button>
              <Button className="h-8 rounded-control px-3 text-[0.8rem]" variant="outline" disabled={busy} onClick={() => reviewMutation.mutate('needs_more_info')}>
                Pedir más info
              </Button>
              <Button className="h-8 rounded-control px-3 text-[0.8rem]" variant="danger" disabled={busy} onClick={() => reviewMutation.mutate('rejected')}>
                Rechazar
              </Button>
            </div>
          </div>
        ) : null}

        {/* Verificación del pago */}
        {payment && payment.status === 'submitted' ? (
          <div className="space-y-2 border-t border-(--app-border) pt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-(--app-text-subtle)">Pago</p>
            <div className="flex flex-wrap gap-2">
              <Button className="h-8 rounded-control px-3 text-[0.8rem]" disabled={busy} onClick={() => paymentMutation.mutate('verified')}>
                <Banknote className="size-4" /> Verificar pago
              </Button>
              <Button className="h-8 rounded-control px-3 text-[0.8rem]" variant="danger" disabled={busy} onClick={() => paymentMutation.mutate('rejected')}>
                Rechazar comprobante
              </Button>
            </div>
          </div>
        ) : null}

        {/* Activación */}
        {!isActivated ? (
          <div className="border-t border-(--app-border) pt-3">
            <Button className="h-8 rounded-control px-3 text-[0.8rem]" disabled={busy || !canActivate} onClick={() => activateMutation.mutate()}>
              <Sparkles className="size-4" /> Activar membresía
            </Button>
            {!canActivate ? (
              <p className="mt-1.5 text-xs text-(--app-text-muted)">
                Disponible cuando la solicitud esté aprobada y el pago verificado.
              </p>
            ) : null}
          </div>
        ) : (
          <div className="space-y-2 border-t border-(--app-border) pt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-(--app-text-subtle)">Membresía activa</p>
            <Button className="h-8 rounded-control px-3 text-[0.8rem]" variant="danger" disabled={busy} onClick={() => deactivateMutation.mutate()}>
              <Power className="size-4" /> Inactivar membresía
            </Button>
            <p className="text-xs text-(--app-text-muted)">
              Úsalo solo cuando el administrador necesite retirar el acceso protegido del miembro.
            </p>
          </div>
        )}
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
    <Button variant="outline" className="h-8 rounded-control px-3 text-[0.8rem]" disabled={openMutation.isPending} onClick={() => openMutation.mutate()}>
      <Paperclip className="size-4" /> {openMutation.isPending ? 'Abriendo…' : 'Ver comprobante'}
    </Button>
  )
}
