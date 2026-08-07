// v4: el precache ahora incluye las fuentes. La versión tiene que subir o los
// clientes que ya instalaron v3 se quedarían con su caché vieja —sin fuentes—
// hasta el siguiente cambio, porque `activate` solo borra las que no son la
// actual y la instalación no se repite.
const APP_SHELL_CACHE = 'asi-platform-shell-v4'
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
 * Añade al precache reintentando una vez.
 *
 * Un `cache.add` que falla en silencio deja un agujero que solo se ve sin red y
 * meses después: la instalación termina "bien" y la carga offline aparece sin
 * estilos o sin fuente. Un reintento cubre el caso real —el servidor todavía
 * calentando en el primer arranque— sin volver frágil la instalación.
 */
async function addToCache(cache, url) {
  try {
    await cache.add(url)
    return true
  } catch {
    try {
      await cache.add(url)
      return true
    } catch {
      return false
    }
  }
}

/**
 * Precachea las hojas de estilo que referencia el HTML **y las fuentes que esas
 * hojas cargan**.
 *
 * No pueden listarse en `APP_SHELL_ASSETS` porque el build les pone un hash en
 * el nombre y este archivo es estático: no conoce el hash. Se descubren leyendo
 * el propio `index.html` y, para las fuentes, el texto de cada hoja.
 *
 * Sin esto, una carga en frío sin red sirve el shell **sin estilos ni fuente**:
 * el HTML viene del precache, pero la petición de la hoja —o la del `.woff2`—
 * no encuentra nada en caché y la red no está. La causa es la misma en los dos
 * casos: esos recursos se piden en la primera visita, cuando el service worker
 * todavía no controla la página, así que el caché en runtime no llega a verlos.
 *
 * Se comprobó midiendo una carga offline: las peticiones de
 * `/assets/manrope-*.woff2` fallaban con `net::ERR_FAILED` y la página se
 * dibujaba con la fuente del sistema. Como `getComputedStyle` sigue devolviendo
 * la familia declarada, eso no se veía en ninguna prueba.
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

    await Promise.all(hrefs.map((href) => addToCache(cache, href)))
    await precacheFontsFrom(cache, hrefs)
  } catch {
    // Sin red durante la instalación no hay nada que precachear.
  }
}

/** Fuentes referenciadas por `url(...)` dentro de las hojas ya precacheadas. */
async function precacheFontsFrom(cache, hrefs) {
  const fontUrls = new Set()

  for (const href of hrefs) {
    const cached = await cache.match(href)

    if (!cached) {
      continue
    }

    const css = await cached.clone().text()

    for (const match of css.matchAll(/url\(\s*["']?([^"')]+\.(?:woff2|woff|ttf|otf))["']?\s*\)/g)) {
      try {
        const url = new URL(match[1], new URL(href, self.location.origin))

        if (url.origin === self.location.origin) {
          fontUrls.add(url.pathname)
        }
      } catch {
        // URL malformada en el CSS: no es asunto del service worker.
      }
    }
  }

  await Promise.all([...fontUrls].map((url) => addToCache(cache, url)))
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
