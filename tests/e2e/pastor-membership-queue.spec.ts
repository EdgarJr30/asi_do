import { expect, test } from '@playwright/test'

import { signInThroughUi } from './support/auth'
import {
  assertRoutedToPastor,
  cleanupMembershipFixture,
  createServiceClient,
  membershipEnvReady,
  pickChurches,
  provisionPastor,
  provisionUser,
  seedApplication,
  type FixtureChurch,
  type ProvisionedCandidate,
  type ServiceClient,
} from './support/membership'

/**
 * Fase 3 (cola del pastor) de extremo a extremo: un pastor con alcance sobre su
 * iglesia ve la solicitud que le enrutó el trigger `route_membership_application`
 * y aprueba la referencia; un pastor de OTRA iglesia no la ve.
 *
 * Todo el escenario se monta aquí con `service_role` —dos pastores, dos
 * iglesias, el miembro y su solicitud— y se borra al terminar. Antes dependía de
 * dos cuentas fijas por variable de entorno y de una fila sembrada a mano, así
 * que las dos pruebas se saltaban siempre.
 *
 * Las iglesias salen de la jerarquía real en vez de un nombre escrito a mano: lo
 * que la prueba necesita es que sean **dos distintas**, no que se llamen de una
 * forma concreta.
 */

test.use({ viewport: { width: 1440, height: 1200 }, isMobile: false, hasTouch: false })

// `serial` y en este orden a propósito: el pastor ajeno mira la cola **mientras
// la solicitud sigue viva**. Si aprobara primero el pastor de la iglesia, la
// segunda prueba vería una cola vacía por el motivo equivocado y no probaría el
// alcance.
test.describe.serial('cola de membresía del pastor', () => {
  test.skip(!membershipEnvReady(), 'Define E2E_SERVICE_ROLE_KEY y E2E_SUPABASE_URL (o usa .env.local).')

  let admin: ServiceClient
  let churchA: FixtureChurch
  let pastorA: ProvisionedCandidate | null = null
  let pastorB: ProvisionedCandidate | null = null
  let member: ProvisionedCandidate | null = null

  test.beforeAll(async () => {
    admin = createServiceClient()

    const [primera, segunda] = await pickChurches(admin, 2)
    churchA = primera

    pastorA = await provisionPastor(admin, [primera.id], 'Pedro Pastor')
    pastorB = await provisionPastor(admin, [segunda.id], 'Pablo Pastor')

    // El solicitante no es miembro todavía: sin acceso ASI.
    member = await provisionUser(admin, {
      prefix: 'member-e2e',
      fullName: 'María Miembro',
      withAsiAccess: false,
    })

    const applicationId = await seedApplication(admin, {
      userId: member.userId,
      firstName: 'María',
      lastName: 'Miembro',
      email: member.email,
      churchId: primera.id,
      churchName: primera.name,
    })

    // El enrutamiento es del trigger, no de la prueba: si eligió a otro pastor,
    // conviene enterarse aquí y no en un aserto de interfaz.
    await assertRoutedToPastor(admin, applicationId, pastorA.userId)
  })

  test.afterAll(async () => {
    if (!admin) {
      return
    }
    await cleanupMembershipFixture(admin, [member, pastorA, pastorB])
  })

  test('un pastor de otra iglesia NO ve las solicitudes ajenas (RLS scoped)', async ({ page }) => {

    const pageErrors: string[] = []
    page.on('pageerror', (error) => pageErrors.push(`${error.name}: ${error.message}`))

    await signInThroughUi(page, pastorB!)
    await page.goto('/account/membership-queue')

    // Es pastor, así que ve la cola; pero no las solicitudes de otra iglesia.
    await expect(
      page.getByRole('heading', { name: /Solicitudes de membres[ií]a de tus iglesias/i })
    ).toBeVisible()
    await expect(page.getByText(/Sin solicitudes pendientes/i)).toBeVisible()
    await expect(page.getByText('María Miembro')).toHaveCount(0)

    expect(pageErrors).toEqual([])
  })

  test('el pastor ve su cola scoped y aprueba la solicitud de su iglesia', async ({ page }) => {

    const pageErrors: string[] = []
    page.on('pageerror', (error) => pageErrors.push(`${error.name}: ${error.message}`))

    await signInThroughUi(page, pastorA!)
    await page.goto('/account/membership-queue')

    await expect(
      page.getByRole('heading', { name: /Solicitudes de membres[ií]a de tus iglesias/i })
    ).toBeVisible()

    // La solicitud enrutada a su iglesia. Se acota a su tarjeta: la cola puede
    // tener varias solicitudes de la misma iglesia.
    const card = page.locator('[class*="rounded"]').filter({ hasText: 'María Miembro' }).first()
    await expect(card).toBeVisible()
    await expect(card.getByText(churchA.name, { exact: false })).toBeVisible()
    await expect(card.getByText(/Profesional/)).toBeVisible()

    // El item de nav "Pastoral" existe para el pastor (el sidebar lo renderiza
    // como <button>).
    await expect(page.getByRole('button', { name: /Solicitudes de mi iglesia/i }).first()).toBeVisible()

    // Aprueba la referencia: la RPC `review_membership_application` autoriza por
    // alcance pastoral.
    await card.getByRole('button', { name: /Aprobar referencia/i }).click()

    // Tras aprobar, sale del filtro de pendientes y desaparece de la cola.
    await expect(page.getByText('María Miembro')).toBeHidden()

    expect(pageErrors).toEqual([])
  })
})
