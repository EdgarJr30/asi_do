import { fireEvent, render, screen } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AppProviders } from '@/app/providers/app-providers'
import { appRoutes } from '@/app/router/routes'
import { surfacePaths } from '@/app/router/surface-paths'
import { ELIGIBILITY_SESSION_KEY } from '@/experiences/institutional/content/eligibility-content'

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
    channel: vi.fn(() => {
      const channel = {
        on: vi.fn(() => channel),
        subscribe: vi.fn(() => channel),
      }

      return channel
    }),
    removeChannel: vi.fn(() => Promise.resolve({ error: null })),
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

// El apply-page consulta la solicitud del servidor para decidir el gate; sin mock
// la query queda en loading (retry) y solo se ve el loader. Resolvemos vacío para
// que el formulario (fuente del token de cliente) se renderice.
vi.mock('@/features/membership/lib/membership-api', async () => {
  const actual =
    await vi.importActual<typeof import('@/features/membership/lib/membership-api')>(
      '@/features/membership/lib/membership-api'
    )

  return {
    ...actual,
    fetchMyMembershipStatus: vi.fn(() =>
      Promise.resolve({
        application: null,
        payment: null,
        verifiedPayment: null,
        verifiedPayments: [],
        settings: null,
      })
    ),
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

// El formulario de solicitud ahora exige cuenta (gate frictionless: todo el
// pipeline se ata a requester_user_id). Sin sesión, la página muestra el gate
// "Crea tu cuenta" en vez del formulario. Estos tests, centrados en el formulario,
// siembran una sesión autenticada para pasar el gate.
function seedAuthenticatedApplicant() {
  authState.session = { user: { id: 'user-applicant', email: 'applicant@example.com' } }
  authState.snapshot = {
    profile: { id: 'user-applicant', email: 'applicant@example.com', is_internal_developer: false },
    memberships: [],
    permissions: [],
    platformPermissions: [],
    isPlatformAdmin: false,
  }
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
  // El género es un radiogroup (role="radio"), no botones.
  fireEvent.click(screen.getByRole('radio', { name: /masculino/i }))
  fireEvent.change(screen.getByRole('textbox', { name: /teléfono celular/i }), {
    target: { value: '809-555-2222' },
  })
  fireEvent.change(screen.getByRole('textbox', { name: /correo electrónico/i }), {
    target: { value: 'ana@example.com' },
  })
  fireEvent.change(screen.getByRole('combobox', { name: /provincia o estado/i }), {
    target: { value: 'Distrito Nacional' },
  })
  fireEvent.change(screen.getByRole('combobox', { name: /^ciudad\*/i }), {
    target: { value: 'Santo Domingo' },
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
  it('redirects to the category selector when there is no valid eligibility token', async () => {
    renderRoute(surfacePaths.institutional.membershipApply)

    // Depende de un redirect asíncrono → damos margen para evitar flakiness bajo carga.
    expect(
      await screen.findByRole(
        'heading',
        { name: /elige tu categoría de membresía/i },
        { timeout: 5000 }
      )
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Solicitud de membresía' })
    ).not.toBeInTheDocument()
  })

  it('renders the organizational application for the empresa category', async () => {
    seedAuthenticatedApplicant()
    saveEligibilityToken({
      category: 'Empresa',
      categorySlug: 'empresa',
      dues: 'RD$3,000.00',
    })

    renderRoute(surfacePaths.institutional.membershipApply)

    expect(
      await screen.findByRole('heading', { name: 'Solicitud de membresía' })
    ).toBeInTheDocument()
    // El indicador de fase aparece en el rail y en el cuerpo (misma etiqueta).
    expect(screen.getAllByText('Fase 1 de 6').length).toBeGreaterThan(0)
    // Género como radiogroup: ninguna opción seleccionada al inicio.
    expect(screen.getByRole('radio', { name: 'Femenino' })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByRole('radio', { name: 'Masculino' })).toHaveAttribute('aria-checked', 'false')

    await completeContactStep()

    expect((await screen.findAllByText('Fase 2 de 6')).length).toBeGreaterThan(0)
    expect(
      screen.getByRole('textbox', { name: /nombre de la organización o empresa/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('textbox', {
        name: /describe brevemente las actividades de la organización/i,
      })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('textbox', { name: /organización o empleador/i })
    ).not.toBeInTheDocument()
  })

  it('renders the professional application for the profesional category', async () => {
    seedAuthenticatedApplicant()
    saveEligibilityToken({
      category: 'Profesional',
      categorySlug: 'profesional',
      dues: 'RD$2,500.00',
    })

    renderRoute(surfacePaths.institutional.membershipApply)

    expect(
      await screen.findByRole('heading', { name: 'Solicitud de membresía' })
    ).toBeInTheDocument()

    await completeContactStep()

    expect(
      await screen.findByRole('textbox', { name: /organización o empleador/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('textbox', { name: /cargo, profesión u ocupación/i })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('textbox', { name: /nombre de la organización o empresa/i })
    ).not.toBeInTheDocument()
  })

  it('skips the category step for the laico category (personal data only)', async () => {
    seedAuthenticatedApplicant()
    saveEligibilityToken({
      category: 'Laico',
      categorySlug: 'laico',
      dues: 'RD$2,000.00',
    })

    renderRoute(surfacePaths.institutional.membershipApply)

    expect(
      await screen.findByRole('heading', { name: 'Solicitud de membresía' })
    ).toBeInTheDocument()
    // La membresía laica omite el paso de categoría → 5 pasos en lugar de 6.
    expect(screen.getAllByText('Fase 1 de 5').length).toBeGreaterThan(0)

    await completeContactStep()

    // Tras contacto, el laico va directo a Evangelismo: sin campos de categoría.
    expect(
      await screen.findByRole('textbox', {
        name: /comparte su fe en su entorno profesional/i,
      })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('textbox', { name: /organización o empleador/i })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('textbox', { name: /nombre de la organización o empresa/i })
    ).not.toBeInTheDocument()
  })

  it('renders the application when the eligibility token arrives through route state', async () => {
    seedAuthenticatedApplicant()
    renderRouteEntry({
      pathname: surfacePaths.institutional.membershipApply,
      state: {
        eligibilityToken: {
          eligible: true,
          category: 'Empresa',
          categorySlug: 'empresa',
          dues: 'RD$3,000.00',
        },
      },
    })

    expect(
      await screen.findByRole('heading', { name: 'Solicitud de membresía' })
    ).toBeInTheDocument()

    await completeContactStep()

    expect(
      await screen.findByRole('textbox', { name: /nombre de la organización o empresa/i })
    ).toBeInTheDocument()
  })

  it('opens the application after selecting a category', async () => {
    seedAuthenticatedApplicant()
    renderRoute(surfacePaths.institutional.eligibility)

    // Selecciona la tarjeta "Profesional" y continúa.
    fireEvent.click(await screen.findByRole('button', { name: /^Profesional/ }))
    fireEvent.click(
      await screen.findByRole('button', { name: /continuar con la solicitud/i })
    )

    // Depende de la navegación al formulario → margen extra para evitar flakiness.
    expect(
      await screen.findByRole('heading', { name: 'Solicitud de membresía' }, { timeout: 5000 })
    ).toBeInTheDocument()

    await completeContactStep()

    expect(
      await screen.findByRole('textbox', { name: /organización o empleador/i })
    ).toBeInTheDocument()
  })

  it('requires selecting a category before continuing', async () => {
    seedAuthenticatedApplicant()
    renderRoute(surfacePaths.institutional.eligibility)

    // Sin selección, el botón de continuar está deshabilitado.
    expect(
      await screen.findByRole('button', { name: /continuar con la solicitud/i })
    ).toBeDisabled()
  })
})
