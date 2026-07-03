import { expect, test } from '@playwright/test'

/**
 * Valida la Fase 3 (cola del pastor) de extremo a extremo con datos sembrados:
 * un pastor con alcance sobre "Iglesia Central de Santo Domingo" y una solicitud
 * pendiente auto-ruteada a él. Requiere las credenciales del pastor de prueba.
 */

const PASTOR_EMAIL = process.env.E2E_PASTOR_EMAIL ?? ''
const PASTOR_PASSWORD = process.env.E2E_PASTOR_PASSWORD ?? 'PastorTest123!'

// Segundo pastor, con alcance sobre OTRA iglesia (no la de María/Marcos).
const PASTOR2_EMAIL = process.env.E2E_PASTOR2_EMAIL ?? ''
const PASTOR2_PASSWORD = process.env.E2E_PASTOR2_PASSWORD ?? 'Pastor2Test123!'

test.use({ viewport: { width: 1440, height: 1200 }, isMobile: false, hasTouch: false })

async function signIn(page: import('@playwright/test').Page, email: string, password: string) {
  await page.goto('/auth/sign-in')
  await page.getByPlaceholder('john.doe@empresa.com.do').fill(email)
  await page.getByPlaceholder('Tu contraseña').fill(password)
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()
  await expect(page).not.toHaveURL(/\/auth\/sign-in/, { timeout: 20_000 })
}

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
  await page.goto('/account/membership-queue')

  await expect(
    page.getByRole('heading', { name: /Solicitudes de membres[ií]a de tus iglesias/i })
  ).toBeVisible({ timeout: 15_000 })

  // 3. La solicitud sembrada (scoped a su iglesia) aparece. Acotamos a su tarjeta:
  // la cola puede tener varias solicitudes de la misma iglesia.
  const card = page.locator('[class*="rounded"]').filter({ hasText: 'María Miembro' }).first()
  await expect(card).toBeVisible()
  await expect(card.getByText('Iglesia Central de Santo Domingo')).toBeVisible()
  await expect(card.getByText(/Profesional joven/)).toBeVisible()

  await page.screenshot({ path: 'tmp/pastor-queue-before.png', fullPage: true })

  // El item de nav "Pastoral" (sidebar lo renderiza como <button>) existe para el pastor
  await expect(page.getByRole('button', { name: /Solicitudes de mi iglesia/i }).first()).toBeVisible()

  // 4. Aprueba la referencia (RPC review_membership_application autoriza por scope)
  await card.getByRole('button', { name: /Aprobar referencia/i }).click()

  // Tras aprobar, la solicitud sale del filtro de pendientes y desaparece de la cola.
  await expect(page.getByText('María Miembro')).toBeHidden({ timeout: 15_000 })

  await page.screenshot({ path: 'tmp/pastor-queue-after.png', fullPage: true })

  expect(pageErrors).toEqual([])
})

test('un pastor de otra iglesia NO ve las solicitudes ajenas (RLS scoped)', async ({ page }) => {
  test.skip(!PASTOR2_EMAIL, 'Define E2E_PASTOR2_EMAIL para correr esta validación.')

  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(`${error.name}: ${error.message}`))

  // Pastor B tiene alcance sobre una iglesia distinta (Gazcue), no la de María/Marcos.
  await signIn(page, PASTOR2_EMAIL, PASTOR2_PASSWORD)
  await page.goto('/account/membership-queue')

  // Es pastor, así que ve la cola; pero NO las solicitudes de la iglesia de otro pastor.
  await expect(
    page.getByRole('heading', { name: /Solicitudes de membres[ií]a de tus iglesias/i })
  ).toBeVisible({ timeout: 15_000 })

  await expect(page.getByText(/Sin solicitudes pendientes/i)).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText('María Miembro')).toHaveCount(0)
  await expect(page.getByText('Marcos Miembro')).toHaveCount(0)

  await page.screenshot({ path: 'tmp/pastor-queue-other-empty.png', fullPage: true })

  expect(pageErrors).toEqual([])
})
