import { buildEmailContent } from './email-content.ts'

/**
 * El procesador de entregas, separado del shell HTTP.
 *
 * Vive fuera de `index.ts` porque allí todo colgaba de `Deno.serve`: importarlo
 * desde un test levantaba un servidor. Aquí las dos fronteras que causan daño
 * irreversible —la base de datos y el proveedor de correo— entran como
 * parámetros, así que un test puede aseverar *qué se habría enviado* sin enviar
 * nada.
 */

/**
 * Duración de la reserva. Si el worker no cierra la entrega en este tiempo se
 * asume que murió y otra ejecución puede reclamarla. Debe superar con holgura
 * lo que tarda una llamada al proveedor.
 */
export const LEASE_SECONDS = 300

/** Tope de intentos antes de dar la entrega por fallida de forma definitiva. */
export const MAX_ATTEMPTS = 5

export const RESEND_EMAILS_ENDPOINT = 'https://api.resend.com/emails'

/**
 * Fila devuelta por `claim_email_deliveries`, que reserva la entrega de forma
 * atómica (`for update skip locked`) en lugar de solo leerla. Trae el token de
 * la reserva y la clave de idempotencia, que son los que hacen seguro el envío.
 */
export interface ClaimedEmailDeliveryRow {
  delivery_id: string
  claim_token: string
  idempotency_key: string
  attempt_count: number
  notification_id: string
  notification_type: string
  title: string
  body: string
  action_url: string | null
  payload: Record<string, unknown> | null
  recipient_email: string | null
  recipient_display_name: string | null
  recipient_full_name: string | null
}

/**
 * Superficie mínima del cliente de Supabase que este procesador usa. Se declara
 * estructuralmente en vez de importar `SupabaseClient` para que un doble de
 * pruebas no tenga que implementar el cliente entero; el cliente real la
 * satisface sin adaptador.
 */
export interface EmailDeliveryDatabase {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }>
  from(table: string): {
    insert(values: Record<string, unknown>): PromiseLike<{ error: unknown }>
  }
}

/** `fetch` global o su doble. */
export type FetchLike = (input: string, init: RequestInit) => Promise<Response>

export interface ProcessEmailDeliveriesDeps {
  database: EmailDeliveryDatabase
  fetch: FetchLike
  resendApiKey: string
  fromEmail: string
  appUrl: string
  limit: number
}

export interface ProcessEmailDeliveriesResult {
  processedCount: number
  sentCount: number
  failedCount: number
}

async function insertDeliveryLog(
  database: EmailDeliveryDatabase,
  input: {
    deliveryId: string
    logLevel: 'info' | 'warn' | 'error'
    message: string
    metadata?: Record<string, unknown>
  }
) {
  const response = await database.from('notification_delivery_logs').insert({
    delivery_id: input.deliveryId,
    log_level: input.logLevel,
    message: input.message,
    metadata: input.metadata ?? {}
  })

  if (response.error) {
    throw response.error
  }
}

/**
 * Cierra la reserva y escribe el resultado. El token es la guarda: si el lease
 * venció y otro worker ya reclamó la entrega, el RPC no aplica nada y devuelve
 * `false`, de modo que un worker zombi no puede pisar el resultado del vivo.
 *
 * Devuelve si el cierre se aplicó, para poder registrarlo cuando no.
 */
async function completeDelivery(
  database: EmailDeliveryDatabase,
  input: {
    deliveryId: string
    claimToken: string
    status: 'sent' | 'failed' | 'pending'
    responseCode?: number | null
    providerMessageId?: string | null
    responsePayload?: Record<string, unknown>
  }
): Promise<boolean> {
  const response = await database.rpc('complete_email_delivery', {
    p_delivery_id: input.deliveryId,
    p_claim_token: input.claimToken,
    p_status: input.status,
    p_response_code: input.responseCode ?? null,
    p_provider_message_id: input.providerMessageId ?? null,
    p_response_payload: input.responsePayload ?? {}
  })

  if (response.error) {
    throw response.error
  }

  const applied = response.data === true

  if (!applied) {
    // El lease venció y otro worker ya reclamó la entrega, así que este cierre
    // no escribió nada. Sin esta nota el intento del worker zombi queda
    // indistinguible del que sí escribió el resultado: la fila muestra lo que
    // dejó el worker vivo y el log dice que todo fue bien dos veces.
    await insertDeliveryLog(database, {
      deliveryId: input.deliveryId,
      logLevel: 'warn',
      message: 'Email delivery close was rejected because the claim token is no longer valid.',
      metadata: {
        attemptedStatus: input.status,
        responseCode: input.responseCode ?? null
      }
    })
  }

  return applied
}

