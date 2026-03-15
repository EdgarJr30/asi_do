import { useEffect, useRef } from 'react'

import { useAppSession } from '@/app/providers/app-session-provider'
import { markNotificationClicked } from '@/lib/notifications/api'

interface NotificationClickMessage {
  type: 'notification-click'
  notificationId?: string
  deliveryId?: string
}

function getLocationTrackingPayload() {
  if (typeof window === 'undefined') {
    return null
  }

  const url = new URL(window.location.href)
  const notificationId = url.searchParams.get('notification_id')
  const deliveryId = url.searchParams.get('delivery_id')

  if (!notificationId) {
    return null
  }

  return {
    notificationId,
    deliveryId
  }
}

function clearLocationTrackingPayload() {
  if (typeof window === 'undefined') {
    return
  }

  const url = new URL(window.location.href)

  if (!url.searchParams.has('notification_id') && !url.searchParams.has('delivery_id')) {
    return
  }

  url.searchParams.delete('notification_id')
  url.searchParams.delete('delivery_id')
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
}

export function NotificationEventBridge() {
  const session = useAppSession()
  const handledKeysRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (session.isLoading || !session.isAuthenticated) {
      return
    }

    const payload = getLocationTrackingPayload()

    if (!payload) {
      return
    }

    const dedupeKey = `${payload.notificationId}:${payload.deliveryId ?? 'none'}`

    if (handledKeysRef.current.has(dedupeKey)) {
      clearLocationTrackingPayload()
      return
    }

    handledKeysRef.current.add(dedupeKey)

    void markNotificationClicked(payload.notificationId, payload.deliveryId).finally(() => {
      clearLocationTrackingPayload()
    })
  }, [session.isAuthenticated, session.isLoading])

  useEffect(() => {
    if (session.isLoading || !session.isAuthenticated || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      return
    }

    const onMessage = (event: MessageEvent<NotificationClickMessage>) => {
      if (event.data?.type !== 'notification-click' || !event.data.notificationId) {
        return
      }

      const dedupeKey = `${event.data.notificationId}:${event.data.deliveryId ?? 'none'}`

      if (handledKeysRef.current.has(dedupeKey)) {
        return
      }

      handledKeysRef.current.add(dedupeKey)
      void markNotificationClicked(event.data.notificationId, event.data.deliveryId)
    }

    navigator.serviceWorker.addEventListener('message', onMessage)

    return () => {
      navigator.serviceWorker.removeEventListener('message', onMessage)
    }
  }, [session.isAuthenticated, session.isLoading])

  return null
}
