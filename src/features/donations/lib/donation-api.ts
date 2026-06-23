import { supabase } from '@/lib/supabase/client'
import { env } from '@/shared/config/env'
import type { Tables, TablesInsert, TablesUpdate } from '@/shared/types/database'

export type DonationAmountOptionRow = Tables<'donation_amount_options'>

export interface DonationAmountOption {
  id: string
  label: string
  amount: number
  currency: string
  display_order: number
}

export interface DonationFormResponse {
  orderNumber: string
  amount: number
  currency: string
  paymentUrl: string
  paymentAltUrl: string
  fields: Record<string, string>
}

export interface StartDonationInput {
  amountOptionId?: string | null
  customAmount?: number | null
  donorName?: string | null
  donorEmail?: string | null
  donorPhone?: string | null
  campaignSlug?: string | null
  designation?: string | null
}

function requirePaymentsUrl(): string {
  const url = env.azulPaymentsUrl
  if (!url) {
    throw new Error('La pasarela de pagos no está configurada. Falta VITE_AZUL_PAYMENTS_URL.')
  }
  return url.replace(/\/+$/, '')
}

export async function listDonationAmountOptions(): Promise<DonationAmountOption[]> {
  if (!supabase) {
    throw new Error('Supabase no está configurado.')
  }

  const { data, error } = await supabase.rpc('list_active_donation_amount_options' as never)

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as DonationAmountOption[]
}

export async function startAzulDonation(input: StartDonationInput): Promise<DonationFormResponse> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }

  if (supabase) {
    const { data: sessionData } = await supabase.auth.getSession()
    const accessToken = sessionData.session?.access_token
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`
    }
  }

  const response = await fetch(`${requirePaymentsUrl()}/payments/azul/donations/create`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      amountOptionId: input.amountOptionId || undefined,
      customAmount: input.customAmount || undefined,
      donorName: input.donorName || undefined,
      donorEmail: input.donorEmail || undefined,
      donorPhone: input.donorPhone || undefined,
      campaignSlug: input.campaignSlug || 'general',
      designation: input.designation || undefined
    })
  })

  const payload = (await response.json().catch(() => ({}))) as Partial<DonationFormResponse> & { error?: string }

  if (!response.ok) {
    throw new Error(payload.error || 'No pudimos iniciar la donación. Intenta de nuevo.')
  }

  if (!payload.paymentUrl || !payload.fields) {
    throw new Error('Respuesta inválida de la pasarela de pagos.')
  }

  return payload as DonationFormResponse
}

export function submitDonationAzulForm(form: Pick<DonationFormResponse, 'paymentUrl' | 'fields'>): void {
  const el = document.createElement('form')
  el.method = 'POST'
  el.action = form.paymentUrl
  el.style.display = 'none'

  for (const [name, value] of Object.entries(form.fields)) {
    const input = document.createElement('input')
    input.type = 'hidden'
    input.name = name
    input.value = value
    el.appendChild(input)
  }

  document.body.appendChild(el)
  el.submit()
}

export async function payDonationWithAzul(input: StartDonationInput): Promise<void> {
  const form = await startAzulDonation(input)
  submitDonationAzulForm(form)
}

// ── Administración de montos de donación (RLS exige is_platform_admin) ─────────

function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase no está configurado.')
  }
  return supabase
}

/** Admin: todos los montos (activos e inactivos), ordenados. */
export async function listAllDonationAmountOptions(): Promise<DonationAmountOptionRow[]> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('donation_amount_options')
    .select('*')
    .order('display_order', { ascending: true })
    .order('amount', { ascending: true })
  if (error) {
    throw error
  }
  return data ?? []
}

export interface DonationAmountOptionInput {
  label: string
  amount: number
  currency: string
  displayOrder: number
  isActive: boolean
}

export async function createDonationAmountOption(input: DonationAmountOptionInput): Promise<DonationAmountOptionRow> {
  const client = requireSupabase()
  const payload: TablesInsert<'donation_amount_options'> = {
    label: input.label.trim(),
    amount: input.amount,
    currency: input.currency.trim() || 'DOP',
    display_order: input.displayOrder,
    is_active: input.isActive,
  }
  const { data, error } = await client.from('donation_amount_options').insert(payload).select('*').single()
  if (error) {
    throw error
  }
  return data
}

export async function updateDonationAmountOption(
  id: string,
  input: Partial<DonationAmountOptionInput>
): Promise<DonationAmountOptionRow> {
  const client = requireSupabase()
  const payload: TablesUpdate<'donation_amount_options'> = {
    ...(input.label !== undefined ? { label: input.label.trim() } : {}),
    ...(input.amount !== undefined ? { amount: input.amount } : {}),
    ...(input.currency !== undefined ? { currency: input.currency.trim() || 'DOP' } : {}),
    ...(input.displayOrder !== undefined ? { display_order: input.displayOrder } : {}),
    ...(input.isActive !== undefined ? { is_active: input.isActive } : {}),
  }
  const { data, error } = await client.from('donation_amount_options').update(payload).eq('id', id).select('*').single()
  if (error) {
    throw error
  }
  return data
}

export async function deleteDonationAmountOption(id: string): Promise<void> {
  const client = requireSupabase()
  const { error } = await client.from('donation_amount_options').delete().eq('id', id)
  if (error) {
    throw error
  }
}

// ── Comprobante de donación (público por número de orden) ─────────────────────

export interface DonationReceipt {
  orderNumber: string
  amount: number
  currency: string
  status: string
  donorName: string | null
  campaignSlug: string | null
  designation: string | null
  authorizationCode: string | null
  azulRrn: string | null
  azulDateTime: string | null
  settledAt: string | null
  createdAt: string
}

export async function getDonationReceipt(orderNumber: string): Promise<DonationReceipt | null> {
  const client = requireSupabase()
  const { data, error } = await client.rpc('get_donation_receipt', { p_order_number: orderNumber })
  if (error) {
    throw error
  }
  const row = Array.isArray(data) ? data[0] : data
  if (!row) {
    return null
  }
  return {
    orderNumber: row.order_number,
    amount: Number(row.amount),
    currency: row.currency,
    status: row.status,
    donorName: row.donor_name,
    campaignSlug: row.campaign_slug,
    designation: row.designation,
    authorizationCode: row.authorization_code,
    azulRrn: row.azul_rrn,
    azulDateTime: row.azul_date_time,
    settledAt: row.settled_at,
    createdAt: row.created_at,
  }
}

// ── Donaciones recibidas (admin) ──────────────────────────────────────────────

export type DonationRow = Tables<'donations'>

/** Admin: lista las donaciones (RLS limita a admin / propias). */
export async function listDonations(limit = 200): Promise<DonationRow[]> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('donations')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) {
    throw error
  }
  return data ?? []
}

/** Historial del usuario logueado (RLS exige donor_user_id = auth.uid()). */
export async function listMyDonations(userId: string): Promise<DonationRow[]> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('donations')
    .select('*')
    .eq('donor_user_id', userId)
    .order('created_at', { ascending: false })
  if (error) {
    throw error
  }
  return data ?? []
}
