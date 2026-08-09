import { createClient } from 'npm:@supabase/supabase-js@2.99.1'

import { parseResendEmailEvent } from '../_shared/resend-webhook.ts'
import { resolveServiceKey } from '../_shared/supabase-keys.ts'
import { verifyResendWebhook } from './verify.ts'

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

  const webhookSecret = Deno.env.get('RESEND_WEBHOOK_SECRET') ?? ''
  if (!webhookSecret) {
    return jsonResponse({ error: 'Webhook configuration is unavailable.' }, 503)
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

  const providerEventId = req.headers.get('svix-id') ?? ''
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceKey = resolveServiceKey()

  if (!supabaseUrl || !serviceKey) {
    return jsonResponse({ error: 'Backend configuration is unavailable.' }, 503)
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false }
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
    // Resend. Un 503 hace que Resend lo reintente sin perder el evento.
    return jsonResponse({ error: 'Delivery is not ready for this event.' }, 503)
  }

  return jsonResponse({
    received: true,
    recorded: result.recorded === true,
    duplicate: result.duplicate === true
  })
})
