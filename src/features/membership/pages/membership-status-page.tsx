import { useEffect, useMemo, useRef, useState } from 'react'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Circle,
  Clock,
  CreditCard,
  Download,
  FileText,
  Share2,
  ShieldCheck,
  Sparkles
} from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import { surfacePaths } from '@/app/router/surface-paths'
import { useAppSession } from '@/app/providers/app-session-provider'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { PageLoader } from '@/components/ui/loader'
import { Pagination } from '@/components/ui/pagination'
import { Textarea } from '@/components/ui/textarea'
import { toErrorMessage } from '@/features/auth/lib/auth-api'
import { payMembershipWithAzul, type AzulPaymentIntent } from '@/features/membership/lib/azul-api'
import { useRealtimeSync } from '@/lib/realtime/use-realtime-sync'
import { printReceipt, receiptPlainText, shareReceipt, type ReceiptLine } from '@/shared/ui/receipt'
import {
  reducedTabPanelReveal,
  smoothCardReveal as cardReveal,
  smoothGridStagger as gridStagger,
  smoothPageStagger as pageStagger,
  tabPanelReveal
} from '@/shared/ui/card-motion'
import {
  fetchMyMembershipStatus,
  getCategoryDue,
  respondMembershipApplication,
  type MembershipPayment,
  type MembershipStatusBundle
} from '@/features/membership/lib/membership-api'
import { cn } from '@/lib/utils/cn'

type StepState = 'done' | 'current' | 'pending' | 'blocked'
type MembershipTab = 'summary' | 'route' | 'receipts'
type AzulReturnOutcome = 'declined' | 'cancelled' | 'error'

const RECEIPTS_PAGE_SIZE = 4

const applicationStatusLabels: Record<string, string> = {
  submitted: 'Enviada',
  under_review: 'En revisión',
  needs_more_info: 'Falta información',
  approved: 'Aprobada',
  rejected: 'Rechazada',
  cancelled: 'Cancelada'
}

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return '—'
  }
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) {
    return '—'
  }
  return date.toLocaleDateString('es-DO', { day: '2-digit', month: 'long', year: 'numeric' })
}

function latestDateValue(...values: Array<string | null | undefined>): string | null {
  let latest: { raw: string; time: number } | null = null
  for (const value of values) {
    if (!value) continue
    const time = new Date(value).getTime()
    if (!Number.isFinite(time)) continue
    if (!latest || time > latest.time) {
      latest = { raw: value, time }
    }
  }
  return latest?.raw ?? null
}

function formatRemainingMembership(value: string | null | undefined, now = new Date()): string {
  if (!value) {
    return '—'
  }
  const expiry = new Date(value)
  if (!Number.isFinite(expiry.getTime()) || expiry <= now) {
    return 'Vencida'
  }

  let years = expiry.getFullYear() - now.getFullYear()
  let months = expiry.getMonth() - now.getMonth()
  let days = expiry.getDate() - now.getDate()

  if (days < 0) {
    months -= 1
    // Días del mes anterior a la fecha de vencimiento.
    days += new Date(expiry.getFullYear(), expiry.getMonth(), 0).getDate()
  }
  if (months < 0) {
    years -= 1
    months += 12
  }

  const parts: string[] = []

  if (years > 0) {
    parts.push(`${years} ${years === 1 ? 'año' : 'años'}`)
  }
  if (months > 0) {
    parts.push(`${months} ${months === 1 ? 'mes' : 'meses'}`)
  }
  if (days > 0) {
    parts.push(`${days} ${days === 1 ? 'día' : 'días'}`)
  }
  return parts.length > 0 ? parts.join(' y ') : 'Menos de 1 día'
}

const paymentStatusLabels: Record<string, string> = {
  initiated: 'Procesando pago',
  submitted: 'En verificación',
  verified: 'Verificado',
  failed: 'Pago rechazado',
  rejected: 'Rechazado',
  declined: 'Pago declinado',
  cancelled: 'Pago cancelado',
  error: 'Error de validación'
}

interface StepView {
  key: string
  title: string
  icon: typeof FileText
  state: StepState
  description: string
}

