import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

import { corsHeaders } from '../_shared/cors.ts'

interface SendNotificationRequest {
  recipientUserId: string
  tenantId?: string | null
  type: string
  title: string
  body: string
  actionUrl?: string | null
  payload?: Record<string, unknown>
}

interface QueuedPushRow {
  auth_key: string | null
  notification_action_url: string | null
  notification_body: string
  notification_id: string
  notification_payload: Record<string, unknown>
  notification_title: string
  p256dh_key: string | null
  push_delivery_id: string | null
  push_subscription_id: string | null
  subscription_endpoint: string | null
  subscription_locale: string | null
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json'
    }
  })
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') {
    return error.message
  }

  return 'Unexpected edge function error.'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseRequestBody(value: unknown): SendNotificationRequest {
  if (!isRecord(value)) {
    throw new Error('Request body must be a JSON object.')
  }

  const recipientUserId = typeof value.recipientUserId === 'string' ? value.recipientUserId.trim() : ''
  const type = typeof value.type === 'string' ? value.type.trim() : ''
  const title = typeof value.title === 'string' ? value.title.trim() : ''
  const body = typeof value.body === 'string' ? value.body.trim() : ''

  if (!recipientUserId || !type || !title || !body) {
    throw new Error('recipientUserId, type, title, and body are required.')
  }

  return {
    recipientUserId,
    tenantId: typeof value.tenantId === 'string' && value.tenantId.trim().length > 0 ? value.tenantId.trim() : null,
    type,
    title,
    body,
    actionUrl: typeof value.actionUrl === 'string' && value.actionUrl.trim().length > 0 ? value.actionUrl.trim() : null,
    payload: isRecord(value.payload) ? value.payload : {}
  }
}

function normalizeActionUrl(actionUrl: string | null | undefined) {
  if (!actionUrl || actionUrl.trim().length === 0) {
    return '/'
  }

  if (actionUrl.startsWith('http://') || actionUrl.startsWith('https://')) {
    return actionUrl
  }

  return actionUrl.startsWith('/') ? actionUrl : `/${actionUrl}`
}

function getVapidConfiguration() {
  const publicKey = Deno.env.get('WEB_PUSH_VAPID_PUBLIC_KEY') ?? ''
  const privateKey = Deno.env.get('WEB_PUSH_VAPID_PRIVATE_KEY') ?? ''
  const contactEmail = Deno.env.get('WEB_PUSH_CONTACT_EMAIL') ?? ''

  if (!publicKey || !privateKey || !contactEmail) {
    return null
  }

  return {
    publicKey,
    privateKey,
    contactEmail: contactEmail.startsWith('mailto:') ? contactEmail : `mailto:${contactEmail}`
  }
}

