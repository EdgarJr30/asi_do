import { expect, test } from '@playwright/test'

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
 * El loop de "falta información": el miembro ve la nota del pastor en su panel y
 * reenvía su solicitud a revisión (needs_more_info → under_review).
 *
 * El fixture es la prueba: se crea el miembro y su solicitud ya en
 * `needs_more_info` con la nota del pastor, porque lo que se verifica es lo que
 * pasa a partir de ahí. Antes esto esperaba una cuenta fija por variable de
 * entorno y una fila sembrada a mano, así que se saltaba siempre.
 */

const NOTA_DEL_PASTOR = 'Necesito tu carta de traslado de la iglesia anterior.'

test.use({ viewport: { width: 1440, height: 1200 }, isMobile: false, hasTouch: false })

test.describe('miembro con solicitud en falta de información', () => {
  test.skip(!membershipEnvReady(), 'Define E2E_SERVICE_ROLE_KEY y E2E_SUPABASE_URL (o usa .env.local).')
  let admin: ServiceClient
  let member: ProvisionedCandidate | null = null

  test.beforeAll(async () => {
    admin = createServiceClient()
    // Sin acceso ASI: quien tiene una solicitud pendiente todavía no es miembro,
    // y el override manual haría que el panel mostrara el estado de alguien ya
    // activo en vez del de una solicitud en curso.
    member = await provisionUser(admin, {
      prefix: 'member-e2e',
      fullName: 'María Miembro',
      withAsiAccess: false,
    })
    await seedApplication(admin, {
      userId: member.userId,
      firstName: 'María',
      lastName: 'Miembro',
      email: member.email,
      status: 'needs_more_info',
      reviewNotes: NOTA_DEL_PASTOR,
    })
  })

  test.afterAll(async () => {
    if (!admin) {
      return
    }
    await cleanupMembershipFixture(admin, [member])
  })

  test('el miembro ve la nota del pastor y reenvía su solicitud a revisión', async ({ page }) => {

    const pageErrors = collectPageErrors(page)

    await signInThroughUi(page, member!)

    await page.goto('/account/membership')

    // La nota del pastor es visible para el miembro.
    await expect(page.getByText('Nota de tu pastor')).toBeVisible()
    await expect(page.getByText(NOTA_DEL_PASTOR)).toBeVisible()

    // Responde y reenvía a revisión.
    await page
      .getByPlaceholder('Responde lo que tu pastor solicitó para continuar con tu solicitud.')
      .fill('Adjunté mi carta de traslado de la Iglesia Central. Quedo atento.')
    await page.getByRole('button', { name: /Reenviar a revisi[óo]n/i }).click()

    // Tras reenviar, la solicitud pasa a under_review y el bloque de nota desaparece.
    await expect(page.getByText('Nota de tu pastor')).toBeHidden()

    expect(pageErrors).toEqual([])
  })
})
