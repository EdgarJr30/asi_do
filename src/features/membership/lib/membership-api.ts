import { createPrivateFileUrl, uploadPrivateFile } from '@/features/auth/lib/auth-api'
import { supabase } from '@/lib/supabase/client'
import type { Tables, TablesInsert } from '@/shared/types/database'

export type MembershipApplication = Tables<'institutional_membership_applications'>
export type MembershipPayment = Tables<'membership_payments'>
export type MembershipPaymentSettings = Tables<'membership_payment_settings'>

export interface MembershipStatusBundle {
  application: MembershipApplication | null
  /** Último pago (cualquier estado), p. ej. una renovación en curso o fallida. */
  payment: MembershipPayment | null
  /** Último pago VERIFICADO; respalda la membresía activa y la "fecha de pago". */
  verifiedPayment: MembershipPayment | null
  /** Todos los pagos verificados (inicial + renovaciones), más reciente primero. Historial de comprobantes. */
  verifiedPayments: MembershipPayment[]
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
  let verifiedPayments: MembershipPayment[] = []

  if (application) {
    const [latestResponse, verifiedResponse] = await Promise.all([
      client
        .from('membership_payments')
        .select('*')
        .eq('application_id', application.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      // Todos los verificados (inicial + renovaciones) para el historial de comprobantes.
      client
        .from('membership_payments')
        .select('*')
        .eq('application_id', application.id)
        .eq('status', 'verified')
        .order('verified_at', { ascending: false })
    ])

    if (latestResponse.error) {
      throw latestResponse.error
    }
    if (verifiedResponse.error) {
      throw verifiedResponse.error
    }
    payment = latestResponse.data ?? null
    verifiedPayments = verifiedResponse.data ?? []
  }

  return {
    application,
    payment,
    verifiedPayment: verifiedPayments[0] ?? null,
    verifiedPayments,
    settings: settingsResponse.data ?? null
  }
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
  azulEnabled: boolean
  azulCurrencyCode: string
  azulEnvironment: string
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
      currency: input.currency.trim() || 'DOP',
      instructions: input.instructions.trim(),
      dues_by_category: input.duesByCategory,
      azul_enabled: input.azulEnabled,
      azul_currency_code: input.azulCurrencyCode.trim() || '$',
      azul_environment: input.azulEnvironment.trim() || 'test',
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
export type MembershipPaymentDecision = Extract<MembershipPayment['status'], 'verified' | 'rejected'>

/** Vista admin: solicitud + su último pago + el estado de la cuenta del miembro. */
export interface AdminMembershipRow {
  application: MembershipApplication
  payment: MembershipPayment | null
  member: Pick<
    Tables<'users'>,
    'id' | 'full_name' | 'email' | 'asi_membership_status' | 'user_subscription_status' | 'membership_expires_at' | 'status'
  > | null
}

/**
 * Consola admin: solicitudes accionables (no canceladas) con su último pago y el
 * estado de la cuenta del miembro. RLS exige permiso admin para ver todo.
 */
export async function fetchAdminMembershipApplications(): Promise<AdminMembershipRow[]> {
  const client = requireSupabase()

  const { data: applications, error } = await client
    .from('institutional_membership_applications')
    .select('*')
    .in('status', ['submitted', 'under_review', 'needs_more_info', 'approved'])
    .order('submitted_at', { ascending: true })

  if (error) {
    throw error
  }

  const rows = applications ?? []
  if (rows.length === 0) {
    return []
  }

  const applicationIds = rows.map((application) => application.id)
  const memberIds = [...new Set(rows.flatMap((application) => (application.requester_user_id ? [application.requester_user_id] : [])))]

  const [paymentsResponse, membersResponse] = await Promise.all([
    client.from('membership_payments').select('*').in('application_id', applicationIds).order('created_at', { ascending: false }),
    memberIds.length
      ? client
          .from('users')
          .select('id, full_name, email, asi_membership_status, user_subscription_status, membership_expires_at, status')
          .in('id', memberIds)
      : Promise.resolve({ data: [], error: null })
  ])

  if (paymentsResponse.error) {
    throw paymentsResponse.error
  }
  if (membersResponse.error) {
    throw membersResponse.error
  }

  const latestPaymentByApplication = new Map<string, MembershipPayment>()
  for (const payment of paymentsResponse.data ?? []) {
    if (!latestPaymentByApplication.has(payment.application_id)) {
      latestPaymentByApplication.set(payment.application_id, payment)
    }
  }
  const memberById = new Map((membersResponse.data ?? []).map((member) => [member.id, member]))

  return rows.map((application) => ({
    application,
    payment: latestPaymentByApplication.get(application.id) ?? null,
    member: application.requester_user_id ? memberById.get(application.requester_user_id) ?? null : null
  }))
}

export type AdminMembershipFilter = 'all' | 'review' | 'approved' | 'active' | 'inactive'

export interface AdminMembershipPage {
  rows: AdminMembershipRow[]
  totalCount: number
  nextOffset: number | null
}

export interface AdminMembershipCounts {
  all: number
  review: number
  approved: number
  active: number
  inactive: number
}

type MembershipAppStatus = Tables<'institutional_membership_applications'>['status']
const MEMBERSHIP_REVIEW_STATUSES: MembershipAppStatus[] = ['submitted', 'under_review', 'needs_more_info']
const MEMBERSHIP_ACTIONABLE_STATUSES: MembershipAppStatus[] = ['submitted', 'under_review', 'needs_more_info', 'approved']
// Hint explícito de FK: la tabla referencia `users` por dos columnas, así que el
// embed debe nombrar la constraint de `requester_user_id` para no ser ambiguo.
const MEMBER_EMBED =
  'member:users!institutional_membership_applications_requester_user_id_fkey(id, full_name, email, asi_membership_status, user_subscription_status, membership_expires_at, status)'
const MEMBERSHIP_SEARCH_FIELDS = [
  'applicant_first_name',
  'applicant_last_name',
  'applicant_email',
  'category_name',
  'home_church_name',
  'church_city'
] as const

function statusesForFilter(filter: AdminMembershipFilter): MembershipAppStatus[] {
  if (filter === 'review') return MEMBERSHIP_REVIEW_STATUSES
  if (filter === 'approved' || filter === 'active' || filter === 'inactive') return ['approved']
  return MEMBERSHIP_ACTIONABLE_STATUSES
}

/**
 * Paginación real de servidor para la consola admin: `range` + count exacto de
 * PostgREST sobre las solicitudes, con filtro por estado y por estado de miembro
 * (embed `inner` sobre `users`) para alimentar el scroll infinito. El último pago
 * se enriquece por página, no se trae todo el histórico.
 */
export async function fetchAdminMembershipPage(params: {
  filter: AdminMembershipFilter
  search?: string
  limit: number
  offset: number
}): Promise<AdminMembershipPage> {
  const client = requireSupabase()
  const requiresMember = params.filter === 'active' || params.filter === 'inactive'
  const memberEmbed = requiresMember
    ? MEMBER_EMBED.replace(
        'users!institutional_membership_applications_requester_user_id_fkey',
        'users!institutional_membership_applications_requester_user_id_fkey!inner'
      )
    : MEMBER_EMBED

  let query = client
    .from('institutional_membership_applications')
    .select(`*, ${memberEmbed}`, { count: 'exact' })
    .in('status', statusesForFilter(params.filter))
    .order('submitted_at', { ascending: true })
    .range(params.offset, params.offset + params.limit - 1)

  if (params.filter === 'active') {
    query = query.eq('member.asi_membership_status', 'active')
  } else if (params.filter === 'inactive') {
    query = query.neq('member.asi_membership_status', 'active')
  }

  const search = params.search?.trim()
  if (search) {
    const pattern = `%${search}%`
    query = query.or(MEMBERSHIP_SEARCH_FIELDS.map((field) => `${field}.ilike.${pattern}`).join(','))
  }

  const { data, error, count } = await query
  if (error) {
    throw error
  }

  const rawRows = (data ?? []) as unknown as Array<MembershipApplication & { member: AdminMembershipRow['member'] }>
  const totalCount = count ?? rawRows.length
  const loadedCount = params.offset + rawRows.length

  const applicationIds = rawRows.map((application) => application.id)
  const latestPaymentByApplication = new Map<string, MembershipPayment>()
  if (applicationIds.length > 0) {
    const paymentsResponse = await client
      .from('membership_payments')
      .select('*')
      .in('application_id', applicationIds)
      .order('created_at', { ascending: false })
    if (paymentsResponse.error) {
      throw paymentsResponse.error
    }
    for (const payment of paymentsResponse.data ?? []) {
      if (!latestPaymentByApplication.has(payment.application_id)) {
        latestPaymentByApplication.set(payment.application_id, payment)
      }
    }
  }

  const rows: AdminMembershipRow[] = rawRows.map(({ member, ...application }) => ({
    application: application as MembershipApplication,
    payment: latestPaymentByApplication.get(application.id) ?? null,
    member: member ?? null
  }))

  return {
    rows,
    totalCount,
    nextOffset: loadedCount < totalCount ? loadedCount : null
  }
}

/** Conteos exactos por filtro para las tarjetas de resumen y las pestañas. */
export async function fetchAdminMembershipCounts(): Promise<AdminMembershipCounts> {
  const client = requireSupabase()
  const base = () => client.from('institutional_membership_applications').select('id', { count: 'exact', head: true })
  const memberInner = () =>
    client
      .from('institutional_membership_applications')
      .select('id, users!institutional_membership_applications_requester_user_id_fkey!inner(id)', {
        count: 'exact',
        head: true
      })
      .eq('status', 'approved')

  const [all, review, approved, active, inactive] = await Promise.all([
    base().in('status', MEMBERSHIP_ACTIONABLE_STATUSES),
    base().in('status', MEMBERSHIP_REVIEW_STATUSES),
    base().eq('status', 'approved'),
    memberInner().eq('users.asi_membership_status', 'active'),
    memberInner().neq('users.asi_membership_status', 'active')
  ])

  for (const response of [all, review, approved, active, inactive]) {
    if (response.error) {
      throw response.error
    }
  }

  return {
    all: all.count ?? 0,
    review: review.count ?? 0,
    approved: approved.count ?? 0,
    active: active.count ?? 0,
    inactive: inactive.count ?? 0
  }
}

/** Admin valida (o rechaza) un pago de membresía vía RPC `verify_membership_payment`. */
export async function verifyMembershipPayment(input: {
  paymentId: string
  decision: MembershipPaymentDecision
  notes?: string
}): Promise<MembershipPayment> {
  const client = requireSupabase()
  const { data, error } = await client.rpc('verify_membership_payment', {
    p_payment_id: input.paymentId,
    p_decision: input.decision,
    p_notes: input.notes?.trim() || undefined
  })

  if (error) {
    throw error
  }
  return data
}

/**
 * Admin activa la cuenta del miembro vía RPC `activate_member` (exige solicitud
 * aprobada + pago verificado; flip de flags + expira en +N meses).
 */
export async function activateMember(input: {
  applicationId: string
  notes?: string
  membershipMonths?: number
}): Promise<Tables<'users'>> {
  const client = requireSupabase()
  const { data, error } = await client.rpc('activate_member', {
    p_application_id: input.applicationId,
    p_notes: input.notes?.trim() || undefined,
    p_membership_months: input.membershipMonths ?? undefined
  })

  if (error) {
    throw error
  }
  return data
}

/** Admin inactiva una membresía ASI activa sin bloquear la cuenta completa. */
export async function deactivateMember(input: { userId: string; notes?: string }): Promise<Tables<'users'>> {
  const client = requireSupabase()
  const { data, error } = await client.rpc('deactivate_member', {
    p_user_id: input.userId,
    p_notes: input.notes?.trim() || undefined
  })

  if (error) {
    throw error
  }
  return data
}

/**
 * Un usuario en el buscador de activación manual, con su estado de membresía y el
 * override de acceso vigente (si lo tiene). Lo alimenta `admin_search_users_for_access`.
 */
export interface ManualAccessUser {
  id: string
  full_name: string
  display_name: string | null
  email: string | null
  status: string
  asi_membership_status: string
  membership_expires_at: string | null
  manual_access_override_until: string | null
  manual_access_override_reason: string | null
}

/** Busca usuarios para conceder/revocar acceso manual (gate = admin de plataforma). */
export async function searchUsersForManualAccess(query: string): Promise<ManualAccessUser[]> {
  const client = requireSupabase()
  const { data, error } = await client.rpc('admin_search_users_for_access' as never, {
    p_query: query.trim() || undefined
  } as never)

  if (error) {
    throw error
  }
  return (data ?? []) as unknown as ManualAccessUser[]
}

/**
 * Un platform_owner / platform_admin / super_administrator concede acceso ASI a un
 * usuario sin exigir solicitud, pago ni aprobación pastoral. `months` null = acceso
 * indefinido (hasta revocarlo). Reutiliza `manual_access_override_until`.
 */
export async function grantManualAccess(input: {
  userId: string
  months: number | null
  reason?: string
}): Promise<Tables<'users'>> {
  const client = requireSupabase()
  const { data, error } = await client.rpc('admin_set_manual_access_override' as never, {
    p_user_id: input.userId,
    p_months: input.months ?? undefined,
    p_reason: input.reason?.trim() || undefined
  } as never)

  if (error) {
    throw error
  }
  return data as unknown as Tables<'users'>
}

/** Revoca el acceso manual concedido a un usuario (no toca la membresía del pipeline). */
export async function revokeManualAccess(input: { userId: string; reason?: string }): Promise<Tables<'users'>> {
  const client = requireSupabase()
  const { data, error } = await client.rpc('admin_clear_manual_access_override' as never, {
    p_user_id: input.userId,
    p_reason: input.reason?.trim() || undefined
  } as never)

  if (error) {
    throw error
  }
  return data as unknown as Tables<'users'>
}

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

/**
 * El miembro responde a una solicitud marcada como "necesita más información" y la
 * reenvía a revisión (`needs_more_info` → `under_review`) vía RPC, conservando la
 * nota del revisor. Autoriza por `requester_user_id = auth.uid()`.
 */
export async function respondMembershipApplication(input: {
  applicationId: string
  responseNote?: string
}): Promise<MembershipApplication> {
  const client = requireSupabase()
  const { data, error } = await client.rpc('respond_membership_application', {
    p_application_id: input.applicationId,
    p_response_note: input.responseNote?.trim() || undefined
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
