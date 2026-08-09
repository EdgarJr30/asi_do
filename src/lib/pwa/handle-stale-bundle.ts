/**
 * Recupera la app cuando el bundle cargado quedó viejo tras un despliegue.
 *
 * Los chunks de Vite llevan hash en el nombre y el despliegue borra los del
 * build anterior. Una pestaña que ya tenía cargado el `index.html` viejo sigue
 * pidiendo *sus* hashes, así que el primer import dinámico —cualquier navegación
 * a una ruta perezosa— falla contra un archivo que ya no está en el servidor.
 *
 * Vite emite `vite:preloadError` justo en ese punto. Sin nadie escuchándolo, el
 * error sube como fatal y la pantalla se queda muerta hasta que el usuario
 * recarga a mano; en `app_error_logs` aparece como "Failed to fetch dynamically
 * imported module" sin ninguna pista de que la causa fue un redespliegue.
 *
 * Recargar trae el `index.html` nuevo —el servidor lo manda con
 * `must-revalidate`— y con él los hashes vigentes.
 */
const RELOAD_GUARD_KEY = 'asi:stale-bundle-reload'

export function handleStaleBundle() {
  if (typeof window === 'undefined') {
    return
  }

  window.addEventListener('vite:preloadError', (event) => {
    // Una recarga que no arregla el problema —un asset caído de verdad, no un
    // bundle viejo— volvería a fallar igual y dejaría a la pestaña recargando
    // en bucle. La marca en sessionStorage acota el reintento a uno por pestaña
    // y deja que el segundo fallo suba al error boundary, que sí sabe explicarlo.
    if (sessionStorage.getItem(RELOAD_GUARD_KEY)) {
      return
    }

    sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()))
    event.preventDefault()
    window.location.reload()
  })

  // Si la app llegó a arrancar, el bundle es coherente: se limpia la marca para
  // que el siguiente despliegue vuelva a tener su reintento.
  window.addEventListener('load', () => {
    sessionStorage.removeItem(RELOAD_GUARD_KEY)
  })
}
