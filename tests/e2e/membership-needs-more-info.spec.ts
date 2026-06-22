import { expect, test } from '@playwright/test'

/**
 * Valida el loop de "falta información": el miembro ve la nota del pastor en su
 * panel y reenvía su solicitud a revisión (needs_more_info → under_review).
 * Requiere un miembro con una solicitud sembrada en needs_more_info.
 */

const MEMBER_EMAIL = process.env.E2E_MEMBER_EMAIL ?? ''
const MEMBER_PASSWORD = process.env.E2E_MEMBER_PASSWORD ?? 'MemberTest123!'

test.use({ viewport: { width: 1440, height: 1200 }, isMobile: false, hasTouch: false })

test('el miembro ve la nota del pastor y reenvía su solicitud a revisión', async ({ page }) => {
  test.skip(!MEMBER_EMAIL, 'Define E2E_MEMBER_EMAIL para correr esta validación.')

  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(`${error.name}: ${error.message}`))

  // 1. Login del miembro
  await page.goto('/auth/sign-in')
  await page.getByPlaceholder('john.doe@empresa.com.do').fill(MEMBER_EMAIL)
  await page.getByPlaceholder('Tu contraseña').fill(MEMBER_PASSWORD)
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()
  await expect(page).not.toHaveURL(/\/auth\/sign-in/, { timeout: 20_000 })

  // 2. Panel de membresía
  await page.goto('/account/membership')

  // 3. La nota del pastor (needs_more_info) es visible para el miembro
  await expect(page.getByText('Nota de tu pastor')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText(/carta de traslado/i)).toBeVisible()

  await page.screenshot({ path: 'tmp/member-needs-info-before.png', fullPage: true })

  // 4. El miembro responde y reenvía a revisión
  await page
    .getByPlaceholder('Responde lo que tu pastor solicitó para continuar con tu solicitud.')
    .fill('Adjunté mi carta de traslado de la Iglesia Central. Quedo atento.')
  await page.getByRole('button', { name: /Reenviar a revisi[óo]n/i }).click()

  // Tras reenviar, la solicitud pasa a under_review y el bloque de nota desaparece.
  await expect(page.getByText('Nota de tu pastor')).toBeHidden({ timeout: 15_000 })

  await page.screenshot({ path: 'tmp/member-needs-info-after.png', fullPage: true })

  expect(pageErrors).toEqual([])
})
