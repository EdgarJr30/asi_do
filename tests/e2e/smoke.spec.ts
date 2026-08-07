import { expect, test } from '@playwright/test'

import { expectAuthenticated, signInThroughUi } from './support/auth'
import {
  cleanupRealtimeCandidate,
  createServiceClient,
  provisionRealtimeCandidate,
  realtimeEnvReady,
  type ProvisionedCandidate,
  type ServiceClient
} from './support/realtime'
import { FRESH_SESSION_CONTENT_TIMEOUT } from './support/timeouts'

const candidateProfilePath = '/account/profile'
const candidateRecruiterRequestPath = '/account/recruiter-request'
const candidateApplicationsPath = '/account/applications'

test.describe('public shell smoke', () => {
  test('loads the institutional home and gates the members-only job board', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText(/Transformando vidas a través del compromiso laico y la fe/i)).toBeVisible()

    await page.goto('/platform')
    await expect(
      page.getByRole('heading', { name: /Vacantes, talento y selección en un solo lugar/i })
    ).toBeVisible()

    // El job board (/account/jobs) está detrás de RequireActiveAsiAccess: un
    // visitante sin sesión activa es redirigido a iniciar sesión.
    await page.goto('/account/jobs')
    await page.waitForURL('**/auth/sign-in**')
    await expect(page.getByRole('heading', { name: /Bienvenida de vuelta/i })).toBeVisible()
  })

  test('treats removed legacy routes as no longer part of the public contract', async ({ page }) => {
    await page.goto('/pipeline')
    await expect(page.getByRole('heading', { name: /Ups, esta página no está disponible/i, level: 1 })).toBeVisible()
  })
})

/**
 * Smoke autenticado.
 *
 * **Lo que había antes no autenticaba.** Se activaba con `E2E_SIGNUP_EMAIL` y
 * `E2E_SIGNUP_PASSWORD`, pero no usaba esas credenciales para nada: solo
 * navegaba a las rutas. Aun "habilitado" habría chocado con los mismos redirects
 * que un visitante anónimo, así que no verificaba ninguna superficie protegida.
 * El bloque además estaba duplicado literalmente entre la rama activa y la
 * saltada, de modo que un cambio en una no llegaba a la otra.
 *
 * Ahora la prueba se provee su propia cuenta con `service_role` —efímera, con
 * acceso ASI por `manual_access_override_until` para saltar el pipeline de
 * membresía— inicia sesión por la interfaz real y la borra al terminar. No
 * depende de que exista una cuenta de prueba concreta ni deja rastro.
 *
 * El único requisito es `E2E_SERVICE_ROLE_KEY` (o `.env.local` en local). Sin
 * Docker no hay Supabase local, así que corre contra el proyecto remoto.
 */
test.describe.serial('mvp authenticated smoke', () => {
  test.skip(
    !realtimeEnvReady(),
    'Define E2E_SERVICE_ROLE_KEY y E2E_SUPABASE_URL (o usa .env.local) para el smoke autenticado.'
  )

  let admin: ServiceClient
  let candidate: ProvisionedCandidate | null = null

  test.beforeAll(async () => {
    admin = createServiceClient()
    candidate = await provisionRealtimeCandidate(admin)
  })

  test.afterAll(async () => {
    // La cuenta se borra pase lo que pase: una prueba que deja usuarios detrás
    // ensucia el proyecto remoto en cada corrida de CI.
    await cleanupRealtimeCandidate(admin, candidate)
    candidate = null
  })

  test('recorre las superficies protegidas con una sesión real', async ({ page }) => {
    const activeCandidate = candidate
    expect(activeCandidate).not.toBeNull()

    await signInThroughUi(page, activeCandidate!)
    await expectAuthenticated(page)

    // El job board: la misma ruta que en la prueba pública redirige a login, aquí
    // debe abrirse. Es el aserto que demuestra que la sesión es real.
    await page.goto('/account/jobs')
    await expect(page).not.toHaveURL(/\/auth\/sign-in/)

    await page.goto(candidateProfilePath)
    // Único aserto del test que espera contenido y no una URL, y cae justo tras
    // un `goto` con la sesión recién iniciada: ver el motivo del margen en
    // `support/timeouts.ts`.
    await expect(page.getByText(/Dejemos tu cuenta lista|Perfil candidato/i).first()).toBeVisible({
      timeout: FRESH_SESSION_CONTENT_TIMEOUT
    })

    await page.goto(candidateApplicationsPath)
    await expect(page).not.toHaveURL(/\/auth\/sign-in/)

    await page.goto(candidateRecruiterRequestPath)
    await expect(page).not.toHaveURL(/\/auth\/sign-in/)
  })

  test('el workspace sigue cerrado para un candidato sin membresía de empresa', async ({ page }) => {
    const activeCandidate = candidate
    expect(activeCandidate).not.toBeNull()

    await signInThroughUi(page, activeCandidate!)

    // Tener sesión no es tener acceso a todo: el candidato no pertenece a ningún
    // tenant, así que el pipeline del empleador debe seguir fuera de su alcance.
    // Sin este aserto, el smoke solo probaría que la autenticación funciona y no
    // que la autorización sigue separando superficies.
    await page.goto('/workspace/pipeline')
    await expect(page).not.toHaveURL(/\/workspace\/pipeline$/)
  })
})
