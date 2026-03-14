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
      console.warn('Service worker registration failed.', error)
    }
  }

  window.addEventListener('load', () => {
    void register()
  })
}
