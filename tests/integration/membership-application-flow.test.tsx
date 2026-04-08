import { render, screen } from '@testing-library/react'
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
    expect(
      screen.getByRole('combobox', { name: /etapa actual/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('textbox', { name: /institución o emprendimiento/i })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('textbox', { name: /nombre de la organización/i })
    ).not.toBeInTheDocument()
  })
})
