import { expect, type Page } from '@playwright/test'

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
}

/** Comprueba que la sesión quedó viva, no solo que el redirect ocurrió. */
export async function expectAuthenticated(page: Page) {
  await page.goto('/account')
  await expect(page).not.toHaveURL(/\/auth\/sign-in/)
}
