import { createClient } from '@supabase/supabase-js'
import { expect, test } from '@playwright/test'

import { expectAuthenticated, signInThroughUi } from './support/auth'
import { logAuthRejections, waitForAppSettled } from './support/guards'
import {
  cleanupUsers,
  createServiceClient,
  explainAdminError,
  provisionUser,
  realtimeConfig,
  realtimeEnvReady,
  type ProvisionedCandidate,
  type ServiceClient
} from './support/realtime'

/**
 * Recuperar contraseña, de punta a punta (R7).
 *
 * Es el flujo que usa exactamente quien **ya no puede entrar**. Si se rompe, la
 * persona afectada no tiene camino alternativo: no puede reportarlo desde dentro
 * del producto, porque para eso haría falta la sesión que no tiene.
 *
 * ## Dos atajos deliberados, y por qué no debilitan la prueba
 *
 * **1. El enlace se acuña con `generateLink`, no se lee de una bandeja.** No hay
 * buzón que consultar en CI, y `generateLink` produce el mismo token que GoTrue
 * pondría en el correo, sin enviarlo. Que el correo *salga* es cosa de la
 * plantilla y del proveedor —`auth-email-template-sync` y el pipeline de R3—; lo
 * que esta prueba verifica es qué pasa cuando alguien lo abre.
 *
 * **2. La solicitud por la interfaz se hace con una dirección que no existe.**
 * Con la cuenta real, GoTrue enviaría un correo de verdad a un dominio `.test`
 * en cada corrida de CI: un rebote duro por pasada, que es como se quema la
 * reputación del remitente. Y no se pierde cobertura, porque el camino es el
 * mismo: GoTrue responde 200 exista o no la cuenta, que es justamente la
 * propiedad de no-divulgación que se está afirmando aquí contra el servicio real.
 *
 * ## Por qué el aterrizaje va por el fragmento de la URL
 *
 * El cliente usa el flujo implícito (sin `flowType: 'pkce'`), así que GoTrue
 * devuelve la sesión de recuperación en el fragmento y `detectSessionInUrl` la
 * consume al arrancar: exactamente lo que hace esta prueba. Navegar el
 * `action_link` en su lugar dependería de que el origen del servidor de pruebas
 * —`127.0.0.1:4173`— esté en `additional_redirect_urls` del proyecto remoto, que
 * no lo está; GoTrue lo ignoraría en silencio y el navegador acabaría en el sitio
 * desplegado en vez de en el código bajo prueba.
 */

const NEW_PASSWORD = 'ClaveRecuperada2026'

function anonKeyReady() {
  return Boolean(realtimeConfig.anonKey)
}

/**
 * En CI, entorno ausente es un fallo, no un skip: mismo criterio que
 * `support/realtime.ts`. Un skip aquí dejaría la corrida verde sin haber
 * ejercitado la recuperación.
 */
if (realtimeEnvReady() && !anonKeyReady() && process.env.CI) {
  throw new Error(
    [
      'Falta E2E_SUPABASE_ANON_KEY (o VITE_SUPABASE_ANON_KEY) en CI.',
      'La prueba de recuperación canjea el token del enlace con la llave pública, como el navegador.',
      'Configúrala en Settings → Secrets and variables → Actions.'
    ].join('\n')
  )
}

function createAnonClient() {
  return createClient(realtimeConfig.supabaseUrl, realtimeConfig.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  })
}

/** Token de un solo uso, tal como lo llevaría el enlace del correo. */
async function mintRecoveryToken(admin: ServiceClient, email: string) {
  const { data, error } = await admin.auth.admin.generateLink({ type: 'recovery', email })

  if (error) {
    throw explainAdminError(error)
  }

  const tokenHash = data.properties?.hashed_token

  if (!tokenHash) {
    throw new Error('GoTrue devolvió un enlace de recuperación sin `hashed_token`.')
  }

  return tokenHash
}

/** La URL con la que el navegador vuelve del enlace, en flujo implícito. */
function recoveryLandingUrl(accessToken: string, refreshToken: string) {
  const fragment = new URLSearchParams({
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_in: '3600',
    token_type: 'bearer',
    type: 'recovery'
  })

  return `/auth/reset-password#${fragment.toString()}`
}

