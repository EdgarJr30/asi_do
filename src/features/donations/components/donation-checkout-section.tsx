import { useMemo, useState } from 'react'

import { useMutation, useQuery } from '@tanstack/react-query'
import { motion, useReducedMotion } from 'motion/react'
import { CreditCard, HeartHandshake, MailCheck, ShieldCheck } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import { surfacePaths } from '@/app/router/surface-paths'
import { useAppSession } from '@/app/providers/app-session-provider'
import {
  getDonationReceipt,
  listDonationAmountOptions,
  payDonationWithAzul,
  type DonationAmountOption,
  type DonationReceipt
} from '@/features/donations/lib/donation-api'
import { InstitutionalCard, InstitutionalSection } from '@/experiences/institutional/components/institutional-ui'
import { cardReveal, gridStagger, pageStagger } from '@/shared/ui/card-motion'
import { printReceipt, receiptPlainText, shareReceipt, type ReceiptLine } from '@/shared/ui/receipt'
import { Spinner } from '@/components/ui/loader'
import { cn } from '@/lib/utils/cn'

const DONATION_RECEIPT_TITLE = 'Comprobante de donación'

function donationReceiptLines(receipt: DonationReceipt): ReceiptLine[] {
  return [
    ['Comercio', 'ASI Rep. Dominicana'],
    ['No. de orden', receipt.orderNumber],
    ['Donante', receipt.donorName ?? '—'],
    ['Monto', `${receipt.currency} ${receipt.amount.toLocaleString('es-DO')}`],
    ['Resultado', receipt.status === 'verified' ? 'Aprobado' : receipt.status],
    ['No. de autorización', receipt.authorizationCode ?? '—'],
    ['Referencia', receipt.azulRrn ?? '—'],
    ['Fecha', new Date(receipt.settledAt ?? receipt.createdAt).toLocaleString('es-DO')]
  ]
}

