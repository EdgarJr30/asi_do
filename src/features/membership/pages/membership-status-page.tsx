import { useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  ArrowRight,
  Banknote,
  CheckCircle2,
  Circle,
  Clock,
  FileText,
  Paperclip,
  ShieldCheck,
  Sparkles,
  UploadCloud
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

import { surfacePaths } from '@/app/router/surface-paths'
import { useAppSession } from '@/app/providers/app-session-provider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PageLoader } from '@/components/ui/loader'
import { PageHeader } from '@/components/ui/page-header'
import { StatCard } from '@/components/ui/stat-card'
import { Textarea } from '@/components/ui/textarea'
import { toErrorMessage } from '@/features/auth/lib/auth-api'
import {
  createMembershipReceiptUrl,
  fetchMyMembershipStatus,
  getCategoryDue,
  respondMembershipApplication,
  submitMembershipPaymentReceipt,
  type MembershipStatusBundle
} from '@/features/membership/lib/membership-api'
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

const paymentStatusLabels: Record<string, string> = {
  submitted: 'En verificación',
  verified: 'Verificado',
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
  const paymentSubmitted = payment?.status === 'submitted'

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
  const displayName = session.profile?.display_name ?? session.profile?.full_name ?? session.authUser?.email ?? 'miembro'
  const firstName = displayName.trim().split(/\s+/)[0] ?? displayName

  const statusQuery = useQuery({
    queryKey: ['membership', 'status', userId],
    enabled: Boolean(userId),
    queryFn: async () => fetchMyMembershipStatus(userId!)
  })

  const bundle = useMemo<MembershipStatusBundle>(
    () => statusQuery.data ?? { application: null, payment: null, settings: null },
    [statusQuery.data]
  )
  const steps = useMemo(() => computeSteps(bundle, session.hasActiveAsiAccess), [bundle, session.hasActiveAsiAccess])
  const progress = useMemo(() => getProgressSummary(steps), [steps])
  const currentStep = getCurrentStep(steps)
  const due = getCategoryDue(bundle.settings, bundle.application?.category_slug)
  const dueAmountLabel = due?.amount != null ? `${bundle.settings?.currency ?? 'USD'} ${due.amount.toLocaleString()}` : null
  const dueSummaryLabel = due ? [dueAmountLabel, due.label].filter(Boolean).join(' · ') : null
  const paymentStep = steps.find((step) => step.key === 'payment')
  const showTransferDetails = paymentStep?.state === 'current' && Boolean(bundle.settings)
  const canUploadReceipt =
    paymentStep?.state === 'current' &&
    Boolean(bundle.application) &&
    (!bundle.payment || bundle.payment.status === 'rejected')

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Cuenta · Membresía"
        title={`Hola, ${firstName}`}
        description={
          session.hasActiveAsiAccess
            ? 'Tu membresía está activa. Ya puedes usar la plataforma y mantener tu información al día.'
            : 'Revisa el avance de tu solicitud, completa el pago y da seguimiento a la activación de tu cuenta.'
        }
        actions={
          session.hasActiveAsiAccess ? (
            <Button className="h-10" onClick={() => void navigate(surfacePaths.candidate.home)}>
              Entrar a la plataforma <ArrowRight className="size-4" />
            </Button>
          ) : (
            <Button className="h-10" onClick={() => void navigate(surfacePaths.institutional.eligibility)}>
              Completar solicitud <ArrowRight className="size-4" />
            </Button>
          )
        }
      >
        <StatCard
          label="Progreso"
          value={`${progress.percent}%`}
          helper={`${progress.completed} de ${progress.total} pasos completados`}
        />
        <StatCard
          label="Solicitud"
          value={bundle.application ? applicationStatusLabels[bundle.application.status] ?? bundle.application.status : 'Pendiente'}
          helper={bundle.application?.category_name ?? 'Selecciona tu categoría para iniciar'}
        />
        <StatCard
          label="Pago"
          value={bundle.payment ? paymentStatusLabels[bundle.payment.status] ?? bundle.payment.status : 'Sin comprobante'}
          helper={dueSummaryLabel ?? 'Cuota pendiente por categoría'}
        />
        <StatCard
          label="Siguiente paso"
          value={currentStep?.title ?? 'Membresía'}
          helper={currentStep?.description ?? 'Revisa el estado de tu membresía'}
        />
      </PageHeader>

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
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <Card>
            <CardHeader className="sm:flex sm:flex-row sm:items-start sm:justify-between sm:gap-4 sm:space-y-0">
              <div className="space-y-2">
                <CardTitle>Ruta de activación</CardTitle>
                <CardDescription>
                  Mantén cada etapa al día para que tu membresía avance sin perder contexto.
                </CardDescription>
              </div>
              <Badge variant="soft" className="w-fit">
                {session.hasActiveAsiAccess ? 'Activa' : 'En proceso'}
              </Badge>
            </CardHeader>

            <CardContent>
              <ol className="space-y-4">
                {steps.map((step, index) => (
                  <MembershipStep
                    key={step.key}
                    step={step}
                    isLast={index === steps.length - 1}
                    onStartApplication={() => void navigate(surfacePaths.institutional.eligibility)}
                  >
                    {step.key === 'application' && bundle.application?.status === 'needs_more_info' ? (
                      <NeedsMoreInfoResponse
                        applicationId={bundle.application.id}
                        reviewNote={bundle.application.review_notes}
                        onResponded={() => void queryClient.invalidateQueries({ queryKey: ['membership', 'status', userId] })}
                      />
                    ) : null}

                    {step.key === 'payment' && showTransferDetails ? (
                      <TransferDetails
                        settings={bundle.settings!}
                        dueAmount={due?.amount ?? null}
                        categoryLabel={due?.label ?? bundle.application?.category_name ?? null}
                      />
                    ) : null}

                    {step.key === 'payment' && canUploadReceipt && bundle.application ? (
                      <ReceiptUpload
                        applicationId={bundle.application.id}
                        memberUserId={userId!}
                        categorySlug={bundle.application.category_slug}
                        amount={due?.amount ?? null}
                        currency={bundle.settings?.currency ?? 'USD'}
                        onUploaded={() => void queryClient.invalidateQueries({ queryKey: ['membership', 'status', userId] })}
                      />
                    ) : null}

                    {step.key === 'payment' && bundle.payment?.receipt_path ? (
                      <ReceiptViewLink receiptPath={bundle.payment.receipt_path} />
                    ) : null}
                  </MembershipStep>
                ))}
              </ol>
            </CardContent>
          </Card>

          <aside className="space-y-5">
            <Card>
              <CardHeader>
                <CardTitle>Estado actual</CardTitle>
                <CardDescription>Resumen operativo de tu membresía.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium text-(--app-text)">Avance</span>
                    <span className="font-semibold text-(--app-text)">{progress.percent}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-(--app-surface-muted)">
                    <div className="h-full rounded-full bg-primary-600" style={{ width: `${progress.percent}%` }} />
                  </div>
                </div>

                <StatusSummaryRow
                  label="Solicitud"
                  value={bundle.application ? applicationStatusLabels[bundle.application.status] ?? bundle.application.status : 'No enviada'}
                />
                <StatusSummaryRow
                  label="Pago"
                  value={bundle.payment ? paymentStatusLabels[bundle.payment.status] ?? bundle.payment.status : 'Pendiente'}
                />
                <StatusSummaryRow
                  label="Acceso"
                  value={session.hasActiveAsiAccess ? 'Activo' : 'Pendiente de activación'}
                />
                <StatusSummaryRow
                  label="Cuota"
                  value={dueAmountLabel ?? due?.label ?? 'Por definir'}
                />
              </CardContent>
            </Card>

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

function MembershipStep({
  step,
  isLast,
  onStartApplication,
  children
}: {
  step: StepView
  isLast: boolean
  onStartApplication: () => void
  children?: ReactNode
}) {
  const Icon = step.icon
  const meta = stateMeta[step.state]

  return (
    <li className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-3 sm:grid-cols-[2.5rem_minmax(0,1fr)] sm:gap-4">
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
        {!isLast ? <span className="my-2 w-px flex-1 bg-(--app-border)" /> : null}
      </div>

      <div className="min-w-0 rounded-[18px] border border-(--app-border) bg-(--app-surface) p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1.5">
            <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-(--app-text)">
              <Icon className="size-4 shrink-0 text-(--app-text-muted)" />
              {step.title}
            </h3>
            <p className="text-sm leading-6 text-(--app-text-muted)">{step.description}</p>
          </div>
          <Badge variant="outline" className={cn('w-fit shrink-0 border-transparent', meta.badge)}>
            {meta.label}
          </Badge>
        </div>

        {step.key === 'application' && step.state === 'current' ? (
          <Button className="mt-4 h-10" onClick={onStartApplication}>
            Iniciar mi solicitud <ArrowRight className="size-4" />
          </Button>
        ) : null}

        {children ? <div className="mt-4">{children}</div> : null}
      </div>
    </li>
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
        <Clock className="size-3.5" /> Después de transferir, sube tu comprobante abajo. También un pastor o administrador puede subirlo por ti.
      </p>
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

function ReceiptViewLink({ receiptPath }: { receiptPath: string }) {
  const openMutation = useMutation({
    mutationFn: async () => createMembershipReceiptUrl(receiptPath),
    onSuccess: (url) => window.open(url, '_blank', 'noopener,noreferrer')
  })

  return (
    <div className="mt-3">
      <Button
        variant="outline"
        className="h-9"
        disabled={openMutation.isPending}
        onClick={() => openMutation.mutate()}
      >
        <Paperclip className="size-4" /> {openMutation.isPending ? 'Abriendo…' : 'Ver mi comprobante'}
      </Button>
      {openMutation.error ? (
        <p className="mt-1.5 text-xs text-rose-600 dark:text-rose-400">{toErrorMessage(openMutation.error)}</p>
      ) : null}
    </div>
  )
}

const ACCEPTED_RECEIPT_TYPES = 'application/pdf,image/png,image/jpeg,image/webp'

function ReceiptUpload({
  applicationId,
  memberUserId,
  categorySlug,
  amount,
  currency,
  onUploaded
}: {
  applicationId: string
  memberUserId: string
  categorySlug: string
  amount: number | null
  currency: string
  onUploaded: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [referenceNote, setReferenceNote] = useState('')

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file) {
        throw new Error('Selecciona el archivo del comprobante.')
      }
      return submitMembershipPaymentReceipt({
        applicationId,
        memberUserId,
        categorySlug,
        amount,
        currency,
        file,
        referenceNote
      })
    },
    onSuccess: () => {
      setFile(null)
      setReferenceNote('')
      if (inputRef.current) {
        inputRef.current.value = ''
      }
      onUploaded()
    }
  })

  return (
    <div className="mt-3 rounded-2xl border border-(--app-border) bg-(--app-surface) p-4">
      <p className="text-sm font-semibold text-(--app-text)">Sube tu comprobante</p>
      <p className="mt-0.5 text-xs text-(--app-text-muted)">PDF o imagen (PNG, JPG, WebP), máximo 10 MB.</p>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_RECEIPT_TYPES}
        onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        disabled={uploadMutation.isPending}
        className="mt-3 block w-full text-sm text-(--app-text-muted) file:mr-3 file:rounded-lg file:border-0 file:bg-(--app-surface-muted) file:px-3 file:py-2 file:text-sm file:font-semibold file:text-(--app-text) hover:file:bg-(--app-border)"
      />

      <input
        type="text"
        value={referenceNote}
        onChange={(event) => setReferenceNote(event.target.value)}
        disabled={uploadMutation.isPending}
        placeholder="Referencia o número de transferencia (opcional)"
        className="mt-3 block w-full rounded-lg border border-(--app-border) bg-(--app-surface) px-3 py-2 text-sm text-(--app-text) placeholder:text-(--app-text-subtle) focus:border-primary-500 focus:outline-none"
      />

      {uploadMutation.error ? (
        <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">{toErrorMessage(uploadMutation.error)}</p>
      ) : null}

      <Button
        className="mt-3 h-10"
        disabled={!file || uploadMutation.isPending}
        onClick={() => uploadMutation.mutate()}
      >
        <UploadCloud className="size-4" /> {uploadMutation.isPending ? 'Subiendo…' : 'Enviar comprobante'}
      </Button>
    </div>
  )
}
