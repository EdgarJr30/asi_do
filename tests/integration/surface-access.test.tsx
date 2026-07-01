import { render, screen } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AppProviders } from '@/app/providers/app-providers'
import { appRoutes } from '@/app/router/routes'
import { surfacePaths } from '@/app/router/surface-paths'

const authState = {
  session: null as null | { user: { id: string; email?: string } },
  snapshot: {
    profile: null,
    memberships: [],
    permissions: [],
    platformPermissions: [],
    isPlatformAdmin: false
  } as {
    profile: {
      id: string
      email: string
      full_name: string
      display_name: string
      locale: string
      country_code: string
      is_internal_developer: boolean
    } | null
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

function completeProfile(input: { id: string; email: string; isInternalDeveloper?: boolean }) {
  return {
    id: input.id,
    email: input.email,
    full_name: 'Maria Reyes',
    display_name: 'Maria Reyes',
    locale: 'es',
    country_code: 'DO',
    is_internal_developer: input.isInternalDeveloper ?? false,
    status: 'active',
    user_approval_status: 'approved',
    asi_membership_status: 'active',
    user_subscription_status: 'active',
    membership_expires_at: '2099-12-31T23:59:59.000Z',
    subscription_expires_at: '2099-12-31T23:59:59.000Z',
    manual_access_override_until: null
  }
}

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(() => Promise.resolve({
        data: {
          session: authState.session
        }
      })),
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

vi.mock('@/features/membership/lib/membership-api', () => ({
  fetchMyMembershipStatus: vi.fn(() =>
    Promise.resolve({
      application: null,
      payment: null,
      verifiedPayment: null,
      verifiedPayments: [],
      settings: null
    })
  ),
  getCategoryDue: vi.fn(() => null),
  respondMembershipApplication: vi.fn(() => Promise.resolve())
}))

function renderRoute(initialEntry: string) {
  const router = createMemoryRouter(appRoutes, {
    initialEntries: [initialEntry]
  })

  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  )
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

describe('surface access states', () => {
  it('redirects /app to the candidate home when the user has no workspace access', async () => {
    authState.session = { user: { id: 'user-0', email: 'candidate@example.com' } }
    authState.snapshot = {
      profile: completeProfile({ id: 'user-0', email: 'candidate@example.com' }),
      memberships: [],
      permissions: [],
      platformPermissions: [],
      isPlatformAdmin: false
    }

    renderRoute(surfacePaths.app.home)

    expect((await screen.findAllByText('Plataforma ASI')).length).toBeGreaterThan(0)
    expect((await screen.findAllByRole('button', { name: 'Inicio' })).length).toBeGreaterThan(0)
  })

  it('redirects /app to the workspace when the user has workspace access', async () => {
    authState.session = { user: { id: 'user-1b', email: 'recruiter@example.com' } }
    authState.snapshot = {
      profile: completeProfile({ id: 'user-1b', email: 'recruiter@example.com' }),
      memberships: [
        {
          id: 'membership-1b',
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

    renderRoute(surfacePaths.app.home)

    expect((await screen.findAllByText('Acme')).length).toBeGreaterThan(0)
    expect((await screen.findAllByText('Plataforma ASI')).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument()
  })

  it('renders candidate not-found inside the candidate shell', async () => {
    authState.session = { user: { id: 'user-1', email: 'candidate@example.com' } }
    authState.snapshot = {
      profile: completeProfile({ id: 'user-1', email: 'candidate@example.com' }),
      memberships: [],
      permissions: [],
      platformPermissions: [],
      isPlatformAdmin: false
    }

    renderRoute('/candidate/nope')

    expect((await screen.findAllByText('Plataforma ASI')).length).toBeGreaterThan(0)
    expect(await screen.findByRole('heading', { name: 'Ups, esta página no está disponible' })).toBeInTheDocument()
  })

  it('renders account membership inside the candidate shell on direct entry', async () => {
    const inactiveMemberProfile = {
      ...completeProfile({ id: 'user-membership', email: 'member@example.com' }),
      asi_membership_status: 'none',
      user_subscription_status: 'none',
      membership_expires_at: null,
      subscription_expires_at: null
    }

    authState.session = { user: { id: 'user-membership', email: 'member@example.com' } }
    authState.snapshot = {
      profile: inactiveMemberProfile,
      memberships: [],
      permissions: [],
      platformPermissions: [],
      isPlatformAdmin: false
    }

    renderRoute(surfacePaths.account.membership)

    expect((await screen.findAllByText('Plataforma ASI')).length).toBeGreaterThan(0)
    expect(await screen.findByRole('heading', { name: 'Tu membresía' })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: /Completar solicitud/i })).toBeInTheDocument()
  })

  it('renders active account membership content when the user also has workspace access', async () => {
    authState.session = { user: { id: 'user-active-member', email: 'active@example.com' } }
    authState.snapshot = {
      profile: completeProfile({ id: 'user-active-member', email: 'active@example.com' }),
      memberships: [
        {
          id: 'membership-active',
          tenantId: 'tenant-active',
          tenantName: 'Empresa de prueba',
          tenantSlug: 'empresa-prueba',
          roleCodes: [],
          roleNames: [],
          permissions: ['workspace:read']
        }
      ],
      permissions: ['workspace:read'],
      platformPermissions: [],
      isPlatformAdmin: false
    }

    renderRoute(surfacePaths.account.membership)

    expect((await screen.findAllByText('Empresa de prueba')).length).toBeGreaterThan(0)
    expect(await screen.findByRole('heading', { name: 'Tu membresía' })).toBeInTheDocument()
    expect((await screen.findAllByText('Vigencia restante')).length).toBeGreaterThan(0)
    expect(await screen.findByRole('link', { name: /Ir a contacto/i })).toBeInTheDocument()
  })

  it('renders workspace forbidden inside the workspace shell', async () => {
    authState.session = { user: { id: 'user-2', email: 'recruiter@example.com' } }
    authState.snapshot = {
      profile: completeProfile({ id: 'user-2', email: 'recruiter@example.com' }),
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

    renderRoute(surfacePaths.workspace.access)

    expect((await screen.findAllByText('Acme')).length).toBeGreaterThan(0)
    expect((await screen.findAllByText('No puedes abrir esta vista del workspace')).length).toBeGreaterThan(0)
  })

  it('renders admin forbidden inside the admin shell', async () => {
    authState.session = { user: { id: 'user-3', email: 'user@example.com' } }
    authState.snapshot = {
      profile: completeProfile({ id: 'user-3', email: 'user@example.com' }),
      memberships: [],
      permissions: [],
      platformPermissions: [],
      isPlatformAdmin: false
    }

    renderRoute(surfacePaths.admin.root)

    expect((await screen.findAllByText('Plataforma ASI')).length).toBeGreaterThan(0)
    expect((await screen.findAllByText('No puedes abrir esta vista administrativa')).length).toBeGreaterThan(0)
  })

  it('renders admin not-found inside the admin shell', async () => {
    authState.session = { user: { id: 'user-4', email: 'admin@example.com' } }
    authState.snapshot = {
      profile: completeProfile({ id: 'user-4', email: 'admin@example.com', isInternalDeveloper: true }),
      memberships: [],
      permissions: [],
      platformPermissions: [],
      isPlatformAdmin: false
    }

    renderRoute('/admin/nope')

    expect((await screen.findAllByText('Plataforma ASI')).length).toBeGreaterThan(0)
    expect(await screen.findByRole('heading', { name: 'Ups, esta página no está disponible' })).toBeInTheDocument()
  })

  it('redirects unauthenticated workspace access to sign-in', async () => {
    renderRoute(surfacePaths.workspace.root)

    expect(await screen.findByRole('heading', { name: 'Bienvenida de vuelta' })).toBeInTheDocument()
  })

  it('redirects authenticated users with missing base profile data to profile setup', async () => {
    authState.session = { user: { id: 'user-5', email: 'new@example.com' } }
    authState.snapshot = {
      profile: {
        ...completeProfile({ id: 'user-5', email: 'new@example.com' }),
        display_name: 'New user',
        locale: '',
        country_code: ''
      },
      memberships: [],
      permissions: [],
      platformPermissions: [],
      isPlatformAdmin: false
    }

    renderRoute(surfacePaths.candidate.profile)

    expect(await screen.findByRole('heading', { name: 'Dejemos tu cuenta lista' })).toBeInTheDocument()
  })
})
