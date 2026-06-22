import { createPrivateFileUrl, uploadPrivateFile } from '@/features/auth/lib/auth-api'
import { supabase } from '@/lib/supabase/client'
import type { Tables, TablesInsert } from '@/shared/types/database'

export type MembershipApplication = Tables<'institutional_membership_applications'>
export type MembershipPayment = Tables<'membership_payments'>
export type MembershipPaymentSettings = Tables<'membership_payment_settings'>

export interface MembershipStatusBundle {
  application: MembershipApplication | null
  payment: MembershipPayment | null
  settings: MembershipPaymentSettings | null
}

/** Cuota configurada para una categoría: { amount, label }. */
export interface CategoryDue {
  amount: number | null
  label: string | null
}

function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase no está configurado. Completa VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.')
  }
  return supabase
}

/** Solicitud más reciente del usuario + su último pago + la configuración de pago activa. */
export async function fetchMyMembershipStatus(userId: string): Promise<MembershipStatusBundle> {
  const client = requireSupabase()

  const [applicationResponse, settingsResponse] = await Promise.all([
    client
      .from('institutional_membership_applications')
      .select('*')
      .eq('requester_user_id', userId)
      .order('submitted_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    client
      .from('membership_payment_settings')
      .select('*')
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
  ])

  if (applicationResponse.error) {
    throw applicationResponse.error
  }
  if (settingsResponse.error) {
    throw settingsResponse.error
  }

  const application = applicationResponse.data ?? null
  let payment: MembershipPayment | null = null

  if (application) {
    const paymentResponse = await client
      .from('membership_payments')
      .select('*')
      .eq('application_id', application.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (paymentResponse.error) {
      throw paymentResponse.error
    }
    payment = paymentResponse.data ?? null
  }

  return { application, payment, settings: settingsResponse.data ?? null }
}

/** Configuración de pago activa (datos bancarios + cuotas). Null si no hay. */
export async function fetchMembershipPaymentSettings(): Promise<MembershipPaymentSettings | null> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('membership_payment_settings')
    .select('*')
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw error
  }
  return data ?? null
}

export interface MembershipPaymentSettingsInput {
  bankName: string
  accountHolder: string
  accountNumber: string
  accountType: string
  routingOrSwift: string
  currency: string
  instructions: string
  duesByCategory: Record<string, { amount: number | null; label: string }>
}

/** Actualiza (admin) la configuración de pago. RLS exige is_platform_admin(). */
export async function updateMembershipPaymentSettings(
  id: string,
  input: MembershipPaymentSettingsInput,
  actorUserId: string | null
): Promise<MembershipPaymentSettings> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('membership_payment_settings')
    .update({
      bank_name: input.bankName.trim(),
      account_holder: input.accountHolder.trim(),
      account_number: input.accountNumber.trim(),
      account_type: input.accountType.trim(),
      routing_or_swift: input.routingOrSwift.trim(),
      currency: input.currency.trim() || 'USD',
      instructions: input.instructions.trim(),
      dues_by_category: input.duesByCategory,
      updated_by_user_id: actorUserId
    })
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    throw error
  }
  return data
}

export type MembershipReviewDecision = Extract<
  MembershipApplication['status'],
  'under_review' | 'needs_more_info' | 'approved' | 'rejected'
>
export type PastoralReferenceStatus = MembershipApplication['pastoral_reference_status']

/** Una solicitud de la cola del pastor con su último pago asociado (si existe). */
export interface PastorQueueItem {
  application: MembershipApplication
  payment: MembershipPayment | null
}

/**
 * Cola scoped del pastor: solicitudes pendientes de las iglesias sobre las que
 * tiene alcance. La RLS de `institutional_membership_applications` ya limita las
 * filas a las iglesias del pastor; aquí solo filtramos por estado y `church_id`.
 */
