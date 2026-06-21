import { useMemo } from 'react'

import { useMutation, useQuery } from '@tanstack/react-query'
import {
  AlertCircle,
  ArrowRight,
  Banknote,
  CheckCircle2,
  Circle,
  Clock,
  FileText,
  LogOut,
  ShieldCheck,
  Sparkles
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { surfacePaths } from '@/app/router/surface-paths'
import { useAppSession } from '@/app/providers/app-session-provider'
import { BrandLockup } from '@/components/ui/app-brand'
import { Button } from '@/components/ui/button'
import { PageLoader } from '@/components/ui/loader'
import { signOutCurrentUser, toErrorMessage } from '@/features/auth/lib/auth-api'
import { fetchMyMembershipStatus, getCategoryDue, type MembershipStatusBundle } from '@/features/membership/lib/membership-api'
import { cn } from '@/lib/utils/cn'

type StepState = 'done' | 'current' | 'pending' | 'blocked'

const applicationStatusLabels: Record<string, string> = {
  submitted: 'Enviada',
  under_review: 'En revisión',
  needs_more_info: 'Falta información',
  approved: 'Aprobada',
  rejected: 'Rechazada',
  cancelled: 'Cancelada'
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
  const paymentVerified = payment?.status === 'verified'
  const paymentSubmitted = payment?.status === 'submitted'

  let applicationDescription: string
  if (!application) {
    applicationDescription = 'Aún no has enviado tu solicitud. Elige tu categoría y tu iglesia para empezar.'
  } else if (appRejected) {
    applicationDescription = `Tu solicitud fue ${applicationStatusLabels[application.status] ?? application.status}. Contacta a un administrador.`
  } else {
    applicationDescription = `Categoría: ${application.category_name}. Estado: ${applicationStatusLabels[application.status] ?? application.status}.`
  }

  return [
    {
      key: 'application',
      title: 'Solicitud de membresía',
      icon: FileText,
      state: appRejected ? 'blocked' : appExists ? 'done' : 'current',
      description: applicationDescription
    },
    {
      key: 'payment',
      title: 'Pago de la membresía',
      icon: Banknote,
      state: !appExists
        ? 'pending'
        : paymentVerified
          ? 'done'
          : 'current',
      description: !appExists
        ? 'Disponible cuando envíes tu solicitud.'
        : paymentVerified
          ? 'Tu pago fue verificado por un administrador.'
          : paymentSubmitted
            ? 'Recibimos tu comprobante. Un administrador lo está verificando.'
            : payment?.status === 'rejected'
              ? 'Tu comprobante fue rechazado. Vuelve a transferir y súbelo de nuevo.'
              : 'Transfiere la cuota de tu categoría y sube el comprobante.'
    },
    {
      key: 'approval',
      title: 'Aprobación pastoral / administrativa',
      icon: ShieldCheck,
      state: appApproved ? 'done' : appRejected ? 'blocked' : appExists ? 'current' : 'pending',
      description: appApproved
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

export function MembershipStatusPage() {
  const session = useAppSession()
  const navigate = useNavigate()
  const userId = session.authUser?.id ?? null
  const displayName = session.profile?.display_name ?? session.profile?.full_name ?? session.authUser?.email ?? 'miembro'

  const statusQuery = useQuery({
    queryKey: ['membership', 'status', userId],
    enabled: Boolean(userId),
    queryFn: async () => fetchMyMembershipStatus(userId!)
  })

  const signOutMutation = useMutation({
    mutationFn: async () => signOutCurrentUser(),
    onSuccess: () => navigate('/auth/sign-in', { replace: true })
  })

  const bundle = useMemo<MembershipStatusBundle>(
    () => statusQuery.data ?? { application: null, payment: null, settings: null },
    [statusQuery.data]
  )
  const steps = useMemo(() => computeSteps(bundle, session.hasActiveAsiAccess), [bundle, session.hasActiveAsiAccess])
  const due = getCategoryDue(bundle.settings, bundle.application?.category_slug)
  const paymentStep = steps.find((step) => step.key === 'payment')
  const showTransferDetails = paymentStep?.state === 'current' && Boolean(bundle.settings)

  return (
    <div className="min-h-dvh bg-(--app-canvas-strong) px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-2xl">
        <header className="mb-6 flex items-center justify-between">
          <BrandLockup />
          <Button variant="ghost" className="h-9" onClick={() => signOutMutation.mutate()} disabled={signOutMutation.isPending}>
            <LogOut className="size-4" /> Salir
          </Button>
        </header>

        <div className="overflow-hidden rounded-panel border border-(--app-border) bg-(--app-surface) shadow-[0_18px_44px_rgba(19,42,97,0.08)]">
          <div className="border-b border-(--app-border) bg-(--app-surface-muted) px-6 py-6 sm:px-8">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-(--app-text-subtle)">Membresía</p>
            <h1 className="mt-1.5 text-[1.5rem] font-semibold tracking-tight text-(--app-text) sm:text-[1.8rem]">
              Hola, {displayName.split(/\s+/)[0]}
            </h1>
            <p className="mt-1 text-sm text-(--app-text-muted)">
              {session.hasActiveAsiAccess
                ? 'Tu membresía está activa. Ya puedes entrar a la plataforma.'
                : 'Completa estos pasos para activar tu membresía y desbloquear la plataforma.'}
            </p>
          </div>

          <div className="px-6 py-6 sm:px-8">
            {statusQuery.isLoading ? (
              <PageLoader label="Cargando tu estado" hint="Revisando tu solicitud y pago" />
            ) : statusQuery.error ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
                {toErrorMessage(statusQuery.error)}
              </div>
            ) : (
              <ol className="space-y-1">
                {steps.map((step, index) => {
                  const Icon = step.icon
                  const meta = stateMeta[step.state]
                  const isLast = index === steps.length - 1
                  return (
                    <li key={step.key} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-full', meta.dot)}>
                          {step.state === 'done' ? (
                            <CheckCircle2 className="size-5" />
                          ) : step.state === 'blocked' ? (
                            <AlertCircle className="size-5" />
                          ) : step.state === 'current' ? (
                            <Clock className="size-4.5" />
                          ) : (
                            <Circle className="size-4" />
                          )}
                        </span>
                        {!isLast ? <span className="my-1 w-px flex-1 bg-(--app-border)" /> : null}
                      </div>

                      <div className={cn('min-w-0 flex-1', isLast ? 'pb-1' : 'pb-6')}>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-(--app-text)">
                            <Icon className="size-4 text-(--app-text-muted)" /> {step.title}
                          </h3>
                          <span className={cn('rounded-full px-2 py-0.5 text-[0.7rem] font-semibold', meta.badge)}>{meta.label}</span>
                        </div>
                        <p className="mt-1 text-sm leading-6 text-(--app-text-muted)">{step.description}</p>

                        {/* Acción del paso de solicitud */}
                        {step.key === 'application' && step.state === 'current' ? (
                          <Button className="mt-3 h-10" onClick={() => void navigate(surfacePaths.institutional.membershipApply)}>
                            Iniciar mi solicitud <ArrowRight className="size-4" />
                          </Button>
                        ) : null}

                        {/* Datos de transferencia en el paso de pago */}
                        {step.key === 'payment' && showTransferDetails ? (
                          <TransferDetails settings={bundle.settings!} dueAmount={due?.amount ?? null} categoryLabel={due?.label ?? bundle.application?.category_name ?? null} />
                        ) : null}
                      </div>
                    </li>
                  )
                })}
              </ol>
            )}

            {session.hasActiveAsiAccess ? (
              <div className="mt-4 border-t border-(--app-border) pt-5">
                <Button className="h-11 w-full sm:w-auto" onClick={() => void navigate(surfacePaths.candidate.home)}>
                  Entrar a la plataforma <ArrowRight className="size-4" />
                </Button>
              </div>
            ) : null}
          </div>
        </div>

        <p className="mt-5 text-center text-xs text-(--app-text-subtle)">
          ¿Dudas con tu membresía? Escríbenos y con gusto te ayudamos.
        </p>
      </div>
    </div>
  )
}

function TransferDetails({
  settings,
  dueAmount,
  categoryLabel
}: {
  settings: NonNullable<MembershipStatusBundle['settings']>
  dueAmount: number | null
  categoryLabel: string | null
}) {
  const rows: Array<{ label: string; value: string }> = [
    { label: 'Banco', value: settings.bank_name },
    { label: 'Titular', value: settings.account_holder },
    { label: 'No. de cuenta', value: settings.account_number },
    { label: 'Tipo', value: settings.account_type },
    { label: 'SWIFT / ABA', value: settings.routing_or_swift }
  ].filter((row) => row.value && row.value.trim().length > 0)

  return (
    <div className="mt-3 rounded-2xl border border-(--app-border) bg-(--app-surface-muted) p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-(--app-text)">Datos para tu transferencia</p>
        {dueAmount != null ? (
          <span className="rounded-full bg-primary-600 px-3 py-1 text-sm font-bold text-white">
            {settings.currency} {dueAmount.toLocaleString()}
          </span>
        ) : null}
      </div>
      {categoryLabel ? <p className="mt-0.5 text-xs text-(--app-text-muted)">Cuota anual · {categoryLabel}</p> : null}

      <dl className="mt-3 grid gap-x-4 gap-y-2 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label}>
            <dt className="text-[0.7rem] font-medium uppercase tracking-wide text-(--app-text-subtle)">{row.label}</dt>
            <dd className="text-sm font-medium text-(--app-text)">{row.value}</dd>
          </div>
        ))}
      </dl>

      {settings.instructions ? <p className="mt-3 text-xs leading-5 text-(--app-text-muted)">{settings.instructions}</p> : null}

      <p className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-(--app-surface) px-3 py-2 text-xs text-(--app-text-muted)">
        <Clock className="size-3.5" /> La carga del comprobante estará disponible en breve. También un pastor o administrador puede subirlo por ti.
      </p>
    </div>
  )
}
