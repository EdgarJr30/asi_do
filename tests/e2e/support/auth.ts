import { expect, type Page } from '@playwright/test'

import { waitForAppSettled } from './guards'
import type { ProvisionedCandidate } from './realtime'

/**
 * Inicio de sesión por la interfaz real, no por API.
 *
 * Importa que sea por la UI: lo que se está verificando incluye el formulario,
 * el redirect posterior y la hidratación de la sesión. Autenticar por API
 * saltaría justo la parte que más se rompe.
 */
export async function signInThroughUi(page: Page, candidate: ProvisionedCandidate) {
  await page.goto('/auth/sign-in')
  await page.getByPlaceholder('john.doe@empresa.com.do').fill(candidate.email)
  await page.getByPlaceholder('Tu contraseña').fill(candidate.password)
  await page.getByRole('button', { name: /Iniciar sesión/i }).click()

  // Un usuario recién creado puede aterrizar en `/account` o en
  // `/account/profile` si el onboarding está incompleto; las dos son válidas.
  await page.waitForURL(/\/account/)

  // La espera vive aquí, y no en cada prueba, porque la carrera la crea el
  // login: la URL cambia antes de que el `<Navigate>` de `sign-in-page.tsx`
  // haya elegido destino (ver `waitForAppSettled`). Toda prueba que inicia
  // sesión y luego navega la sufre, así que dejarla en los call sites es
  // repetirla y olvidarla en la siguiente que se escriba.
  await waitForAppSettled(page)
}

/**
 * Comprueba que la sesión quedó viva, no solo que el redirect ocurrió.
 *
 * La recarga dura es el aserto: prueba que la sesión sobrevive a un `load`
 * —rehidratada desde el almacenamiento— y no solo que el login navegó. Se
 * espera a que la app se asiente antes de afirmar nada porque
 * `not.toHaveURL(/sign-in/)` se cumple igual con el loader en pantalla: sin la
 * espera, este helper no distingue "sesión viva" de "todavía cargando".
 */
export async function expectAuthenticated(page: Page) {
  await page.goto('/account')
  await waitForAppSettled(page)
  await expect(page).not.toHaveURL(/\/auth\/sign-in/)
}
