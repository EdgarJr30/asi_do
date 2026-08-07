import { expect, test } from '@playwright/test'

import { signInThroughUi } from './support/auth'
import { collectPageErrors } from './support/page-errors'
import {
  cleanupMembershipFixture,
  createServiceClient,
  membershipEnvReady,
  provisionPlatformAdmin,
  provisionUser,
  seedApplication,
  seedPayment,
  setPaymentStatus,
  type ProvisionedCandidate,
  type ServiceClient,
} from './support/membership'

/**
 * Fase 4: un admin de plataforma aprueba la solicitud y activa la membresía
 * desde `/admin/membership`.
 *
 * Dos reglas se comprueban aquí, y son distintas: la **activación exige
 * solicitud aprobada y pago verificado** —el botón sigue deshabilitado mientras
 * falte una de las dos—, y una vez cumplidas, activa.
 *
 * Sobre el pago: la consola **no tiene forma de verificarlo**. La RPC
 * `verify_membership_payment` existe en la base pero ningún componente la llama;
 * hoy el único camino a `verified` es la liquidación de AZUL. Por eso el fixture
 * lo mueve como lo movería la pasarela, en vez de simular un botón inexistente.
 * La versión anterior de esta prueba pulsaba "Verificar pago", un botón que no
 * está en el producto — y como la prueba se saltaba siempre, nadie lo notó.
 */

test.use({ viewport: { width: 1440, height: 1200 }, isMobile: false, hasTouch: false })

test.describe('consola de administración de membresías', () => {
  test.skip(!membershipEnvReady(), 'Define E2E_SERVICE_ROLE_KEY y E2E_SUPABASE_URL (o usa .env.local).')

  let admin: ServiceClient
  let platformAdmin: ProvisionedCandidate | null = null
  let applicant: ProvisionedCandidate | null = null
  let paymentId = ''

  test.beforeAll(async () => {
    admin = createServiceClient()

    platformAdmin = await provisionPlatformAdmin(admin)
    applicant = await provisionUser(admin, {
      prefix: 'applicant-e2e',
      fullName: 'Marcos Miembro',
      withAsiAccess: false,
    })

    const applicationId = await seedApplication(admin, {
      userId: applicant.userId,
      firstName: 'Marcos',
      lastName: 'Miembro',
      email: applicant.email,
    })
    paymentId = await seedPayment(admin, {
      applicationId,
      userId: applicant.userId,
      status: 'submitted',
    })
  })

  test.afterAll(async () => {
    if (!admin) {
      return
    }
    await cleanupMembershipFixture(admin, [applicant, platformAdmin])
  })

  test('un admin aprueba la solicitud y activa la cuenta cuando el pago está verificado', async ({ page }) => {

    const pageErrors = collectPageErrors(page)

    await signInThroughUi(page, platformAdmin!)

    await page.goto('/admin/membership')
    await expect(page.getByRole('heading', { name: /Administración de membresías/i })).toBeVisible()

    // La consola lista todas las solicitudes en curso: se busca la del fixture
    // en vez de confiar en que sea la primera de la lista. Por correo y no por
    // nombre porque la búsqueda compara columna a columna —nombre y apellido son
    // dos— y "Marcos Miembro" no coincide con ninguna.
    await page.getByPlaceholder('Buscar por nombre, email, categoría…').fill(applicant!.email)

    const card = page.locator('[class*="rounded"]').filter({ hasText: 'Marcos Miembro' }).first()
    await expect(card).toBeVisible()

    // 1. Con el pago sin verificar, activar no está disponible. Es la regla que
    //    la Fase 4 tenía que garantizar.
    await expect(card.getByRole('button', { name: /Activar membres[ií]a/i })).toBeDisabled()

    // 2. El admin aprueba la solicitud.
    await card.getByRole('button', { name: /^Aprobar$/ }).click()
    await expect(card.getByText('Aprobada')).toBeVisible()

    // Aprobada pero sin pago verificado: sigue sin poder activarse.
    await expect(card.getByRole('button', { name: /Activar membres[ií]a/i })).toBeDisabled()

    // 3. La pasarela liquida el pago (lo que hoy hace AZUL, no la consola).
    await setPaymentStatus(admin, paymentId, 'verified')
    await expect(card.getByText('Pago verificado')).toBeVisible()

    // 4. Ahora sí: activar. Se comprueba la confirmación del producto y, sobre
    //    todo, el efecto en la base: el badge de la tarjeta depende de que la
    //    lista refresque, pero que el miembro quede activo no depende de nada.
    const activar = card.getByRole('button', { name: /Activar membres[ií]a/i })
    await expect(activar).toBeEnabled()
    await activar.click()
    await expect(page.getByText(/Cuenta activada/i)).toBeVisible()

    await expect
      .poll(async () => {
        const { data } = await admin
          .from('users')
          .select('asi_membership_status')
          .eq('id', applicant!.userId)
          .maybeSingle<{ asi_membership_status: string }>()
        return data?.asi_membership_status ?? null
      })
      .toBe('active')

    expect(pageErrors).toEqual([])
  })
})
