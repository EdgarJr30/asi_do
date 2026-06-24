import { useEffect, useMemo, useState } from 'react'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PageLoader } from '@/components/ui/loader'
import { Textarea } from '@/components/ui/textarea'
import { toErrorMessage } from '@/features/auth/lib/auth-api'
import { payMembershipWithAzul, type AzulPaymentIntent } from '@/features/membership/lib/azul-api'
import { useRealtimeSync } from '@/lib/realtime/use-realtime-sync'
import { printReceipt, receiptPlainText, shareReceipt, type ReceiptLine } from '@/shared/ui/receipt'
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

const paymentStatusLabels: Record<string, string> = {
  initiated: 'Procesando pago',
  submitted: 'En verificación',
  verified: 'Verificado',
  failed: 'Pago rechazado',
  rejected: 'Rechazado'
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

const stateMeta: Record<StepState, { label: string; dot: string; badge: string }> = {
  done: {
    label: 'Completado',
    dot: 'bg-emerald-500 text-white',
    badge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/12 dark:text-emerald-300'
  },
  current: {
    label: 'En progreso',
    dot: 'bg-primary-600 text-white',
    badge: 'bg-primary-50 text-primary-700 dark:bg-primary-500/12 dark:text-primary-300'
  },
  pending: {
    label: 'Pendiente',
    dot: 'bg-(--app-surface-muted) text-(--app-text-subtle)',
    badge: 'bg-(--app-surface-muted) text-(--app-text-subtle)'
  },
  blocked: {
    label: 'Atención',
    dot: 'bg-rose-500 text-white',
    badge: 'bg-rose-50 text-rose-700 dark:bg-rose-500/12 dark:text-rose-300'
  }
}

function getCurrentStep(steps: StepView[]) {
  return steps.find((step) => step.state === 'blocked') ?? steps.find((step) => step.state === 'current') ?? steps.at(-1)
}

function getProgressSummary(steps: StepView[]) {
  const completed = steps.filter((step) => step.state === 'done').length
  return { completed, total: steps.length, percent: Math.round((completed / steps.length) * 100) }
}

export function MembershipStatusPage() {
  const session = useAppSession()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const userId = session.authUser?.id ?? null
  const [activeTab, setActiveTab] = useState<MembershipTab>('summary')

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
    () => statusQuery.data ?? { application: null, payment: null, verifiedPayment: null, settings: null },
    [statusQuery.data]
  )
  const steps = useMemo(() => computeSteps(bundle, session.hasActiveAsiAccess), [bundle, session.hasActiveAsiAccess])
  const progress = useMemo(() => getProgressSummary(steps), [steps])
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
  const membershipExpiresAt = session.profile?.membership_expires_at ?? bundle.verifiedPayment?.period_end ?? null

  // Resultado del retorno de AZUL (?payment=approved|declined|cancelled|error): avisa y refresca.
  const [searchParams, setSearchParams] = useSearchParams()
  useEffect(() => {
    const result = searchParams.get('payment')
    if (!result) {
      return
    }
    const notices: Record<string, { kind: 'success' | 'error' | 'info'; text: string }> = {
      approved: { kind: 'success', text: '¡Pago confirmado! Un administrador activará tu cuenta en breve.' },
      declined: { kind: 'error', text: 'Tu pago fue declinado. Revisa los datos de tu tarjeta e inténtalo de nuevo.' },
      cancelled: { kind: 'info', text: 'Cancelaste el pago. Puedes intentarlo cuando quieras.' },
      error: { kind: 'error', text: 'Hubo un problema validando tu pago. Si se te realizó el cargo, contáctanos.' }
    }
    const notice = notices[result]
    if (notice) {
      if (notice.kind === 'success') toast.success(notice.text)
      else if (notice.kind === 'error') toast.error(notice.text)
      else toast.info(notice.text)
    }
    void queryClient.invalidateQueries({ queryKey: ['membership', 'status', userId] })
    const next = new URLSearchParams(searchParams)
    next.delete('payment')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams, queryClient, userId])

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-3xl">
          <h1 className="text-2xl font-semibold tracking-tight text-(--app-text)">Tu membresía</h1>
          <p className="mt-1 max-w-2xl text-[0.9rem] leading-6 text-(--app-text-muted)">
            Mantén tu membresía ASI al día, renueva con facilidad y conserva tus comprobantes en un espacio organizado.
          </p>
        </div>

        {!session.hasActiveAsiAccess ? (
          <Button className="h-10 w-fit" onClick={() => void navigate(surfacePaths.institutional.eligibility)}>
            Completar solicitud <ArrowRight className="size-4" />
          </Button>
        ) : null}
      </header>

      {statusQuery.isLoading ? (
        <Card>
          <CardContent className="mt-0">
            <PageLoader label="Cargando tu estado" hint="Revisando tu solicitud y pago" />
          </CardContent>
        </Card>
      ) : statusQuery.error ? (
        <Card className="border-rose-200 bg-rose-50/70 dark:border-rose-500/30 dark:bg-rose-500/10">
          <CardContent className="mt-0 flex items-start gap-3 text-sm text-rose-700 dark:text-rose-300">
            <AlertCircle className="mt-0.5 size-5 shrink-0" />
            <div>
              <p className="font-semibold">No pudimos cargar tu membresía.</p>
              <p className="mt-1">{toErrorMessage(statusQuery.error)}</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_21rem]">
          <section className="space-y-5">
            <Card className="overflow-hidden border-primary-200 bg-[linear-gradient(135deg,rgba(43,69,143,0.06),rgba(255,255,255,0.94))] dark:border-primary-500/25 dark:bg-[linear-gradient(135deg,rgba(43,69,143,0.2),rgba(15,23,42,0.96))]">
              <CardHeader className="gap-3 sm:flex sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
                <div className="space-y-1.5">
                  <Badge variant="soft" className="w-fit">{routeStatusLabel}</Badge>
                  <CardTitle>Lo importante ahora</CardTitle>
                  <CardDescription>
                    {session.hasActiveAsiAccess
                      ? 'Tu membresía está activa. Revisa tu renovación y conserva tus datos al día.'
                      : currentStep?.description ?? 'Completa el siguiente paso para avanzar tu membresía.'}
                  </CardDescription>
                </div>
                <div className="min-w-22 rounded-2xl border border-(--app-border) bg-(--app-surface)/80 px-3 py-2.5 text-center">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-(--app-text-subtle)">Avance</p>
                  <p className="mt-0.5 text-xl font-semibold text-(--app-text)">{progress.percent}%</p>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {session.hasActiveAsiAccess && canRenew && bundle.application ? (
                  <div className="rounded-panel border border-(--app-border) bg-(--app-surface) p-3.5">
                    <p className="text-sm font-semibold text-(--app-text)">Renovar membresía</p>
                    <p className="mt-1 text-[0.82rem] leading-5 text-(--app-text-muted)">
                      Renueva por 1 a 5 años. Tu membresía actual se conserva y el monto se calcula automáticamente.
                    </p>
                    <AzulPayCard
                      applicationId={bundle.application.id}
                      intent="renewal"
                      annualAmount={due?.amount ?? null}
                      currency={bundle.settings?.currency ?? 'DOP'}
                      categoryLabel={due?.label ?? bundle.application.category_name ?? null}
                      paymentStatus={bundle.payment?.status === 'initiated' ? 'initiated' : null}
                      azulEnabled={azulEnabled}
                      compact
                      onRefresh={() => void queryClient.invalidateQueries({ queryKey: ['membership', 'status', userId] })}
                    />
                  </div>
                ) : null}

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
                    paymentStatus={bundle.payment?.status ?? null}
                    azulEnabled={azulEnabled}
                    onRefresh={() => void queryClient.invalidateQueries({ queryKey: ['membership', 'status', userId] })}
                  />
                ) : null}

                {!session.hasActiveAsiAccess && currentStep?.key === 'application' && currentStep.state === 'current' ? (
                  <Button className="h-10" onClick={() => void navigate(surfacePaths.institutional.eligibility)}>
                    Iniciar mi solicitud <ArrowRight className="size-4" />
                  </Button>
                ) : null}

                {session.hasActiveAsiAccess && !canRenew ? (
                  <div className="rounded-panel border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-200">
                    Tu membresía está activa. No tienes acciones pendientes ahora.
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card className="overflow-hidden p-0">
              <div className="border-b border-(--app-border) px-4 pt-4 sm:px-5">
                <nav className="flex gap-1 overflow-x-auto" aria-label="Secciones de membresía">
                  {[
                    { key: 'summary', label: 'Resumen', icon: Sparkles },
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
                          'inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-3 text-sm font-semibold transition',
                          activeTab === tab.key
                            ? 'border-primary-600 text-primary-700 dark:text-primary-200'
                            : 'border-transparent text-(--app-text-muted) hover:text-(--app-text)'
                        )}
                      >
                        <TabIcon className="size-4" />
                        {tab.label}
                      </button>
                    )
                  })}
                </nav>
              </div>

              <div className="p-4 sm:p-5">
                {activeTab === 'summary' ? (
                  <div className="grid gap-2.5 md:grid-cols-2">
                    <SummaryTile
                      icon={FileText}
                      label="Solicitud"
                      value={bundle.application ? applicationStatusLabels[bundle.application.status] ?? bundle.application.status : 'No enviada'}
                    />
                    <SummaryTile
                      icon={CreditCard}
                      label="Pago"
                      value={session.hasActiveAsiAccess ? 'Verificado' : bundle.payment ? paymentStatusLabels[bundle.payment.status] ?? bundle.payment.status : 'Pendiente'}
                    />
                    <SummaryTile icon={ShieldCheck} label="Acceso" value={session.hasActiveAsiAccess ? 'Activo' : 'Pendiente'} />
                    <SummaryTile icon={CreditCard} label="Cuota" value={dueAmountLabel ?? due?.label ?? 'Por definir'} />
                    <SummaryTile icon={Sparkles} label="Categoría" value={bundle.application?.category_name ?? 'Sin categoría'} />
                    <SummaryTile icon={ArrowRight} label="Siguiente paso" value={currentStep?.title ?? 'Membresía'} />
                  </div>
                ) : null}

                {activeTab === 'route' ? (
                  <div className="space-y-3">
                    {steps.map((step) => (
                      <MembershipStep
                        key={step.key}
                        step={step}
                        onStartApplication={() => void navigate(surfacePaths.institutional.eligibility)}
                      />
                    ))}
                  </div>
                ) : null}

                {activeTab === 'receipts' ? (
                  bundle.verifiedPayment ? (
                    <MembershipReceiptCard
                      payment={bundle.verifiedPayment}
                      currency={bundle.settings?.currency ?? 'DOP'}
                      categoryLabel={due?.label ?? bundle.application?.category_name ?? null}
                    />
                  ) : (
                    <div className="rounded-panel border border-dashed border-(--app-border) bg-(--app-surface-muted) p-5 text-sm text-(--app-text-muted)">
                      Aún no hay comprobantes verificados disponibles. Cuando un pago sea aprobado, aparecerá aquí.
                    </div>
                  )
                ) : null}
              </div>
            </Card>
          </section>

          <aside className="space-y-5">
            <Card>
              <CardHeader>
                <CardTitle>Estado actual</CardTitle>
                <CardDescription>Resumen operativo sin pasos completados ocupando el foco.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium text-(--app-text)">Avance</span>
                    <span className="font-semibold text-(--app-text)">{progress.completed} / {progress.total}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-(--app-surface-muted)">
                    <div className="h-full rounded-full bg-primary-600" style={{ width: `${progress.percent}%` }} />
                  </div>
                </div>
                <StatusSummaryRow label="Solicitud" value={bundle.application ? applicationStatusLabels[bundle.application.status] ?? bundle.application.status : 'No enviada'} />
                <StatusSummaryRow label="Pago" value={session.hasActiveAsiAccess ? 'Verificado' : bundle.payment ? paymentStatusLabels[bundle.payment.status] ?? bundle.payment.status : 'Pendiente'} />
                <StatusSummaryRow label="Acceso" value={session.hasActiveAsiAccess ? 'Activo' : 'Pendiente'} />
              </CardContent>
            </Card>

            {session.hasActiveAsiAccess ? (
              <Card>
                <CardHeader>
                  <CardTitle>Fechas clave</CardTitle>
                  <CardDescription>Datos de referencia de tu membresía activa.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-1">
                  <StatusSummaryRow label="Fecha de pago" value={formatDate(bundle.verifiedPayment?.verified_at ?? null)} />
                  <StatusSummaryRow label="Activación" value={formatDate(membershipActivatedAt)} />
                  <StatusSummaryRow label="Vencimiento" value={formatDate(membershipExpiresAt)} />
                </CardContent>
              </Card>
            ) : null}

            <Card>
              <CardHeader>
                <CardTitle>Soporte</CardTitle>
                <CardDescription>
                  ¿Dudas con tu membresía? Escríbenos y con gusto te ayudamos.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link
                  to={surfacePaths.institutional.contactUs}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-2xl border border-(--app-border) bg-(--app-surface) px-3.5 text-sm font-semibold text-(--app-text) shadow-sm transition hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700"
                >
                  Ir a contacto <ArrowRight className="size-4" />
                </Link>
              </CardContent>
            </Card>
          </aside>
        </div>
      )}
    </div>
  )
}

function StatusSummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-t border-(--app-border) pt-3 first:border-t-0 first:pt-0">
      <span className="text-sm text-(--app-text-muted)">{label}</span>
      <span className="text-right text-sm font-semibold text-(--app-text)">{value}</span>
    </div>
  )
}

function SummaryTile({ icon: Icon, label, value }: { icon: typeof FileText; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-(--app-border) bg-(--app-surface-muted) p-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-(--app-surface) text-primary-700 dark:text-primary-200">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-(--app-text-subtle)">{label}</p>
        <p className="mt-1 truncate text-sm font-semibold text-(--app-text)">{value}</p>
      </div>
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
  const Icon = step.icon
  const meta = stateMeta[step.state]
  const isOpenByDefault = step.state !== 'done'

  return (
    <details
      className="group rounded-panel border border-(--app-border) bg-(--app-surface) transition-colors open:bg-(--app-surface-elevated)"
      open={isOpenByDefault}
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 p-4 marker:hidden">
        <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-full', meta.dot)}>
          {step.state === 'done' ? <CheckCircle2 className="size-5" /> : null}
          {step.state === 'blocked' ? <AlertCircle className="size-5" /> : null}
          {step.state === 'current' ? <Clock className="size-4.5" /> : null}
          {step.state === 'pending' ? <Circle className="size-4" /> : null}
        </span>
        <div className="min-w-0 flex-1">
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-(--app-text)">
            <Icon className="size-4 shrink-0 text-(--app-text-muted)" />
            {step.title}
          </p>
        </div>
        <Badge variant="outline" className={cn('w-fit shrink-0 border-transparent', meta.badge)}>
          {meta.label}
        </Badge>
      </summary>

      <div className="border-t border-(--app-border) px-4 pb-4 pt-3">
        <p className="text-sm leading-6 text-(--app-text-muted)">{step.description}</p>

        {step.key === 'application' && step.state === 'current' ? (
          <Button className="mt-4 h-10" onClick={onStartApplication}>
            Iniciar mi solicitud <ArrowRight className="size-4" />
          </Button>
        ) : null}
      </div>
    </details>
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
      <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
        El pago en línea aún no está disponible. Inténtalo más tarde o contacta a un administrador.
      </div>
    )
  }

  if (processing) {
    return (
      <div className="mt-3 rounded-2xl border border-(--app-border) bg-(--app-surface-muted) p-4">
        <p className="inline-flex items-center gap-2 text-sm font-semibold text-(--app-text)">
          <Clock className="size-4" /> Estamos confirmando tu pago…
        </p>
        <p className="mt-1 text-xs text-(--app-text-muted)">
          Si ya completaste el pago en AZUL, la confirmación puede tardar unos minutos.
        </p>
        <Button variant="outline" className="mt-3 h-9" onClick={onRefresh}>
          Actualizar estado
        </Button>
      </div>
    )
  }

  const yearSelector = (
    <label className="mt-3 flex items-center justify-between gap-3 text-sm">
      <span className="font-medium text-(--app-text)">Años de membresía</span>
      <select
        value={years}
        onChange={(event) => setYears(Number(event.target.value))}
        disabled={payMutation.isPending}
        className="h-9 rounded-lg border border-(--app-border) bg-(--app-surface) px-2 text-sm text-(--app-text) focus:border-primary-500 focus:outline-none"
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
      className={compact ? 'mt-3 h-9 w-full' : 'mt-3 h-10'}
      disabled={payMutation.isPending}
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
      <div className="mt-2">
        {yearSelector}
        {button}
      </div>
    )
  }

  return (
    <div className="mt-3 rounded-2xl border border-(--app-border) bg-(--app-surface-muted) p-4">
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
      {paymentStatus === 'failed' || paymentStatus === 'rejected' ? (
        <p className="mt-2 text-xs font-medium text-rose-600 dark:text-rose-400">
          Tu intento anterior no se completó. Puedes intentarlo de nuevo.
        </p>
      ) : null}
      {button}
      <p className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-(--app-surface) px-3 py-2 text-xs text-(--app-text-muted)">
        <ShieldCheck className="size-3.5" /> Transacción procesada por AZUL. No almacenamos los datos de tu tarjeta.
      </p>
    </div>
  )
}

