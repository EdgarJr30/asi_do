import { useState } from 'react'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, useReducedMotion } from 'motion/react'
import { HandCoins, Plus, Save, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/page-header'
import { PageLoader } from '@/components/ui/loader'
import { StatCard } from '@/components/ui/stat-card'
import { toErrorMessage } from '@/features/auth/lib/auth-api'
import {
  createDonationAmountOption,
  deleteDonationAmountOption,
  listAllDonationAmountOptions,
  listDonations,
  updateDonationAmountOption,
  type DonationAmountOptionRow,
} from '@/features/donations/lib/donation-api'
import { cardReveal, gridStagger, pageStagger } from '@/shared/ui/card-motion'

const QUERY_KEY = ['donation-amount-options', 'admin'] as const

function formatMoney(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString('es-DO')}`
}

export function AdminDonationAmountsPage() {
  const queryClient = useQueryClient()
  const shouldReduceMotion = useReducedMotion()
  const [newLabel, setNewLabel] = useState('')
  const [newAmount, setNewAmount] = useState('')
  const [newOrder, setNewOrder] = useState('')

  const optionsQuery = useQuery({ queryKey: QUERY_KEY, queryFn: listAllDonationAmountOptions })
  const options = optionsQuery.data ?? []

  const donationsQuery = useQuery({ queryKey: ['donations', 'admin', 'all'], queryFn: () => listDonations() })
  const donations = donationsQuery.data ?? []
  const totalRaised = donations
    .filter((donation) => donation.status === 'verified')
    .reduce((sum, donation) => sum + Number(donation.amount), 0)

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: QUERY_KEY })
  }

  const createMutation = useMutation({
    mutationFn: async () =>
      createDonationAmountOption({
        label: newLabel.trim() || `RD$${Number(newAmount).toLocaleString('es-DO')}`,
        amount: Number(newAmount),
        currency: 'DOP',
        displayOrder: newOrder.trim() === '' ? (options.length + 1) * 10 : Number(newOrder),
        isActive: true,
      }),
    onSuccess: () => {
      invalidate()
      toast.success('Monto agregado')
      setNewLabel('')
      setNewAmount('')
      setNewOrder('')
    },
    onError: (error) => toast.error('No se pudo agregar', { description: toErrorMessage(error) }),
  })

  const updateMutation = useMutation({
    mutationFn: async (input: { id: string; patch: Parameters<typeof updateDonationAmountOption>[1] }) =>
      updateDonationAmountOption(input.id, input.patch),
    onSuccess: () => invalidate(),
    onError: (error) => toast.error('No se pudo actualizar', { description: toErrorMessage(error) }),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => deleteDonationAmountOption(id),
    onSuccess: () => {
      invalidate()
      toast.success('Monto eliminado')
    },
    onError: (error) => toast.error('No se pudo eliminar', { description: toErrorMessage(error) }),
  })

  const activeCount = options.filter((option) => option.is_active).length

  return (
    <motion.div className="space-y-6" variants={pageStagger} initial={shouldReduceMotion ? false : 'hidden'} animate="show">
      <motion.div variants={cardReveal}>
        <PageHeader
          eyebrow="Admin · Donaciones"
          title="Montos de donación"
          description="Define los montos sugeridos que verán los donantes en la página pública. Son la fuente de verdad: el frontend no decide montos."
        >
          <StatCard label="Activos" value={String(activeCount)} helper="Visibles para donantes" />
          <StatCard label="Total" value={String(options.length)} helper="Montos configurados" />
          <StatCard label="Moneda" value="DOP" helper="Pesos dominicanos" />
        </PageHeader>
      </motion.div>

      <motion.div variants={cardReveal}>
        <Card>
          <CardHeader>
            <Badge variant="soft">
              <Plus className="size-3.5" /> Agregar monto
            </Badge>
            <CardTitle>Nuevo monto sugerido</CardTitle>
            <CardDescription>El monto debe ser único por moneda. Los donantes igual pueden ingresar un monto personalizado.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-4 sm:grid-cols-[1.4fr_1fr_0.8fr_auto] sm:items-end"
              onSubmit={(event) => {
                event.preventDefault()
                if (!newAmount || Number(newAmount) <= 0) {
                  toast.error('Ingresa un monto válido')
                  return
                }
                createMutation.mutate()
              }}
            >
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium text-(--app-text-muted)">Etiqueta (opcional)</span>
                <Input placeholder="RD$10,000" value={newLabel} onChange={(event) => setNewLabel(event.target.value)} />
              </label>
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium text-(--app-text-muted)">Monto (DOP)</span>
                <Input type="number" min={100} inputMode="decimal" placeholder="10000" value={newAmount} onChange={(event) => setNewAmount(event.target.value)} />
              </label>
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium text-(--app-text-muted)">Orden</span>
                <Input type="number" inputMode="numeric" placeholder="auto" value={newOrder} onChange={(event) => setNewOrder(event.target.value)} />
              </label>
              <Button className="h-10" disabled={createMutation.isPending}>
                <Plus className="size-4" /> {createMutation.isPending ? 'Agregando…' : 'Agregar'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={cardReveal}>
        <Card>
          <CardHeader>
            <Badge variant="soft">
              <HandCoins className="size-3.5" /> Montos
            </Badge>
            <CardTitle>Montos configurados</CardTitle>
            <CardDescription>Edita la etiqueta, el monto o el orden; activa/desactiva o elimina.</CardDescription>
          </CardHeader>
          <CardContent>
            {optionsQuery.isLoading ? (
              <PageLoader inline label="Cargando montos" />
            ) : options.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-(--app-border) px-4 py-10 text-center text-sm text-(--app-text-muted)">
                Aún no hay montos configurados. Agrega el primero arriba.
              </div>
            ) : (
              <motion.ul variants={gridStagger} initial={shouldReduceMotion ? false : 'hidden'} animate="show" className="space-y-3">
                {options.map((option) => (
                  <motion.li key={option.id} variants={cardReveal}>
                    <DonationAmountRow
                      option={option}
                      onSave={(patch) => updateMutation.mutate({ id: option.id, patch })}
                      onToggle={() => updateMutation.mutate({ id: option.id, patch: { isActive: !option.is_active } })}
                      onDelete={() => deleteMutation.mutate(option.id)}
                      saving={updateMutation.isPending}
                      deleting={deleteMutation.isPending}
                    />
                  </motion.li>
                ))}
              </motion.ul>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={cardReveal}>
        <Card>
          <CardHeader>
            <Badge variant="soft">
              <HandCoins className="size-3.5" /> Donaciones recibidas
            </Badge>
            <CardTitle>Historial de donaciones</CardTitle>
            <CardDescription>
              Cada intento de donación con su estado, donante y referencia de AZUL.
              {donations.length ? ` Recaudado (aprobadas): ${formatMoney(totalRaised, 'DOP')}.` : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {donationsQuery.isLoading ? (
              <PageLoader inline label="Cargando donaciones" />
            ) : donations.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-(--app-border) px-4 py-10 text-center text-sm text-(--app-text-muted)">
                Aún no se han registrado donaciones.
              </div>
            ) : (
              <motion.ul variants={gridStagger} initial={shouldReduceMotion ? false : 'hidden'} animate="show" className="space-y-3">
                {donations.map((donation) => {
                  const meta = donationStatusMeta(donation.status)
                  return (
                    <motion.li key={donation.id} variants={cardReveal} className="rounded-2xl border border-(--app-border) bg-(--app-surface) p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-(--app-text)">
                            {formatMoney(Number(donation.amount), donation.currency)}
                            {donation.custom_amount ? <span className="ml-2 text-xs font-normal text-(--app-text-muted)">(personalizado)</span> : null}
                          </p>
                          <p className="mt-0.5 text-xs text-(--app-text-muted)">
                            {donation.donor_name || donation.donor_email || 'Donante anónimo'} · {donation.order_number}
                          </p>
                          <p className="mt-0.5 text-xs text-(--app-text-subtle)">
                            {new Date(donation.created_at).toLocaleString('es-DO')}
                            {donation.campaign_slug && donation.campaign_slug !== 'general' ? ` · ${donation.campaign_slug}` : ''}
                            {donation.authorization_code ? ` · Aut. ${donation.authorization_code}` : ''}
                          </p>
                        </div>
                        <Badge variant="outline" className={meta.className}>
                          {meta.label}
                        </Badge>
                      </div>
                    </motion.li>
                  )
                })}
              </motion.ul>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  )
}

function donationStatusMeta(status: string): { label: string; className: string } {
  switch (status) {
    case 'verified':
      return { label: 'Aprobada', className: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/12 dark:text-emerald-200' }
    case 'failed':
      return { label: 'Fallida', className: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/25 dark:bg-rose-500/12 dark:text-rose-200' }
    case 'cancelled':
      return { label: 'Cancelada', className: 'border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300' }
    default:
      return { label: 'En proceso', className: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/25 dark:bg-sky-500/12 dark:text-sky-200' }
  }
}

function DonationAmountRow({
  option,
  onSave,
  onToggle,
  onDelete,
  saving,
  deleting,
}: {
  option: DonationAmountOptionRow
  onSave: (patch: { label?: string; amount?: number; displayOrder?: number }) => void
  onToggle: () => void
  onDelete: () => void
  saving: boolean
  deleting: boolean
}) {
  const [label, setLabel] = useState(option.label)
  const [amount, setAmount] = useState(String(option.amount))
  const [order, setOrder] = useState(String(option.display_order))

  const dirty = label !== option.label || amount !== String(option.amount) || order !== String(option.display_order)

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-(--app-border) bg-(--app-surface) p-4">
      <label className="grid min-w-40 flex-1 gap-1 text-xs">
        <span className="font-medium uppercase tracking-wide text-(--app-text-subtle)">Etiqueta</span>
        <Input value={label} onChange={(event) => setLabel(event.target.value)} />
      </label>
      <label className="grid w-32 gap-1 text-xs">
        <span className="font-medium uppercase tracking-wide text-(--app-text-subtle)">Monto</span>
        <Input type="number" value={amount} onChange={(event) => setAmount(event.target.value)} />
      </label>
      <label className="grid w-20 gap-1 text-xs">
        <span className="font-medium uppercase tracking-wide text-(--app-text-subtle)">Orden</span>
        <Input type="number" value={order} onChange={(event) => setOrder(event.target.value)} />
      </label>
      <span className="text-xs text-(--app-text-muted)">{formatMoney(Number(amount) || 0, option.currency)}</span>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          className="h-9"
          disabled={!dirty || saving}
          onClick={() => onSave({ label, amount: Number(amount), displayOrder: Number(order) })}
        >
          <Save className="size-4" /> Guardar
        </Button>
        <Button variant="outline" className="h-9" onClick={onToggle} disabled={saving}>
          {option.is_active ? 'Desactivar' : 'Activar'}
        </Button>
        <Button
          variant="outline"
          className="h-9 text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-500/10"
          onClick={onDelete}
          disabled={deleting}
        >
          <Trash2 className="size-4" />
        </Button>
        <Badge
          variant="outline"
          className={
            option.is_active
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/12 dark:text-emerald-200'
              : 'border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300'
          }
        >
          {option.is_active ? 'Activo' : 'Inactivo'}
        </Badge>
      </div>
    </div>
  )
}
