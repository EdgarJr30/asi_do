const APP_SHELL_CACHE = 'asi-platform-shell-v3'
const APP_SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.png',
  '/icons/app-icon-192.png',
  '/icons/app-icon-512.png',
  '/brand/asi-logo-light.no-bg.webp',
  '/brand/asi-logo-white-transparent.webp'
]
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

/**
 * Precachea las hojas de estilo que referencia el HTML.
 *
 * No pueden listarse en `APP_SHELL_ASSETS` porque el build les pone un hash en
 * el nombre y este archivo es estático: no conoce el hash. Se descubren leyendo
 * el propio `index.html`.
 *
 * Sin esto, una carga en frío sin red sirve el shell **sin estilos**: el HTML
 * viene del precache, pero la petición de la hoja no encuentra nada en caché
 * —solo se guarda cuando el service worker ya controla la página, y en la
 * primera visita todavía no lo hacía— y la red no está. Antes no pasaba porque
 * el CSS viajaba en línea dentro del HTML.
 *
 * Es best-effort: si algo falla, el resto del precache ya se aplicó.
 */
async function precacheReferencedStylesheets(cache) {
  try {
    const response = await fetch('/index.html', { cache: 'no-cache' })

    if (!response.ok) {
      return
    }

    const html = await response.text()
    const hrefs = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)].map(
      (match) => match[1]
    )

    await Promise.all(hrefs.map((href) => cache.add(href).catch(() => {})))
  } catch {
    // Sin red durante la instalación no hay nada que precachear.
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(APP_SHELL_CACHE)

      await cache.addAll(APP_SHELL_ASSETS)
      await precacheReferencedStylesheets(cache)
      await self.skipWaiting()
    })()
  )
})

self.addEventListener('push', (event) => {
  const payload = event.data ? event.data.json() : {}
  const notificationTitle = payload.title || 'ASI Rep. Dominicana'
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
      icon: '/icons/app-icon-192.png',
      badge: '/icons/app-icon-192.png',
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
