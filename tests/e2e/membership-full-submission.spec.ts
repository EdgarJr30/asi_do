import { expect, test, type Page } from '@playwright/test'

import {
  createServiceClient,
  fetchMemberApplications,
  findUserIdByEmail,
  membershipConfig,
  membershipEnvReady,
  resetMemberApplications,
  seedLiveApplication,
  type ServiceClient,
} from './support/membership'

/**
 * Flujo COMPLETO de envío real de una solicitud de membresía (categoría "retired")
 * bajo el modelo de DRAFT:
 *   login → deep-link con token de elegibilidad → se persiste un draft en la cuenta →
 *   formulario de 6 pasos → envío (UPDATE draft → submitted) → pantalla de éxito.
 * Verifica en BD que NO se duplica la solicitud (el draft se reutiliza).
 *
 * Repetible: resetea las solicitudes del miembro al inicio (requiere service_role).
 * Requiere `E2E_APPLICANT_EMAIL` + credenciales de `.env.local`.
 */

const { applicantEmail: APPLICANT_EMAIL, applicantPassword: APPLICANT_PASSWORD } = membershipConfig

test.use({ viewport: { width: 1440, height: 1200 }, isMobile: false, hasTouch: false })

let admin: ServiceClient
let applicantUserId = ''

test.beforeAll(async () => {
  if (!membershipEnvReady()) {
    return
  }
  admin = createServiceClient()
  applicantUserId = (await findUserIdByEmail(admin, APPLICANT_EMAIL)) ?? ''
})

function eligibilityAccessToken() {
  const token = {
    eligible: true,
    category: 'Profesional o empresario jubilado',
    categorySlug: 'retired',
    dues: 'US$50',
    timestamp: Date.now(),
  }
  return Buffer.from(JSON.stringify(token))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

async function signIn(page: Page) {
  await page.goto('/auth/sign-in')
  await page.getByPlaceholder('john.doe@empresa.com.do').fill(APPLICANT_EMAIL)
  await page.getByPlaceholder('Tu contraseña').fill(APPLICANT_PASSWORD)
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()
  await expect(page).not.toHaveURL(/\/auth\/sign-in/, { timeout: 20_000 })
}

async function next(page: Page) {
  await page.getByRole('button', { name: 'Siguiente' }).click()
}

test('un miembro envía su solicitud vía draft sin duplicar la fila', async ({ page }) => {
  test.skip(!membershipEnvReady(), 'Define E2E_APPLICANT_EMAIL + service_role (.env.local) para correr esta validación.')
  expect(applicantUserId, 'No se encontró el usuario solicitante por email').not.toBe('')

  // Estado en cero → el flujo crea un draft nuevo y luego lo envía.
  await resetMemberApplications(admin, applicantUserId)

  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(`${error.name}: ${error.message}`))

  await signIn(page)

  // Deep-link al formulario con un token de elegibilidad (categoría retired).
  await page.goto(`/membership/apply?eligibilityToken=${eligibilityAccessToken()}`)
  await expect(page.getByRole('heading', { name: /^Solicitud de membresía$/i })).toBeVisible({ timeout: 15_000 })

  // ── Paso 1: Datos de contacto ──
  await page.locator('[name="firstName"]').fill('Ana')
  await page.locator('[name="lastName"]').fill('Solicitante')
  await page.getByRole('radio', { name: 'Femenino' }).click()
  await page.locator('[name="cellPhone"]').fill('8095550199')
  await page.locator('[name="email"]').fill(APPLICANT_EMAIL)
  // País por defecto "República Dominicana" → provincia y ciudad son selects dependientes.
  await page.getByLabel(/Provincia o estado/).selectOption({ index: 1 })
  await page.getByLabel(/^Ciudad/).selectOption({ index: 1 })
  await page.locator('[name="postalCode"]').fill('10101')
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
  await page
    .locator('[name="membershipPrompt"]')
    .fill('Quiero aportar mi experiencia profesional a la misión de ASI.')
  await next(page)

  // ── Paso 6: Compromiso (checkboxes de aceptación) ──
  const checkboxes = page.getByRole('checkbox')
  const count = await checkboxes.count()
  for (let i = 0; i < count; i++) {
    await checkboxes.nth(i).check()
  }

  await page.screenshot({ path: 'tmp/full-submission-before.png', fullPage: true })
  await page.getByRole('button', { name: /Enviar solicitud/i }).click()

  // Éxito: pantalla de confirmación con CTA al panel de membresía.
  await expect(page.getByRole('button', { name: /Ir a mi panel de membresía/i })).toBeVisible({ timeout: 20_000 })
  await page.screenshot({ path: 'tmp/full-submission-after.png', fullPage: true })

  // BD: exactamente UNA solicitud (el draft se reutilizó, no se duplicó) y está enviada.
  const apps = await fetchMemberApplications(admin, applicantUserId)
  expect(apps.length, 'Debe existir exactamente una solicitud (draft → submitted, sin duplicar)').toBe(1)
  expect(apps[0].status).toBe('submitted')
  expect(apps[0].category_slug).toBe('retired')

  expect(pageErrors).toEqual([])
})

test('con una solicitud viva, /membership/apply redirige al panel de estado', async ({ page }) => {
  test.skip(!membershipEnvReady(), 'Define E2E_APPLICANT_EMAIL + service_role (.env.local) para correr esta validación.')
  expect(applicantUserId, 'No se encontró el usuario solicitante por email').not.toBe('')

  // Sembramos una solicitud viva (under_review: no notifica) → el form no debe abrirse.
  await resetMemberApplications(admin, applicantUserId)
  await seedLiveApplication(admin, applicantUserId)

  try {
    await signIn(page)

    await page.goto(`/membership/apply?eligibilityToken=${eligibilityAccessToken()}`)

    // El guard anti-duplicado manda al panel de estado en vez de re-renderizar el form.
    await expect(page).toHaveURL(/\/account\/membership/, { timeout: 15_000 })
    await expect(page.getByRole('heading', { name: /^Solicitud de membresía$/i })).toHaveCount(0)
  } finally {
    await resetMemberApplications(admin, applicantUserId)
  }
})
