import { expect, test, type Page } from '@playwright/test'

/**
 * Verifica que el flujo público de solicitud está habilitado:
 * después de calificar, un visitante sin sesión debe llegar al gate de cuenta
 * y no a una pantalla de recepción cerrada.
 */

async function reachMembershipForm(page: Page) {
  await page.goto('/eligibility')
  await page.getByRole('button', { name: 'Sí' }).click()
  await page.getByRole('button', { name: 'Unión Dominicana (UDA)' }).click()
  await page.getByRole('button', { name: /Mi organización/i }).click()
  await page.getByRole('button', { name: /Con fines de lucro/i }).click()
  await page.getByRole('button', { name: 'Dos o más' }).click()
  await page.getByRole('button', { name: /La organización es de propiedad y operación independiente/i }).click()
  await page.getByRole('button', { name: /Continuar con la solicitud/i }).click()
}

test('el flujo de membresía permite continuar creando o iniciando sesión', async ({ page }) => {
  await reachMembershipForm(page)

  await expect(page.getByRole('heading', { name: /Crea tu cuenta para enviar tu solicitud/i })).toBeVisible()
  await expect(page.getByText(/Calificas para la membresía de Organizacional Con Fines de Lucro/i)).toBeVisible()

  await expect(page.getByText(/recepci[óo]n de solicitudes de membres[ií]a est[áa] cerrada/i)).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Env[íi]o cerrado/i })).toHaveCount(0)

  const signUpHref = await page.getByRole('link', { name: /Crear mi cuenta/i }).getAttribute('href')
  const signInHref = await page.getByRole('link', { name: /Ya tengo cuenta, iniciar sesión/i }).getAttribute('href')

  expect(signUpHref).toContain('/auth/sign-up?next=')
  expect(signInHref).toContain('/auth/sign-in?next=')
  expect(decodeURIComponent(signUpHref ?? '')).toContain('/membership/apply?eligibilityToken=')
  expect(decodeURIComponent(signInHref ?? '')).toContain('/membership/apply?eligibilityToken=')
})
