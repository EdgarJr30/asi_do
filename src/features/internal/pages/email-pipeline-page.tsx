import { useState } from 'react'

import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import {
  ChevronDown,
  ChevronUp,
  Eye,
  FlaskConical,
  RefreshCw,
  Search,
  Send,
  Trash2
} from 'lucide-react'
import { toast } from 'sonner'

import { useAppSession } from '@/app/providers/app-session-provider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/loader'
import { PageHeader } from '@/components/ui/page-header'
import { Select } from '@/components/ui/select'
import { StatCard } from '@/components/ui/stat-card'
import { Textarea } from '@/components/ui/textarea'
import {
  clearTestEmails,
  fetchEmailDeliveriesPage,
  fetchEmailDeliveryStats,
  fetchTestEmailDeliveries,
  forceTestStatus,
  resendDelivery,
  sendTestEmail,
  type EmailDeliveryRow,
  type EmailDeliveryStatus,
  type EmailStatusFilter,
  type SimulateScenario
} from '@/features/internal/lib/email-pipeline-api'

const PAGE_SIZE = 25

type BadgeVariant = 'default' | 'soft' | 'outline'

const STATUS_META: Record<EmailDeliveryStatus, { label: string; variant: BadgeVariant }> = {
  pending: { label: 'En cola', variant: 'outline' },
  processing: { label: 'Enviando', variant: 'outline' },
  sent: { label: 'Enviado', variant: 'default' },
  failed: { label: 'Fallido', variant: 'soft' },
  read: { label: 'Leído', variant: 'default' },
  clicked: { label: 'Con clic', variant: 'default' }
}

const TYPE_LABEL: Record<string, string> = {
  'email.test': 'Prueba',
  'membership.application_submitted': 'Solicitud enviada',
  'membership.payment_submitted': 'Comprobante subido',
  'membership.reviewed': 'Solicitud revisada',
  'membership.payment_reviewed': 'Pago revisado',
  'membership.activated': 'Membresía activada'
}

const FORCE_OPTIONS: { value: EmailDeliveryStatus; label: string }[] = [
  { value: 'pending', label: 'En cola' },
  { value: 'processing', label: 'Enviando (colgado)' },
  { value: 'sent', label: 'Enviado' },
  { value: 'read', label: 'Leído' },
  { value: 'clicked', label: 'Con clic' },
  { value: 'failed', label: 'Fallido' }
]

function statusMeta(status: EmailDeliveryStatus) {
  return STATUS_META[status] ?? { label: status, variant: 'outline' as BadgeVariant }
}

function typeLabel(type: string | undefined) {
  if (!type) return '—'
  return TYPE_LABEL[type] ?? type
}

