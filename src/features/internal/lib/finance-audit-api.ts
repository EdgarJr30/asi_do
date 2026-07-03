import { supabase } from '@/lib/supabase/client'
import type { Json, Tables } from '@/shared/types/database'

type MembershipPaymentRow = Tables<'membership_payments'>
type DonationRow = Tables<'donations'>

export type FinanceAuditSource = 'membership' | 'donation'
export type FinanceAuditStatus = 'approved' | 'declined' | 'processing' | 'refunded'

export interface FinanceAuditTransaction {
  id: string
  source: FinanceAuditSource
  occurredAt: string
  orderNumber: string
  azulOrderId: string | null
  displayName: string
  sourceLabel: string
  cardBrand: string | null
  maskedCard: string | null
  hasSecureToken: boolean
  status: FinanceAuditStatus
  rawStatus: string
  authorizationCode: string | null
  amount: number
  currency: string
  rrn: string | null
  gatewayPayload: Json
}

type JsonRecord = { [key: string]: Json | undefined }

function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase no está configurado.')
  }
  return supabase
}

function isRecord(value: Json | null | undefined): value is JsonRecord {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function getString(payload: JsonRecord, keys: string[]): string | null {
  for (const key of keys) {
    const value = payload[key]
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value)
    }
  }
  return null
}

function getBoolean(payload: JsonRecord, key: string): boolean {
  const value = payload[key]
  if (typeof value === 'boolean') {
    return value
  }
  if (typeof value === 'string') {
    return ['true', '1', 'yes', 'si'].includes(value.toLowerCase())
  }
  return false
}

function hasSecureCardToken(payload: JsonRecord): boolean {
  return getBoolean(payload, 'DataVaultTokenPresent') || !!getString(payload, ['DataVaultToken', 'DataVaultExpiration', 'DataVaultBrand'])
}

function normalizeCardBrand(raw: string | null): string | null {
  if (!raw) {
    return null
  }
  const value = raw.toUpperCase()
  if (value.includes('VISA')) {
    return 'VISA'
  }
  if (value.includes('MASTER') || value === 'MC') {
    return 'MC'
  }
  if (value.includes('AMEX') || value.includes('AMERICAN')) {
    return 'AMEX'
  }
  return value.slice(0, 8)
}

function maskCard(raw: string | null): string | null {
  if (!raw) {
    return null
  }
  const value = raw.replace(/\s+/g, '')
  if (value.includes('*')) {
    return value
  }
  const digits = value.replace(/\D/g, '')
  if (digits.length < 8) {
    return value
  }
  return `${digits.slice(0, 1)}${'*'.repeat(Math.max(digits.length - 5, 3))}${digits.slice(-4)}`
}

function parseAzulDateTime(value: string | null): string | null {
  if (!value || !/^\d{14}$/.test(value)) {
    return null
  }
  const year = value.slice(0, 4)
  const month = value.slice(4, 6)
  const day = value.slice(6, 8)
  const hour = value.slice(8, 10)
  const minute = value.slice(10, 12)
  const second = value.slice(12, 14)
  return `${year}-${month}-${day}T${hour}:${minute}:${second}`
}

function statusFromPayment(status: MembershipPaymentRow['status'], payload: JsonRecord): FinanceAuditStatus {
  if (getBoolean(payload, 'Refunded')) {
    return 'refunded'
  }
  if (status === 'verified') {
    return 'approved'
  }
  if (status === 'initiated' || status === 'submitted') {
    return 'processing'
  }
  return 'declined'
}

function statusFromDonation(status: DonationRow['status'], payload: JsonRecord): FinanceAuditStatus {
  if (getBoolean(payload, 'Refunded')) {
    return 'refunded'
  }
  if (status === 'verified') {
    return 'approved'
  }
  if (status === 'initiated') {
    return 'processing'
  }
  return 'declined'
}

function fallbackPayload(row: {
  order_number: string | null
  azul_order_id: string | null
  azul_date_time: string | null
  azul_response_code: string | null
  azul_iso_code: string | null
  azul_response_message: string | null
  authorization_code: string | null
  azul_rrn: string | null
  amount: number | null
  currency: string
}): JsonRecord {
  return {
    AzulOrderId: row.azul_order_id,
    OrderNumber: row.order_number,
    DateTime: row.azul_date_time,
    ResponseCode: row.azul_response_code,
    IsoCode: row.azul_iso_code,
    ResponseMessage: row.azul_response_message,
    AuthorizationCode: row.authorization_code,
    RRN: row.azul_rrn,
    Amount: row.amount,
    Currency: row.currency,
  }
}

