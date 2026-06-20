import { expect, test } from '@playwright/test'

const email = process.env.E2E_SIGNUP_EMAIL!
const password = process.env.E2E_SIGNUP_PASSWORD!
const shotDir = process.env.E2E_SHOT_DIR ?? 'test-results/tmp'

test('candidate first login lands on /candidate home, not the profile form', async ({ page }, testInfo) => {
  await page.goto('/auth/sign-in')
  await page.getByPlaceholder('maria.reyes@empresa.com.do').fill(email)
  await page.getByPlaceholder('Tu contrasena').fill(password)
  await page.getByRole('button', { name: /Iniciar sesion/i }).click()

  // Debe aterrizar en el home del candidato (/candidate), NO en /candidate/profile.
  await page.waitForURL('**/candidate', { timeout: 20_000 })
  expect(new URL(page.url()).pathname).toBe('/candidate')

  // Encabezado del home + banner de perfil incompleto (usuario nuevo).
  await expect(page.getByText('Inicio · Tu espacio')).toBeVisible()
  await expect(page.getByText(/Completa tu perfil para destacar/i)).toBeVisible()

  // Tarjetas de módulos en lenguaje claro.
  await expect(page.getByRole('heading', { name: 'Explorar vacantes' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '¿Representas una empresa?' })).toBeVisible()

  await page.waitForTimeout(800)
  await page.screenshot({ path: `${shotDir}/${testInfo.project.name}-candidate-home.png`, fullPage: true })
})

test('sidebar copy: Inicio present, "Acceso operador" gone', async ({ page }, testInfo) => {
  await page.goto('/auth/sign-in')
  await page.getByPlaceholder('maria.reyes@empresa.com.do').fill(email)
  await page.getByPlaceholder('Tu contrasena').fill(password)
  await page.getByRole('button', { name: /Iniciar sesion/i }).click()
  await page.waitForURL('**/candidate', { timeout: 20_000 })

  // El texto críptico anterior no debe existir en ninguna parte.
  await expect(page.getByText('Acceso operador')).toHaveCount(0)

  await page.waitForTimeout(500)
  await page.screenshot({ path: `${shotDir}/${testInfo.project.name}-sidebar.png`, fullPage: false })
})
