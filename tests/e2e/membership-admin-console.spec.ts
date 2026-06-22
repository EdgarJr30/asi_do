import { expect, test } from '@playwright/test'

/**
 * Consola admin de membresía (Fase 4): un admin aprueba la solicitud, verifica el
 * pago y activa la cuenta. La activación solo se habilita con solicitud aprobada
 * + pago verificado. Requiere un admin de plataforma y la solicitud de "Marcos"
 * con un pago en estado submitted.
 */

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? ''
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'Admin2Test123!'

test.use({ viewport: { width: 1440, height: 1200 }, isMobile: false, hasTouch: false })

test('un admin revisa, verifica el pago y activa una cuenta', async ({ page }) => {
  test.skip(!ADMIN_EMAIL, 'Define E2E_ADMIN_EMAIL para correr esta validación.')

  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(`${error.name}: ${error.message}`))

  // Login admin
  await page.goto('/auth/sign-in')
  await page.getByPlaceholder('john.doe@empresa.com.do').fill(ADMIN_EMAIL)
  await page.getByPlaceholder('Tu contraseña').fill(ADMIN_PASSWORD)
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()
  await expect(page).not.toHaveURL(/\/auth\/sign-in/, { timeout: 20_000 })

  // Consola admin
  await page.goto('/admin/membership')
  await expect(page.getByRole('heading', { name: /Consola de membresía/i })).toBeVisible({ timeout: 15_000 })

  // Tarjeta de Marcos (tiene un pago por verificar)
  const card = page.locator('[class*="rounded"]').filter({ hasText: 'Marcos Miembro' }).first()
  await expect(card).toBeVisible({ timeout: 15_000 })

  await page.screenshot({ path: 'tmp/admin-console-before.png', fullPage: true })

  // 1. Aprobar la solicitud
  await card.getByRole('button', { name: 'Aprobar' }).click()
  await expect(card.getByText(/Aprobada/i)).toBeVisible({ timeout: 15_000 })

  // 2. Verificar el pago
  await card.getByRole('button', { name: 'Verificar pago' }).click()
  await expect(card.getByText(/Pago verificado/i)).toBeVisible({ timeout: 15_000 })

  // 3. Activar la cuenta (ahora habilitado)
  await card.getByRole('button', { name: 'Activar cuenta' }).click()
  await expect(card.getByText(/Cuenta activada/i)).toBeVisible({ timeout: 15_000 })

  await page.screenshot({ path: 'tmp/admin-console-after.png', fullPage: true })

  expect(pageErrors).toEqual([])
})
