import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AppProviders } from '@/app/providers/app-providers'
import { appRoutes } from '@/app/router/routes'
import { surfacePaths } from '@/app/router/surface-paths'
import {
  ELIGIBILITY_DRAFT_STORAGE_KEY,
  ELIGIBILITY_SESSION_KEY,
} from '@/experiences/institutional/content/eligibility-content'

const authState = {
  session: null as null | { user: { id: string; email?: string } },
  snapshot: {
    profile: null,
    memberships: [],
    permissions: [],
    platformPermissions: [],
    isPlatformAdmin: false,
  } as {
    profile: { id: string; email: string; is_internal_developer: boolean } | null
    memberships: Array<{
      id: string
      tenantId: string
      tenantName: string
      tenantSlug: string
      roleCodes: string[]
      roleNames: string[]
      permissions: string[]
    }>
    permissions: string[]
    platformPermissions: string[]
    isPlatformAdmin: boolean
  },
}

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(() =>
        Promise.resolve({
          data: {
            session: authState.session,
          },
        })
      ),
      onAuthStateChange: vi.fn(() => ({
        data: {
          subscription: {
            unsubscribe: vi.fn(),
          },
        },
      })),
    },
  },
}))

vi.mock('@/features/auth/lib/auth-api', async () => {
  const actual =
    await vi.importActual<typeof import('@/features/auth/lib/auth-api')>(
      '@/features/auth/lib/auth-api'
    )

  return {
    ...actual,
    fetchSessionSnapshot: vi.fn(() => Promise.resolve(authState.snapshot)),
  }
})

function renderRoute(initialEntry: string) {
  const router = createMemoryRouter(appRoutes, {
    initialEntries: [initialEntry],
  })

  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  )
}

function renderRouteEntry(entry: string | { pathname: string; state?: unknown }) {
  const router = createMemoryRouter(appRoutes, {
    initialEntries: [entry],
  })

  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  )
}

function saveEligibilityToken(token: {
  category: string
  categorySlug: string
  dues: string
}) {
  window.sessionStorage.setItem(
    ELIGIBILITY_SESSION_KEY,
    JSON.stringify({
      eligible: true,
      timestamp: Date.now(),
      ...token,
    })
  )
}

async function completeContactStep() {
  fireEvent.change(await screen.findByRole('textbox', { name: /nombre\*/i }), {
    target: { value: 'Ana' },
  })
  fireEvent.change(screen.getByRole('textbox', { name: /apellido/i }), {
    target: { value: 'Pérez' },
  })
  const genderButton = screen
    .getAllByRole('button', { name: /masculino/i })
    .find((button) => button.textContent === 'Masculino')

  expect(genderButton).toBeDefined()
  fireEvent.click(genderButton as HTMLElement)
  fireEvent.change(screen.getByRole('textbox', { name: /teléfono celular/i }), {
    target: { value: '809-555-2222' },
  })
  fireEvent.change(screen.getByRole('textbox', { name: /correo electrónico/i }), {
    target: { value: 'ana@example.com' },
  })
  fireEvent.change(screen.getByRole('textbox', { name: /^dirección del hogar\*/i }), {
    target: { value: 'Calle 1, Santo Domingo' },
  })
  fireEvent.change(screen.getByRole('textbox', { name: /^ciudad\*/i }), {
    target: { value: 'Santo Domingo' },
  })
  fireEvent.change(screen.getByRole('textbox', { name: /provincia o estado/i }), {
    target: { value: 'Distrito Nacional' },
  })
  fireEvent.change(screen.getByRole('textbox', { name: /código postal/i }), {
    target: { value: '10101' },
  })
  fireEvent.click(screen.getByRole('button', { name: /siguiente/i }))
}

beforeEach(() => {
  authState.session = null
  authState.snapshot = {
    profile: null,
    memberships: [],
    permissions: [],
    platformPermissions: [],
    isPlatformAdmin: false,
  }
  window.sessionStorage.clear()
  window.localStorage.clear()
})