function computeSteps(bundle: MembershipStatusBundle, isActive: boolean): StepView[] {
  const { application, payment } = bundle
  const appExists = Boolean(application)
  const appRejected = application?.status === 'rejected' || application?.status === 'cancelled'
  const appApproved = application?.status === 'approved'
  const appNeedsInfo = application?.status === 'needs_more_info'
  const paymentVerified = payment?.status === 'verified'
  const paymentInitiated = payment?.status === 'initiated'
  const paymentFailed = payment?.status === 'failed' || payment?.status === 'rejected'

  let applicationDescription: string
  if (!application) {
    applicationDescription = 'Aún no has enviado tu solicitud. Elige tu categoría y tu iglesia para empezar.'
  } else if (appRejected) {
    applicationDescription = `Tu solicitud fue ${applicationStatusLabels[application.status] ?? application.status}. Contacta a un administrador.`
  } else if (appNeedsInfo) {
    applicationDescription = 'Tu pastor solicitó más información. Revisa su nota, responde y reenvía tu solicitud a revisión.'
  } else {
    applicationDescription = `Categoría: ${application.category_name}. Estado: ${applicationStatusLabels[application.status] ?? application.status}.`
  }

  return [
    {
      key: 'application',
      title: 'Solicitud de membresía',
      icon: FileText,
      state: appRejected ? 'blocked' : appNeedsInfo ? 'blocked' : appExists ? 'done' : 'current',
      description: applicationDescription
    },
    {
      key: 'payment',
      title: 'Pago de la membresía',
      icon: CreditCard,
      // Un miembro activo ya pagó: una renovación en curso/fallida NO debe degradarlo.
      state: !appExists
        ? 'pending'
        : isActive || paymentVerified
          ? 'done'
          : 'current',
      description: !appExists
        ? 'Disponible cuando envíes tu solicitud.'
        : isActive || paymentVerified
          ? 'Tu pago con tarjeta fue confirmado.'
          : paymentInitiated
            ? 'Estamos procesando tu pago. Si ya pagaste, esta página se actualizará en breve.'
            : paymentFailed
              ? 'Tu pago no se completó. Puedes intentarlo de nuevo con tarjeta.'
              : 'Paga la cuota de tu categoría con tarjeta de crédito o débito de forma segura.'
    },
    {
      key: 'approval',
      title: 'Aprobación pastoral / administrativa',
      icon: ShieldCheck,
      state: isActive || appApproved ? 'done' : appRejected ? 'blocked' : appExists ? 'current' : 'pending',
      description: isActive || appApproved
        ? 'Tu solicitud fue aprobada.'
        : appRejected
          ? 'Tu solicitud no fue aprobada.'
          : appExists
            ? 'Tu pastor (o un administrador) revisará tu solicitud.'
            : 'Disponible cuando envíes tu solicitud.'
    },
    {
      key: 'activation',
      title: 'Activación de tu cuenta',
      icon: Sparkles,
      state: isActive ? 'done' : appApproved && paymentVerified ? 'current' : 'pending',
      description: isActive
        ? '¡Tu membresía está activa! Ya puedes usar la plataforma.'
        : appApproved && paymentVerified
          ? 'Todo listo. Un administrador activará tu cuenta en breve.'
          : 'Un administrador activa tu cuenta cuando la solicitud esté aprobada y el pago verificado.'
    }
  ]
}

const stateMeta: Record<StepState, { label: string }> = {
  done: {
    label: 'Completado'
  },
  current: {
    label: 'En progreso'
  },
  pending: {
    label: 'Pendiente'
  },
  blocked: {
    label: 'Atención'
  }
}

function getCurrentStep(steps: StepView[]) {
  return steps.find((step) => step.state === 'blocked') ?? steps.find((step) => step.state === 'current') ?? steps.at(-1)
}

