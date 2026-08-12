import { expect, test, type Page } from '@playwright/test'

import { signInThroughUi } from './support/auth'
import { collectPageErrors } from './support/page-errors'
import {
  cleanupMembershipFixture,
  createServiceClient,
  membershipEnvReady,
  provisionUser,
  seedApplication,
  type ProvisionedCandidate,
  type ServiceClient,
} from './support/membership'

/**
 * A dónde sale el asistente de perfil base según dónde quedó la membresía.
 *
 * Es el punto donde más se pierde el recién registrado: antes salía siempre al
 * pago, incluso con la solicitud sin enviar, donde no hay nada que pagar. Se
 * prueba de punta a punta porque el destino depende de datos del servidor
 * (la solicitud) y de la navegación real, no de un componente aislado.
 */

test.use({ viewport: { width: 1440, height: 1200 }, isMobile: false, hasTouch: false })

/** Recorre los 3 pasos del asistente y lo guarda. */
async function completeBaseProfileWizard(page: Page, fullName: string, displayName: string) {
  await expect(page.getByRole('heading', { name: 'Dejemos tu cuenta lista' })).toBeVisible()

  const nombreCompleto = page.getByPlaceholder('Ej. John Doe')
  const nombreVisible = page.getByPlaceholder('Ej. John D.')

  await nombreCompleto.fill(fullName)
  await nombreVisible.fill(displayName)
  // El asistente resetea el formulario cuando llega el perfil de la sesión: si el
  // relleno ocurrió antes, se pierde. Se comprueba aquí para que el fallo diga eso
  // y no "no encuentro el botón del último paso".
  await expect(nombreCompleto).toHaveValue(fullName)
  await expect(nombreVisible).toHaveValue(displayName)

  await page.getByRole('button', { name: 'Continuar', exact: true }).first().click()
  await expect(page.getByRole('heading', { name: 'Idioma y país' })).toBeVisible()

  await page.getByRole('button', { name: 'Continuar', exact: true }).first().click()
  await expect(page.getByRole('heading', { name: /Una foto ayuda/i })).toBeVisible()

  await page.getByRole('button', { name: /Guardar y continuar/i }).first().click()
}

test.describe('salida del asistente de perfil base', () => {
  test.skip(!membershipEnvReady(), 'Define E2E_SERVICE_ROLE_KEY y E2E_SUPABASE_URL (o usa .env.local).')

  let admin: ServiceClient
  let conSolicitud: ProvisionedCandidate | null = null
  let conBorrador: ProvisionedCandidate | null = null

  test.beforeAll(async () => {
    admin = createServiceClient()

    // Sin acceso ASI en ambos: son solicitantes, no miembros activos.
    conSolicitud = await provisionUser(admin, {
      prefix: 'onb-pago-e2e',
      withAsiAccess: false,
      withBaseOnboarding: false,
    })
    await seedApplication(admin, {
      userId: conSolicitud.userId,
      firstName: 'Ana',
      lastName: 'Enviada',
      email: conSolicitud.email,
      status: 'under_review',
    })

    conBorrador = await provisionUser(admin, {
      prefix: 'onb-draft-e2e',
      withAsiAccess: false,
      withBaseOnboarding: false,
    })
    await seedApplication(admin, {
      userId: conBorrador.userId,
      firstName: 'Luis',
      lastName: 'Borrador',
      email: conBorrador.email,
      status: 'draft',
    })
  })

  test.afterAll(async () => {
    if (!admin) {
      return
    }
    await cleanupMembershipFixture(admin, [conSolicitud, conBorrador])
  })

  test('con la solicitud ya enviada, el asistente sale al pago', async ({ page }) => {
    const pageErrors = collectPageErrors(page)

    await signInThroughUi(page, conSolicitud!)
    await page.goto('/account/profile')

    await completeBaseProfileWizard(page, 'Ana Enviada', 'Ana E.')

    // Sale solo al guardar: no hay pantalla intermedia que el usuario deba pulsar.
    await page.waitForURL('**/account/membership')
    await expect(page.getByRole('heading', { name: 'Tu membresía' })).toBeVisible()
    await expect(page.getByRole('button', { name: /Pagar con tarjeta/i })).toBeVisible()

    expect(pageErrors).toEqual([])
  })

  test('con la solicitud en borrador, el asistente manda a terminarla y avisa que no puede pagar', async ({ page }) => {
    const pageErrors = collectPageErrors(page)

    await signInThroughUi(page, conBorrador!)
    await page.goto('/account/profile')

    await completeBaseProfileWizard(page, 'Luis Borrador', 'Luis B.')

    // Con la solicitud sin enviar, la salida es el formulario, no el pago.
    await page.waitForURL('**/membership/apply**')

    // Y la pantalla de membresía dice lo mismo: sin solicitud enviada no hay pago.
    await page.goto('/account/membership')
    await expect(page.getByText('Todavía no puedes pagar')).toBeVisible()

    expect(pageErrors).toEqual([])
  })
})
