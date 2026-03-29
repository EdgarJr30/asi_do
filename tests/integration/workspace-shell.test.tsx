import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CandidateShell } from '@/experiences/app/layouts/candidate-shell'
import { EmployerShell } from '@/experiences/app/layouts/employer-shell'
import { AppProviders } from '@/app/providers/app-providers'
import { surfacePaths } from '@/app/router/surface-paths'
import { fetchMyNotifications, markNotificationRead } from '@/lib/notifications/api'
import { signOutCurrentUser } from '@/features/auth/lib/auth-api'

const authState = {
  session: null as null | { user: { id: string; email?: string } },
  snapshot: {
    profile: null,
    memberships: [],
    permissions: [],
    platformPermissions: [],
    isPlatformAdmin: false
  } as {
    profile: { id: string; email: string; full_name?: string; display_name?: string; is_internal_developer: boolean } | null
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

const notificationState = {
  items: [] as Array<{
    id: string
    title: string
    body: string
    action_url: string | null
    read_at: string | null
    clicked_at: string | null
    created_at: string
    updated_at: string
    recipient_user_id: string
    tenant_id: string | null
    type: string
    payload: Record<string, unknown>
  }>
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
    }
  }
}))

vi.mock('@/features/auth/lib/auth-api', async () => {
  const actual = await vi.importActual<typeof import('@/features/auth/lib/auth-api')>('@/features/auth/lib/auth-api')

  return {
    ...actual,
    fetchSessionSnapshot: vi.fn(() => Promise.resolve(authState.snapshot)),
    signOutCurrentUser: vi.fn(() => Promise.resolve())
  }
})

vi.mock('@/lib/notifications/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/notifications/api')>('@/lib/notifications/api')

  return {
    ...actual,
    fetchMyNotifications: vi.fn(() => Promise.resolve(notificationState.items)),
    markNotificationRead: vi.fn((notificationId: string) =>
      Promise.resolve(
        notificationState.items.find((item) => item.id === notificationId) ?? {
          id: notificationId,
          title: '',
          body: '',
          action_url: null,
          read_at: new Date().toISOString(),
          clicked_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          recipient_user_id: 'user-1',
          tenant_id: null,
          type: 'system.test',
          payload: {}
        }
      )
    )
  }
})

function renderWorkspaceShell(initialEntry = surfacePaths.workspace.root) {
  const router = createMemoryRouter(
    [
      {
        path: surfacePaths.workspace.root,
        element: <EmployerShell />,
        children: [
          {
            index: true,
            element: <div>Resumen del workspace</div>
          },
          {
            path: 'jobs',
            element: <div>Jobs del workspace</div>
          },
          {
            path: 'talent',
            element: <div>Candidates del workspace</div>
          },
          {
            path: 'pipeline',
            element: <div>Pipeline del workspace</div>
          },
          {
            path: 'settings/access',
            element: <div>Roles del workspace</div>
          }
        ]
      },
      {
        path: surfacePaths.candidate.profile,
        element: <div>Perfil candidato</div>
      },
      {
        path: surfacePaths.public.home,
        element: <div>Landing publica</div>
      }
    ],
    {
      initialEntries: [initialEntry]
    }
  )

  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  )
}

function renderCandidateShell(initialEntry = surfacePaths.candidate.profile) {
  const router = createMemoryRouter(
    [
      {
        path: surfacePaths.candidate.root,
        element: <CandidateShell />,
        children: [
          {
            path: 'profile',
            element: <div>Perfil candidato</div>
          },
          {
            path: 'applications',
            element: <div>Aplicaciones del candidato</div>
          },
          {
            path: 'onboarding',
            element: <div>Onboarding candidato</div>
          }
        ]
      },
      {
        path: surfacePaths.storefront.jobs,
        element: <div>Jobs publicos</div>
      }
    ],
    {
      initialEntries: [initialEntry]
    }
  )

  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  )
}

function seedWorkspaceSession(permissions: string[]) {
  authState.session = { user: { id: 'user-1', email: 'owner@acme.test' } }
  authState.snapshot = {
    profile: {
      id: 'user-1',
      email: 'owner@acme.test',
      full_name: 'Ana Torres',
      display_name: 'Ana Torres',
      is_internal_developer: false
    },
    memberships: [
      {
        id: 'membership-1',
        tenantId: 'tenant-1',
        tenantName: 'Acme',
        tenantSlug: 'acme',
        roleCodes: ['owner'],
        roleNames: ['Owner'],
        permissions
      }
    ],
    permissions,
    platformPermissions: [],
    isPlatformAdmin: false
  }
}

