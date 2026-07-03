import { useEffect, useMemo, useState } from 'react'

import { useQuery } from '@tanstack/react-query'
import { Copy, Eye, LockKeyhole, Search, X } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PageLoader } from '@/components/ui/loader'
import {
  AdminCard,
  AdminEmpty,
  AdminStat,
  AdminStatBar,
  AdminTabs,
} from '@/features/internal/components/admin-redesign'
import {
  fetchFinanceAuditTransactions,
  type FinanceAuditStatus,
  type FinanceAuditTransaction,
} from '@/features/internal/lib/finance-audit-api'

type AuditFilter = 'all' | FinanceAuditStatus

const AUDIT_QUERY_KEY = ['admin', 'finance', 'azul-audit'] as const
const EMPTY_TRANSACTIONS: FinanceAuditTransaction[] = []

const statusMeta: Record<FinanceAuditStatus, { label: string; className: string }> = {
  approved: {
    label: 'Aprobada',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/12 dark:text-emerald-200',
  },
  declined: {
    label: 'Declinada',
    className: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/25 dark:bg-rose-500/12 dark:text-rose-200',
  },
  processing: {
    label: 'En proceso',
    className: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/25 dark:bg-sky-500/12 dark:text-sky-200',
  },
  refunded: {
    label: 'Reembolsada',
    className: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/25 dark:bg-violet-500/12 dark:text-violet-200',
  },
}

const filterTabs: Array<{ value: AuditFilter; label: string }> = [
  { value: 'all', label: 'Todas' },
  { value: 'approved', label: 'Aprobadas' },
  { value: 'declined', label: 'Declinadas' },
  { value: 'processing', label: 'En proceso' },
  { value: 'refunded', label: 'Reembolsadas' },
]

function formatMoney(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatDay(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return 'Fecha no disponible'
  }
  return new Intl.DateTimeFormat('es-DO', { day: '2-digit', month: 'short', year: 'numeric' }).format(date).replace('.', '')
}

function formatTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '--:--:--'
  }
  return new Intl.DateTimeFormat('es-DO', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date)
}