describe('institutional membership application flow', () => {
  it('redirects back to the eligibility wizard when there is no valid eligibility token', async () => {
    renderRoute(surfacePaths.institutional.membershipApply)

    expect(
      await screen.findByRole('heading', { name: 'Verificación de Elegibilidad' })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Solicitud de membresía ASI' })
    ).not.toBeInTheDocument()
  })

  it('renders the organizational application when the eligibility result qualifies an organization', async () => {
    saveEligibilityToken({
      category: 'Organizacional Con Fines de Lucro',
      categorySlug: 'organizational-for-profit',
      dues: '$250',
    })

    renderRoute(surfacePaths.institutional.membershipApply)

    expect(
      await screen.findByRole('heading', { name: 'Solicitud de membresía ASI' })
    ).toBeInTheDocument()
    expect(screen.getByText('Fase 1 de 6')).toBeInTheDocument()
    expect(
      screen.getByRole('progressbar', { name: /progreso de solicitud 0%/i })
    ).toBeInTheDocument()
    expect(
      screen.getByText(/La recepcion de solicitudes de membresia esta cerrada temporalmente/i)
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /\+2 más/i }))
    expect(screen.getByText('Requisitos adicionales')).toBeInTheDocument()
    expect(
      screen.getByText(/la organización no debe ser propiedad/i)
    ).toBeInTheDocument()
    const femaleGenderButton = screen.getByRole('button', { name: 'Femenino' })
    const maleGenderButton = screen.getByRole('button', { name: 'Masculino' })

    expect(femaleGenderButton).toHaveAttribute('aria-pressed', 'false')
    expect(maleGenderButton).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(screen.getByText('Género'))
    expect(femaleGenderButton).toHaveAttribute('aria-pressed', 'false')
    expect(maleGenderButton).toHaveAttribute('aria-pressed', 'false')

    await completeContactStep()

    expect(await screen.findByText('Fase 2 de 6')).toBeInTheDocument()
    expect(
      screen.getByRole('textbox', { name: /nombre de la organización/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('textbox', {
        name: /describe brevemente las actividades de la organización/i,
      })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('combobox', { name: /etapa actual/i })
    ).not.toBeInTheDocument()
  })

  it('renders the young professional application when the eligibility result qualifies a young professional', async () => {
    saveEligibilityToken({
      category: 'Joven Profesional',
      categorySlug: 'young-professional',
      dues: '$25',
    })

    renderRoute(surfacePaths.institutional.membershipApply)

    expect(
      await screen.findByRole('heading', { name: 'Solicitud de membresía ASI' })
    ).toBeInTheDocument()

    await completeContactStep()

    expect(
      await screen.findByRole('combobox', { name: /etapa actual/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('textbox', { name: /institución o emprendimiento/i })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('textbox', { name: /nombre de la organización/i })
    ).not.toBeInTheDocument()
  })

  it('renders the application when the eligibility token arrives through route state', async () => {
    renderRouteEntry({
      pathname: surfacePaths.institutional.membershipApply,
      state: {
        eligibilityToken: {
          eligible: true,
          category: 'Propietario Individual',
          categorySlug: 'sole-proprietor',
          dues: '$200',
        },
      },
    })

    expect(
      await screen.findByRole('heading', { name: 'Solicitud de membresía ASI' })
    ).toBeInTheDocument()

    await completeContactStep()

    expect(
      await screen.findByRole('textbox', { name: /nombre del negocio o práctica/i })
    ).toBeInTheDocument()
  })

  it('opens the filtered application after completing the eligibility wizard', async () => {
    renderRoute(surfacePaths.institutional.eligibility)

    fireEvent.click(
      await screen.findByRole('button', {
        name: /sí/i,
      })
    )

    fireEvent.click(
      await screen.findByRole('button', {
        name: /unión dominicana/i,
      })
    )

    fireEvent.click(
      await screen.findByRole('button', {
        name: /yo personalmente/i,
      })
    )

    fireEvent.click(
      await screen.findByRole('button', {
        name: /no/i,
      })
    )

    fireEvent.click(
      await screen.findByRole('button', {
        name: /joven profesional/i,
      })
    )

    fireEvent.click(
      await screen.findByRole('button', {
        name: /continuar con la solicitud/i,
      })
    )

    expect(
      await screen.findByRole('heading', { name: 'Solicitud de membresía ASI' })
    ).toBeInTheDocument()

    await completeContactStep()

    expect(
      await screen.findByRole('combobox', { name: /etapa actual/i })
    ).toBeInTheDocument()
  })

  it('restores the eligibility wizard draft after leaving the page', async () => {
    renderRoute(surfacePaths.institutional.eligibility)

    fireEvent.click(await screen.findByRole('button', { name: /sí/i }))
    fireEvent.click(await screen.findByRole('button', { name: /unión dominicana/i }))
    fireEvent.click(await screen.findByRole('button', { name: /yo personalmente/i }))
    fireEvent.click(await screen.findByRole('button', { name: /no/i }))
    fireEvent.click(await screen.findByRole('button', { name: /empleado/i }))

    expect(
      await screen.findByRole('heading', {
        name: /autoridad para contratar o despedir empleados/i,
      })
    ).toBeInTheDocument()

    cleanup()
    renderRoute(surfacePaths.institutional.eligibility)

    expect(
      await screen.findByRole('heading', {
        name: /autoridad para contratar o despedir empleados/i,
      })
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /atrás/i }))

    expect(
      await screen.findByRole('heading', {
        name: /actualmente empleado, jubilado o es un joven profesional/i,
      })
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^empleado/i })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
  })

  it('clears the eligibility draft only when continuing to the application', async () => {
    renderRoute(surfacePaths.institutional.eligibility)

    fireEvent.click(await screen.findByRole('button', { name: /sí/i }))
    fireEvent.click(await screen.findByRole('button', { name: /unión dominicana/i }))
    fireEvent.click(await screen.findByRole('button', { name: /yo personalmente/i }))
    fireEvent.click(await screen.findByRole('button', { name: /no/i }))
    fireEvent.click(await screen.findByRole('button', { name: /joven profesional/i }))

    expect(
      await screen.findByRole('heading', { name: 'Joven Profesional' })
    ).toBeInTheDocument()

    expect(window.localStorage.getItem(ELIGIBILITY_DRAFT_STORAGE_KEY)).not.toBeNull()

    fireEvent.click(
      await screen.findByRole('button', { name: /continuar con la solicitud/i })
    )

    expect(
      await screen.findByRole('heading', { name: 'Solicitud de membresía ASI' })
    ).toBeInTheDocument()
    expect(window.localStorage.getItem(ELIGIBILITY_DRAFT_STORAGE_KEY)).toBeNull()
  })
})