export function MembershipStatusPage() {
  const session = useAppSession()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const shouldReduceMotion = useReducedMotion()
  const userId = session.authUser?.id ?? null
  const [activeTab, setActiveTab] = useState<MembershipTab>('summary')
  const [openReceiptId, setOpenReceiptId] = useState<string | null>(null)
  const [receiptsPage, setReceiptsPage] = useState(0)
  const lastHandledPaymentResultRef = useRef<string | null>(null)

  const statusQuery = useQuery({
    queryKey: ['membership', 'status', userId],
    enabled: Boolean(userId),
    queryFn: async () => fetchMyMembershipStatus(userId!)
  })

  // Actualización EN VIVO (Supabase Realtime → React Query): el pago liquidado por
  // AZUL, la revisión de la solicitud y la activación de la cuenta se reflejan sin
  // recargar. RLS limita los eventos a las filas del propio usuario.
  useRealtimeSync(
    userId ? `membership-status-${userId}` : 'membership-status',
    [
      {
        table: 'membership_payments',
        filter: userId ? `member_user_id=eq.${userId}` : undefined,
        invalidate: [['membership', 'status', userId]]
      },
      {
        table: 'institutional_membership_applications',
        filter: userId ? `requester_user_id=eq.${userId}` : undefined,
        invalidate: [['membership', 'status', userId]]
      },
      {
        // Activación de la cuenta: re-hidrata la sesión para que hasActiveAsiAccess
        // (y el resto del chrome) cambie a "activa" en vivo.
        table: 'users',
        filter: userId ? `id=eq.${userId}` : undefined,
        onChange: () => {
          void session.refresh()
          void queryClient.invalidateQueries({ queryKey: ['membership', 'status', userId] })
        }
      }
    ],
    { enabled: Boolean(userId) }
  )

  const bundle = useMemo<MembershipStatusBundle>(
    () => statusQuery.data ?? { application: null, payment: null, verifiedPayment: null, verifiedPayments: [], settings: null },
    [statusQuery.data]
  )
  const steps = useMemo(() => computeSteps(bundle, session.hasActiveAsiAccess), [bundle, session.hasActiveAsiAccess])
  const currentStep = getCurrentStep(steps)
  const due = getCategoryDue(bundle.settings, bundle.application?.category_slug)
  const dueAmountLabel = due?.amount != null ? `${bundle.settings?.currency ?? 'DOP'} ${due.amount.toLocaleString()}` : null
  const paymentStep = steps.find((step) => step.key === 'payment')
  const azulEnabled = Boolean(bundle.settings?.azul_enabled)
  const showPayStep = paymentStep?.state === 'current' && Boolean(bundle.application)
  const canRenew = session.hasActiveAsiAccess && bundle.application?.status === 'approved' && azulEnabled
  const importantStep = steps.find((step) => step.state === 'blocked') ?? steps.find((step) => step.state === 'current')
  const routeStatusLabel = session.hasActiveAsiAccess ? 'Activa' : importantStep?.title ?? 'En proceso'
  const membershipActivatedAt =
    session.profile?.membership_activated_at ?? bundle.verifiedPayment?.period_start ?? bundle.verifiedPayment?.verified_at ?? null
  const membershipExpiresAt = latestDateValue(session.profile?.membership_expires_at, bundle.verifiedPayment?.period_end)
  const remainingMembership = formatRemainingMembership(membershipExpiresAt)
  const receiptsTotalPages = Math.ceil(bundle.verifiedPayments.length / RECEIPTS_PAGE_SIZE)
  const safeReceiptsPage = receiptsTotalPages > 0 ? Math.min(Math.max(receiptsPage, 0), receiptsTotalPages - 1) : 0
  const visibleReceipts = bundle.verifiedPayments.slice(
    safeReceiptsPage * RECEIPTS_PAGE_SIZE,
    safeReceiptsPage * RECEIPTS_PAGE_SIZE + RECEIPTS_PAGE_SIZE
  )
  const membershipProgress = computeMembershipTermProgress(membershipActivatedAt, membershipExpiresAt)
  const activeTabPanelVariants = shouldReduceMotion ? reducedTabPanelReveal : tabPanelReveal
  // Esta rama aparece después del query; no debe depender de un estado inicial
  // oculto porque una transición perdida dejaría la pantalla visualmente en blanco.
  const contentInitialState = false

  // Resultado del retorno de AZUL (?payment=approved|declined|cancelled|error): avisa y refresca.
  const [searchParams, setSearchParams] = useSearchParams()
  const paymentResult = searchParams.get('payment')
  const recoverableAzulOutcome: AzulReturnOutcome | null =
    paymentResult === 'declined' || paymentResult === 'cancelled' || paymentResult === 'error' ? paymentResult : null
  useEffect(() => {
    const result = paymentResult
    if (!result) {
      return
    }
    const resultKey = `${result}:${searchParams.get('order') ?? ''}`
    if (lastHandledPaymentResultRef.current === resultKey) {
      return
    }
    lastHandledPaymentResultRef.current = resultKey

    const notices: Record<string, { kind: 'success' | 'error' | 'info'; text: string }> = {
      approved: { kind: 'success', text: '¡Pago confirmado! Un administrador activará tu cuenta en breve.' },
      declined: { kind: 'error', text: 'Tu pago fue declinado. Revisa los datos de tu tarjeta e inténtalo de nuevo.' },
      cancelled: { kind: 'info', text: 'Cancelaste el pago. Puedes intentarlo cuando quieras.' },
      error: { kind: 'error', text: 'Hubo un problema validando tu pago. Si se te realizó el cargo, contáctanos.' }
    }
    const notice = notices[result]
    if (notice) {
      if (notice.kind === 'success') {
        toast.success(
          session.hasActiveAsiAccess
            ? '¡Membresía renovada! Tu nueva vigencia ya está actualizada.'
            : notice.text
        )
      }
      else if (notice.kind === 'error') toast.error(notice.text)
      else toast.info(notice.text)
    }
    if (result === 'approved') {
      void session.refresh()
      const next = new URLSearchParams(searchParams)
      next.delete('payment')
      next.delete('order')
      setSearchParams(next, { replace: true })
    }
    void queryClient.invalidateQueries({ queryKey: ['membership', 'status', userId] })
  }, [paymentResult, searchParams, setSearchParams, queryClient, session, userId])

  const visiblePaymentStatus =
    recoverableAzulOutcome && bundle.payment?.status === 'initiated'
      ? recoverableAzulOutcome
      : bundle.payment?.status ?? null

  return (
    <motion.div
      className="space-y-6"
      variants={pageStagger}
      initial={shouldReduceMotion ? false : 'hidden'}
      animate="show"
    >
      <motion.header variants={cardReveal} className="space-y-1.5">
        <div className="max-w-3xl">
          <h1 className="text-xl font-semibold tracking-tight text-(--app-text) sm:text-[1.6rem]">Tu membresía</h1>
          <p className="max-w-2xl text-[0.84rem] leading-relaxed text-(--app-text-muted)">
            Mantén tu membresía ASI al día, renueva con facilidad y conserva tus comprobantes en un solo lugar.
          </p>
        </div>
      </motion.header>

      {statusQuery.isLoading ? (
        <motion.div variants={cardReveal}>
          <Card>
            <CardContent className="mt-0">
              <PageLoader inline label="Cargando tu estado" hint="Revisando tu solicitud y pago" />
            </CardContent>
          </Card>
        </motion.div>
      ) : statusQuery.error ? (
        <motion.div variants={cardReveal}>
          <Card className="border-rose-200 bg-rose-50/70 dark:border-rose-500/30 dark:bg-rose-500/10">
            <CardContent className="mt-0 flex items-start gap-3 text-sm text-rose-700 dark:text-rose-300">
              <AlertCircle className="mt-0.5 size-5 shrink-0" />
              <div>
                <p className="font-semibold">No pudimos cargar tu membresía.</p>
                <p className="mt-1">{toErrorMessage(statusQuery.error)}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <motion.div
          key="membership-status-content"
          variants={gridStagger}
          initial={contentInitialState}
          animate="show"
          className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]"
        >
          <motion.section variants={gridStagger} initial={contentInitialState} animate="show" className="space-y-6">
            <motion.div variants={cardReveal}>
              <MembershipOverviewCard
                category={bundle.application?.category_name ?? 'Sin categoría'}
                statusLabel={routeStatusLabel}
                activatedAt={membershipActivatedAt}
                expiresAt={membershipExpiresAt}
                remaining={remainingMembership}
                progress={membershipProgress}
                isActive={session.hasActiveAsiAccess}
              />
            </motion.div>

            {!session.hasActiveAsiAccess ? (
              <motion.div variants={cardReveal}>
                <Card className="rounded-card border-(--app-border) bg-(--app-surface-elevated) p-5 shadow-[0_1px_2px_rgba(20,40,90,0.04),0_4px_16px_rgba(20,40,90,0.04)]">
                  <CardContent className="mt-0 space-y-3">
                    <div>
                      <CardTitle>{currentStep?.title ?? 'Próximo paso'}</CardTitle>
                      <p className="mt-1 text-sm leading-6 text-(--app-text-muted)">
                        {currentStep?.description ?? 'Completa el siguiente paso para avanzar tu membresía.'}
                      </p>
                    </div>
                    {!session.hasActiveAsiAccess && bundle.application?.status === 'needs_more_info' ? (
                      <NeedsMoreInfoResponse
                        applicationId={bundle.application.id}
                        reviewNote={bundle.application.review_notes}
                        onResponded={() => void queryClient.invalidateQueries({ queryKey: ['membership', 'status', userId] })}
                      />
                    ) : null}

                    {!session.hasActiveAsiAccess && showPayStep && bundle.application ? (
                      <AzulPayCard
                        applicationId={bundle.application.id}
                        intent="initial"
                        annualAmount={due?.amount ?? null}
                        currency={bundle.settings?.currency ?? 'DOP'}
                        categoryLabel={due?.label ?? bundle.application.category_name ?? null}
                        paymentStatus={visiblePaymentStatus}
                        azulEnabled={azulEnabled}
                        onRefresh={() => void queryClient.invalidateQueries({ queryKey: ['membership', 'status', userId] })}
                      />
                    ) : null}

                    {!session.hasActiveAsiAccess && currentStep?.key === 'application' && currentStep.state === 'current' ? (
                      <Button className="h-10" onClick={() => void navigate(surfacePaths.institutional.membershipApply)}>
                        Iniciar mi solicitud <ArrowRight className="size-4" />
                      </Button>
                    ) : null}
                  </CardContent>
                </Card>
              </motion.div>
            ) : null}

            <motion.div variants={cardReveal}>
              <nav
                className="inline-flex max-w-full gap-0.5 overflow-x-auto rounded-control border border-(--app-border) bg-(--app-surface-elevated) p-1 shadow-sm"
                aria-label="Secciones de membresía"
              >
                  {[
                    { key: 'summary', label: 'Resumen', icon: FileText },
                    { key: 'route', label: 'Ruta', icon: ShieldCheck },
                    { key: 'receipts', label: 'Comprobantes', icon: FileText }
                  ].map((tab) => {
                    const TabIcon = tab.icon
                    return (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setActiveTab(tab.key as MembershipTab)}
                        className={cn(
                          'inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-control px-4 text-sm font-semibold transition',
                          activeTab === tab.key
                            ? 'bg-primary-600 text-white shadow-sm'
                            : 'text-(--app-text-muted) hover:bg-(--app-surface-muted) hover:text-(--app-text)'
                        )}
                      >
                        <TabIcon className="size-4" />
                        {tab.label}
                      </button>
                    )
                  })}
                </nav>

              <div className="mt-4">
                <AnimatePresence mode="wait" initial={false}>
                  {activeTab === 'summary' ? (
                    <motion.div
                      key="summary"
                      variants={activeTabPanelVariants}
                      initial="hidden"
                      animate="show"
                      exit="exit"
                      className="overflow-hidden rounded-card border border-(--app-border) bg-(--app-surface-elevated) shadow-[0_1px_2px_rgba(20,40,90,0.04),0_4px_16px_rgba(20,40,90,0.04)]"
                    >
                      <SummaryRow
                        icon={FileText}
                        label="Solicitud"
                        value={bundle.application ? applicationStatusLabels[bundle.application.status] ?? bundle.application.status : 'No enviada'}
                        tone={bundle.application?.status === 'approved' ? 'success' : 'neutral'}
                      />
                      <SummaryRow
                        icon={CreditCard}
                        label="Pago"
                        value={session.hasActiveAsiAccess ? 'Verificado' : bundle.payment ? paymentStatusLabels[bundle.payment.status] ?? bundle.payment.status : 'Pendiente'}
                        tone={session.hasActiveAsiAccess || bundle.payment?.status === 'verified' ? 'success' : 'neutral'}
                      />
                      <SummaryRow icon={ShieldCheck} label="Acceso" value={session.hasActiveAsiAccess ? 'Activo' : 'Pendiente'} tone={session.hasActiveAsiAccess ? 'success' : 'neutral'} />
                      <SummaryRow icon={CreditCard} label="Cuota anual" value={dueAmountLabel ?? due?.label ?? 'Por definir'} />
                      <SummaryRow icon={Clock} label="Vigencia restante" value={remainingMembership} />
                      <SummaryRow icon={Sparkles} label="Categoría" value={bundle.application?.category_name ?? 'Sin categoría'} />
                    </motion.div>
                  ) : null}

                  {activeTab === 'route' ? (
                    <motion.div
                      key="route"
                      variants={activeTabPanelVariants}
                      initial="hidden"
                      animate="show"
                      exit="exit"
                      className="overflow-hidden rounded-card border border-(--app-border) bg-(--app-surface-elevated) px-5 py-2 shadow-[0_1px_2px_rgba(20,40,90,0.04),0_4px_16px_rgba(20,40,90,0.04)]"
                    >
                      {steps.map((step) => (
                        <MembershipStep
                          key={step.key}
                          step={step}
                          onStartApplication={() => void navigate(surfacePaths.institutional.membershipApply)}
                        />
                      ))}
                    </motion.div>
                  ) : null}

                  {activeTab === 'receipts' ? (
                    <motion.div
                      key="receipts"
                      variants={activeTabPanelVariants}
                      initial="hidden"
                      animate="show"
                      exit="exit"
                      className="space-y-3"
                    >
                      {bundle.verifiedPayments.length > 0 ? (
                        <>
                          <p className="px-0.5 text-sm text-(--app-text-subtle)">
                            {bundle.verifiedPayments.length}{' '}
                            {bundle.verifiedPayments.length === 1 ? 'comprobante' : 'comprobantes'}. Toca uno para ver el detalle.
                          </p>
                          {visibleReceipts.map((paymentItem) => (
                            <MembershipReceiptCard
                              key={paymentItem.id}
                              payment={paymentItem}
                              currency={bundle.settings?.currency ?? paymentItem.currency ?? 'DOP'}
                              categoryLabel={due?.label ?? bundle.application?.category_name ?? null}
                              isOpen={openReceiptId === paymentItem.id}
                              onToggle={() => setOpenReceiptId((current) => (current === paymentItem.id ? null : paymentItem.id))}
                            />
                          ))}
                          <Pagination
                            page={safeReceiptsPage}
                            totalPages={receiptsTotalPages}
                            onPageChange={(nextPage) => {
                              setReceiptsPage(nextPage)
                              setOpenReceiptId(null)
                            }}
                            ariaLabel="Paginación de comprobantes de pago"
                            className="pt-1"
                          />
                        </>
                      ) : (
                        <div className="rounded-card border border-dashed border-(--app-border) bg-(--app-surface-muted) p-5 text-sm text-(--app-text-muted)">
                          Aún no hay comprobantes verificados disponibles. Cuando un pago sea aprobado, aparecerá aquí.
                        </div>
                      )}
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            </motion.div>
          </motion.section>

          <motion.aside variants={gridStagger} initial={contentInitialState} animate="show" className="space-y-5 lg:sticky lg:top-6">
            {session.hasActiveAsiAccess && bundle.application ? (
              <motion.div variants={cardReveal}>
                <Card className="rounded-card p-5 shadow-[0_1px_2px_rgba(20,40,90,0.04),0_4px_16px_rgba(20,40,90,0.04)]">
                  <CardContent className="mt-0">
                    <CardTitle>Renovar membresía</CardTitle>
                    <p className="mt-2 text-sm leading-6 text-(--app-text-muted)">
                      Renueva por 1 a 5 años. Tu membresía actual se conserva y el monto se calcula automáticamente.
                    </p>
                    <AzulPayCard
                      applicationId={bundle.application.id}
                      intent="renewal"
                      annualAmount={due?.amount ?? null}
                      currency={bundle.settings?.currency ?? 'DOP'}
                      categoryLabel={due?.label ?? bundle.application.category_name ?? null}
                      paymentStatus={visiblePaymentStatus === 'initiated' ? 'initiated' : visiblePaymentStatus}
                      azulEnabled={canRenew}
                      compact
                      onRefresh={() => void queryClient.invalidateQueries({ queryKey: ['membership', 'status', userId] })}
                    />
                  </CardContent>
                </Card>
              </motion.div>
            ) : null}

            <motion.div variants={cardReveal}>
              <Card className="rounded-card p-5 shadow-[0_1px_2px_rgba(20,40,90,0.04),0_4px_16px_rgba(20,40,90,0.04)]">
                <CardContent className="mt-0">
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-control bg-primary-50 text-primary-700 dark:bg-primary-500/12 dark:text-primary-200">
                      <AlertCircle className="size-4" />
                    </span>
                    <CardTitle>¿Necesitas ayuda?</CardTitle>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-(--app-text-muted)">
                    ¿Dudas con tu membresía? Escríbenos y con gusto te ayudamos.
                  </p>
                  <Link
                    to={surfacePaths.institutional.contactUs}
                    className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-control border border-(--app-border) bg-(--app-surface) px-3.5 text-sm font-semibold text-(--app-text) shadow-sm transition hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700 dark:hover:bg-primary-500/12"
                  >
                    Ir a contacto <ArrowRight className="size-4" />
                  </Link>
                </CardContent>
              </Card>
            </motion.div>
          </motion.aside>
        </motion.div>
      )}
    </motion.div>
  )
}