function transactionSearchText(transaction: FinanceAuditTransaction) {
  return [
    transaction.orderNumber,
    transaction.azulOrderId,
    transaction.authorizationCode,
    transaction.maskedCard,
    transaction.cardBrand,
    transaction.displayName,
    transaction.sourceLabel,
    transaction.rrn,
    transaction.rawStatus,
    JSON.stringify(transaction.gatewayPayload),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

export function AdminPaymentAuditPage() {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<AuditFilter>('all')
  const [selected, setSelected] = useState<FinanceAuditTransaction | null>(null)

  const auditQuery = useQuery({
    queryKey: AUDIT_QUERY_KEY,
    queryFn: () => fetchFinanceAuditTransactions(),
  })

  const transactions = auditQuery.data ?? EMPTY_TRANSACTIONS
  const stats = useMemo(() => {
    const last30Start = new Date()
    last30Start.setDate(last30Start.getDate() - 30)

    const approved = transactions.filter((transaction) => transaction.status === 'approved')
    return {
      last30: transactions.filter((transaction) => new Date(transaction.occurredAt) >= last30Start).length,
      approved: approved.length,
      declined: transactions.filter((transaction) => transaction.status === 'declined').length,
      approvedAmount: approved.reduce((sum, transaction) => sum + transaction.amount, 0),
    }
  }, [transactions])

  const filteredTransactions = useMemo(() => {
    const query = search.trim().toLowerCase()
    return transactions.filter((transaction) => {
      const matchesFilter = filter === 'all' || transaction.status === filter
      const matchesSearch = !query || transactionSearchText(transaction).includes(query)
      return matchesFilter && matchesSearch
    })
  }, [filter, search, transactions])

  return (
    <div className="space-y-5">
      <AdminStatBar columns={4}>
        <AdminStat label="Transacciones" value={String(transactions.length)} helper={`${stats.last30} en los ultimos 30 dias`} tone="blue" />
        <AdminStat label="Aprobadas" value={String(stats.approved)} helper="Autorizadas por AZUL" tone="green" />
        <AdminStat label="Declinadas / error" value={String(stats.declined)} helper="Sin autorizacion aprobada" tone="rose" />
        <AdminStat label="Monto aprobado" value={formatMoney(stats.approvedAmount, 'DOP')} helper="Suma de aprobadas" tone="violet" />
      </AdminStatBar>

      <AdminCard
        title="Auditoría de pagos AZUL"
        description="Historial de cuotas y donaciones procesadas por la Página de Pago de AZUL, con respuesta cruda para soporte y conciliación."
        tag={<Badge variant="soft">Pasarela</Badge>}
      >
        <div className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <label className="relative block min-w-0 flex-1">
              <span className="sr-only">Buscar transacciones AZUL</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-(--app-text-subtle)" />
              <Input
                className="pl-9"
                placeholder="Buscar por tracking, orden AZUL, autorizacion, tarjeta o persona"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <AdminTabs value={filter} tabs={filterTabs} onChange={setFilter} />
          </div>

          {auditQuery.isLoading ? (
            <PageLoader inline label="Cargando auditoría de pagos AZUL" />
          ) : auditQuery.error ? (
            <div className="rounded-card border border-rose-200 bg-rose-50 px-4 py-6 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
              No pudimos cargar la auditoría de pagos. Verifica tu permiso de administración e intenta de nuevo.
            </div>
          ) : filteredTransactions.length === 0 ? (
            <AdminEmpty
              title="Sin transacciones para mostrar"
              description={transactions.length === 0 ? 'Aún no hay intentos AZUL registrados.' : 'La búsqueda o el filtro actual no arroja resultados.'}
            />
          ) : (
            <>
              <div className="hidden overflow-x-auto rounded-card border border-(--app-border) lg:block">
                <table className="min-w-[980px] w-full border-collapse bg-(--app-surface-elevated) text-left text-sm">
                  <thead className="border-b border-(--app-border) bg-(--app-surface-muted)">
                    <tr className="text-[0.68rem] font-bold uppercase tracking-[0.08em] text-(--app-text-subtle)">
                      <th className="px-4 py-3">Fecha y hora</th>
                      <th className="px-4 py-3">Tracking de compra</th>
                      <th className="px-4 py-3">Tarjeta</th>
                      <th className="px-4 py-3">Estado</th>
                      <th className="px-4 py-3">Autorización</th>
                      <th className="px-4 py-3 text-right">Monto</th>
                      <th className="px-4 py-3 text-right">Detalle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions.map((transaction) => (
                      <AuditTableRow key={transaction.id} transaction={transaction} onOpen={setSelected} />
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-3 lg:hidden">
                {filteredTransactions.map((transaction) => (
                  <AuditMobileRow key={transaction.id} transaction={transaction} onOpen={setSelected} />
                ))}
              </div>
            </>
          )}
        </div>
      </AdminCard>

      {selected ? <TransactionDetailModal transaction={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  )
}

function AuditTableRow({
  transaction,
  onOpen,
}: {
  transaction: FinanceAuditTransaction
  onOpen: (transaction: FinanceAuditTransaction) => void
}) {
  return (
    <tr className="border-b border-(--app-border)/70 last:border-b-0 hover:bg-(--app-surface-muted)/60">
      <td className="px-4 py-3 align-middle">
        <p className="font-semibold text-(--app-text)">{formatDay(transaction.occurredAt)}</p>
        <p className="font-mono text-xs tabular-nums text-(--app-text-subtle)">{formatTime(transaction.occurredAt)}</p>
      </td>
      <td className="px-4 py-3 align-middle">
        <p className="max-w-[230px] truncate font-mono text-xs font-semibold text-(--app-text)">{transaction.orderNumber}</p>
        <p className="mt-1 max-w-[230px] truncate text-xs text-(--app-text-muted)">
          {transaction.displayName} · {transaction.sourceLabel}
        </p>
      </td>
      <td className="px-4 py-3 align-middle">
        <PaymentCardCell transaction={transaction} />
      </td>
      <td className="px-4 py-3 align-middle">
        <StatusBadge status={transaction.status} />
      </td>
      <td className="px-4 py-3 align-middle font-mono text-xs font-semibold text-(--app-text)">{transaction.authorizationCode ?? '—'}</td>
      <td className="px-4 py-3 align-middle text-right font-semibold tabular-nums text-(--app-text)">
        {formatMoney(transaction.amount, transaction.currency)}
      </td>
      <td className="px-4 py-3 align-middle text-right">
        <Button
          variant="ghost"
          className="size-9 rounded-control p-0 text-primary-600 hover:text-primary-700 dark:text-primary-300"
          aria-label={`Ver detalle de ${transaction.orderNumber}`}
          onClick={() => onOpen(transaction)}
        >
          <Eye className="size-4" />
        </Button>
      </td>
    </tr>
  )
}

function AuditMobileRow({
  transaction,
  onOpen,
}: {
  transaction: FinanceAuditTransaction
  onOpen: (transaction: FinanceAuditTransaction) => void
}) {
  return (
    <article className="rounded-card border border-(--app-border) bg-(--app-surface-elevated) p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-xs font-semibold text-(--app-text)">{transaction.orderNumber}</p>
          <p className="mt-1 text-sm font-semibold text-(--app-text)">{formatMoney(transaction.amount, transaction.currency)}</p>
          <p className="mt-1 text-xs text-(--app-text-muted)">
            {formatDay(transaction.occurredAt)} · {formatTime(transaction.occurredAt)}
          </p>
        </div>
        <StatusBadge status={transaction.status} />
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs text-(--app-text-muted)">
            {transaction.displayName} · {transaction.sourceLabel}
          </p>
          <div className="mt-2">
            <PaymentCardCell transaction={transaction} />
          </div>
        </div>
        <Button variant="outline" className="h-9 rounded-control" onClick={() => onOpen(transaction)}>
          <Eye className="size-4" /> Detalle
        </Button>
      </div>
    </article>
  )
}

function PaymentCardCell({ transaction }: { transaction: FinanceAuditTransaction }) {
  return (
    <div className="flex items-center gap-2">
      <CardBrandLogo brand={transaction.cardBrand} />
      <span className="font-mono text-xs font-semibold tabular-nums text-(--app-text)">{transaction.maskedCard ?? '—'}</span>
      {transaction.hasSecureToken ? <LockKeyhole className="size-3.5 text-emerald-600 dark:text-emerald-300" aria-label="Token seguro DataVault" /> : null}
    </div>
  )
}

function CardBrandLogo({ brand }: { brand: string | null }) {
  if (brand === 'VISA') {
    return (
      <span
        className="inline-flex h-[22px] w-10 items-center justify-center rounded-[5px] border border-[#d7def2] bg-white text-[0.62rem] font-black italic tracking-[0.04em] text-[#1a1f71] shadow-sm"
        aria-label="Visa"
      >
        VISA
      </span>
    )
  }

  if (brand === 'MASTERCARD') {
    return (
      <span
        className="relative inline-flex h-[22px] w-10 items-center justify-center rounded-[5px] border border-[#eed7c8] bg-white shadow-sm"
        aria-label="Mastercard"
      >
        <span className="absolute left-[7px] size-[14px] rounded-full bg-[#eb001b]" />
        <span className="absolute right-[7px] size-[14px] rounded-full bg-[#f79e1b] mix-blend-multiply" />
      </span>
    )
  }

  if (brand === 'AMEX') {
    return (
      <span className="inline-flex h-[22px] w-10 items-center justify-center rounded-[5px] bg-[#1e7fc2] text-[0.52rem] font-black text-white shadow-sm" aria-label="American Express">
        AMEX
      </span>
    )
  }

  return (
    <span className="inline-flex h-[22px] w-10 items-center justify-center rounded-[5px] bg-slate-700 text-[0.5rem] font-bold text-white shadow-sm dark:bg-slate-500" aria-label="Marca de tarjeta no identificada">
      CARD
    </span>
  )
}

function StatusBadge({ status }: { status: FinanceAuditStatus }) {
  const meta = statusMeta[status]
  return (
    <Badge variant="outline" className={meta.className}>
      {meta.label}
    </Badge>
  )
}

function TransactionDetailModal({ transaction, onClose }: { transaction: FinanceAuditTransaction; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const json = useMemo(() => JSON.stringify(transaction.gatewayPayload, null, 2), [transaction.gatewayPayload])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(json)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error('No se pudo copiar el JSON')
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(12,24,55,0.44)] p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <section
        className="grid max-h-[88vh] w-full max-w-[720px] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-[18px] border border-(--app-border) bg-(--app-surface-elevated) shadow-[0_24px_70px_rgba(8,18,42,0.28)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="azul-transaction-detail-title"
      >
        <header className="flex items-start justify-between gap-4 border-b border-(--app-border) px-5 py-4">
          <div className="min-w-0">
            <h2 id="azul-transaction-detail-title" className="text-lg font-bold tracking-normal text-(--app-text)">
              Detalle de transacción
            </h2>
            <p className="mt-1 truncate font-mono text-xs text-(--app-text-subtle)">
              AZUL OrderId {transaction.azulOrderId ?? '—'} · {transaction.orderNumber}
            </p>
          </div>
          <Button variant="ghost" className="size-9 shrink-0 rounded-control p-0" aria-label="Cerrar detalle" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </header>

        <div className="min-h-0 overflow-y-auto px-5 py-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.08em] text-(--app-text-subtle)">Respuesta completa de la pasarela</p>
            <Badge variant="outline" className="bg-(--app-surface-muted) text-(--app-text-muted)">
              HTTP 200 · application/json
            </Badge>
          </div>
          <pre className="max-h-[54vh] overflow-auto rounded-card bg-[#0f1b38] p-4 font-mono text-xs leading-6 text-slate-100">
            <JsonSyntax json={json} />
          </pre>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-(--app-border) px-5 py-4">
          <StatusBadge status={transaction.status} />
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" className="h-9 rounded-control" onClick={() => void handleCopy()}>
              <Copy className="size-4" /> {copied ? 'Copiado' : 'Copiar JSON'}
            </Button>
            <Button className="h-9 rounded-control" onClick={onClose}>
              Cerrar
            </Button>
          </div>
        </footer>
      </section>
    </div>
  )
}

function JsonSyntax({ json }: { json: string }) {
  const tokenPattern = /("(?:\\u[\dA-Fa-f]{4}|\\[^u]|[^\\"])*"(?=\s*:)|"(?:\\u[\dA-Fa-f]{4}|\\[^u]|[^\\"])*"|\btrue\b|\bfalse\b|\bnull\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g
  const nodes: Array<{ text: string; className?: string }> = []
  let lastIndex = 0

  for (const match of json.matchAll(tokenPattern)) {
    const index = match.index ?? 0
    if (index > lastIndex) {
      nodes.push({ text: json.slice(lastIndex, index) })
    }

    const token = match[0]
    const className = token.startsWith('"')
      ? json.slice(index + token.length).trimStart().startsWith(':')
        ? 'text-[#7fb0ff]'
        : 'text-[#8fd9a8]'
      : token === 'true' || token === 'false'
        ? 'text-[#d98fd9]'
        : token === 'null'
          ? 'text-[#5c6b8a]'
          : 'text-[#e6b96b]'

    nodes.push({ text: token, className })
    lastIndex = index + token.length
  }

  if (lastIndex < json.length) {
    nodes.push({ text: json.slice(lastIndex) })
  }

  return (
    <>
      {nodes.map((node, index) => (
        <span key={`${node.text}-${index}`} className={node.className}>
          {node.text}
        </span>
      ))}
    </>
  )
}