async function updateDeliveryStatus(
  client: ReturnType<typeof createClient>,
  input: {
    deliveryId: string
    status: string
    responseCode?: number | null
    providerMessageId?: string | null
    responsePayload?: Record<string, unknown>
    logLevel?: string
    logMessage: string
    deactivateSubscription?: boolean
    permissionState?: string | null
  }
) {
  const response = await client.rpc('update_push_delivery_status', {
    p_delivery_id: input.deliveryId,
    p_delivery_status: input.status,
    p_response_code: input.responseCode ?? null,
    p_provider_message_id: input.providerMessageId ?? null,
    p_response_payload: input.responsePayload ?? {},
    p_log_level: input.logLevel ?? 'info',
    p_log_message: input.logMessage,
    p_deactivate_subscription: input.deactivateSubscription ?? false,
    p_permission_state: input.permissionState ?? null
  })

  if (response.error) {
    throw response.error
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405)
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const authorization = req.headers.get('Authorization')

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase environment variables are missing in the edge runtime.')
    }

    if (!authorization) {
      return jsonResponse({ error: 'Authorization header is required.' }, 401)
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authorization
        }
      }
    })

    const token = authorization.replace(/^Bearer\s+/i, '')
    const userResponse = await supabase.auth.getUser(token)

    if (userResponse.error || !userResponse.data.user) {
      return jsonResponse({ error: 'The user session could not be resolved.' }, 401)
    }

    const payload = parseRequestBody(await req.json())
    const queueResponse = await supabase.rpc('queue_push_notification', {
      p_recipient_user_id: payload.recipientUserId,
      p_tenant_id: payload.tenantId ?? null,
      p_type: payload.type,
      p_title: payload.title,
      p_body: payload.body,
      p_action_url: payload.actionUrl ?? null,
      p_payload: payload.payload ?? {}
    })

    if (queueResponse.error) {
      throw queueResponse.error
    }

    const queuedRows = (queueResponse.data ?? []) as QueuedPushRow[]
    const notificationId = queuedRows[0]?.notification_id ?? null
    const pushRows = queuedRows.filter(
      (row): row is QueuedPushRow &
        Required<Pick<QueuedPushRow, 'auth_key' | 'p256dh_key' | 'push_delivery_id' | 'subscription_endpoint'>> =>
        Boolean(row.auth_key && row.p256dh_key && row.push_delivery_id && row.subscription_endpoint)
    )

    if (pushRows.length === 0) {
      return jsonResponse({
        notificationId,
        queuedCount: 0,
        sentCount: 0,
        failedCount: 0,
        skippedPush: true
      })
    }

    const vapidConfiguration = getVapidConfiguration()

    if (!vapidConfiguration) {
      await Promise.all(
        pushRows.map((row) =>
          updateDeliveryStatus(supabase, {
            deliveryId: row.push_delivery_id,
            status: 'failed',
            responseCode: 503,
            responsePayload: {
              missingConfig: [
                'WEB_PUSH_VAPID_PUBLIC_KEY',
                'WEB_PUSH_VAPID_PRIVATE_KEY',
                'WEB_PUSH_CONTACT_EMAIL'
              ]
            },
            logLevel: 'error',
            logMessage: 'Push delivery failed because VAPID configuration is missing in the Edge Function environment.'
          })
        )
      )

      return jsonResponse({
        notificationId,
        queuedCount: pushRows.length,
        sentCount: 0,
        failedCount: pushRows.length,
        skippedPush: false
      })
    }

    webpush.setVapidDetails(
      vapidConfiguration.contactEmail,
      vapidConfiguration.publicKey,
      vapidConfiguration.privateKey
    )

    let sentCount = 0
    let failedCount = 0

    for (const row of pushRows) {
      try {
        const result = await webpush.sendNotification(
          {
            endpoint: row.subscription_endpoint,
            keys: {
              auth: row.auth_key,
              p256dh: row.p256dh_key
            }
          },
          JSON.stringify({
            title: row.notification_title,
            body: row.notification_body,
            actionUrl: normalizeActionUrl(row.notification_action_url),
            notificationId: row.notification_id,
            deliveryId: row.push_delivery_id,
            payload: row.notification_payload,
            locale: row.subscription_locale
          })
        )

        await updateDeliveryStatus(supabase, {
          deliveryId: row.push_delivery_id,
          status: 'sent',
          responseCode: result.statusCode ?? 201,
          providerMessageId:
            typeof result.headers?.location === 'string' ? result.headers.location : row.push_delivery_id,
          responsePayload: {
            statusCode: result.statusCode ?? null,
            headers: result.headers ?? {},
            body: result.body ?? null
          },
          logMessage: 'Web push notification accepted by the provider.'
        })

        sentCount += 1
      } catch (error) {
        const errorRecord = isRecord(error) ? error : {}
        const statusCode =
          typeof errorRecord.statusCode === 'number' ? errorRecord.statusCode : 500
        const shouldDeactivate = statusCode === 404 || statusCode === 410

        await updateDeliveryStatus(supabase, {
          deliveryId: row.push_delivery_id,
          status: 'failed',
          responseCode: statusCode,
          responsePayload: {
            statusCode,
            headers: isRecord(errorRecord.headers) ? errorRecord.headers : {},
            body: 'body' in errorRecord ? errorRecord.body : null
          },
          logLevel: 'error',
          logMessage: toErrorMessage(error),
          deactivateSubscription: shouldDeactivate,
          permissionState: shouldDeactivate ? 'expired' : null
        })

        failedCount += 1
      }
    }

    return jsonResponse({
      notificationId,
      queuedCount: pushRows.length,
      sentCount,
      failedCount,
      skippedPush: false
    })
  } catch (error) {
    console.error('send-notification failed', error)

    return jsonResponse(
      {
        error: toErrorMessage(error)
      },
      400
    )
  }
})