function computeMembershipTermProgress(activatedAt: string | null, expiresAt: string | null) {
  if (!activatedAt || !expiresAt) {
    return 0
  }
  const start = new Date(activatedAt).getTime()
  const end = new Date(expiresAt).getTime()
  const now = Date.now()
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || now >= end) {
    return 0
  }
  if (now <= start) {
    return 100
  }
  return Math.max(4, Math.min(100, Math.round(((end - now) / (end - start)) * 100)))
}

function MembershipOverviewCard({
  category,
  statusLabel,
  activatedAt,
  expiresAt,
  remaining,
  progress,
  isActive
}: {
  category: string
  statusLabel: string
  activatedAt: string | null
  expiresAt: string | null
  remaining: string
  progress: number
  isActive: boolean
}) {
  return (
    <Card className="rounded-card border-(--app-border) bg-(--app-surface-elevated) p-5 shadow-[0_1px_2px_rgba(20,40,90,0.04),0_4px_16px_rgba(20,40,90,0.04)] sm:p-6">
      <CardContent className="mt-0">
        <div className="flex items-center gap-4">
          <span className="flex size-13 shrink-0 items-center justify-center rounded-card bg-gradient-to-br from-primary-600 to-primary-400 text-white shadow-sm">
            <Sparkles className="size-6" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.06em] text-(--app-text-subtle)">Categoría</p>
            <p className="mt-0.5 truncate text-xl font-bold tracking-tight text-(--app-text)">{category}</p>
          </div>
          <StatusPill className="ml-auto shrink-0" label={statusLabel} tone={isActive ? 'success' : 'neutral'} />
        </div>

        <div className="mt-6">
          <div className="mb-2 flex items-baseline justify-between gap-4">
            <span className="text-sm text-(--app-text-muted)">Vigencia restante</span>
            <span className="text-right text-sm font-semibold text-(--app-text)">{remaining}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-(--app-border)">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary-700 to-primary-400 transition-[width] duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between gap-4 text-xs text-(--app-text-subtle)">
            <span>Activación · {formatDate(activatedAt)}</span>
            <span className="text-right">Vence · {formatDate(expiresAt)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function StatusPill({
  label,
  tone = 'neutral',
  className
}: {
  label: string
  tone?: 'success' | 'neutral' | 'danger'
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex h-7 items-center gap-2 rounded-full px-3 text-xs font-semibold',
        tone === 'success' && 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/12 dark:text-emerald-300',
        tone === 'neutral' && 'bg-(--app-surface-muted) text-(--app-text-muted)',
        tone === 'danger' && 'bg-rose-50 text-rose-700 dark:bg-rose-500/12 dark:text-rose-300',
        className
      )}
    >
      <span
        className={cn(
          'size-1.5 rounded-full',
          tone === 'success' && 'bg-emerald-500',
          tone === 'neutral' && 'bg-(--app-text-subtle)',
          tone === 'danger' && 'bg-rose-500'
        )}
      />
      {label}
    </span>
  )
}

