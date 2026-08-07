import { expect, test, type Page } from '@playwright/test'

import {
  cleanupRealtimeCandidate,
  createServiceClient,
  provisionRealtimeCandidate,
  realtimeEnvReady,
  resolveJobPublisher,
  type JobPublisher,
  type ProvisionedCandidate,
  type ServiceClient
} from './support/realtime'
import { FRESH_SESSION_CONTENT_TIMEOUT } from './support/timeouts'

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

/**
 * Registra por qué se recargó una pestaña, si se recarga.
 *
 * La garantía que mide esta prueba —"nadie recargó"— se comprobaba con una
 * marca en `window`, y una marca perdida no dice quién la borró: puede ser la
 * aplicación (un defecto) o el servidor de desarrollo de Vite, que emite un
 * full-reload a **todos** los clientes conectados cuando descubre una
 * dependencia nueva y la re-optimiza. Con esto, el fallo trae su causa.
 */
function observarRecargas(page: Page) {
  const navegaciones: string[] = []
  const avisosVite: string[] = []

  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) {
      navegaciones.push(frame.url())
    }
  })
  page.on('console', (message) => {
    const texto = message.text()
    if (texto.includes('[vite]')) {
      avisosVite.push(texto)
    }
  })

  return {
    /** Navegaciones desde que se armó la marca; la primera es la propia página. */
    resumen: () => `navegaciones=${navegaciones.length} vite=${JSON.stringify(avisosVite.slice(-4))}`,
    /** ¿Fue Vite quien la recargó? Lo anuncia por consola antes de hacerlo. */
    recargaDeVite: () =>
      avisosVite.some((aviso) => /reload|optimized dependencies|new dependencies/i.test(aviso)),
    reiniciar: () => {
      navegaciones.length = 0
      avisosVite.length = 0
    }
  }
}

/**
 * Comprueba que la pestaña no se recargó, distinguiendo quién lo hizo.
 *
 * El servidor de desarrollo de Vite emite un full-reload a **todos** los
 * clientes conectados cuando descubre una dependencia nueva y la re-optimiza.
 * Con la suite completa eso pasa de vez en cuando —otra spec entra a una ruta
 * que carga un chunk nuevo mientras estas dos pestañas están abiertas— y
 * tumbaba esta prueba una de cada cuatro corridas por algo que no es del
 * producto. Aislada nunca fallaba, que es la firma del problema.
 *
 * Tolerar sin más habría sido tapar el caso que importa: que la aplicación se
 * recargue sola. Por eso solo se perdona cuando Vite lo anunció por consola, y
 * queda anotado en el informe. Cualquier otra recarga sigue siendo un fallo.
 */
async function expectSinRecarga(
  page: Page,
  testigo: ReturnType<typeof observarRecargas>,
  etiqueta: string
) {
  const marca = await page.evaluate(() => (window as unknown as { __noReload?: boolean }).__noReload)

  if (marca !== true && testigo.recargaDeVite()) {
    test.info().annotations.push({
      type: 'infra',
      description: `Vite recargó ${etiqueta} durante la prueba — ${testigo.resumen()}`
    })
    return
  }

  expect(marca, `${etiqueta} se recargó sin que Vite lo anunciara — ${testigo.resumen()}`).toBe(true)
}

async function signInAndOpenBoard(page: Page, candidate: ProvisionedCandidate, baselineTitle: string) {
  await page.goto('/auth/sign-in')
  await page.getByPlaceholder('john.doe@empresa.com.do').fill(candidate.email)
  await page.getByPlaceholder('Tu contraseña').fill(candidate.password)
  await page.getByRole('button', { name: /Iniciar sesión/i }).click()
  // Usuario nuevo: puede aterrizar en /account o /account/profile (onboarding).
  await page.waitForURL(/\/account/)
  await page.goto('/account/jobs')
  // Esperar a una vacante que ya existía: confirma que el board terminó de
  // cargar antes de medir nada en vivo. El título sale de la base, no de una
  // constante — ver `resolveJobPublisher`.
  await expect(page.getByText(baselineTitle).first()).toBeVisible({
    timeout: FRESH_SESSION_CONTENT_TIMEOUT
  })
  // A partir de aquí, ninguna sesión debe recargarse: lo verificamos al final.
  await page.evaluate(() => ((window as unknown as { __noReload: boolean }).__noReload = true))
}

test.describe.serial('job board público en vivo', () => {
  test.skip(!realtimeEnvReady(), 'Define E2E_SERVICE_ROLE_KEY y E2E_SUPABASE_URL (o usa .env.local).')

  let admin: ServiceClient
  let candidate: ProvisionedCandidate | null = null
  let publisher: JobPublisher | null = null

  test.beforeAll(async () => {
    admin = createServiceClient()
    publisher = await resolveJobPublisher(admin)
    candidate = await provisionRealtimeCandidate(admin)
  })

  test.afterAll(async () => {
    await cleanupRealtimeCandidate(admin, candidate)
  })

  test('una vacante publicada aparece y desaparece en vivo en dos sesiones, sin recargar', async ({ browser }) => {
    expect(candidate).not.toBeNull()
    // Sin ninguna vacante publicada no hay board que observar. Es un salto
    // honesto: la prueba no puede concluir nada, y fallar aquí culparía al
    // producto de que la base está vacía.
    test.skip(publisher === null, 'No hay ninguna vacante publicada bajo la que publicar la de prueba.')
    const activeCandidate = candidate!
    const activePublisher = publisher!
    const unique = `Vacante Realtime ${Date.now()}`
    const slug = `vacante-realtime-${Date.now()}`
    let insertedId: string | null = null

    const contextA = await browser.newContext()
    const contextB = await browser.newContext()
    const pageA = await contextA.newPage()
    const pageB = await contextB.newPage()
    const testigoA = observarRecargas(pageA)
    const testigoB = observarRecargas(pageB)

    try {
      await signInAndOpenBoard(pageA, activeCandidate, activePublisher.baselineTitle)
      await signInAndOpenBoard(pageB, activeCandidate, activePublisher.baselineTitle)
      // Desde aquí empieza la ventana en la que nadie debe recargar.
      testigoA.reiniciar()
      testigoB.reiniciar()

      // --- Otra "empresa" publica una vacante directamente en la BD ---
      const { data, error } = await admin
        .from('job_postings')
        .insert({
          tenant_id: activePublisher.tenantId,
          company_profile_id: activePublisher.companyProfileId,
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
      await expect(pageA.getByText(unique).first()).toBeVisible()
      await expect(pageB.getByText(unique).first()).toBeVisible()

      // --- La vacante se elimina; ambas deben dejar de mostrarla en vivo ---
      await admin.from('job_postings').delete().eq('id', insertedId)
      insertedId = null

      await expect(pageA.getByText(unique)).toHaveCount(0)
      await expect(pageB.getByText(unique)).toHaveCount(0)

      // Garantía de "en vivo": ninguna pestaña se recargó durante la prueba.
      await expectSinRecarga(pageA, testigoA, 'la pestaña A')
      await expectSinRecarga(pageB, testigoB, 'la pestaña B')
    } finally {
      if (insertedId) {
        await admin.from('job_postings').delete().eq('id', insertedId)
      }
      await contextA.close()
      await contextB.close()
    }
  })
})
