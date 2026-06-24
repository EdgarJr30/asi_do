import { supabase } from '@/lib/supabase/client'
import { env } from '@/shared/config/env'

export type AzulPaymentIntent = 'initial' | 'renewal'

export interface AzulFormResponse {
  orderNumber: string
  amount: number
  currency: string
  paymentUrl: string
  paymentAltUrl: string
  fields: Record<string, string>
}

function requirePaymentsUrl(): string {
  const url = env.azulPaymentsUrl
  if (!url) {
    throw new Error('La pasarela de pagos no está configurada. Falta VITE_AZUL_PAYMENTS_URL.')
  }
  return url.replace(/\/+$/, '')
}

/**
 * Inicia un pago de membresía en el microservicio AZUL. Reenvía el JWT de la sesión
 * para que el RPC con RLS autorice y calcule la cuota server-side. Devuelve el form
 * firmado (AuthHash) listo para postear a la Página de Pago de AZUL.
 */
export async function startAzulMembershipPayment(input: {
  applicationId: string
  intent?: AzulPaymentIntent
  years?: number
}): Promise<AzulFormResponse> {
  if (!supabase) {
    throw new Error('Supabase no está configurado.')
  }

  const { data: sessionData } = await supabase.auth.getSession()
  const accessToken = sessionData.session?.access_token
  if (!accessToken) {
    throw new Error('Tu sesión expiró. Vuelve a iniciar sesión para pagar.')
  }

  const paymentsUrl = requirePaymentsUrl()
  let response: Response
  try {
    response = await fetch(`${paymentsUrl}/payments/azul/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        applicationId: input.applicationId,
        intent: input.intent ?? 'initial',
        years: input.years ?? 1
      })
    })
  } catch {
    throw new Error(
      `No pudimos conectar con la pasarela de pagos (${paymentsUrl}). Verifica que el servicio esté disponible y permita el origin de esta app.`
    )
  }

  const payload = (await response.json().catch(() => ({}))) as Partial<AzulFormResponse> & { error?: string }

  if (!response.ok) {
    throw new Error(payload.error || 'No pudimos iniciar el pago. Intenta de nuevo.')
  }

  if (!payload.paymentUrl || !payload.fields) {
    throw new Error('Respuesta inválida de la pasarela de pagos.')
  }

  return payload as AzulFormResponse
}

/**
 * Construye y envía un formulario oculto por POST a la Página de Pago de AZUL,
 * provocando la navegación full-page del browser (integración estándar del doc AZUL).
 */
export function submitAzulForm(form: Pick<AzulFormResponse, 'paymentUrl' | 'fields'>): void {
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

/** Atajo: inicia el pago y redirige el browser a AZUL en un solo paso. */
export async function payMembershipWithAzul(input: {
  applicationId: string
  intent?: AzulPaymentIntent
  years?: number
}): Promise<void> {
  const form = await startAzulMembershipPayment(input)
  submitAzulForm(form)
}