function SummaryRow({
  icon: Icon,
  label,
  value,
  tone = 'plain'
}: {
  icon: typeof FileText
  label: string
  value: string
  tone?: 'success' | 'neutral' | 'plain'
}) {
  return (
    <div className="flex items-center gap-4 border-t border-(--app-border) px-5 py-4 first:border-t-0">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-control border border-(--app-border) bg-(--app-surface-muted) text-(--app-text-muted)">
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1 text-sm text-(--app-text-muted)">{label}</span>
      <span className="text-right text-sm font-semibold text-(--app-text)">
        {tone === 'plain' ? value : <StatusPill label={value} tone={tone} />}
      </span>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.04em] text-(--app-text-subtle)">{label}</p>
      <p className="mt-1 text-sm font-medium text-(--app-text)">{value}</p>
    </div>
  )
}

function MembershipStep({
  step,
  onStartApplication
}: {
  step: StepView
  onStartApplication: () => void
}) {
  const meta = stateMeta[step.state]
  const tone = step.state === 'done' ? 'success' : step.state === 'blocked' ? 'danger' : 'neutral'

  return (
    <div className="flex items-center gap-4 border-t border-(--app-border) py-4 first:border-t-0">
      <span
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-full',
          step.state === 'done' && 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/12 dark:text-emerald-300',
          step.state === 'current' && 'bg-primary-50 text-primary-700 dark:bg-primary-500/12 dark:text-primary-200',
          step.state === 'pending' && 'bg-(--app-surface-muted) text-(--app-text-subtle)',
          step.state === 'blocked' && 'bg-rose-50 text-rose-600 dark:bg-rose-500/12 dark:text-rose-300'
        )}
      >
        {step.state === 'done' ? <CheckCircle2 className="size-4.5" /> : null}
        {step.state === 'blocked' ? <AlertCircle className="size-4.5" /> : null}
        {step.state === 'current' ? <Clock className="size-4" /> : null}
        {step.state === 'pending' ? <Circle className="size-4" /> : null}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-(--app-text)">{step.title}</p>
        <p className="mt-0.5 text-xs leading-5 text-(--app-text-subtle)">{step.description}</p>
      </div>
      <StatusPill label={meta.label} tone={tone} />
      {step.key === 'application' && step.state === 'current' ? (
        <Button className="hidden h-9 rounded-control px-3 text-xs sm:inline-flex" onClick={onStartApplication}>
          Iniciar <ArrowRight className="size-3.5" />
        </Button>
      ) : null}
    </div>
  )
}