function DonationReceiptCard({ receipt }: { receipt: DonationReceipt }) {
  const lines = donationReceiptLines(receipt)
  return (
    <div className="mt-4 rounded-card-lg border border-emerald-200 bg-white px-5 py-4 text-sm">
      <p className="font-semibold text-emerald-900">Comprobante de tu donación</p>
      <dl className="mt-3 space-y-1.5">
        {lines.map(([key, value]) => (
          <div key={key} className="flex items-start justify-between gap-4 border-t border-zinc-100 pt-1.5 first:border-t-0 first:pt-0">
            <dt className="text-zinc-500">{key}</dt>
            <dd className="text-right font-medium text-zinc-900">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => printReceipt(DONATION_RECEIPT_TITLE, lines)}
          className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-control border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
        >
          Descargar
        </button>
        <button
          type="button"
          onClick={() => void shareReceipt(DONATION_RECEIPT_TITLE, receiptPlainText(DONATION_RECEIPT_TITLE, lines))}
          className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-control border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
        >
          Compartir
        </button>
      </div>
    </div>
  )
}

const customSelection = 'custom'

function formatDop(amount: number) {
  return new Intl.NumberFormat('es-DO', {
    style: 'currency',
    currency: 'DOP',
    maximumFractionDigits: 0
  }).format(amount)
}

function paymentMessage(status: string | null) {
  if (status === 'approved') {
    return {
      tone: 'success',
      title: 'Donación recibida',
      body: 'Gracias por apoyar la misión de ASI República Dominicana. Registramos la transacción y podrás conservar el comprobante de AZUL.'
    }
  }

  if (status === 'declined') {
    return {
      tone: 'warning',
      title: 'La donación no fue aprobada',
      body: 'AZUL no aprobó la transacción. Puedes revisar los datos de pago e intentarlo nuevamente.'
    }
  }

  if (status === 'cancelled') {
    return {
      tone: 'warning',
      title: 'Donación cancelada',
      body: 'No se completó ningún cargo. Puedes elegir un monto y volver a intentarlo cuando estés listo.'
    }
  }

  if (status === 'error') {
    return {
      tone: 'error',
      title: 'No pudimos confirmar la donación',
      body: 'La pasarela no devolvió una respuesta verificable. Si ves un cargo, contacta al equipo de ASI con tu comprobante.'
    }
  }

  return null
}

function resolveSelectedAmount(option: DonationAmountOption | null, customAmount: string) {
  if (option) {
    return option.amount
  }

  const parsed = Number(customAmount)
  return Number.isFinite(parsed) ? parsed : 0
}

export function DonationCheckoutSection() {
  const [searchParams] = useSearchParams()
  const shouldReduceMotion = useReducedMotion()
  const session = useAppSession()
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null)
  const [customAmount, setCustomAmount] = useState('')
  const [designation, setDesignation] = useState('Fondo general ASI DO')
  const [acceptedPolicies, setAcceptedPolicies] = useState(false)

  // Progressive profiling: si hay sesión, prefill desde el perfil (derivado, sin effect).
  // `null` = el usuario aún no edita el campo → usamos el valor del perfil; al escribir, manda su input.
  const [donorNameInput, setDonorNameInput] = useState<string | null>(null)
  const [donorEmailInput, setDonorEmailInput] = useState<string | null>(null)
  const [donorPhoneInput, setDonorPhoneInput] = useState<string | null>(null)

  const donorName = donorNameInput ?? (session.profile?.full_name || session.profile?.display_name || '')
  const donorEmail = donorEmailInput ?? (session.profile?.email || session.authUser?.email || '')
  const donorPhone = donorPhoneInput ?? (session.profile?.phone || '')

  const amountOptionsQuery = useQuery({
    queryKey: ['donations', 'amount-options'],
    queryFn: listDonationAmountOptions
  })

  const options = useMemo(() => amountOptionsQuery.data ?? [], [amountOptionsQuery.data])
  const effectiveSelectedOptionId = selectedOptionId ?? options[0]?.id ?? null
  const selectedOption = effectiveSelectedOptionId && effectiveSelectedOptionId !== customSelection
    ? options.find((option) => option.id === effectiveSelectedOptionId) ?? null
    : null
  const isCustom = effectiveSelectedOptionId === customSelection
  const selectedAmount = resolveSelectedAmount(selectedOption, customAmount)
  const statusMessage = paymentMessage(searchParams.get('payment'))
  const receiptOrder = searchParams.get('order')
  const receiptQuery = useQuery({
    queryKey: ['donation-receipt', receiptOrder],
    queryFn: async () => getDonationReceipt(receiptOrder!),
    enabled: Boolean(receiptOrder),
  })
  const receipt = receiptQuery.data ?? null

  const canDonate = useMemo(() => {
    if (!donorName.trim() || !donorEmail.trim()) {
      return false
    }

    if (!acceptedPolicies) {
      return false
    }

    if (isCustom) {
      return selectedAmount >= 100 && selectedAmount <= 1_000_000
    }

    return Boolean(selectedOption)
  }, [acceptedPolicies, donorEmail, donorName, isCustom, selectedAmount, selectedOption])

  const donateMutation = useMutation({
    mutationFn: () =>
      payDonationWithAzul({
        amountOptionId: isCustom ? null : selectedOption?.id ?? null,
        customAmount: isCustom ? selectedAmount : null,
        donorName,
        donorEmail,
        donorPhone,
        campaignSlug: 'general',
        designation
      }),
    onError: (error) => {
      toast.error('No pudimos iniciar la donación', {
        description: error instanceof Error ? error.message : 'Intenta nuevamente en unos minutos.'
      })
    }
  })

  return (
    <InstitutionalSection id="donar-ahora" tone="muted" reveal="mount">
      <motion.div
        className="grid gap-6 xl:grid-cols-[minmax(0,0.82fr)_minmax(360px,0.48fr)] xl:items-start"
        variants={pageStagger}
        initial={shouldReduceMotion ? false : 'hidden'}
        animate="show"
      >
        <motion.div variants={cardReveal}>
          <div className="max-w-3xl">
            <p className="asi-kicker">Donar ahora</p>
            <div className="asi-accent-line" />
            <h2 className="asi-heading-lg">Elige un monto y completa tu aporte en AZUL.</h2>
            <p className="asi-copy mt-4 text-[1.02rem]">
              La donación queda registrada antes de enviarte a la pasarela. Cuando AZUL apruebe el pago, enviaremos el comprobante al correo indicado.
            </p>
          </div>

          {statusMessage ? (
            <div
              className={cn(
                'mt-5 rounded-card-lg border px-5 py-4 text-sm',
                statusMessage.tone === 'success' && 'border-emerald-200 bg-emerald-50 text-emerald-900',
                statusMessage.tone === 'warning' && 'border-amber-200 bg-amber-50 text-amber-900',
                statusMessage.tone === 'error' && 'border-rose-200 bg-rose-50 text-rose-900'
              )}
            >
              <p className="font-semibold">{statusMessage.title}</p>
              <p className="mt-1 leading-6">{statusMessage.body}</p>
            </div>
          ) : null}

          {receipt && receipt.status === 'verified' ? <DonationReceiptCard receipt={receipt} /> : null}

          <motion.div variants={gridStagger} className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {options.map((option) => (
              <motion.button
                key={option.id}
                type="button"
                variants={cardReveal}
                onClick={() => setSelectedOptionId(option.id)}
                className={cn(
                  'rounded-card border bg-white px-4 py-4 text-left shadow-[0_10px_30px_rgba(0,47,110,0.06)] transition',
                  effectiveSelectedOptionId === option.id
                    ? 'border-(--asi-primary) ring-2 ring-(--asi-primary)/18'
                    : 'border-slate-200 hover:border-(--asi-primary)/45'
                )}
              >
                <span className="text-lg font-semibold tracking-tight text-(--asi-text)">{formatDop(option.amount)}</span>
                <span className="mt-1 block text-xs font-semibold uppercase tracking-[0.16em] text-(--asi-secondary)">Aporte sugerido</span>
              </motion.button>
            ))}

            <motion.button
              type="button"
              variants={cardReveal}
              onClick={() => setSelectedOptionId(customSelection)}
              className={cn(
                'rounded-card border border-dashed bg-white px-4 py-4 text-left shadow-[0_10px_30px_rgba(0,47,110,0.06)] transition',
                isCustom ? 'border-(--asi-primary) ring-2 ring-(--asi-primary)/18' : 'border-slate-300 hover:border-(--asi-primary)/45'
              )}
            >
              <span className="text-lg font-semibold tracking-tight text-(--asi-text)">Otro monto</span>
              <span className="mt-1 block text-xs font-semibold uppercase tracking-[0.16em] text-(--asi-secondary)">Personalizado</span>
            </motion.button>
          </motion.div>

          {amountOptionsQuery.isError ? (
            <p className="mt-4 rounded-card border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              No pudimos cargar los montos configurados. Revisa la conexión con Supabase o intenta nuevamente.
            </p>
          ) : null}
        </motion.div>

        <motion.div variants={cardReveal}>
          <InstitutionalCard className="bg-white/92" hoverMotion={false}>
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-card bg-(--asi-surface-raised) text-(--asi-primary)">
                <CreditCard className="size-5" />
              </span>
              <div>
                <p className="text-lg font-semibold tracking-tight text-(--asi-text)">Resumen de donación</p>
              </div>
            </div>

            <div className="mt-5 rounded-card bg-(--asi-surface-raised) px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-(--asi-secondary)">Monto seleccionado</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-(--asi-text)">
                {selectedAmount > 0 ? formatDop(selectedAmount) : 'RD$0'}
              </p>
            </div>

            {isCustom ? (
              <label className="mt-4 grid gap-2 text-sm font-medium text-(--asi-text)">
                Monto personalizado
                <input
                  className="h-12 rounded-card border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-(--asi-primary) focus:ring-2 focus:ring-(--asi-primary)/15"
                  inputMode="numeric"
                  min={100}
                  max={1000000}
                  type="number"
                  value={customAmount}
                  onChange={(event) => setCustomAmount(event.target.value)}
                />
              </label>
            ) : null}

            <div className="mt-4 grid gap-3">
              <label className="grid gap-2 text-sm font-medium text-(--asi-text)">
                Nombre del donante
                <input
                  className="h-12 rounded-card border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-(--asi-primary) focus:ring-2 focus:ring-(--asi-primary)/15"
                  autoComplete="name"
                  value={donorName}
                  onChange={(event) => setDonorNameInput(event.target.value)}
                />
              </label>
              <label className="grid gap-2 text-sm font-medium text-(--asi-text)">
                Correo
                <input
                  className="h-12 rounded-card border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-(--asi-primary) focus:ring-2 focus:ring-(--asi-primary)/15"
                  autoComplete="email"
                  type="email"
                  value={donorEmail}
                  onChange={(event) => setDonorEmailInput(event.target.value)}
                />
              </label>
              <label className="grid gap-2 text-sm font-medium text-(--asi-text)">
                Teléfono
                <input
                  className="h-12 rounded-card border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-(--asi-primary) focus:ring-2 focus:ring-(--asi-primary)/15"
                  autoComplete="tel"
                  inputMode="tel"
                  type="tel"
                  value={donorPhone}
                  onChange={(event) => setDonorPhoneInput(event.target.value)}
                />
              </label>
              <label className="grid gap-2 text-sm font-medium text-(--asi-text)">
                Destino
                <select
                  className="h-12 rounded-card border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-(--asi-primary) focus:ring-2 focus:ring-(--asi-primary)/15"
                  value={designation}
                  onChange={(event) => setDesignation(event.target.value)}
                >
                  <option>Fondo general ASI DO</option>
                  <option>Proyectos misioneros</option>
                  <option>Convención nacional</option>
                  <option>Salud comunitaria</option>
                  <option>Evangelismo en el mercado</option>
                </select>
              </label>
            </div>

            <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-card border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-(--asi-text-muted)">
              <input
                checked={acceptedPolicies}
                className="mt-1 size-4 shrink-0 accent-(--asi-primary)"
                type="checkbox"
                onChange={(event) => setAcceptedPolicies(event.target.checked)}
              />
              <span>
                Acepto los{' '}
                <Link className="font-semibold text-(--asi-primary) hover:underline" to={surfacePaths.institutional.terms}>
                  términos y condiciones
                </Link>
                , las políticas de privacidad, entrega, devoluciones/cancelaciones y seguridad de pagos antes de continuar a AZUL.
              </span>
            </label>

            <button
              type="button"
              disabled={!canDonate || donateMutation.isPending}
              onClick={() => donateMutation.mutate()}
              className="asi-button asi-button-primary mt-5 w-full disabled:cursor-not-allowed disabled:opacity-60"
            >
              {donateMutation.isPending ? (
                <>
                  <Spinner size="sm" /> Preparando pago...
                </>
              ) : (
                'Donar ahora'
              )}
            </button>

            <div className="mt-5 grid gap-2 text-xs leading-5 text-(--asi-text-muted)">
              <span className="inline-flex items-center gap-2">
                <ShieldCheck className="size-4 text-(--asi-primary)" />
                No almacenamos datos de tarjeta en ASI.
              </span>
              <span className="inline-flex items-center gap-2">
                <MailCheck className="size-4 text-(--asi-primary)" />
                Enviamos el comprobante de la donación aprobada al correo indicado.
              </span>
              <span className="inline-flex items-center gap-2">
                <HeartHandshake className="size-4 text-(--asi-primary)" />
                Tu aporte se procesa en pesos dominicanos.
              </span>
            </div>
          </InstitutionalCard>
        </motion.div>
      </motion.div>
    </InstitutionalSection>
  )
}