test.describe.serial('recuperación de contraseña', () => {
  test.skip(
    !realtimeEnvReady() || !anonKeyReady(),
    'Define E2E_SUPABASE_URL, E2E_SERVICE_ROLE_KEY y E2E_SUPABASE_ANON_KEY (o usa .env.local).'
  )

  let admin: ServiceClient
  let account: ProvisionedCandidate | null = null

  test.beforeAll(async () => {
    admin = createServiceClient()
    account = await provisionUser(admin, { prefix: 'pwd-e2e', fullName: 'Recuperación E2E' })
  })

  test.afterAll(async () => {
    await cleanupUsers(admin, [account])
    account = null
  })

  test.beforeEach(({ page }) => {
    logAuthRejections(page)
  })

  test('pide el enlace sin revelar si la cuenta existe', async ({ page }) => {
    const unknownEmail = `no-existe+${Date.now()}@asido.test`

    await page.goto('/auth/forgot-password')
    await page.getByPlaceholder('john.doe@empresa.com.do').fill(unknownEmail)
    await page.getByRole('button', { name: /Enviar enlace/i }).click()

    // GoTrue responde 200 para una cuenta inexistente, así que la pantalla no
    // puede decir otra cosa que la confirmación condicional. Si algún día el
    // proveedor empezara a devolver error, este aserto es el que lo delata:
    // aparecería el toast de fallo en vez de "Revisa tu correo".
    await expect(page.getByRole('heading', { name: /Revisa tu correo/i })).toBeVisible()
    await expect(page.getByText(/tiene una cuenta en ASI/i)).toBeVisible()
    await expect(page.getByText(/no (existe|está registrad|encontramos)/i)).toHaveCount(0)
  })

  test('el enlace deja crear una contraseña nueva, y es la que sirve para entrar', async ({ page }) => {
    const activeAccount = account
    expect(activeAccount).not.toBeNull()

    const tokenHash = await mintRecoveryToken(admin, activeAccount!.email)
    const anon = createAnonClient()
    const { data: verified, error: verifyError } = await anon.auth.verifyOtp({
      type: 'recovery',
      token_hash: tokenHash
    })

    expect(verifyError, 'el token recién acuñado debería canjearse').toBeNull()
    const session = verified.session
    expect(session, 'el canje debería devolver una sesión de recuperación').not.toBeNull()

    await page.goto(recoveryLandingUrl(session!.access_token, session!.refresh_token))
    await waitForAppSettled(page)

    await expect(page.getByRole('heading', { name: /Crea tu contraseña nueva/i })).toBeVisible()
    await page.getByPlaceholder('Tu contraseña nueva', { exact: true }).fill(NEW_PASSWORD)
    await page.getByPlaceholder('Repite tu contraseña nueva').fill(NEW_PASSWORD)
    await page.getByRole('button', { name: /Guardar contraseña/i }).click()

    // La sesión de recuperación se cierra a propósito tras el cambio: estrenar la
    // contraseña es la única confirmación real de que quedó guardada.
    await page.waitForURL('**/auth/sign-in**')
    await waitForAppSettled(page)

    // La vieja ya no abre. Sin este aserto, un `updateUser` que no hiciera nada
    // pasaría la prueba: la contraseña de siempre seguiría funcionando.
    await page.getByPlaceholder('john.doe@empresa.com.do').fill(activeAccount!.email)
    await page.getByPlaceholder('Tu contraseña').fill(activeAccount!.password)
    await page.getByRole('button', { name: /Iniciar sesión/i }).click()
    await expect(page.getByText('No pudimos iniciar sesión')).toBeVisible()
    await expect(page).toHaveURL(/\/auth\/sign-in/)

    // Y la nueva sí, por la interfaz real y sobreviviendo a una recarga dura.
    await signInThroughUi(page, { ...activeAccount!, password: NEW_PASSWORD })
    await expectAuthenticated(page)
  })

  test('un enlace ya usado no vale por segunda vez', async ({ page }) => {
    const activeAccount = account
    expect(activeAccount).not.toBeNull()

    const tokenHash = await mintRecoveryToken(admin, activeAccount!.email)
    const anon = createAnonClient()

    const first = await anon.auth.verifyOtp({ type: 'recovery', token_hash: tokenHash })
    expect(first.error).toBeNull()

    const second = await anon.auth.verifyOtp({ type: 'recovery', token_hash: tokenHash })
    expect(second.error, 'GoTrue debería rechazar el segundo canje del mismo token').not.toBeNull()
    expect(second.data.session).toBeNull()

    // Lo que ve la persona al reabrir el enlace del correo: GoTrue redirige con el
    // error en el fragmento y la app se queda sin sesión que hidratar.
    await page.goto(
      '/auth/reset-password#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired'
    )
    await waitForAppSettled(page)

    await expect(page.getByText(/Este enlace ya no sirve/i)).toBeVisible()
    await expect(page.getByPlaceholder('Tu contraseña nueva', { exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Pedir un enlace nuevo/i })).toBeVisible()
  })

  test('entrar a la pantalla a mano no abre el formulario', async ({ page }) => {
    await page.goto('/auth/reset-password')
    await waitForAppSettled(page)

    await expect(page.getByText(/Este enlace ya no sirve/i)).toBeVisible()
    await expect(page.getByPlaceholder('Tu contraseña nueva', { exact: true })).toHaveCount(0)
  })
})
