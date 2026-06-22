import type { Json } from '@/shared/types/database'

import { toControlledError } from '@/lib/errors/error-utils'
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

export interface AppNotificationPage {
  notifications: AppNotification[]
  totalCount: number
  unreadCount: number
}

export interface FetchMyNotificationsPageOptions {
  page?: number
  pageSize?: number
  recipientUserId?: string | null
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
    throw new Error(`La suscripción push no incluye la clave ${keyName}.`)
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
    p_quiet_hours_json: {},
    p_tenant_id: values.tenantId ?? null
  } as never)

  if (response.error) {
    throw toControlledError(response.error)
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
    throw toControlledError(response.error)
  }

  return response.data
}

export async function fetchMyNotificationsPage(options: FetchMyNotificationsPageOptions = {}): Promise<AppNotificationPage> {
  const client = requireSupabase()
  const pageSize = Math.max(1, options.pageSize ?? 6)
  const page = Math.max(1, options.page ?? 1)
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  const recipientUserId = options.recipientUserId?.trim() || null

  let query = client
    .from('notifications' as never)
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })

  if (recipientUserId) {
    query = query.eq('recipient_user_id', recipientUserId)
  }

  const response = await query
    .range(from, to)

  if (response.error) {
    throw toControlledError(response.error)
  }

  let unreadQuery = client
    .from('notifications' as never)
    .select('id', { count: 'exact', head: true })
    .is('read_at', null)

  if (recipientUserId) {
    unreadQuery = unreadQuery.eq('recipient_user_id', recipientUserId)
  }

  const unreadResponse = await unreadQuery

  if (unreadResponse.error) {
    throw toControlledError(unreadResponse.error)
  }

  return {
    notifications: (response.data ?? []) as AppNotification[],
    totalCount: response.count ?? 0,
    unreadCount: unreadResponse.count ?? 0
  }
}

export async function fetchMyNotifications(limit = 6, recipientUserId?: string | null): Promise<AppNotification[]> {
  const page = await fetchMyNotificationsPage({ pageSize: limit, recipientUserId })
  return page.notifications
}

function isMissingRpcFunctionError(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false
  }

  const record = error as { code?: unknown; message?: unknown }
  return (
    record.code === 'PGRST202' ||
    (typeof record.message === 'string' && record.message.includes('Could not find the function public.mark_notification_unread'))
  )
}

export async function markNotificationRead(notificationId: string) {
  const client = requireSupabase()
  const response = await client.rpc('mark_notification_read' as never, {
    p_notification_id: notificationId
  } as never)

  if (response.error) {
    throw toControlledError(response.error)
  }

  return response.data as AppNotification
}

export async function markNotificationUnread(notificationId: string) {
  const client = requireSupabase()
  const response = await client.rpc('mark_notification_unread' as never, {
    p_notification_id: notificationId
  } as never)

  if (response.error) {
    if (isMissingRpcFunctionError(response.error)) {
      const fallbackResponse = await client
        .from('notifications' as never)
        .update({
          read_at: null,
          updated_at: new Date().toISOString()
        } as never)
        .eq('id', notificationId)
        .select('*')
        .single()

      if (fallbackResponse.error) {
        throw toControlledError(fallbackResponse.error)
      }

      return fallbackResponse.data as AppNotification
    }

    throw toControlledError(response.error)
  }

  return response.data as AppNotification
}

/** Marca como leídas varias notificaciones (reutiliza el RPC por id, en paralelo). */
export async function markAllNotificationsRead(notificationIds: string[]) {
  if (notificationIds.length === 0) {
    return
  }
  await Promise.all(notificationIds.map((id) => markNotificationRead(id)))
}

export async function markNotificationClicked(notificationId: string, deliveryId?: string | null) {
  const client = requireSupabase()
  const response = await client.rpc('mark_notification_clicked' as never, {
    p_notification_id: notificationId,
    p_delivery_id: deliveryId ?? null
  } as never)

  if (response.error) {
    throw toControlledError(response.error)
  }

  return response.data as AppNotification
}

export async function sendNotification(values: SendNotificationInput): Promise<SendNotificationResult> {
  const client = requireSupabase()
  const sessionResponse = await client.auth.getSession()
  const accessToken = sessionResponse.data.session?.access_token ?? null

  if (!accessToken) {
    throw new Error('No encontramos una sesión valida para invocar la notificación push.')
  }

  const response = await client.functions.invoke('send-notification', {
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
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
    throw toControlledError(response.error)
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
