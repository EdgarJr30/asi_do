import { expect, test } from '@playwright/test'

/**
 * Valida la Fase 3 (cola del pastor) de extremo a extremo con datos sembrados:
 * un pastor con alcance sobre "Iglesia Central de Santo Domingo" y una solicitud
 * pendiente auto-ruteada a él. Requiere las credenciales del pastor de prueba.
 */

const PASTOR_EMAIL = process.env.E2E_PASTOR_EMAIL ?? ''
const PASTOR_PASSWORD = process.env.E2E_PASTOR_PASSWORD ?? 'PastorTest123!'

test.use({ viewport: { width: 1440, height: 1200 }, isMobile: false, hasTouch: false })

test('el pastor ve su cola scoped y aprueba la solicitud de su iglesia', async ({ page }) => {
  test.skip(!PASTOR_EMAIL, 'Define E2E_PASTOR_EMAIL para correr esta validación.')

  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(`${error.name}: ${error.message}`))

  // 1. Login del pastor
  await page.goto('/auth/sign-in')
  await page.getByPlaceholder('john.doe@empresa.com.do').fill(PASTOR_EMAIL)
  await page.getByPlaceholder('Tu contraseña').fill(PASTOR_PASSWORD)
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()

  // Espera a salir de la pantalla de sign-in (sesión hidratada + redirect).
  await expect(page).not.toHaveURL(/\/auth\/sign-in/, { timeout: 20_000 })

  // 2. Entra a la cola del pastor
  await page.goto('/candidate/membership-queue')

  await expect(
    page.getByRole('heading', { name: /Solicitudes de membres[ií]a de tus iglesias/i })
  ).toBeVisible({ timeout: 15_000 })

  // 3. La solicitud sembrada (scoped a su iglesia) aparece
  await expect(page.getByText('María Miembro')).toBeVisible()
  await expect(page.getByText('Iglesia Central de Santo Domingo')).toBeVisible()
  await expect(page.getByText(/Profesional joven/)).toBeVisible()

  await page.screenshot({ path: 'tmp/pastor-queue-before.png', fullPage: true })

  // El item de nav "Pastoral" (sidebar lo renderiza como <button>) existe para el pastor
  await expect(page.getByRole('button', { name: /Solicitudes de mi iglesia/i }).first()).toBeVisible()

  // 4. Aprueba la referencia (RPC review_membership_application autoriza por scope)
  await page.getByRole('button', { name: /Aprobar referencia/i }).click()

  // Tras aprobar, la solicitud sale del filtro de pendientes y desaparece de la cola.
  await expect(page.getByText('María Miembro')).toBeHidden({ timeout: 15_000 })

  await page.screenshot({ path: 'tmp/pastor-queue-after.png', fullPage: true })

  expect(pageErrors).toEqual([])
})