/** Destinatario mostrado: override de prueba (payload.to) o el email del usuario. */
function recipientOf(row: EmailDeliveryRow) {
  const override = row.notification?.payload?.to
  if (typeof override === 'string' && override.trim()) return override
  return row.notification?.recipient_user?.email ?? '—'
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  return new Date(value).toLocaleString('es-DO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const STATS_KEY = ['email-pipeline', 'stats'] as const
const PAGE_KEY = ['email-pipeline', 'page'] as const
const TEST_KEY = ['email-pipeline', 'test'] as const

export function EmailPipelinePage() {
  const { permissions, authUser } = useAppSession()
  const canResend = permissions.includes('email:resend')
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<EmailStatusFilter>('all')
  const [selected, setSelected] = useState<EmailDeliveryRow | null>(null)

  const onSearch = (value: string) => {
    setSearch(value)
    setPage(1)
  }
  const onStatusFilter = (value: EmailStatusFilter) => {
    setStatusFilter(value)
    setPage(1)
  }

  const statsQuery = useQuery({ queryKey: STATS_KEY, queryFn: fetchEmailDeliveryStats })
  const pageQuery = useQuery({
    queryKey: [...PAGE_KEY, { page, search, statusFilter }],
    queryFn: () => fetchEmailDeliveriesPage({ page, pageSize: PAGE_SIZE, search, status: statusFilter }),
    placeholderData: keepPreviousData
  })

  const rows = pageQuery.data?.rows ?? []
  const total = pageQuery.data?.total ?? 0
  const stats = statsQuery.data ?? { total: 0, delivered: 0, problem: 0 }
  const inFlight = Math.max(0, stats.total - stats.delivered - stats.problem)
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const refreshAll = () => {
    void queryClient.invalidateQueries({ queryKey: ['email-pipeline'] })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Plataforma"
        title="Pipeline de correos"
        description="Historial de correos transaccionales enviados por el sistema y módulo de prueba aislado."
        actions={
          <Button
            variant="outline"
            onClick={refreshAll}
            disabled={pageQuery.isFetching || statsQuery.isFetching}
          >
            <RefreshCw className={`h-4 w-4 ${pageQuery.isFetching || statsQuery.isFetching ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total" value={stats.total} helper="Correos del pipeline real" />
        <StatCard label="Entregados / enviados" value={stats.delivered} />
        <StatCard label="En proceso" value={inFlight} />
        <StatCard label="Con problema" value={stats.problem} helper="Fallidos" />
      </div>

      <div className="grid gap-3 rounded-panel border border-(--app-border) bg-(--app-surface-elevated) p-4 sm:grid-cols-[1fr_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--app-text-subtle)" />
          <Input
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Buscar por destinatario, asunto o tipo…"
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onChange={(event) => onStatusFilter(event.target.value as EmailStatusFilter)}>
          <option value="all">Todos los estados</option>
          <option value="problem">Solo con problema</option>
          <option value="sent">Enviados</option>
          <option value="pending">En cola</option>
          <option value="processing">Enviando</option>
          <option value="failed">Fallidos</option>
          <option value="read">Leídos</option>
          <option value="clicked">Con clic</option>
        </Select>
      </div>

      <DeliveryTable
        rows={rows}
        total={total}
        loading={pageQuery.isLoading}
        onView={setSelected}
      />

      {total > 0 ? (
        <div className="flex items-center justify-between text-sm text-(--app-text-muted)">
          <span>
            Página {page} de {totalPages} · {total} correos
          </span>
          <div className="flex gap-2">
            <Button variant="outline" disabled={page <= 1 || pageQuery.isFetching} onClick={() => setPage((value) => value - 1)}>
              Anterior
            </Button>
            <Button variant="outline" disabled={page >= totalPages || pageQuery.isFetching} onClick={() => setPage((value) => value + 1)}>
              Siguiente
            </Button>
          </div>
        </div>
      ) : null}

      {canResend ? <TestPanel defaultTo={authUser?.email ?? ''} onView={setSelected} /> : null}

      <DetailModal log={selected} canResend={canResend} onClose={() => setSelected(null)} />
    </div>
  )
}

function DeliveryTable({
  rows,
  total,
  loading,
  onView,
  forceControl,
  onResend
}: {
  rows: EmailDeliveryRow[]
  total: number
  loading: boolean
  onView: (row: EmailDeliveryRow) => void
  forceControl?: (row: EmailDeliveryRow) => React.ReactNode
  onResend?: (row: EmailDeliveryRow) => void
}) {
  const colSpan = 6 + (forceControl ? 1 : 0) + (onResend ? 1 : 0)
  return (
    <div className="overflow-x-auto rounded-panel border border-(--app-border) bg-(--app-surface-elevated)">
      <table className="w-full min-w-[760px] text-sm">
        <thead>
          <tr className="border-b border-(--app-border) text-left text-[0.68rem] uppercase tracking-[0.16em] text-(--app-text-subtle)">
            <th className="px-4 py-3">Estado</th>
            <th className="px-4 py-3">Destinatario</th>
            <th className="px-4 py-3">Asunto</th>
            <th className="px-4 py-3">Tipo</th>
            <th className="px-4 py-3">Intentos</th>
            <th className="px-4 py-3">Fecha</th>
            {forceControl ? <th className="px-4 py-3">Forzar estado</th> : null}
            <th className="px-4 py-3 text-right">{onResend ? 'Acciones' : 'Acción'}</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={colSpan} className="px-4 py-10 text-center text-(--app-text-muted)">
                <Spinner className="mx-auto" />
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={colSpan} className="px-4 py-10 text-center text-(--app-text-muted)">
                {total === 0 ? 'Aún no se ha enviado ningún correo.' : 'Sin resultados'}
              </td>
            </tr>
          ) : (
            rows.map((row) => {
              const meta = statusMeta(row.delivery_status)
              return (
                <tr key={row.id} className="border-b border-(--app-border)/60 transition-colors hover:bg-(--app-surface-muted)/60">
                  <td className="px-4 py-3">
                    <Badge variant={meta.variant}>{meta.label}</Badge>
                  </td>
                  <td className="px-4 py-3 font-medium text-(--app-text)">{recipientOf(row)}</td>
                  <td className="px-4 py-3 max-w-[240px] truncate text-(--app-text-muted)">
                    {row.notification?.title ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-(--app-text-muted)">{typeLabel(row.notification?.type)}</td>
                  <td className="px-4 py-3 text-(--app-text-muted)">{row.attempt_count}</td>
                  <td className="px-4 py-3 text-(--app-text-muted)">{formatDate(row.created_at)}</td>
                  {forceControl ? <td className="px-4 py-3">{forceControl(row)}</td> : null}
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {onResend ? (
                        <button
                          onClick={() => onResend(row)}
                          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-500/12"
                        >
                          <RefreshCw className="h-4 w-4" /> Reenviar
                        </button>
                      ) : null}
                      <button
                        onClick={() => onView(row)}
                        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-500/12"
                      >
                        <Eye className="h-4 w-4" /> Ver
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}

const SCENARIO_HELP: Record<SimulateScenario, string> = {
  send: '⚠️ «Envío real» manda un correo de verdad al destinatario vía Resend.',
  fail: 'Marca el correo como fallido sin enviarlo.',
  hang: 'Deja el correo colgado en «enviando» (sin desenlace).'
}

function TestPanel({ defaultTo, onView }: { defaultTo: string; onView: (row: EmailDeliveryRow) => void }) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [to, setTo] = useState(defaultTo)
  const [subject, setSubject] = useState('Prueba de pipeline de correos')
  const [message, setMessage] = useState('Este es un correo de prueba del pipeline. Si lo recibes, el envío de punta a punta funciona.')
  const [simulate, setSimulate] = useState<SimulateScenario>('send')

  const testQuery = useQuery({ queryKey: TEST_KEY, queryFn: () => fetchTestEmailDeliveries() })
  const testRows = testQuery.data ?? []

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: TEST_KEY })
    void queryClient.invalidateQueries({ queryKey: STATS_KEY })
  }

  const send = useMutation({
    mutationFn: () => sendTestEmail({ to, subject, message, simulate }),
    onSuccess: () => {
      toast.success('Correo de prueba lanzado')
      invalidate()
      // El procesador es asíncrono: refrescar un instante después para ver el desenlace.
      if (simulate === 'send') setTimeout(invalidate, 2500)
    },
    onError: (error: Error) => toast.error(error.message)
  })

  const force = useMutation({
    mutationFn: ({ row, status }: { row: EmailDeliveryRow; status: EmailDeliveryStatus }) =>
      forceTestStatus(row.id, status),
    onSuccess: (_data, variables) => {
      toast.success(`Estado forzado a "${statusMeta(variables.status).label}"`)
      invalidate()
    },
    onError: (error: Error) => toast.error(error.message)
  })

  const resend = useMutation({
    mutationFn: (row: EmailDeliveryRow) => resendDelivery(row.id),
    onSuccess: () => {
      toast.success('Correo reenviado')
      invalidate()
      setTimeout(invalidate, 2500)
    },
    onError: (error: Error) => toast.error(error.message)
  })

  const clear = useMutation({
    mutationFn: () => clearTestEmails(),
    onSuccess: (count) => {
      toast.success(`${count} correos de prueba eliminados`)
      invalidate()
    },
    onError: (error: Error) => toast.error(error.message)
  })

  const onClear = () => {
    if (window.confirm('¿Eliminar todos los correos de prueba? Esta acción no se puede deshacer.')) {
      clear.mutate()
    }
  }

  return (
    <Card className="overflow-hidden border-accent-200/70 bg-accent-50/40 dark:border-accent-500/25 dark:bg-accent-500/[0.06]">
      <button onClick={() => setOpen((value) => !value)} className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left">
        <span className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-100 text-accent-600 dark:bg-accent-500/15 dark:text-accent-200">
            <FlaskConical className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-base font-semibold text-(--app-text)">Modo de prueba</span>
            <span className="block text-sm text-(--app-text-muted)">
              Prueba el pipeline de punta a punta y fuerza cualquier estado. Aislado: no afecta el pipeline real ni las métricas.
            </span>
          </span>
        </span>
        {open ? <ChevronUp className="h-5 w-5 text-(--app-text-subtle)" /> : <ChevronDown className="h-5 w-5 text-(--app-text-subtle)" />}
      </button>

      {open ? (
        <CardContent className="space-y-5 border-t border-accent-200/60 pt-5 dark:border-accent-500/20">
          <div className="grid gap-4 rounded-panel border border-(--app-border) bg-(--app-surface-elevated) p-5 sm:grid-cols-2">
            <label className="space-y-1.5 text-sm">
              <span className="font-medium text-(--app-text)">Destinatario</span>
              <Input value={to} onChange={(event) => setTo(event.target.value)} placeholder="correo@ejemplo.com" />
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="font-medium text-(--app-text)">Escenario a simular</span>
              <Select value={simulate} onChange={(event) => setSimulate(event.target.value as SimulateScenario)}>
                <option value="send">Envío real (end-to-end vía Resend)</option>
                <option value="fail">Forzar fallo (failed)</option>
                <option value="hang">Dejar colgado (enviando)</option>
              </Select>
            </label>
            <label className="space-y-1.5 text-sm sm:col-span-2">
              <span className="font-medium text-(--app-text)">Asunto</span>
              <Input value={subject} onChange={(event) => setSubject(event.target.value)} />
            </label>
            <label className="space-y-1.5 text-sm sm:col-span-2">
              <span className="font-medium text-(--app-text)">Mensaje</span>
              <Textarea rows={3} value={message} onChange={(event) => setMessage(event.target.value)} />
            </label>
            <div className="sm:col-span-2">
              <Button onClick={() => send.mutate()} disabled={!to.trim() || send.isPending} variant="secondary">
                <Send className="h-4 w-4" /> Lanzar correo de prueba
              </Button>
              <p className="mt-2 text-xs text-(--app-text-muted)">{SCENARIO_HELP[simulate]}</p>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Correos de prueba</CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => void testQuery.refetch()} disabled={testQuery.isFetching}>
                <RefreshCw className={`h-4 w-4 ${testQuery.isFetching ? 'animate-spin' : ''}`} /> Actualizar
              </Button>
              <Button variant="danger" onClick={onClear} disabled={testRows.length === 0 || clear.isPending}>
                <Trash2 className="h-4 w-4" /> Limpiar pruebas
              </Button>
            </div>
          </div>

          {testRows.length === 0 ? (
            <EmptyState title="Sin correos de prueba" description="Aún no has lanzado correos de prueba desde este panel." />
          ) : (
            <DeliveryTable
              rows={testRows}
              total={testRows.length}
              loading={testQuery.isLoading}
              onView={onView}
              onResend={(row) => resend.mutate(row)}
              forceControl={(row) => (
                <Select
                  value=""
                  disabled={force.isPending}
                  onChange={(event) => {
                    const status = event.target.value as EmailDeliveryStatus
                    if (status) force.mutate({ row, status })
                  }}
                >
                  <option value="">Cambiar a…</option>
                  {FORCE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              )}
            />
          )}
        </CardContent>
      ) : null}
    </Card>
  )
}

function DetailModal({
  log,
  canResend,
  onClose
}: {
  log: EmailDeliveryRow | null
  canResend: boolean
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const resend = useMutation({
    mutationFn: (deliveryId: string) => resendDelivery(deliveryId),
    onSuccess: () => {
      toast.success('Correo reenviado')
      void queryClient.invalidateQueries({ queryKey: ['email-pipeline'] })
      onClose()
    },
    onError: (error: Error) => toast.error(error.message)
  })

  if (!log) return null

  const meta = statusMeta(log.delivery_status)
  const errorPayload = log.delivery_status === 'failed' ? log.response_payload : null

  const timeline = [
    { label: 'Creado', at: log.created_at },
    { label: 'Último intento', at: log.last_attempt_at },
    { label: 'Entregado', at: log.delivered_at },
    { label: 'Fallido', at: log.failed_at }
  ].filter((item) => item.at)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button aria-label="Cerrar" className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <Card className="relative z-10 max-h-[90vh] w-full max-w-2xl overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>Correo de email</CardTitle>
          <Badge variant={meta.variant}>{meta.label}</Badge>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Info label="Destinatario" value={recipientOf(log)} />
            <Info label="Proveedor" value={log.provider_name} />
            <Info label="Asunto" value={log.notification?.title ?? '—'} />
            <Info label="Tipo" value={typeLabel(log.notification?.type)} />
            <Info label="ID del proveedor" value={log.provider_message_id ?? '—'} />
            <Info label="Intentos" value={String(log.attempt_count)} />
          </div>

          {errorPayload && Object.keys(errorPayload).length > 0 ? (
            <div className="rounded-panel border border-rose-300/50 bg-rose-50/60 p-4 dark:border-rose-500/25 dark:bg-rose-500/10">
              <p className="text-[0.68rem] uppercase tracking-[0.16em] text-(--app-text-subtle)">Error</p>
              <pre className="mt-1 whitespace-pre-wrap break-words font-mono text-xs text-rose-600 dark:text-rose-300">
                {JSON.stringify(errorPayload, null, 2)}
              </pre>
            </div>
          ) : null}

          {timeline.length > 0 ? (
            <div className="rounded-panel bg-(--app-surface-muted) p-4">
              <p className="mb-2 text-[0.68rem] uppercase tracking-[0.16em] text-(--app-text-subtle)">Línea de tiempo</p>
              <ul className="space-y-1 text-sm">
                {timeline.map((item) => (
                  <li key={item.label} className="flex justify-between">
                    <span className="text-(--app-text-muted)">{item.label}</span>
                    <span className="font-medium text-(--app-text)">{formatDate(item.at)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {log.notification?.body ? (
            <div>
              <p className="mb-1.5 text-[0.68rem] uppercase tracking-[0.16em] text-(--app-text-subtle)">Contenido</p>
              <p className="rounded-panel border border-(--app-border) bg-(--app-surface-elevated) p-4 text-sm leading-6 text-(--app-text-muted)">
                {log.notification.body}
              </p>
            </div>
          ) : null}

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose}>
              Cerrar
            </Button>
            {canResend ? (
              <Button onClick={() => resend.mutate(log.id)} disabled={resend.isPending}>
                <RefreshCw className="h-4 w-4" /> Reenviar
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[0.68rem] uppercase tracking-[0.16em] text-(--app-text-subtle)">{label}</p>
      <p className="mt-0.5 break-words font-medium text-(--app-text)">{value}</p>
    </div>
  )
}
