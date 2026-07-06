import { fireEvent, render, screen } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AppProviders } from '@/app/providers/app-providers'
import { appRoutes } from '@/app/router/routes'
import { StorefrontShell } from '@/experiences/storefront/layouts/storefront-shell'
import { PLATFORM_REGISTRATION_LOCKED } from '@/shared/config/launch-access'

const guestRegistrationActionName = PLATFORM_REGISTRATION_LOCKED ? 'Registro cerrado' : 'Crear cuenta'

const authState = {
  session: null as null | { user: { id: string; email?: string } },
  snapshot: {
    profile: null,
    memberships: [],
    permissions: [],
    platformPermissions: [],
    isPlatformAdmin: false
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
  }
}

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(() =>
        Promise.resolve({
          data: {
            session: authState.session
          }
        })
      ),
      onAuthStateChange: vi.fn(() => ({
        data: {
          subscription: {
            unsubscribe: vi.fn()
          }
        }
      }))
    },
    channel: vi.fn(() => {
      const channel = {
        on: vi.fn(() => channel),
        subscribe: vi.fn(() => channel)
      }

      return channel
    }),
    removeChannel: vi.fn(() => Promise.resolve({ error: null }))
  }
}))

vi.mock('@/features/auth/lib/auth-api', async () => {
  const actual = await vi.importActual<typeof import('@/features/auth/lib/auth-api')>('@/features/auth/lib/auth-api')

  return {
    ...actual,
    fetchSessionSnapshot: vi.fn(() => Promise.resolve(authState.snapshot))
  }
})

function renderWithProviders(router: ReturnType<typeof createMemoryRouter>) {
  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  )
}

function renderPublicShell(initialEntry = '/platform') {
  const router = createMemoryRouter(
    [
      {
        path: '/platform',
        element: <StorefrontShell />,
        children: [
          {
            index: true,
            element: <div>Public content</div>
          }
        ]
      }
    ],
    {
      initialEntries: [initialEntry]
    }
  )

  renderWithProviders(router)
}

beforeEach(() => {
  authState.session = null
  authState.snapshot = {
    profile: null,
    memberships: [],
    permissions: [],
    platformPermissions: [],
    isPlatformAdmin: false
  }
})

describe('route shells', () => {
  it('renders the public shell with guest actions for unauthenticated visitors', async () => {
    renderPublicShell()

    // El brand es el logo (link a home con el alt de la marca).
    expect(await screen.findByRole('link', { name: /ASI República Dominicana/i })).toBeInTheDocument()
    // Navegación de marketing (anclas), no destinos de producto.
    expect(screen.getByRole('link', { name: '¿Cómo funciona?' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'FAQ' })).toBeInTheDocument()
    // "ASI institucional" e "Iniciar sesión" navegan → son links, no botones.
    expect(screen.getByRole('link', { name: 'ASI institucional' })).toBeInTheDocument()
    const guestRegistrationAction = screen.getByRole('button', { name: guestRegistrationActionName })
    expect(guestRegistrationAction).toBeInTheDocument()
    if (PLATFORM_REGISTRATION_LOCKED) {
      expect(guestRegistrationAction).toBeDisabled()
    } else {
      expect(guestRegistrationAction).toBeEnabled()
    }
    expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toBeInTheDocument()
  })

  it('shows only workspace access for authenticated users with workspace permissions, including mobile menu', async () => {
    authState.session = { user: { id: 'user-1', email: 'recruiter@example.com' } }
    authState.snapshot = {
      profile: {
        id: 'user-1',
        email: 'recruiter@example.com',
        is_internal_developer: false
      },
      memberships: [
        {
          id: 'membership-1',
          tenantId: 'tenant-1',
          tenantName: 'Acme',
          tenantSlug: 'acme',
          roleCodes: [],
          roleNames: [],
          permissions: ['workspace:read']
        }
      ],
      permissions: ['workspace:read'],
      platformPermissions: [],
      isPlatformAdmin: false
    }

    renderPublicShell()

    expect(await screen.findByRole('link', { name: 'Abrir mi workspace' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Crear cuenta' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Abrir menú' }))

    expect(await screen.findAllByRole('link', { name: 'Abrir mi workspace' })).toHaveLength(2)
    expect(screen.queryByRole('button', { name: 'Crear cuenta' })).not.toBeInTheDocument()
  })

  it('shows only profile access for authenticated users without workspace permissions, including mobile menu', async () => {
    authState.session = { user: { id: 'user-2', email: 'candidate@example.com' } }
    authState.snapshot = {
      profile: {
        id: 'user-2',
        email: 'candidate@example.com',
        is_internal_developer: false
      },
      memberships: [],
      permissions: [],
      platformPermissions: [],
      isPlatformAdmin: false
    }

    renderPublicShell()

    expect(await screen.findByRole('link', { name: 'Mi perfil' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Crear cuenta' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Abrir menú' }))

    expect(await screen.findAllByRole('link', { name: 'Mi perfil' })).toHaveLength(2)
    expect(screen.queryByRole('button', { name: 'Crear cuenta' })).not.toBeInTheDocument()
  })

  it('renders auth as an isolated shell', async () => {
    const router = createMemoryRouter(appRoutes, {
      initialEntries: ['/auth/sign-in']
    })

    renderWithProviders(router)

    expect(await screen.findByRole('heading', { name: 'Bienvenida de vuelta' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Plataforma ASI/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/Hiring workspace para empresas y equipos de selección/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ver pricing' })).not.toBeInTheDocument()
  })

})
