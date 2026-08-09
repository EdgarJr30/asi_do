import { expect, type Page } from '@playwright/test'

import { FRESH_SESSION_CONTENT_TIMEOUT } from './timeouts'

/**
 * Asertos sobre lo que hace un guard de ruta.
 *
 * Existe por un fallo concreto: el smoke afirmaba `getByText('Acceso
 * restringido')` en `/workspace/pipeline` y en CI reportó
 * `element(s) not found`. Ese mensaje es compatible con cuatro finales muy
 * distintos —la app se quedó en el loader, se fue a `/auth/sign-in`, la desvió
 * el gate de onboarding a `/account/profile`, o el de membresía a
 * `/account/membership`— y no permite distinguir un defecto de autorización de
 * un problema del entorno. Una prueba que no sabe decir qué vio no sirve para
 * diagnosticar; solo sirve para bloquear.
 *
 * Aquí se corrigen las dos cosas a la vez:
 *
 * 1. **Se afirma el estado, no el copy.** `SurfaceStatusPage` publica
 *    `data-testid="surface-status"` con `data-surface`/`data-kind`. Reescribir
 *    el texto de la pantalla —que es copy y se reescribe— ya no rompe pruebas
 *    que hablan de autorización.
 * 2. **El fallo explica dónde acabó la app.** Si la pantalla esperada no
 *    aparece, el error trae la URL real, el título visible y si la plataforma
 *    seguía cargando.
 */

/**
 * Espera a que la app llegue a un estado terminal antes de navegar a otro sitio.
 *
 * Hace falta porque iniciar sesión **no termina cuando cambia la URL**.
 * `signInThroughUi` vuelve en cuanto la URL casa con `/account`, pero el
 * `<Navigate>` de `sign-in-page.tsx` decide el destino en cliente después de
 * hidratar sesión, perfil y permisos: hay una ventana en la que la app todavía
 * va a navegar. Un `goto` lanzado dentro de esa ventana compite con ella.
 *
 * Que la carrera es real quedó demostrado sirviendo el build de producción:
 * ahí Playwright la reporta en voz alta —`Navigation to "/workspace/pipeline"
 * is interrupted by another navigation to "/account"`—. Con `vite dev`, que es
 * como corre CI, la misma carrera es silenciosa: el `goto` no falla, la
 * navegación pendiente gana después y el navegador acaba en `/account`. La
 * prueba se queda entonces esperando en la pantalla equivocada hasta agotar el
 * presupuesto y reporta `element(s) not found`, que es exactamente el fallo que
 * apareció en `mobile-webkit` y que no se reproduce en una máquina rápida.
 *
 * Dos condiciones, las dos observables, ninguna un número al azar:
 * 1. el loader de plataforma se retiró —sesión hidratada y chunk cargado—;
 * 2. la URL dejó de moverse en dos lecturas consecutivas: ningún guard tiene ya
 *    un redirect pendiente.
 */
export async function waitForAppSettled(page: Page, timeout = FRESH_SESSION_CONTENT_TIMEOUT) {
  await expect(page.getByTestId('page-loader')).toHaveCount(0, { timeout })

  // `previousUrl` arranca en `null` a propósito: sin eso, la primera lectura se
  // compararía consigo misma y la espera se daría por buena sin haber
  // observado nada.
  let previousUrl: string | null = null

  await expect
    .poll(
      () => {
        const currentUrl = page.url()
        const isStable = previousUrl !== null && currentUrl === previousUrl
        previousUrl = currentUrl

        return isStable
      },
      { timeout, intervals: [200, 200, 300, 500] }
    )
    .toBe(true)
}

/**
 * Deja constancia de un rechazo de Supabase Auth, que si no es invisible.
 *
 * Cuando el login no navega, la prueba muere en `waitForURL` con "Timeout
 * 30000ms exceeded": un mensaje que no distingue un defecto del formulario de
 * un `429` del proyecto remoto, que es compartido y recibe seis inicios de
 * sesión seguidos en una pasada completa del smoke.
 *
 * Solo habla cuando `/auth/v1/token` responde con error. **Nunca vuelca el
 * cuerpo de una respuesta correcta**: ahí viaja el `access_token` del usuario y
 * el log de CI es público. El cuerpo de un error no lleva credenciales y es
 * justo lo que hace falta para separar "límite del remoto" de "defecto".
 */
