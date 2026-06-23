import { expect, test, type Page } from '@playwright/test'

import {
  cleanupRealtimeCandidate,
  createServiceClient,
  provisionRealtimeCandidate,
  realtimeConfig,
  realtimeEnvReady,
  type ProvisionedCandidate,
  type ServiceClient
} from './support/realtime'

/**
 * Regresión de datos en vivo: dos sesiones independientes abren el job board
 * público y, cuando una vacante se publica/borra en la BD (simulando a otra
 * empresa), AMBAS lo reflejan sin recargar la página. Cubre el patrón
 * useRealtimeSync('public-job-board', ...) -> invalidateQueries de React Query.
 *
 * Necesita `service_role` para mutar la BD, así que se salta cuando el entorno no
 * está configurado (ver tests/e2e/support/realtime.ts). Para correrla:
 *   npx playwright test tests/e2e/realtime-job-board.spec.ts --project=desktop-webkit
 * (lee .env.local automáticamente en local).
 */

const DEMO_JOB_TITLE = 'Desarrollador(a) Frontend React'

async function signInAndOpenBoard(page: Page, candidate: ProvisionedCandidate) {
  await page.goto('/auth/sign-in')
  await page.getByPlaceholder('john.doe@empresa.com.do').fill(candidate.email)
  await page.getByPlaceholder('Tu contraseña').fill(candidate.password)
  await page.getByRole('button', { name: /Iniciar sesión/i }).click()
  // Usuario nuevo: puede aterrizar en /candidate o /candidate/profile (onboarding).
  await page.waitForURL(/\/candidate/, { timeout: 30_000 })
  await page.goto('/platform/jobs')
  await expect(page.getByText(DEMO_JOB_TITLE).first()).toBeVisible({ timeout: 30_000 })
  // A partir de aquí, ninguna sesión debe recargarse: lo verificamos al final.
  await page.evaluate(() => ((window as unknown as { __noReload: boolean }).__noReload = true))
}

test.describe.serial('job board público en vivo', () => {
  test.skip(!realtimeEnvReady(), 'Define E2E_SERVICE_ROLE_KEY y E2E_SUPABASE_URL (o usa .env.local).')

  let admin: ServiceClient
  let candidate: ProvisionedCandidate | null = null

  test.beforeAll(async () => {
    admin = createServiceClient()
    candidate = await provisionRealtimeCandidate(admin)
  })

  test.afterAll(async () => {
    await cleanupRealtimeCandidate(admin, candidate)
  })

  test('una vacante publicada aparece y desaparece en vivo en dos sesiones, sin recargar', async ({ browser }) => {
    expect(candidate).not.toBeNull()
    const activeCandidate = candidate!
    const unique = `Vacante Realtime ${Date.now()}`
    const slug = `vacante-realtime-${Date.now()}`
    let insertedId: string | null = null

    const contextA = await browser.newContext()
    const contextB = await browser.newContext()
    const pageA = await contextA.newPage()
    const pageB = await contextB.newPage()

    try {
      await signInAndOpenBoard(pageA, activeCandidate)
      await signInAndOpenBoard(pageB, activeCandidate)

      // --- Otra "empresa" publica una vacante directamente en la BD ---
      const { data, error } = await admin
        .from('job_postings')
        .insert({
          tenant_id: realtimeConfig.tenantId,
          company_profile_id: realtimeConfig.companyProfileId,
          title: unique,
          slug,
          summary: 'Vacante temporal para verificar actualizaciones en vivo.',
          description: 'Se crea y elimina dentro de la prueba e2e de realtime.',
          status: 'published',
          published_at: new Date().toISOString()
        })
        .select('id')
        .single<{ id: string }>()
      if (error) {
        throw error
      }
      insertedId = data.id

      // Sin recargar: ambas sesiones deben mostrar la nueva vacante.
      await expect(pageA.getByText(unique).first()).toBeVisible({ timeout: 20_000 })
      await expect(pageB.getByText(unique).first()).toBeVisible({ timeout: 20_000 })

      // --- La vacante se elimina; ambas deben dejar de mostrarla en vivo ---
      await admin.from('job_postings').delete().eq('id', insertedId)
      insertedId = null

      await expect(pageA.getByText(unique)).toHaveCount(0, { timeout: 20_000 })
      await expect(pageB.getByText(unique)).toHaveCount(0, { timeout: 20_000 })

      // Garantía de "en vivo": ninguna pestaña se recargó durante la prueba.
      expect(await pageA.evaluate(() => (window as unknown as { __noReload?: boolean }).__noReload)).toBe(true)
      expect(await pageB.evaluate(() => (window as unknown as { __noReload?: boolean }).__noReload)).toBe(true)
    } finally {
      if (insertedId) {
        await admin.from('job_postings').delete().eq('id', insertedId)
      }
      await contextA.close()
      await contextB.close()
    }
  })
})