function normalizeMembershipPayment(
  row: MembershipPaymentRow,
  memberById: Map<string, Pick<Tables<'users'>, 'full_name' | 'email'>>
): FinanceAuditTransaction {
  const payload = isRecord(row.gateway_payload) ? row.gateway_payload : fallbackPayload(row)
  const cardBrand = normalizeCardBrand(getString(payload, ['CardBrand', 'DataVaultBrand', 'Brand']))
  const cardNumber = maskCard(getString(payload, ['CardNumber', 'DataVaultCardNumber', 'MaskedCardNumber', 'card_number']))
  const member = memberById.get(row.member_user_id)

  return {
    id: `membership:${row.id}`,
    source: 'membership',
    occurredAt: parseAzulDateTime(row.azul_date_time) ?? row.verified_at ?? row.created_at,
    orderNumber: row.order_number ?? row.id,
    azulOrderId: row.azul_order_id,
    displayName: member?.full_name || member?.email || 'Miembro ASI',
    sourceLabel: row.intent === 'renewal' ? 'Renovación de membresía' : 'Cuota de membresía',
    cardBrand,
    maskedCard: cardNumber,
    hasSecureToken: hasSecureCardToken(payload),
    status: statusFromPayment(row.status, payload),
    rawStatus: row.status,
    authorizationCode: row.authorization_code,
    amount: Number(row.amount ?? 0),
    currency: row.currency,
    rrn: row.azul_rrn,
    gatewayPayload: payload,
  }
}

function normalizeDonation(row: DonationRow): FinanceAuditTransaction {
  const payload = isRecord(row.gateway_payload) ? row.gateway_payload : fallbackPayload(row)
  const cardBrand = normalizeCardBrand(getString(payload, ['CardBrand', 'DataVaultBrand', 'Brand']))
  const cardNumber = maskCard(getString(payload, ['CardNumber', 'DataVaultCardNumber', 'MaskedCardNumber', 'card_number']))

  return {
    id: `donation:${row.id}`,
    source: 'donation',
    occurredAt: parseAzulDateTime(row.azul_date_time) ?? row.settled_at ?? row.created_at,
    orderNumber: row.order_number,
    azulOrderId: row.azul_order_id,
    displayName: row.donor_name || row.donor_email || 'Donante anónimo',
    sourceLabel: row.campaign_slug && row.campaign_slug !== 'general' ? `Donación · ${row.campaign_slug}` : 'Donación',
    cardBrand,
    maskedCard: cardNumber,
    hasSecureToken: hasSecureCardToken(payload),
    status: statusFromDonation(row.status, payload),
    rawStatus: row.status,
    authorizationCode: row.authorization_code,
    amount: Number(row.amount),
    currency: row.currency,
    rrn: row.azul_rrn,
    gatewayPayload: payload,
  }
}

export async function fetchFinanceAuditTransactions(limit = 250): Promise<FinanceAuditTransaction[]> {
  const client = requireSupabase()

  const [paymentsResponse, donationsResponse] = await Promise.all([
    client
      .from('membership_payments')
      .select('*')
      .not('order_number', 'is', null)
      .order('created_at', { ascending: false })
      .limit(limit),
    client
      .from('donations')
      .select('*')
      .not('order_number', 'is', null)
      .order('created_at', { ascending: false })
      .limit(limit),
  ])

  if (paymentsResponse.error) {
    throw paymentsResponse.error
  }
  if (donationsResponse.error) {
    throw donationsResponse.error
  }

  const payments = paymentsResponse.data ?? []
  const memberIds = [...new Set(payments.map((payment) => payment.member_user_id).filter(Boolean))]
  const membersResponse = memberIds.length
    ? await client.from('users').select('id, full_name, email').in('id', memberIds)
    : { data: [], error: null }

  if (membersResponse.error) {
    throw membersResponse.error
  }

  const memberById = new Map((membersResponse.data ?? []).map((member) => [member.id, member]))
  return [
    ...payments.map((payment) => normalizeMembershipPayment(payment, memberById)),
    ...(donationsResponse.data ?? []).map(normalizeDonation),
  ].sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
}
