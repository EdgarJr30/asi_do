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
      // Import dinámico: evita arrastrar el cliente Supabase al bundle eager.
      void import('@/lib/errors/client-error-logger').then(({ captureClientError }) =>
        captureClientError({
          source: 'pwa.service-worker-registration',
          route: typeof window === 'undefined' ? null : window.location.pathname,
          userMessage: 'No pudimos registrar el service worker de la app.',
          error,
          severity: 'warning'
        })
      )
      console.warn('Service worker registration failed.', error)
    }
  }

  window.addEventListener('load', () => {
    void register()
  })
}
