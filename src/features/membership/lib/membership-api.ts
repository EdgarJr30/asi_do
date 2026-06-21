import { supabase } from '@/lib/supabase/client'
import type { Tables } from '@/shared/types/database'

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
