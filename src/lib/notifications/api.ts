import type { Json } from '@/shared/types/database'

import { supabase } from '@/lib/supabase/client'
import { collectClientEnvironmentMetadata, getClientSupportLabel } from '@/lib/platform/client-environment'

export interface NotificationPreferencesInput {
  locale: 'es' | 'en'
  emailEnabled: boolean
  pushEnabled: boolean
  inAppEnabled: boolean
  tenantId?: string | null
}

export interface AppNotification {
  id: string
  recipient_user_id: string
  tenant_id: string | null
  type: string
  title: string
  body: string
  action_url: string | null
  payload: Json
  read_at: string | null
  clicked_at: string | null
  created_at: string
  updated_at: string
}

export interface SendNotificationInput {
  recipientUserId: string
  tenantId?: string | null
  type: string
  title: string
  body: string
  actionUrl?: string | null
  payload?: Json
}

export interface SendNotificationResult {
  notificationId: string | null
  queuedCount: number
  sentCount: number
  failedCount: number
  skippedPush: boolean
}

interface PushSubscriptionRegistrationOptions {
  locale: 'es' | 'en'
  tenantId?: string | null
  deviceLabel?: string | null
}

function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase no esta configurado. Completa las variables VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.')
  }

  return supabase
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return 'Ocurrio un error inesperado.'
}

function resolveDeviceKind(userAgent: string) {
  const normalizedAgent = userAgent.toLowerCase()

  if (/(iphone|ipad|android|mobile)/.test(normalizedAgent)) {
    return 'mobile'
  }

  return 'desktop'
}

function getSubscriptionKey(subscription: PushSubscription, keyName: 'p256dh' | 'auth') {
  const key = subscription.getKey(keyName)

  if (!key) {
    throw new Error(`La suscripcion push no incluye la clave ${keyName}.`)
  }

  return btoa(String.fromCharCode(...new Uint8Array(key)))
}

export async function saveNotificationPreferences(values: NotificationPreferencesInput) {
  const client = requireSupabase()
  const response = await client.rpc('upsert_notification_preferences' as never, {
    p_locale: values.locale,
    p_email_enabled: values.emailEnabled,
    p_push_enabled: values.pushEnabled,
    p_in_app_enabled: values.inAppEnabled,
    p_tenant_id: values.tenantId ?? null
  } as never)

  if (response.error) {
    throw new Error(toErrorMessage(response.error))
  }

  return response.data
}

export async function registerBrowserPushSubscription(
  subscription: PushSubscription,
  options: PushSubscriptionRegistrationOptions
) {
  const client = requireSupabase()
  const endpoint = subscription.endpoint
  const p256dhKey = getSubscriptionKey(subscription, 'p256dh')
  const authKey = getSubscriptionKey(subscription, 'auth')
  const clientEnvironment = await collectClientEnvironmentMetadata()
  const userAgent = clientEnvironment.userAgent

  const response = await client.rpc('register_push_subscription' as never, {
    p_endpoint: endpoint,
    p_p256dh_key: p256dhKey,
    p_auth_key: authKey,
    p_device_label: options.deviceLabel ?? getClientSupportLabel(clientEnvironment),
    p_device_kind: userAgent ? resolveDeviceKind(userAgent) : 'desktop',
    p_locale: options.locale,
    p_user_agent: userAgent,
    p_tenant_id: options.tenantId ?? null
  } as never)

  if (response.error) {
    throw new Error(toErrorMessage(response.error))
  }

  return response.data
}

export async function fetchMyNotifications(limit = 6): Promise<AppNotification[]> {
  const client = requireSupabase()
  const response = await client
    .from('notifications' as never)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (response.error) {
    throw new Error(toErrorMessage(response.error))
  }

  return (response.data ?? []) as AppNotification[]
}

export async function markNotificationRead(notificationId: string) {
  const client = requireSupabase()
  const response = await client.rpc('mark_notification_read' as never, {
    p_notification_id: notificationId
  } as never)

  if (response.error) {
    throw new Error(toErrorMessage(response.error))
  }

  return response.data as AppNotification
}

export async function markNotificationClicked(notificationId: string, deliveryId?: string | null) {
  const client = requireSupabase()
  const response = await client.rpc('mark_notification_clicked' as never, {
    p_notification_id: notificationId,
    p_delivery_id: deliveryId ?? null
  } as never)

  if (response.error) {
    throw new Error(toErrorMessage(response.error))
  }

  return response.data as AppNotification
}

export async function sendNotification(values: SendNotificationInput): Promise<SendNotificationResult> {
  const client = requireSupabase()
  const response = await client.functions.invoke('send-notification', {
    body: {
      recipientUserId: values.recipientUserId,
      tenantId: values.tenantId ?? null,
      type: values.type,
      title: values.title,
      body: values.body,
      actionUrl: values.actionUrl ?? null,
      payload: values.payload ?? {}
    }
  })

  if (response.error) {
    throw new Error(toErrorMessage(response.error))
  }

  const data = response.data as SendNotificationResult | null

  return (
    data ?? {
      notificationId: null,
      queuedCount: 0,
      sentCount: 0,
      failedCount: 0,
      skippedPush: true
    }
  )
}
