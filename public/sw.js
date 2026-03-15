const APP_SHELL_CACHE = 'talent-marketplace-shell-v1'
const APP_SHELL_ASSETS = ['/', '/index.html', '/manifest.webmanifest', '/favicon.svg', '/icons/app-icon.svg']
const STATIC_DESTINATIONS = new Set(['style', 'script', 'font', 'image', 'manifest'])

function buildNotificationUrl(data = {}) {
  const actionUrl = typeof data.actionUrl === 'string' && data.actionUrl.length > 0 ? data.actionUrl : '/'

  try {
    const url = new URL(actionUrl, self.location.origin)

    if (url.origin === self.location.origin) {
      if (data.notificationId) {
        url.searchParams.set('notification_id', data.notificationId)
      }

      if (data.deliveryId) {
        url.searchParams.set('delivery_id', data.deliveryId)
      }
    }

    return url.toString()
  } catch {
    return self.location.origin
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then((cache) => cache.addAll(APP_SHELL_ASSETS)).then(() => self.skipWaiting())
  )
})

self.addEventListener('push', (event) => {
  const payload = event.data ? event.data.json() : {}
  const notificationTitle = payload.title || 'Talent Marketplace SaaS'
  const notificationBody = payload.body || 'You have a new update waiting in the app.'
  const data = {
    actionUrl: payload.actionUrl || '/',
    deliveryId: payload.deliveryId || null,
    notificationId: payload.notificationId || null,
    tenantId: payload.tenantId || null
  }

  event.waitUntil(
    self.registration.showNotification(notificationTitle, {
      body: notificationBody,
      icon: '/icons/app-icon.svg',
      badge: '/icons/app-icon.svg',
      tag: payload.notificationId || `push-${Date.now()}`,
      renotify: true,
      data
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const data = event.notification.data || {}
  const targetUrl = buildNotificationUrl(data)

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clients) => {
      for (const client of clients) {
        client.postMessage({
          type: 'notification-click',
          notificationId: data.notificationId || null,
          deliveryId: data.deliveryId || null
        })

        if ('focus' in client) {
          await client.focus()
        }

        if ('navigate' in client) {
          await client.navigate(targetUrl)
        }

        return
      }

      if (self.clients.openWindow) {
        await self.clients.openWindow(targetUrl)
      }
    })
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== APP_SHELL_CACHE).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event

  if (request.method !== 'GET') {
    return
  }

  const url = new URL(request.url)

  if (url.origin !== self.location.origin) {
    return
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(APP_SHELL_CACHE)
        return cache.match('/index.html')
      })
    )
    return
  }

  if (!STATIC_DESTINATIONS.has(request.destination)) {
    return
  }

  event.respondWith(
    caches.open(APP_SHELL_CACHE).then(async (cache) => {
      const cachedResponse = await cache.match(request)
      const networkResponsePromise = fetch(request)
        .then((response) => {
          if (response.ok) {
            void cache.put(request, response.clone())
          }

          return response
        })
        .catch(() => cachedResponse)

      return cachedResponse ?? networkResponsePromise
    })
  )
})
