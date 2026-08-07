import { expect, test, type Page } from '@playwright/test'

import { signInThroughUi } from './support/auth'
import {
  cleanupMembershipFixture,
  createServiceClient,
  fetchMemberApplications,
  membershipEnvReady,
  provisionUser,
  resetMemberApplications,
  seedApplication,
  type ProvisionedCandidate,
  type ServiceClient,
} from './support/membership'

/**
 * Flujo COMPLETO de envío real de una solicitud de membresía (categoría "profesional")
 * bajo el modelo de DRAFT:
 *   login → deep-link con token de elegibilidad → se persiste un draft en la cuenta →
 *   formulario de 6 pasos → envío (UPDATE draft → submitted) → pantalla de éxito.
 * Verifica en BD que NO se duplica la solicitud (el draft se reutiliza).
 *
 * La cuenta se crea aquí con `service_role` y se borra al terminar, así que la
 * prueba es repetible y no depende de que exista un solicitante concreto: antes
 * pedía `E2E_APPLICANT_EMAIL`, que nadie define, y se saltaba siempre.
 *
 * El solicitante nace **sin acceso ASI**: quien va a enviar una solicitud
 * todavía no es miembro, y con el override manual el guard lo mandaría al panel
 * de estado en vez de al formulario.
 */

test.use({ viewport: { width: 1440, height: 1200 }, isMobile: false, hasTouch: false })

let admin: ServiceClient
let applicant: ProvisionedCandidate | null = null

test.beforeAll(async () => {
  if (!membershipEnvReady()) {
    return
  }
  admin = createServiceClient()
  applicant = await provisionUser(admin, {
    prefix: 'applicant-e2e',
    fullName: 'Ana Solicitante',
    withAsiAccess: false,
  })
})

test.afterAll(async () => {
  if (!admin) {
    return
  }
  await cleanupMembershipFixture(admin, [applicant])
})

