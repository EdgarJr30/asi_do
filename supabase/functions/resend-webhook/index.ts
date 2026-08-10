import { createClient } from 'npm:@supabase/supabase-js@2.99.1'

import { resolveResendWebhookSecret } from '../_shared/resend-config.ts'
import { parseResendEmailEvent } from '../_shared/resend-webhook.ts'
import { resolveServiceKey } from '../_shared/supabase-keys.ts'
import { fetchWithTimeout } from '../_shared/fetch-with-timeout.ts'
import { evaluateRetryBudget } from './retry-budget.ts'
import { verifyResendWebhook } from './verify.ts'

export const DATABASE_REQUEST_TIMEOUT_MS = 8_000

interface RecordEventResult {
  recorded?: boolean
  duplicate?: boolean
  reason?: string
  delivery_id?: string
  delivery_status?: string
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405)
  }

  const webhookSecret = resolveResendWebhookSecret((name) => Deno.env.get(name))
  if (!webhookSecret) {
    return jsonResponse({ error: 'Webhook configuration is unavailable.' }, 503)
  }

  const providerEventId = req.headers.get('svix-id') ?? ''

  // Corte de carga: un reintento fuera de ventana se acepta y termina aquí, sin
  // firma que verificar ni base que consultar. Es lo que impide que una caída
  // larga se convierta en una tormenta de reintentos contra la base caída.
  const retryBudget = evaluateRetryBudget(req.headers.get('svix-timestamp'), Date.now())
  if (retryBudget.exhausted) {
    console.error('Resend webhook dropped because its retry budget is exhausted.', {
      providerEventId,
      ageMs: retryBudget.ageMs
    })
    return jsonResponse({ received: true, recorded: false, dropped: 'retry_budget_exhausted' })
  }

  const rawBody = await req.text()

  let event
  try {
    const verifiedPayload = verifyResendWebhook(rawBody, {
      id: req.headers.get('svix-id') ?? '',
      timestamp: req.headers.get('svix-timestamp') ?? '',
      signature: req.headers.get('svix-signature') ?? '',
      secret: webhookSecret
    })
    event = parseResendEmailEvent(verifiedPayload)
  } catch {
    return jsonResponse({ error: 'Invalid webhook request.' }, 400)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceKey = resolveServiceKey()

  if (!supabaseUrl || !serviceKey) {
    return jsonResponse({ error: 'Backend configuration is unavailable.' }, 503)
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
    global: { fetch: fetchWithTimeout(fetch, DATABASE_REQUEST_TIMEOUT_MS) }
  })

  const response = await supabase.rpc('record_resend_webhook_event', {
    p_provider_event_id: providerEventId,
    p_provider_message_id: event.providerMessageId,
    p_event_type: event.type,
    p_event_created_at: event.createdAt,
    p_payload: event.payload
  })

  if (response.error) {
    console.error('Resend webhook persistence failed.', {
      providerEventId,
      providerMessageId: event.providerMessageId,
      eventType: event.type,
      errorCode: response.error.code
    })
    return jsonResponse({ error: 'Webhook event could not be persisted.' }, 500)
  }

  const result = (response.data ?? {}) as RecordEventResult
  if (result.reason === 'delivery_not_found') {
    // El webhook puede ganar la carrera contra el UPDATE que guarda el id de
    // Resend. Un 503 hace que Resend lo reintente sin perder el evento; la
    // carrera se resuelve en segundos, así que el presupuesto de reintentos de
    // arriba corta el caso en el que la entrega no va a aparecer nunca.
    return jsonResponse({ error: 'Delivery is not ready for this event.' }, 503)
  }

  return jsonResponse({
    received: true,
    recorded: result.recorded === true,
    duplicate: result.duplicate === true
  })
})
