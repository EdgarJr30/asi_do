import { expect, test } from '@playwright/test'

const hasLiveAuth = Boolean(process.env.E2E_SIGNUP_EMAIL && process.env.E2E_SIGNUP_PASSWORD)
const candidateProfilePath = '/candidate/profile'
const candidateRecruiterRequestPath = '/candidate/recruiter-request'
const candidateApplicationsPath = '/candidate/applications'
const workspacePipelinePath = '/workspace/pipeline'

test.describe('public shell smoke', () => {
  test('loads the institutional home and gates the members-only job board', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText(/Transformando vidas a través del compromiso laico y la fe/i)).toBeVisible()

    await page.goto('/platform')
    await expect(
      page.getByRole('heading', { name: /Vacantes, talento y selección en un solo lugar/i })
    ).toBeVisible()

    // El job board (/platform/jobs) está detrás de RequireActiveAsiAccess: un
    // visitante sin sesión activa es redirigido a iniciar sesión.
    await page.goto('/platform/jobs')
    await page.waitForURL('**/auth/sign-in**', { timeout: 15_000 })
    await expect(page.getByRole('heading', { name: /Bienvenida de vuelta/i })).toBeVisible()
  })

  test('treats removed legacy routes as no longer part of the public contract', async ({ page }) => {
    await page.goto('/pipeline')
    await expect(page.getByRole('heading', { name: /Ups, esta página no está disponible/i, level: 1 })).toBeVisible()
  })
})

if (hasLiveAuth) {
  test.describe('mvp authenticated smoke', () => {
    test('covers auth callback shell, profile setup, recruiter request, applications, and pipeline surfaces', async ({
      page
    }) => {
      await page.goto('/auth')
      await expect(page.getByText('Crea tu usuario base')).toBeVisible()

      await page.goto(`/auth/confirm?next=${encodeURIComponent(candidateProfilePath)}`)
      await expect(page.getByText(/confirmacion|callback/i)).toBeVisible()

      await page.goto('/candidate/onboarding')
      await expect(page).toHaveURL(new RegExp(`${candidateProfilePath}$`))

      await page.goto(candidateProfilePath)
      await expect(page.getByText(/Dejemos tu cuenta lista|Perfil candidato/i)).toBeVisible()

      await page.goto(candidateRecruiterRequestPath)
      await expect(page.getByText(/Solicitud recruiter|validación/i)).toBeVisible()

      await page.goto(candidateApplicationsPath)
      await expect(page.getByText(/Revisa tu avance|Applications/i)).toBeVisible()

      await page.goto(workspacePipelinePath)
      await expect(page.getByText(/Pipeline|applicants/i)).toBeVisible()
    })
  })
} else {
  test.describe.skip('mvp authenticated smoke', () => {
  test('covers auth callback shell, profile setup, recruiter request, applications, and pipeline surfaces', async ({
    page
  }) => {
    await page.goto('/auth')
    await expect(page.getByText('Crea tu usuario base')).toBeVisible()

    await page.goto(`/auth/confirm?next=${encodeURIComponent(candidateProfilePath)}`)
    await expect(page.getByText(/confirmacion|callback/i)).toBeVisible()

    await page.goto('/candidate/onboarding')
    await expect(page).toHaveURL(new RegExp(`${candidateProfilePath}$`))

    await page.goto(candidateProfilePath)
    await expect(page.getByText(/Dejemos tu cuenta lista|Perfil candidato/i)).toBeVisible()

    await page.goto(candidateRecruiterRequestPath)
    await expect(page.getByText(/Solicitud recruiter|validación/i)).toBeVisible()

    await page.goto(candidateApplicationsPath)
    await expect(page.getByText(/Revisa tu avance|Applications/i)).toBeVisible()

    await page.goto(workspacePipelinePath)
    await expect(page.getByText(/Pipeline|applicants/i)).toBeVisible()
  })
  })
}
