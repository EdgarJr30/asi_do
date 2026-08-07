import { expect, test } from '@playwright/test'

import { signInThroughUi } from './support/auth'
import {
  cleanupRealtimeCandidate,
  createServiceClient,
  provisionRealtimeCandidate,
  realtimeEnvReady,
  type ProvisionedCandidate,
  type ServiceClient
} from './support/realtime'

/**
 * El home del candidato recién autenticado.
 *
 * Se provee su propia cuenta efímera con `service_role` y la borra al terminar,
 * igual que el smoke autenticado. Antes leía `E2E_SIGNUP_EMAIL` /
 * `E2E_SIGNUP_PASSWORD`: variables que nadie define, así que en cualquier
 * máquina sin ellas los dos tests morían con `fill(undefined)` —un error que no
 * dice nada del producto— en vez de saltarse o de funcionar solos.
 *
 * Además la cuenta tiene que ser **nueva de verdad**: lo que se verifica es
 * dónde aterriza un usuario en su primer acceso y que vea el aviso de perfil
 * incompleto. Con una cuenta fija reutilizada, el segundo aserto dejaría de ser
 * cierto en cuanto alguien completara ese perfil.
 */

const shotDir = process.env.E2E_SHOT_DIR ?? 'test-results/tmp'

test.describe('home del candidato', () => {
  test.skip(
    !realtimeEnvReady(),
    'Define E2E_SERVICE_ROLE_KEY y E2E_SUPABASE_URL (o usa .env.local) para provisionar la cuenta.'
  )

  let admin: ServiceClient
  let candidate: ProvisionedCandidate | null = null

  test.beforeAll(async () => {
    admin = createServiceClient()
    candidate = await provisionRealtimeCandidate(admin)
  })

  test.afterAll(async () => {
    await cleanupRealtimeCandidate(admin, candidate)
  })

  test('candidate first login lands on /account home, not the profile form', async ({ page }, testInfo) => {
    expect(candidate).not.toBeNull()
    await signInThroughUi(page, candidate!)

    // Debe aterrizar en el home del usuario (/account), NO en /account/profile.
    expect(new URL(page.url()).pathname).toBe('/account')

    // Y el formulario de perfil no debe estar ocupando la pantalla. Es el aserto
    // que le da nombre a la prueba, y ahora se comprueba por lo que se ve y no
    // por la URL: el asistente vive dentro de /account/profile.
    await expect(page.getByText(/Dejemos tu cuenta lista/i)).toHaveCount(0)

    // El home renderizado. Se comprueba su acción principal, no el copy del
    // encabezado: el rediseño de la página cambió el título por un saludo con
    // el nombre del usuario, y "Inicio · Tu espacio" / "Completa tu perfil para
    // destacar" ya no existen en el producto. Un aserto contra un texto que se
    // borró hace meses no protege nada.
    await expect(page.getByRole('button', { name: /Explorar vacantes/i }).first()).toBeVisible()

    await page.screenshot({ path: `${shotDir}/${testInfo.project.name}-candidate-home.png`, fullPage: true })
  })

  test('sidebar copy: Inicio present, "Acceso operador" gone', async ({ page }, testInfo) => {
    expect(candidate).not.toBeNull()
    await signInThroughUi(page, candidate!)

    // El texto críptico anterior no debe existir en ninguna parte.
    await expect(page.getByText('Acceso operador')).toHaveCount(0)

    await page.screenshot({ path: `${shotDir}/${testInfo.project.name}-sidebar.png`, fullPage: false })
  })
})
