import { supabase } from '@/lib/supabase/client'
import { env } from '@/shared/config/env'

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
