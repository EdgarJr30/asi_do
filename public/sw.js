const APP_SHELL_CACHE = 'talent-marketplace-shell-v1'
const APP_SHELL_ASSETS = ['/', '/index.html', '/manifest.webmanifest', '/favicon.svg', '/icons/app-icon.svg']
const STATIC_DESTINATIONS = new Set(['style', 'script', 'font', 'image', 'manifest'])

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then((cache) => cache.addAll(APP_SHELL_ASSETS)).then(() => self.skipWaiting())
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
