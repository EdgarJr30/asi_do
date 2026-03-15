import { captureClientError } from '@/lib/errors/client-error-logger'

export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) {
    return
  }

  const register = async () => {
    try {
      await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none'
      })
    } catch (error) {
      void captureClientError({
        source: 'pwa.service-worker-registration',
        route: typeof window === 'undefined' ? null : window.location.pathname,
        userMessage: 'No pudimos registrar el service worker de la app.',
        error,
        severity: 'warning'
      })
      console.warn('Service worker registration failed.', error)
    }
  }

  window.addEventListener('load', () => {
    void register()
  })
}