beforeEach(() => {
  window.localStorage.clear()
  authState.session = null
  authState.snapshot = {
    profile: null,
    memberships: [],
    permissions: [],
    platformPermissions: [],
    isPlatformAdmin: false
  }
  notificationState.items = []
  vi.mocked(fetchMyNotifications).mockClear()
  vi.mocked(markNotificationRead).mockClear()
  vi.mocked(signOutCurrentUser).mockClear()
})

describe('workspace shell', () => {
  it('renders the premium workspace navigation with all permitted destinations', async () => {
    seedWorkspaceSession(['workspace:read', 'candidate_directory:read', 'application:read', 'role:read'])
    renderWorkspaceShell()

    expect(await screen.findByText('ASI para equipos')).toBeInTheDocument()
    expect(screen.queryByText('Publica vacantes, descubre talento y coordina contrataciones con una experiencia clara.')).not.toBeInTheDocument()
    expect(screen.getAllByText('Acme').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Company').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Jobs').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Candidates').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Pipeline').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Roles').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Abrir notificaciones' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Abrir menu de perfil' })).toBeInTheDocument()
  })

  it('hides unauthorized workspace destinations when permissions are partial', async () => {
    seedWorkspaceSession(['workspace:read'])
    renderWorkspaceShell()

    expect(await screen.findByText('Resumen del workspace')).toBeInTheDocument()
    expect(screen.getAllByText('Company').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Jobs').length).toBeGreaterThan(0)
    expect(screen.queryByText('Candidates del workspace')).not.toBeInTheDocument()
    expect(screen.queryByText('Pipeline del workspace')).not.toBeInTheDocument()
    expect(screen.queryByText('Roles del workspace')).not.toBeInTheDocument()
    expect(screen.queryAllByText('Candidates')).toHaveLength(0)
    expect(screen.queryAllByText('Pipeline')).toHaveLength(0)
    expect(screen.queryAllByText('Roles')).toHaveLength(0)
  })

  it('opens the notifications popover and marks unread items as read', async () => {
    seedWorkspaceSession(['workspace:read'])
    notificationState.items = [
      {
        id: 'notification-1',
        recipient_user_id: 'user-1',
        tenant_id: 'tenant-1',
        type: 'system.test',
        title: 'Nueva actividad',
        body: 'Tienes una actualización pendiente.',
        action_url: null,
        payload: {},
        read_at: null,
        clicked_at: null,
        created_at: '2026-03-19T12:00:00.000Z',
        updated_at: '2026-03-19T12:00:00.000Z'
      }
    ]

    renderWorkspaceShell()

    fireEvent.click(await screen.findByRole('button', { name: 'Abrir notificaciones' }))

    expect(await screen.findByText('Nueva actividad')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Marcar leida' }))

    await waitFor(() => {
      expect(markNotificationRead).toHaveBeenCalledWith('notification-1')
    })
  })

  it('opens the profile menu and navigates to candidate profile', async () => {
    seedWorkspaceSession(['workspace:read', 'role:read'])
    renderWorkspaceShell()

    fireEvent.click(await screen.findByRole('button', { name: 'Abrir menu de perfil' }))
    fireEvent.click(screen.getAllByRole('button', { name: 'Mi perfil' }).at(-1)!)

    expect(await screen.findByText('Perfil candidato')).toBeInTheDocument()
  })

  it('persists the desktop sidebar collapsed state', async () => {
    seedWorkspaceSession(['workspace:read', 'role:read'])
    renderWorkspaceShell()

    fireEvent.click(await screen.findByRole('button', { name: 'Contraer sidebar de workspace' }))

    expect(await screen.findByRole('button', { name: 'Expandir sidebar de workspace' })).toBeInTheDocument()
    expect(window.localStorage.getItem('asi:workspace-sidebar-collapsed:v1')).toBe('1')
  })

  it('supports sign out from the workspace sidebar footer', async () => {
    seedWorkspaceSession(['workspace:read', 'role:read'])
    renderWorkspaceShell()

    fireEvent.click((await screen.findAllByRole('button', { name: 'Cerrar sesion' }))[0])

    await waitFor(() => {
      expect(signOutCurrentUser).toHaveBeenCalled()
    })
    expect(await screen.findByText('Landing publica')).toBeInTheDocument()
  })

  it('reuses the shared platform chrome for the candidate area', async () => {
    seedWorkspaceSession([])
    renderCandidateShell()

    expect(await screen.findByText('ASI para talento')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Abrir notificaciones' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Abrir menu de perfil' })).toBeInTheDocument()
    expect(screen.getAllByText('Perfil').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Explorar jobs' })).toBeInTheDocument()
  })
})
