function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replaceAll('-', '+').replaceAll('_', '/')
  const rawData = window.atob(base64)

  return Uint8Array.from(rawData, (char) => char.charCodeAt(0))
}

export function isPushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    return 'denied' as const
  }

  return Notification.requestPermission()
}

export async function subscribeToPushNotifications(publicKey: string) {
  const registration = await navigator.serviceWorker.ready
  const existingSubscription = await registration.pushManager.getSubscription()

  if (existingSubscription) {
    return existingSubscription
  }

  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey)
  })
}
