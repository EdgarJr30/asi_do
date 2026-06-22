import { expect, test, type Page } from '@playwright/test'

/**
 * Verifica que el envío de solicitudes de membresía está HABILITADO:
 * con MEMBERSHIP_APPLICATION_SUBMISSIONS_LOCKED = false, el formulario ya no
 * muestra el banner de "recepción cerrada" ni el botón "Envío cerrado".
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

test.use({ viewport: { width: 1440, height: 1200 }, isMobile: false, hasTouch: false })

test('el formulario de membresía permite enviar (gate liberado)', async ({ page }) => {
  await reachMembershipForm(page)

  await expect(page.getByRole('heading', { name: /Solicitud de membresía ASI/i })).toBeVisible()

  // El banner de "recepción cerrada" no debe aparecer.
  await expect(page.getByText(/recepci[óo]n de solicitudes de membres[ií]a est[áa] cerrada/i)).toHaveCount(0)
  // Tampoco la etiqueta "Envío cerrado" del botón de submit.
  await expect(page.getByRole('button', { name: /Env[íi]o cerrado/i })).toHaveCount(0)

  await page.screenshot({ path: 'tmp/membership-submit-enabled.png', fullPage: true })
})
