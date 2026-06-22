import { expect, test, type Page } from '@playwright/test'

/**
 * Flujo COMPLETO de envío real de una solicitud de membresía (categoría "retired"):
 * login del miembro → formulario de 6 pasos → envío → pantalla de éxito.
 * Prueba el camino real que estaba bloqueado por el flag de submisiones.
 * Requiere un miembro confirmado y onboardeado (E2E_APPLICANT_EMAIL).
 */

const APPLICANT_EMAIL = process.env.E2E_APPLICANT_EMAIL ?? ''
const APPLICANT_PASSWORD = process.env.E2E_APPLICANT_PASSWORD ?? 'Applicant123!'

test.use({ viewport: { width: 1440, height: 1200 }, isMobile: false, hasTouch: false })

function eligibilityAccessToken() {
  const token = {
    eligible: true,
    category: 'Profesional o empresario jubilado',
    categorySlug: 'retired',
    dues: 'US$50',
    timestamp: Date.now()
  }
  return Buffer.from(JSON.stringify(token))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

async function next(page: Page) {
  await page.getByRole('button', { name: 'Siguiente' }).click()
}

test('un miembro envía una solicitud de membresía de punta a punta', async ({ page }) => {
  test.skip(!APPLICANT_EMAIL, 'Define E2E_APPLICANT_EMAIL para correr esta validación.')

  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(`${error.name}: ${error.message}`))

  // Login
  await page.goto('/auth/sign-in')
  await page.getByPlaceholder('john.doe@empresa.com.do').fill(APPLICANT_EMAIL)
  await page.getByPlaceholder('Tu contraseña').fill(APPLICANT_PASSWORD)
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()
  await expect(page).not.toHaveURL(/\/auth\/sign-in/, { timeout: 20_000 })

  // Deep-link al formulario con un token de elegibilidad (categoría retired)
  await page.goto(`/membership/apply?eligibilityToken=${eligibilityAccessToken()}`)
  await expect(page.getByRole('heading', { name: /Solicitud de membresía ASI/i })).toBeVisible({ timeout: 15_000 })

  // ── Paso 1: Datos de contacto ──
  await page.locator('[name="firstName"]').fill('Ana')
  await page.locator('[name="lastName"]').fill('Solicitante')
  await page.getByRole('button', { name: 'Femenino' }).click()
  await page.locator('[name="cellPhone"]').fill('8095550199')
  await page.locator('[name="email"]').fill(APPLICANT_EMAIL)
  await page.locator('[name="address1"]').fill('Calle Principal 100, Ensanche')
  await page.locator('[name="city"]').fill('Santo Domingo')
  await page.locator('[name="stateProvince"]').fill('Distrito Nacional')
  await page.locator('[name="postalCode"]').fill('10101')
  await page.locator('[name="country"]').fill('República Dominicana')
  await next(page)

  // ── Paso 2: Datos de categoría (retired) ──
  await page.locator('[name="retiredFrom"]').fill('Consultoría financiera empresarial')
  await page.locator('[name="retirementYear"]').fill('2015')
  await page
    .locator('[name="retirementSummary"]')
    .fill('Dirigí una firma de consultoría financiera durante más de 25 años antes de jubilarme.')
  await next(page)

  // ── Paso 3: Evangelismo personal ──
  await page
    .locator('[name="shareFaith"]')
    .fill('Comparto mi fe acompañando a colegas jubilados y sirviendo en mi iglesia local cada semana.')
  // "Estudios bíblicos locales" es exclusivo de ministries; "Mentoría" de voluntariado.
  await page.getByRole('checkbox', { name: 'Estudios bíblicos locales' }).check()
  await page.getByRole('checkbox', { name: 'Mentoría' }).check()
  await next(page)

  // ── Paso 4: Referencia (iglesia + pastor) ──
  await page.getByLabel('Unión').selectOption({ label: 'Unión Dominicana' })
  await page.getByLabel('Asociación / Misión').selectOption({ label: 'Asociación Central Dominicana' })
  await page.getByLabel('Distrito').selectOption({ label: 'Distrito Capital Norte' })
  // "Iglesia local" colisiona con "Nombre de la iglesia local": ubicamos el <select>
  // por la opción que contiene.
  await page
    .locator('select')
    .filter({ has: page.getByRole('option', { name: 'Iglesia Central de Santo Domingo' }) })
    .selectOption({ label: 'Iglesia Central de Santo Domingo' })
  // homeChurchName / churchCity / conference se autocompletan al elegir la iglesia.
  await page.locator('[name="churchStateProvince"]').fill('Distrito Nacional')
  await page.locator('[name="pastorName"]').fill('Pedro Pastor')
  await page.locator('[name="pastorPhone"]').fill('8095550100')
  await page.locator('[name="pastorEmail"]').fill('pastor.referencia@asido.test')
  await next(page)

  // ── Paso 5: Cuotas ──
  await page.locator('[name="paymentPreference"]').selectOption('bank-transfer')
  await page
    .locator('[name="membershipPrompt"]')
    .fill('Quiero aportar mi experiencia profesional a la misión de ASI.')
  await next(page)

  // ── Paso 6: Compromiso ──
  const checkboxes = page.getByRole('checkbox')
  const count = await checkboxes.count()
  for (let i = 0; i < count; i++) {
    await checkboxes.nth(i).check()
  }
  await page.locator('[name="signature"]').fill('Ana Solicitante')

  await page.screenshot({ path: 'tmp/full-submission-before.png', fullPage: true })
  await page.getByRole('button', { name: /Enviar solicitud/i }).click()

  // Éxito: pantalla de confirmación con CTA al panel de membresía.
  await expect(page.getByRole('button', { name: /Ir a mi panel de membresía/i })).toBeVisible({ timeout: 20_000 })
  await page.screenshot({ path: 'tmp/full-submission-after.png', fullPage: true })

  expect(pageErrors).toEqual([])
})
