import { expect, test } from '@playwright/test'

/**
 * Pruebas del service worker real, contra el build de producción.
 *
 * La suite E2E principal corre sobre `npm run dev`, donde el service worker ni
 * siquiera se registra, así que hasta ahora nadie lo había ejercitado. El
 * comportamiento offline que se observó en su momento venía del disk cache del
 * navegador y no del SW: una prueba que apagara la red sin limpiar ese caché
 * habría pasado igual con el SW desactivado.
 *
 * Por eso cada prueba de aquí parte de un estado explícito y verifica que el
 * SW **está** controlando la página antes de concluir nada.
 */

const SHELL_CACHE = 'asi-platform-shell-v3'

test.describe('service worker', () => {
  test('se registra y toma control de la página', async ({ page }) => {
    await page.goto('/')

    const controlled = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready

      return {
        hasRegistration: Boolean(registration),
        scope: registration.scope,
        // `controller` es lo que distingue "registrado" de "controlando esta
        // pestaña". En la primera visita puede tardar, de ahí el reintento.
        hasController: Boolean(navigator.serviceWorker.controller)
      }
    })

    expect(controlled.hasRegistration).toBe(true)
    expect(controlled.scope).toContain('/')

    if (!controlled.hasController) {
      await page.reload()
      await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller))
    }

    expect(await page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)
  })

  test('precachea el app shell declarado', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => navigator.serviceWorker.ready)

    const cached = await page.evaluate(async (cacheName) => {
      const cache = await caches.open(cacheName)
      const keys = await cache.keys()

      return keys.map((request) => new URL(request.url).pathname)
    }, SHELL_CACHE)

    // Si el shell no está en caché, el fallback de navegación offline no tiene
    // nada que servir y la prueba de abajo pasaría por el disk cache.
    expect(cached).toContain('/index.html')
    expect(cached).toContain('/manifest.webmanifest')
  })

  test('carga en frío sin red sirviendo el shell desde el service worker', async ({
    page,
    context
  }) => {
    await page.goto('/')
    await page.evaluate(() => navigator.serviceWorker.ready)
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller))

    // La parte que faltaba: vaciar el disk cache del navegador. Sin esto, una
    // carga offline puede resolverse desde ahí y la prueba no demuestra nada
    // sobre el service worker.
    const client = await context.newCDPSession(page)
    await client.send('Network.clearBrowserCache')

    await context.setOffline(true)

    const response = await page.goto('/')

    expect(response).not.toBeNull()
    // El shell responde aunque no haya red.
    await expect(page.locator('#root')).toBeAttached()
    expect(await page.evaluate(() => navigator.onLine)).toBe(false)

    // Y responde **estilado**. Este aserto importa desde que la hoja dejó de ir
    // en línea dentro de `index.html`: ahora la sirve el handler de destinos
    // estáticos del service worker desde su caché en runtime. Si esa parte se
    // rompe, la página offline sigue existiendo pero se ve sin estilos, y la
    // prueba anterior —que solo miraba que `#root` estuviera— no lo notaría.
    const styled = await page.evaluate(() => {
      const body = getComputedStyle(document.body)

      return {
        fontFamily: body.fontFamily,
        stylesheets: document.styleSheets.length
      }
    })

    expect(styled.fontFamily).toContain('Manrope')
    expect(styled.stylesheets).toBeGreaterThan(1)

    await context.setOffline(false)
  })

  test('una ruta profunda cae al shell cuando no hay red', async ({ page, context }) => {
    await page.goto('/')
    await page.evaluate(() => navigator.serviceWorker.ready)
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller))

    const client = await context.newCDPSession(page)
    await client.send('Network.clearBrowserCache')
    await context.setOffline(true)

    // Una ruta que nunca se visitó: el `navigate` handler del SW debe devolver
    // `/index.html` y dejar que el router del cliente resuelva.
    await page.goto('/platform/jobs')

    await expect(page.locator('#root')).toBeAttached()

    await context.setOffline(false)
  })

  test('muestra el aviso de sin conexión', async ({ page, context }) => {
    await page.goto('/')
    await page.evaluate(() => navigator.serviceWorker.ready)

    await context.setOffline(true)
    // `setOffline` no dispara el evento `offline` en todos los casos; el banner
    // escucha ese evento, así que se emite explícitamente.
    await page.evaluate(() => window.dispatchEvent(new Event('offline')))

    // No se localiza por `role="status"`: los loaders del sistema de diseno usan
    // ese mismo rol y el selector queda ambiguo.
    const banner = page.getByText('Sin conexión. Estás viendo la última información guardada.')

    await expect(banner).toBeVisible()

    await context.setOffline(false)
    await page.evaluate(() => window.dispatchEvent(new Event('online')))

    await expect(banner).toBeHidden()
  })

  test('la activación poda las cachés de versiones anteriores', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => navigator.serviceWorker.ready)

    // Se siembra una caché con nombre de versión vieja.
    await page.evaluate(async () => {
      const cache = await caches.open('asi-platform-shell-v0')
      await cache.put('/viejo', new Response('obsoleto'))
    })

    // `registration.update()` no basta: si el archivo del SW no cambió, el
    // navegador no instala ni activa nada y el handler de `activate` —que es
    // quien poda— nunca corre. Hay que desregistrar y volver a registrar para
    // provocar una activación de verdad.
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration()
      await registration?.unregister()
    })
    await page.reload()
    await page.evaluate(() => navigator.serviceWorker.ready)
    await page.waitForFunction(async () => {
      const names = await caches.keys()
      return !names.includes('asi-platform-shell-v0')
    })

    const names = await page.evaluate(() => caches.keys())

    expect(names).toContain(SHELL_CACHE)
    expect(names).not.toContain('asi-platform-shell-v0')
  })
})