export async function fetchPastorMembershipQueue(): Promise<PastorQueueItem[]> {
  const client = requireSupabase()

  const { data: applications, error } = await client
    .from('institutional_membership_applications')
    .select('*')
    .in('status', ['submitted', 'under_review', 'needs_more_info'])
    .not('church_id', 'is', null)
    .order('submitted_at', { ascending: true })

  if (error) {
    throw error
  }

  const rows = applications ?? []
  if (rows.length === 0) {
    return []
  }

  const { data: payments, error: paymentsError } = await client
    .from('membership_payments')
    .select('*')
    .in('application_id', rows.map((application) => application.id))
    .order('created_at', { ascending: false })

  if (paymentsError) {
    throw paymentsError
  }

  // Primer pago por solicitud (ya vienen ordenados desc por created_at).
  const latestPaymentByApplication = new Map<string, MembershipPayment>()
  for (const payment of payments ?? []) {
    if (!latestPaymentByApplication.has(payment.application_id)) {
      latestPaymentByApplication.set(payment.application_id, payment)
    }
  }

  return rows.map((application) => ({
    application,
    payment: latestPaymentByApplication.get(application.id) ?? null
  }))
}

/**
 * Revisión de una solicitud por el pastor (o admin) vía RPC `review_membership_application`:
 * autoriza por alcance pastoral, registra la referencia pastoral y audita la transición.
 */
export async function reviewMembershipApplication(input: {
  applicationId: string
  decision: MembershipReviewDecision
  pastoralReference?: PastoralReferenceStatus | null
  reviewNotes?: string
}): Promise<MembershipApplication> {
  const client = requireSupabase()
  const { data, error } = await client.rpc('review_membership_application', {
    p_application_id: input.applicationId,
    p_decision: input.decision,
    p_pastoral_reference: input.pastoralReference ?? undefined,
    p_review_notes: input.reviewNotes?.trim() || undefined
  })

  if (error) {
    throw error
  }
  return data
}

export interface SubmitMembershipPaymentInput {
  applicationId: string
  memberUserId: string
  categorySlug: string
  amount: number | null
  currency: string
  file: File
  referenceNote?: string
  /** Quién sube el comprobante: el propio miembro por defecto, o el pastor por él. */
  uploadedByUserId?: string
}

/**
 * Sube el comprobante de transferencia al bucket privado y registra el pago
 * (`status='submitted'`) para que un admin lo verifique. Cubre el período anual.
 */
export async function submitMembershipPaymentReceipt(input: SubmitMembershipPaymentInput): Promise<MembershipPayment> {
  const client = requireSupabase()

  const receiptPath = await uploadPrivateFile({
    bucket: 'membership-receipts',
    ownerUserId: input.memberUserId,
    file: input.file,
    prefix: 'receipt'
  })

  const periodStart = new Date()
  const periodEnd = new Date(periodStart)
  periodEnd.setFullYear(periodEnd.getFullYear() + 1)

  const payload: TablesInsert<'membership_payments'> = {
    application_id: input.applicationId,
    member_user_id: input.memberUserId,
    category_slug: input.categorySlug,
    amount: input.amount,
    currency: input.currency,
    method: 'bank_transfer',
    period_start: periodStart.toISOString().slice(0, 10),
    period_end: periodEnd.toISOString().slice(0, 10),
    receipt_path: receiptPath,
    reference_note: input.referenceNote?.trim() || null,
    status: 'submitted',
    uploaded_by_user_id: input.uploadedByUserId ?? input.memberUserId
  }

  const { data, error } = await client.from('membership_payments').insert(payload).select('*').single()

  if (error) {
    throw error
  }
  return data
}

/** URL firmada (10 min) para que el miembro vea/descargue su comprobante subido. */
export async function createMembershipReceiptUrl(receiptPath: string): Promise<string> {
  return createPrivateFileUrl('membership-receipts', receiptPath)
}

/** Extrae la cuota de una categoría desde la configuración (jsonb dues_by_category). */
export function getCategoryDue(settings: MembershipPaymentSettings | null, categorySlug: string | null | undefined): CategoryDue | null {
  if (!settings || !categorySlug) {
    return null
  }
  const map = (settings.dues_by_category ?? {}) as Record<string, { amount?: number; label?: string } | undefined>
  const entry = map[categorySlug]
  if (!entry) {
    return null
  }
  return { amount: typeof entry.amount === 'number' ? entry.amount : null, label: entry.label ?? null }
}