const RECEIPT_TITLE = 'Comprobante de pago de membresía'

function buildReceiptLines(payment: MembershipPayment, currency: string, categoryLabel: string | null): ReceiptLine[] {
  return [
    ['Comercio', 'ASI Rep. Dominicana'],
    ['No. de orden', payment.order_number ?? '—'],
    ['Categoría', categoryLabel ?? payment.category_slug],
    ['Monto', formatMoney(Number(payment.amount ?? 0), currency)],
    ['Resultado', 'Aprobado'],
    ['No. de autorización', payment.authorization_code ?? '—'],
    ['Referencia', payment.azul_rrn ?? '—'],
    ['Fecha', formatDate(payment.verified_at)]
  ]
}

function MembershipReceiptCard({
  payment,
  currency,
  categoryLabel
}: {
  payment: MembershipPayment
  currency: string
  categoryLabel: string | null
}) {
  const lines = buildReceiptLines(payment, currency, categoryLabel)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Comprobante de pago</CardTitle>
        <CardDescription>Descárgalo o compártelo cuando lo necesites.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        {lines.map(([key, value]) => (
          <StatusSummaryRow key={key} label={key} value={value} />
        ))}
        <div className="flex gap-2 pt-3">
          <Button variant="outline" className="h-9 flex-1" onClick={() => printReceipt(RECEIPT_TITLE, lines)}>
            <Download className="size-4" /> Descargar
          </Button>
          <Button
            variant="outline"
            className="h-9 flex-1"
            onClick={() => void shareReceipt(RECEIPT_TITLE, receiptPlainText(RECEIPT_TITLE, lines))}
          >
            <Share2 className="size-4" /> Compartir
          </Button>
        </div>
      </CardContent>
    </Card>
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
    <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
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