export async function processEmailDeliveries(
  deps: ProcessEmailDeliveriesDeps
): Promise<ProcessEmailDeliveriesResult> {
  const { database, resendApiKey, fromEmail, appUrl } = deps

  // Reserva atómica: marca las filas como 'processing' y devuelve solo las que
  // este worker consiguió. Otra ejecución concurrente recibe un conjunto
  // disjunto, así que el mismo correo no puede enviarse dos veces. También
  // recupera reservas cuyo lease venció porque el worker anterior murió.
  const pendingResponse = await database.rpc('claim_email_deliveries', {
    p_limit: deps.limit,
    p_lease_seconds: LEASE_SECONDS,
    p_max_attempts: MAX_ATTEMPTS
  })

  if (pendingResponse.error) {
    throw pendingResponse.error
  }

  const deliveries = (pendingResponse.data ?? []) as ClaimedEmailDeliveryRow[]

  if (deliveries.length === 0) {
    return { processedCount: 0, sentCount: 0, failedCount: 0 }
  }

  let sentCount = 0
  let failedCount = 0

  for (const delivery of deliveries) {
    // Override del destinatario (lo usa el módulo de prueba de /admin/correos para
    // enviar a una dirección arbitraria). El pipeline real no setea payload.to.
    const overrideTo =
      typeof delivery.payload?.to === 'string' ? (delivery.payload.to as string).trim() : ''
    const overrideRecipientName =
      typeof delivery.payload?.recipientName === 'string'
        ? (delivery.payload.recipientName as string).trim()
        : ''
    const recipientEmail = overrideTo || (delivery.recipient_email?.trim() ?? '')
    const recipientName =
      overrideRecipientName ||
      delivery.recipient_display_name?.trim() ||
      delivery.recipient_full_name?.trim() ||
      'usuario'

    // El contador de intentos ya lo incrementó la reserva, dentro de la misma
    // sentencia que tomó la fila. Hacerlo aquí era un read-then-write que
    // perdía incrementos y marcaba 'processing' demasiado tarde.

    if (!resendApiKey || !fromEmail) {
      failedCount += 1
      await completeDelivery(database, {
        deliveryId: delivery.delivery_id,
        claimToken: delivery.claim_token,
        status: 'failed',
        responseCode: 503,
        responsePayload: {
          missingConfig: [
            !resendApiKey ? 'RESEND_API_KEY_DEV' : null,
            !fromEmail ? 'EMAIL_FROM_ADDRESS_DEV' : null
          ].filter(Boolean)
        }
      })
      await insertDeliveryLog(database, {
        deliveryId: delivery.delivery_id,
        logLevel: 'error',
        message: 'Email delivery failed because the email provider configuration is missing.',
        metadata: {
          provider: 'resend',
          recipientEmail
        }
      })
      continue
    }

    if (recipientEmail.length === 0) {
      failedCount += 1
      await completeDelivery(database, {
        deliveryId: delivery.delivery_id,
        claimToken: delivery.claim_token,
        status: 'failed',
        responseCode: 422,
        responsePayload: {
          recipientEmail
        }
      })
      await insertDeliveryLog(database, {
        deliveryId: delivery.delivery_id,
        logLevel: 'error',
        message: 'Email delivery failed because the notification payload or recipient email is incomplete.',
        metadata: {
          notificationId: delivery.notification_id
        }
      })
      continue
    }

    const emailContent = buildEmailContent({
      appUrl,
      type: delivery.notification_type,
      title: delivery.title,
      body: delivery.body,
      actionUrl: delivery.action_url,
      recipientName
    })

    const providerResponse = await deps.fetch(RESEND_EMAILS_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
        // Si la respuesta se pierde (timeout, corte) y el lease expira, el
        // reintento llega con la misma clave y el proveedor no reenvía. La
        // clave solo se renueva en un reenvío deliberado desde /admin/correos.
        'Idempotency-Key': delivery.idempotency_key
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [recipientEmail],
        subject: delivery.title,
        html: emailContent.html,
        text: emailContent.text
      })
    })

    const providerPayload = (await providerResponse.json().catch(() => ({}))) as Record<string, unknown>

    if (!providerResponse.ok) {
      failedCount += 1
      // Se deja en 'pending' para que el siguiente ciclo lo reintente con la
      // misma clave de idempotencia, hasta agotar MAX_ATTEMPTS. Marcarlo
      // 'failed' aquí convertía un fallo transitorio del proveedor en
      // definitivo y el correo no se enviaba nunca.
      await completeDelivery(database, {
        deliveryId: delivery.delivery_id,
        claimToken: delivery.claim_token,
        status: delivery.attempt_count >= MAX_ATTEMPTS ? 'failed' : 'pending',
        responseCode: providerResponse.status,
        responsePayload: providerPayload
      })
      await insertDeliveryLog(database, {
        deliveryId: delivery.delivery_id,
        logLevel: 'error',
        message: 'Email delivery failed at provider level.',
        metadata: {
          responseCode: providerResponse.status,
          attemptCount: delivery.attempt_count,
          providerPayload
        }
      })
      continue
    }

    sentCount += 1
    await completeDelivery(database, {
      deliveryId: delivery.delivery_id,
      claimToken: delivery.claim_token,
      status: 'sent',
      responseCode: providerResponse.status,
      providerMessageId: typeof providerPayload.id === 'string' ? providerPayload.id : null,
      responsePayload: providerPayload
    })
    await insertDeliveryLog(database, {
      deliveryId: delivery.delivery_id,
      logLevel: 'info',
      message: 'Email delivery sent successfully.',
      metadata: {
        provider: 'resend',
        providerMessageId: providerPayload.id ?? null,
        recipientEmail
      }
    })
  }

  return {
    processedCount: deliveries.length,
    sentCount,
    failedCount
  }
}