export function logAuthRejections(page: Page) {
  // Una petición que ni siquiera llega a tener respuesta —DNS caído, red
  // cortada, TLS rechazado— no pasa por `response`. Ya ocurrió: un
  // `getaddrinfo ENOTFOUND` contra el host de Supabase tumbó el login y la
  // prueba solo supo decir que `waitForURL` agotó 30s. Sin esta rama, el
  // registro deja fuera justo el caso en el que la causa no es del producto.
  page.on('requestfailed', (request) => {
    if (!request.url().includes('/auth/v1/')) {
      return
    }

    console.error(
      `[auth] petición sin respuesta a ${request.url()}: ${request.failure()?.errorText ?? '(motivo desconocido)'}`
    )
  })

  page.on('response', (response) => {
    if (!response.url().includes('/auth/v1/token') || response.ok()) {
      return
    }

    void response
      .text()
      .catch(() => '(cuerpo ilegible)')
      .then((body) => {
        console.error(
          `[auth] ${response.status()} ${response.statusText()} en ${response.url()}\n[auth] ${body.slice(0, 500)}`
        )
      })
  })
}

/** Superficies que pueden renderizar `SurfaceStatusPage`. */
export type GuardSurface = 'institutional' | 'storefront' | 'auth' | 'candidate' | 'workspace' | 'admin'
export type GuardStatusKind = 'forbidden' | 'not-found'

/**
 * Retrato de la pantalla actual para un mensaje de error.
 *
 * Nunca lanza: se invoca justo cuando una prueba ya está fallando, y un fallo
 * aquí taparía el fallo real.
 */
export async function describeCurrentScreen(page: Page) {
  const url = page.url()

  // Se busca el `h1` y, si no hay —el home institucional, por ejemplo, no
  // tiene—, cualquier encabezado. Un retrato que dice "(ninguno)" cuando la
  // pantalla sí tenía título no ayuda a nadie.
  const heading =
    (await page
      .getByRole('heading', { level: 1 })
      .first()
      .textContent({ timeout: 1_000 })
      .catch(() => null)) ??
    (await page
      .getByRole('heading')
      .first()
      .textContent({ timeout: 1_000 })
      .catch(() => null))

  const stillLoading = await page
    .getByTestId('page-loader')
    .count()
    .then((count) => count > 0)
    .catch(() => false)

  return [
    `URL real: ${url}`,
    `Título visible: ${heading?.trim() || '(ninguno)'}`,
    stillLoading
      ? 'La plataforma seguía en el loader: no llegó a un estado terminal (sesión, chunk o consulta pendiente).'
      : 'La plataforma ya no estaba cargando: renderizó otra pantalla, no la esperada.'
  ].join('\n')
}

/**
 * Comprueba que un guard bloqueó la ruta y que lo hizo por el motivo esperado.
 *
 * `timeout` usa `FRESH_SESSION_CONTENT_TIMEOUT` porque el caso normal es
 * navegar a una ruta protegida con la sesión recién iniciada; ver el motivo del
 * margen en `support/timeouts.ts`.
 */
export async function expectSurfaceStatus(
  page: Page,
  {
    surface,
    kind,
    timeout = FRESH_SESSION_CONTENT_TIMEOUT
  }: { surface: GuardSurface; kind: GuardStatusKind; timeout?: number }
) {
  const status = page.getByTestId('surface-status')

  try {
    await expect(status).toBeVisible({ timeout })
  } catch {
    throw new Error(
      [
        `Se esperaba la pantalla de estado de superficie (surface=${surface}, kind=${kind}) y no se renderizó.`,
        await describeCurrentScreen(page)
      ].join('\n')
    )
  }

  // El estado, no el texto: qué superficie bloqueó y con qué motivo.
  await expect(status).toHaveAttribute('data-surface', surface)
  await expect(status).toHaveAttribute('data-kind', kind)
}
