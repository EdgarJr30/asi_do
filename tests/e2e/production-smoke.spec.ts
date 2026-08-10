import { expect, test } from '@playwright/test'

/**
 * Smoke seguro para el sitio productivo.
 *
 * Este archivo no importa `support/realtime`, no recibe `service_role` y no
 * crea sesiones ni datos. Solo observa superficies públicas y un redirect de
 * visitante. Las suites que mutan Supabase pertenecen exclusivamente a local,
 * development o staging.
 */
test.describe('production read-only smoke', () => {
  test('carga las superficies públicas y conserva el cierre del área privada', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText(/Transformando vidas a través del compromiso laico y la fe/i)).toBeVisible()

    await page.goto('/platform')
    await expect(
      page.getByRole('heading', { name: /Vacantes, talento y selección en un solo lugar/i })
    ).toBeVisible()

    await page.goto('/account/jobs')
    await page.waitForURL('**/auth/sign-in**')
    await expect(page.getByRole('heading', { name: /Bienvenida de vuelta/i })).toBeVisible()

    await page.goto('/pipeline')
    await expect(page.getByRole('heading', { name: /Ups, esta página no está disponible/i, level: 1 })).toBeVisible()
  })
})