const YEAR_OPTIONS = [1, 2, 3, 4, 5] as const

function formatMoney(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString('es-DO')}`
}

function AzulPayCard({
  applicationId,
  intent,
  annualAmount,
  currency,
  categoryLabel,
  paymentStatus,
  azulEnabled,
  compact = false,
  onRefresh
}: {
  applicationId: string
  intent: AzulPaymentIntent
  annualAmount: number | null
  currency: string
  categoryLabel: string | null
  paymentStatus: string | null
  azulEnabled: boolean
  compact?: boolean
  onRefresh: () => void
}) {
  const [years, setYears] = useState(1)
  const [acceptedPolicies, setAcceptedPolicies] = useState(false)
  const processing = paymentStatus === 'initiated'
  const total = annualAmount != null ? annualAmount * years : null
  const totalLabel = total != null ? formatMoney(total, currency) : null

  const payMutation = useMutation({
    mutationFn: async () => payMembershipWithAzul({ applicationId, intent, years }),
    onError: (error) => toast.error(toErrorMessage(error))
    // En éxito, el browser navega a AZUL (no hay onSuccess que renderizar).
  })

  if (!azulEnabled) {
    return (
      <div className="mt-3 rounded-card border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
        El pago en línea aún no está disponible. Inténtalo más tarde o contacta a un administrador.
      </div>
    )
  }

  // Un intento 'initiated' no bloquea la tarjeta: avisamos pero dejamos reintentar
  // (si lo cancelaste/cerraste no llega callback y quedaría colgado para siempre).
  const processingNotice = processing ? (
    <div className="mt-3 rounded-control border border-amber-200 bg-amber-50 p-3 dark:border-amber-500/30 dark:bg-amber-500/10">
      <p className="inline-flex items-center gap-2 text-xs font-semibold text-amber-800 dark:text-amber-200">
        <Clock className="size-3.5" /> Tienes un intento de pago sin completar
      </p>
      <p className="mt-1 text-xs leading-5 text-amber-700/90 dark:text-amber-200/80">
        Si ya pagaste en AZUL, pulsa “Actualizar estado”. Si lo cancelaste o cerraste la ventana, vuelve a intentarlo aquí.
      </p>
      <Button variant="outline" className="mt-2 h-8 text-xs" onClick={onRefresh}>
        Actualizar estado
      </Button>
    </div>
  ) : null

  const yearSelector = (
    <label className={cn('mt-4 flex gap-2 text-sm', compact ? 'flex-col' : 'items-center justify-between')}>
      <span className="text-xs font-semibold text-(--app-text-muted)">Años de membresía</span>
      <select
        value={years}
        onChange={(event) => setYears(Number(event.target.value))}
        disabled={payMutation.isPending}
        className={cn(
          'h-11 rounded-control border border-(--app-border) bg-(--app-surface) px-3 text-sm font-medium text-(--app-text) focus:border-primary-500 focus:outline-none focus:ring-3 focus:ring-primary-500/12',
          compact ? 'w-full' : 'min-w-34'
        )}
      >
        {YEAR_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {option} {option === 1 ? 'año' : 'años'}
          </option>
        ))}
      </select>
    </label>
  )

  const button = (
    <Button
      className={compact ? 'mt-4 h-12 w-full rounded-control' : 'mt-3 h-10'}
      disabled={payMutation.isPending || !acceptedPolicies}
      onClick={() => payMutation.mutate()}
    >
      <CreditCard className="size-4" />
      {payMutation.isPending
        ? 'Redirigiendo…'
        : intent === 'renewal'
          ? `Renovar${totalLabel ? ` · ${totalLabel}` : ''}`
          : `Pagar con tarjeta${totalLabel ? ` · ${totalLabel}` : ''}`}
    </Button>
  )

  if (compact) {
    return (
      <div className="mt-4">
        {processingNotice}
        {yearSelector}
        <div className="mt-4 flex items-baseline justify-between gap-4 border-y border-(--app-border) py-4">
          <span className="text-sm text-(--app-text-muted)">Total a pagar</span>
          <span className="text-xl font-bold tracking-tight text-(--app-text)">{totalLabel ?? 'Por definir'}</span>
        </div>
        <CheckoutComplianceBox
          accepted={acceptedPolicies}
          onAcceptedChange={setAcceptedPolicies}
          compact
        />
        {button}
        <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-(--app-text-subtle)">
          <ShieldCheck className="size-3.5" /> Pago seguro procesado por AZUL
        </p>
      </div>
    )
  }

  return (
    <div className="mt-3 rounded-card border border-(--app-border) bg-(--app-surface-muted) p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-(--app-text)">Pago seguro con tarjeta</p>
        {totalLabel ? (
          <span className="rounded-full bg-primary-600 px-3 py-1 text-sm font-bold text-white">{totalLabel}</span>
        ) : null}
      </div>
      {categoryLabel ? (
        <p className="mt-0.5 text-xs text-(--app-text-muted)">
          {annualAmount != null ? `${formatMoney(annualAmount, currency)} / año` : 'Cuota anual'} · {categoryLabel}
        </p>
      ) : null}

      {processingNotice}
      {yearSelector}
      {total != null && annualAmount != null ? (
        <p className="mt-1 text-xs text-(--app-text-muted)">
          {years} {years === 1 ? 'año' : 'años'} × {formatMoney(annualAmount, currency)} ={' '}
          <span className="font-semibold text-(--app-text)">{formatMoney(total, currency)}</span>
        </p>
      ) : null}

      <p className="mt-2 text-xs leading-5 text-(--app-text-muted)">
        Serás redirigido a la página de pago de AZUL para completar la transacción con tu tarjeta de crédito o
        débito. Al terminar, volverás aquí automáticamente.
      </p>
      <CheckoutComplianceBox accepted={acceptedPolicies} onAcceptedChange={setAcceptedPolicies} />
      {paymentStatus === 'failed' || paymentStatus === 'rejected' || paymentStatus === 'declined' || paymentStatus === 'cancelled' || paymentStatus === 'error' ? (
        <p className="mt-2 text-xs font-medium text-rose-600 dark:text-rose-400">
          {paymentStatus === 'cancelled'
            ? 'Cancelaste el intento anterior. Puedes volver a intentarlo cuando quieras.'
            : 'Tu intento anterior no se completó. Puedes intentarlo de nuevo.'}
        </p>
      ) : null}
      {button}
      <p className="mt-3 inline-flex items-center gap-1.5 rounded-control bg-(--app-surface) px-3 py-2 text-xs text-(--app-text-muted)">
        <ShieldCheck className="size-3.5" /> Transacción procesada por AZUL. No almacenamos los datos de tu tarjeta.
      </p>
    </div>
  )
}

function CheckoutComplianceBox({
  accepted,
  onAcceptedChange,
  compact = false
}: {
  accepted: boolean
  onAcceptedChange: (accepted: boolean) => void
  compact?: boolean
}) {
  return (
    <div className={cn('rounded-card border border-(--app-border) bg-(--app-surface) p-3', compact ? 'mt-3' : 'mt-3')}>
      <label className="flex cursor-pointer items-start gap-2 text-xs leading-5 text-(--app-text-muted)">
        <input
          checked={accepted}
          className="mt-1 size-4 shrink-0 accent-primary-600"
          type="checkbox"
          onChange={(event) => onAcceptedChange(event.target.checked)}
        />
        <span>
          Acepto los{' '}
          <Link className="font-semibold text-primary-700 hover:underline" to={surfacePaths.institutional.terms}>
            términos
          </Link>
          , privacidad, entrega, devoluciones/cancelaciones y seguridad de pagos antes de continuar a AZUL.
        </span>
      </label>
    </div>
  )
}

const RECEIPT_TITLE = 'Comprobante de pago de membresía'

function buildReceiptLines(payment: MembershipPayment, currency: string, categoryLabel: string | null): ReceiptLine[] {
  const termMonths = payment.term_months ?? 12
  const termYears = Math.max(1, Math.round(termMonths / 12))
  const period =
    payment.period_start || payment.period_end
      ? `${formatDate(payment.period_start)} - ${formatDate(payment.period_end)}`
      : '—'

  return [
    ['Comercio', 'ASI Rep. Dominicana'],
    ['No. de orden', payment.order_number ?? '—'],
    ['Tipo', payment.intent === 'renewal' ? 'Renovación' : 'Membresía inicial'],
    ['Categoría', categoryLabel ?? payment.category_slug],
    ['Monto', formatMoney(Number(payment.amount ?? 0), currency)],
    ['Término', `${termYears} ${termYears === 1 ? 'año' : 'años'}`],
    ['Vigencia', period],
    ['Resultado', 'Aprobado'],
    ['No. de autorización', payment.authorization_code ?? '—'],
    ['Referencia', payment.azul_rrn ?? '—'],
    ['Fecha', formatDate(payment.verified_at)]
  ]
}

function MembershipReceiptCard({
  payment,
  currency,
  categoryLabel,
  isOpen,
  onToggle
}: {
  payment: MembershipPayment
  currency: string
  categoryLabel: string | null
  isOpen: boolean
  onToggle: () => void
}) {
  const lines = buildReceiptLines(payment, currency, categoryLabel)
  const kindLabel = payment.intent === 'renewal' ? 'Renovación' : 'Membresía inicial'
  const amountLabel = formatMoney(Number(payment.amount ?? 0), currency)
  const termMonths = payment.term_months ?? 12
  const termYears = Math.max(1, Math.round(termMonths / 12))

  return (
    <div
      className={cn(
        'overflow-hidden rounded-card border bg-(--app-surface-elevated) transition-[border-color,box-shadow]',
        isOpen
          ? 'border-primary-200 shadow-[0_4px_14px_rgba(20,40,90,0.06)] dark:border-primary-500/25'
          : 'border-(--app-border) hover:border-primary-200 hover:shadow-[0_4px_14px_rgba(20,40,90,0.06)]'
      )}
    >
      <button
        type="button"
        aria-expanded={isOpen}
        className="flex w-full cursor-pointer items-center gap-4 p-4 text-left"
        onClick={onToggle}
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-control bg-emerald-50 text-emerald-600 dark:bg-emerald-500/12 dark:text-emerald-300">
          <FileText className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-(--app-text)">Comprobante · {kindLabel}</p>
          <p className="mt-0.5 truncate text-xs text-(--app-text-muted)">
            {formatDate(payment.verified_at)} · {termYears} {termYears === 1 ? 'año' : 'años'}
          </p>
        </div>
        <span className="shrink-0 text-sm font-bold tabular-nums text-(--app-text)">{amountLabel}</span>
        <ChevronDown
          className={cn('size-4 shrink-0 text-(--app-text-subtle) transition-transform duration-200', isOpen && 'rotate-180')}
        />
      </button>

      <div className={cn('max-h-0 overflow-hidden opacity-0 transition-all duration-300', isOpen && 'max-h-96 opacity-100')}>
        <div className="border-t border-(--app-border) px-4 pb-4 pt-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <DetailRow label="Número" value={payment.order_number ?? '—'} />
            <DetailRow label="Concepto" value={`${kindLabel}${termYears ? ` · ${termYears} ${termYears === 1 ? 'año' : 'años'}` : ''}`} />
            <DetailRow label="Método de pago" value={payment.method === 'azul' ? 'Tarjeta · AZUL' : payment.method ?? '—'} />
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.04em] text-(--app-text-subtle)">Estado</p>
              <p className="mt-1 text-sm font-semibold text-emerald-700 dark:text-emerald-300">Pagado</p>
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Button
              className="h-10 flex-1 rounded-control"
              onClick={(event) => {
                event.stopPropagation()
                printReceipt(RECEIPT_TITLE, lines)
              }}
            >
              <Download className="size-4" /> Descargar PDF
            </Button>
            <Button
              variant="outline"
              className="h-10 flex-1 rounded-control"
              onClick={(event) => {
                event.stopPropagation()
                void shareReceipt(RECEIPT_TITLE, receiptPlainText(RECEIPT_TITLE, lines))
              }}
            >
              <Share2 className="size-4" /> Compartir
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function NeedsMoreInfoResponse({
  applicationId,
  reviewNote,
  onResponded
}: {
  applicationId: string
  reviewNote: string | null
  onResponded: () => void
}) {
  const [note, setNote] = useState('')

  const respondMutation = useMutation({
    mutationFn: async () => respondMembershipApplication({ applicationId, responseNote: note }),
    onSuccess: () => {
      setNote('')
      onResponded()
    }
  })

  return (
    <div className="mt-3 rounded-card border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
      {reviewNote ? (
        <div className="mb-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">Nota de tu pastor</p>
          <p className="mt-1 whitespace-pre-line text-sm text-(--app-text)">{reviewNote}</p>
        </div>
      ) : null}

      <label className="text-sm font-medium text-(--app-text)">Tu respuesta</label>
      <Textarea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        disabled={respondMutation.isPending}
        rows={3}
        placeholder="Responde lo que tu pastor solicitó para continuar con tu solicitud."
        className="mt-1.5"
      />

      {respondMutation.error ? (
        <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">{toErrorMessage(respondMutation.error)}</p>
      ) : null}

      <Button
        className="mt-3 h-10"
        disabled={respondMutation.isPending}
        onClick={() => respondMutation.mutate()}
      >
        {respondMutation.isPending ? 'Enviando…' : 'Reenviar a revisión'} <ArrowRight className="size-4" />
      </Button>
    </div>
  )
}
