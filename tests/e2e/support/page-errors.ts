import type { Page } from '@playwright/test'

/**
 * Recoge los errores no capturados de la página, descartando uno concreto: el
 * fallo de transporte de la propia telemetría de errores.
 *
 * Por qué existe la excepción. Varias pruebas terminan con
 * `expect(pageErrors).toEqual([])`, que es un buen aserto: un error no capturado
 * en la consola casi siempre es un defecto. Pero en WebKit una petición `fetch`
 * cancelada —por ejemplo, la que la app manda a `log_client_error` cuando la
 * pestaña ya se está yendo— se reporta como error de página con el texto "due to
 * access control checks". Eso tumbó una corrida completa mientras que la misma
 * prueba pasaba aislada.
 *
 * Se comprobó que no era permisos: llamando a `log_client_error` desde un
 * cliente real, como `anon` y como `authenticated`, la RPC responde OK.
 *
 * La regla del filtro es estrecha a propósito: **solo** el transporte del
 * reporte de errores. Que no se pueda reportar un error no es el error; si la
 * app lanza uno de verdad, sigue fallando la prueba.
 */
const RUIDO_DE_TELEMETRIA = /log_client_error/

export function collectPageErrors(page: Page) {
  const errores: string[] = []

  page.on('pageerror', (error) => {
    const texto = `${error.name}: ${error.message}`

    if (RUIDO_DE_TELEMETRIA.test(texto)) {
      return
    }

    errores.push(texto)
  })

  return errores
}