function eligibilityAccessToken() {
  const token = {
    eligible: true,
    category: 'Profesional',
    categorySlug: 'profesional',
    dues: 'RD$2,500.00',
    timestamp: Date.now(),
  }
  return Buffer.from(JSON.stringify(token))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

async function signIn(page: Page) {
  await signInThroughUi(page, applicant!)
}

async function next(page: Page, siguienteSeccion: string | RegExp) {
  await page.getByRole('button', { name: 'Siguiente' }).click()
  // Comprobar que avanzó: si un campo obligatorio nuevo bloquea el paso, el
  // fallo tiene que señalar aquí y no veinte líneas después, cuando un `fill`
  // no encuentra un campo que nunca llegó a renderizarse.
  await expect(page.getByRole('heading', { name: siguienteSeccion })).toBeVisible()
}

test('un miembro envía su solicitud vía draft sin duplicar la fila', async ({ page }) => {
  test.skip(!membershipEnvReady(), 'Define E2E_SERVICE_ROLE_KEY y E2E_SUPABASE_URL (o usa .env.local).')

  // Estado en cero → el flujo crea un draft nuevo y luego lo envía.
  await resetMemberApplications(admin, applicant!.userId)

  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(`${error.name}: ${error.message}`))

  await signIn(page)

  // Deep-link al formulario con un token de elegibilidad (categoría retired).
  await page.goto(`/membership/apply?eligibilityToken=${eligibilityAccessToken()}`)
  await expect(page.getByRole('heading', { name: /^Solicitud de membresía$/i })).toBeVisible()

  // ── Paso 1: Datos de contacto ──
  await page.locator('[name="firstName"]').fill('Ana')
  await page.locator('[name="lastName"]').fill('Solicitante')
  await page.getByRole('radio', { name: 'Femenino' }).click()
  await page.locator('[name="cellPhone"]').fill('8095550199')
  await page.locator('[name="email"]').fill(applicant!.email)
  // País por defecto "República Dominicana" → provincia y ciudad son selects dependientes.
  await page.getByLabel(/Provincia o estado/).selectOption({ index: 1 })
  await page.getByLabel(/^Ciudad/).selectOption({ index: 1 })
  await page.locator('[name="postalCode"]').fill('10101')
  await next(page, /Trayectoria profesional/i)

  // ── Paso 2: Datos de categoría (profesional) ──
  await page.locator('[name="employerName"]').fill('Consultoría Financiera del Caribe')
  await page.locator('[name="roleTitle"]').fill('Consultor financiero senior')
  // El campo se llamaba "Enfoque profesional" cuando se escribió la prueba; hoy
  // es "Sector en el que ejerces". Se localiza por rol y no por etiqueta porque
  // los campos con ayuda tienen dos elementos con ese mismo nombre accesible: el
  // control y el botón de ayuda que lo explica.
  await page.getByRole('combobox', { name: /Sector en el que ejerces/ }).selectOption({ index: 1 })
  await page.locator('[name="workPhone"]').fill('8095550110')
  await next(page, /Evangelismo personal/i)

  // ── Paso 3: Evangelismo personal ──
  await page
    .locator('[name="shareFaith"]')
    .fill('Comparto mi fe acompañando a colegas jubilados y sirviendo en mi iglesia local cada semana.')
  // "Estudios bíblicos locales" es exclusivo de ministries; "Mentoría" de voluntariado.
  await page.getByRole('checkbox', { name: 'Estudios bíblicos locales' }).check()
  await page.getByRole('checkbox', { name: 'Mentoría' }).check()
  await next(page, /Referencia/i)

  // ── Paso 4: Referencia (iglesia + pastor) ──
  // "Iglesia local" colisiona con "Nombre de la iglesia local": ubicamos el <select>
  // por la opción que contiene.
  await page
    .locator('select')
    .filter({ has: page.getByRole('option', { name: 'Iglesia Central de Santo Domingo' }) })
    .selectOption({ label: 'Iglesia Central de Santo Domingo' })
  // La iglesia va primero; su territorio y los campos visibles se autocompletan desde esa selección.
  await expect(page.getByRole('combobox', { name: /^Unión/ }).locator('option:checked')).toContainText(
    'Unión Dominicana'
  )
  await expect(page.getByRole('combobox', { name: /^Asociación/ }).locator('option:checked')).toContainText(
    'Asociación Central Dominicana'
  )
  await expect(page.getByRole('combobox', { name: /^Distrito/ }).locator('option:checked')).toContainText(
    'Distrito Capital Norte'
  )
  await page.locator('[name="churchStateProvince"]').fill('Distrito Nacional')
  await page.locator('[name="pastorName"]').fill('Pedro Pastor')
  await page.locator('[name="pastorPhone"]').fill('8095550100')
  await page.locator('[name="pastorEmail"]').fill('pastor.referencia@asido.test')
  await next(page, /Cuotas de membresía/i)

  // ── Paso 5: Cuotas ──
  // Sin campos obligatorios propios para esta categoría: la dirección de
  // facturación hereda de la principal.
  await next(page, /Compromiso/i)

  // ── Paso 6: Compromiso (motivación + checkboxes de aceptación) ──
  // La motivación vive en este paso, no en el de cuotas como cuando se escribió
  // la prueba.
  await page
    .locator('[name="membershipPrompt"]')
    .fill('Quiero aportar mi experiencia profesional a la misión de ASI.')

  const checkboxes = page.getByRole('checkbox')
  const count = await checkboxes.count()
  for (let i = 0; i < count; i++) {
    await checkboxes.nth(i).check()
  }

  await page.screenshot({ path: 'tmp/full-submission-before.png', fullPage: true })
  await page.getByRole('button', { name: /Enviar solicitud/i }).click()

  // Éxito: pantalla de confirmación con CTA al panel de membresía.
  await expect(page.getByRole('button', { name: /Ir a pagar mi membresía/i })).toBeVisible()
  await page.screenshot({ path: 'tmp/full-submission-after.png', fullPage: true })

  // BD: exactamente UNA solicitud (el draft se reutilizó, no se duplicó) y está enviada.
  const apps = await fetchMemberApplications(admin, applicant!.userId)
  expect(apps.length, 'Debe existir exactamente una solicitud (draft → submitted, sin duplicar)').toBe(1)
  expect(apps[0].status).toBe('submitted')
  expect(apps[0].category_slug).toBe('profesional')

  expect(pageErrors).toEqual([])
})

test('con una solicitud viva, /membership/apply redirige al panel de estado', async ({ page }) => {
  test.skip(!membershipEnvReady(), 'Define E2E_SERVICE_ROLE_KEY y E2E_SUPABASE_URL (o usa .env.local).')

  // Sembramos una solicitud viva (under_review: no notifica) → el form no debe abrirse.
  await resetMemberApplications(admin, applicant!.userId)
  await seedApplication(admin, {
    userId: applicant!.userId,
    firstName: 'Ana',
    lastName: 'Solicitante',
    email: applicant!.email,
  })

  try {
    await signIn(page)

    await page.goto(`/membership/apply?eligibilityToken=${eligibilityAccessToken()}`)

    // El guard anti-duplicado manda al panel de estado en vez de re-renderizar el form.
    await expect(page).toHaveURL(/\/account\/membership/)
    await expect(page.getByRole('heading', { name: /^Solicitud de membresía$/i })).toHaveCount(0)
  } finally {
    await resetMemberApplications(admin, applicant!.userId)
  }
})
