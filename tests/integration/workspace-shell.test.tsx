import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CandidateShell } from '@/experiences/app/layouts/candidate-shell'
import { EmployerShell } from '@/experiences/app/layouts/employer-shell'
import { AppProviders } from '@/app/providers/app-providers'
import { surfacePaths } from '@/app/router/surface-paths'
import { fetchMyNotifications, fetchMyNotificationsPage, markNotificationRead, markNotificationUnread } from '@/lib/notifications/api'
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
    fetchMyNotifications: vi.fn((limit: number = 6, recipientUserId?: string | null) =>
      Promise.resolve(notificationState.items.filter((item) => !recipientUserId || item.recipient_user_id === recipientUserId).slice(0, limit))
    ),
    fetchMyNotificationsPage: vi.fn((options: { page?: number; pageSize?: number; recipientUserId?: string | null } = {}) => {
      const pageSize = options.pageSize ?? 6
      const page = options.page ?? 1
      const from = (page - 1) * pageSize
      const items = notificationState.items.filter((item) => !options.recipientUserId || item.recipient_user_id === options.recipientUserId)

      return Promise.resolve({
        notifications: items.slice(from, from + pageSize),
        totalCount: items.length,
        unreadCount: items.filter((item) => !item.read_at).length
      })
    }),
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
    ),
    markNotificationUnread: vi.fn((notificationId: string) =>
      Promise.resolve(
        notificationState.items.find((item) => item.id === notificationId) ?? {
          id: notificationId,
          title: '',
          body: '',
          action_url: null,
          read_at: null,
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

function renderWorkspaceShell(initialEntry: string = surfacePaths.workspace.root) {
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
        element: <div>Landing pública</div>
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

function renderCandidateShell(initialEntry: string = surfacePaths.candidate.profile) {
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

function seedWorkspaceInternalDeveloperSession(permissions: string[]) {
  seedWorkspaceSession(permissions)
  if (authState.snapshot.profile) {
    authState.snapshot.profile.is_internal_developer = true
  }
}

function isActiveNavigationButton(button: HTMLElement) {
  return button.getAttribute('data-active') === 'true' && button.getAttribute('aria-current') === 'page'
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
  vi.mocked(fetchMyNotificationsPage).mockClear()
  vi.mocked(markNotificationRead).mockClear()
  vi.mocked(markNotificationUnread).mockClear()
  vi.mocked(signOutCurrentUser).mockClear()
})

describe('workspace shell', () => {
  it('renders the premium workspace navigation with all permitted destinations', async () => {
    seedWorkspaceSession(['workspace:read', 'candidate_directory:read', 'application:read', 'role:read'])
    renderWorkspaceShell()

    expect((await screen.findAllByText('Plataforma ASI')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Acme').length).toBeGreaterThan(0)
    // Base unificada (Tu espacio) + módulos de empresa (Mi empresa)
    expect(screen.getAllByText('Inicio').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Perfil').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Resumen').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Vacantes').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Candidatos').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Pipeline').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Abrir notificaciones' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Abrir menu de perfil' })).toBeInTheDocument()
  })

  it('hides unauthorized workspace destinations when permissions are partial', async () => {
    seedWorkspaceSession(['workspace:read'])
    renderWorkspaceShell()

    expect(await screen.findByText('Resumen del workspace')).toBeInTheDocument()
    // Visibles con solo workspace:read
    expect(screen.getAllByText('Resumen').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Vacantes').length).toBeGreaterThan(0)
    // Ocultos sin sus permisos (candidate_directory:read / application:read)
    expect(screen.queryByText('Candidates del workspace')).not.toBeInTheDocument()
    expect(screen.queryByText('Pipeline del workspace')).not.toBeInTheDocument()
    expect(screen.queryAllByText('Candidatos')).toHaveLength(0)
    expect(screen.queryAllByText('Pipeline')).toHaveLength(0)
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

  it('toggles a notification from read to unread', async () => {
    seedWorkspaceSession(['workspace:read'])
    notificationState.items = [
      {
        id: 'notification-read',
        recipient_user_id: 'user-1',
        tenant_id: 'tenant-1',
        type: 'system.test',
        title: 'Actividad revisada',
        body: 'Esta notificación ya fue leída.',
        action_url: null,
        payload: {},
        read_at: '2026-03-19T12:10:00.000Z',
        clicked_at: null,
        created_at: '2026-03-19T12:00:00.000Z',
        updated_at: '2026-03-19T12:10:00.000Z'
      }
    ]

    renderWorkspaceShell()

    fireEvent.click(await screen.findByRole('button', { name: 'Abrir notificaciones' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Marcar no leida' }))

    await waitFor(() => {
      expect(markNotificationUnread).toHaveBeenCalledWith('notification-read')
    })
  })

  it('only lists notifications addressed to the authenticated user', async () => {
    seedWorkspaceSession(['workspace:read', 'notification:manage'])
    notificationState.items = [
      {
        id: 'notification-own',
        recipient_user_id: 'user-1',
        tenant_id: 'tenant-1',
        type: 'system.test',
        title: 'Tu notificación',
        body: 'Esta sí se puede marcar desde la campana personal.',
        action_url: null,
        payload: {},
        read_at: null,
        clicked_at: null,
        created_at: '2026-03-19T12:00:00.000Z',
        updated_at: '2026-03-19T12:00:00.000Z'
      },
      {
        id: 'notification-other',
        recipient_user_id: 'user-2',
        tenant_id: 'tenant-1',
        type: 'system.test',
        title: 'Notificación de otro usuario',
        body: 'Un manager podría verla por RLS, pero no debe aparecer aquí.',
        action_url: null,
        payload: {},
        read_at: null,
        clicked_at: null,
        created_at: '2026-03-19T12:01:00.000Z',
        updated_at: '2026-03-19T12:01:00.000Z'
      }
    ]

    renderWorkspaceShell()

    fireEvent.click(await screen.findByRole('button', { name: 'Abrir notificaciones' }))

    expect(await screen.findByText('Tu notificación')).toBeInTheDocument()
    expect(screen.queryByText('Notificación de otro usuario')).not.toBeInTheDocument()
    expect(vi.mocked(fetchMyNotificationsPage)).toHaveBeenCalledWith({
      page: 1,
      pageSize: 8,
      recipientUserId: 'user-1'
    })
  })

  it('paginates the notification popover', async () => {
    seedWorkspaceSession(['workspace:read'])
    notificationState.items = Array.from({ length: 10 }, (_, index) => ({
      id: `notification-${index + 1}`,
      recipient_user_id: 'user-1',
      tenant_id: 'tenant-1',
      type: 'system.test',
      title: `Notificación ${index + 1}`,
      body: `Detalle ${index + 1}`,
      action_url: null,
      payload: {},
      read_at: new Date().toISOString(),
      clicked_at: null,
      created_at: `2026-03-${String(20 - index).padStart(2, '0')}T12:00:00.000Z`,
      updated_at: `2026-03-${String(20 - index).padStart(2, '0')}T12:00:00.000Z`
    }))

    renderWorkspaceShell()

    fireEvent.click(await screen.findByRole('button', { name: 'Abrir notificaciones' }))

    expect(await screen.findByText('Notificación 1')).toBeInTheDocument()
    expect(screen.getByText('1-8 de 10')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Notificaciones siguientes' }))

    expect(await screen.findByText('Notificación 9')).toBeInTheDocument()
    expect(screen.getByText('9-10 de 10')).toBeInTheDocument()
    expect(vi.mocked(fetchMyNotificationsPage)).toHaveBeenCalledWith({
      page: 2,
      pageSize: 8,
      recipientUserId: 'user-1'
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

    fireEvent.click(await screen.findByRole('button', { name: 'Contraer sidebar de plataforma' }))

    expect(await screen.findByRole('button', { name: 'Expandir sidebar de plataforma' })).toBeInTheDocument()
    expect(window.localStorage.getItem('asi:workspace-sidebar-collapsed:v1')).toBe('1')
  })

  it('supports sign out from the workspace sidebar footer', async () => {
    seedWorkspaceSession(['workspace:read', 'role:read'])
    renderWorkspaceShell()

    fireEvent.click((await screen.findAllByRole('button', { name: 'Cerrar sesión' }))[0])

    await waitFor(() => {
      expect(signOutCurrentUser).toHaveBeenCalled()
    })
    expect(await screen.findByText('Landing pública')).toBeInTheDocument()
  })

  it('reuses the shared platform chrome for the candidate área', async () => {
    seedWorkspaceSession([])
    renderCandidateShell()

    expect((await screen.findAllByText('Plataforma ASI')).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Abrir notificaciones' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Abrir menu de perfil' })).toBeInTheDocument()
    expect(screen.getAllByText('Perfil').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Empleos').length).toBeGreaterThan(0)
  })

  it('keeps workspace modules visible in the unified sidebar when the user has workspace access', async () => {
    seedWorkspaceSession(['workspace:read'])
    renderCandidateShell()

    // En el sidebar unificado los módulos de empresa aparecen también en el área de candidato.
    expect(await screen.findAllByText('Resumen')).not.toHaveLength(0)
    expect(screen.getAllByText('Vacantes').length).toBeGreaterThan(0)
  })

  it('keeps the candidate base visible in the unified sidebar for authenticated users', async () => {
    seedWorkspaceSession(['workspace:read'])
    renderWorkspaceShell()

    // La base "Tu espacio" siempre está, incluso dentro del área de empresa.
    expect(await screen.findAllByText('Perfil')).not.toHaveLength(0)
    expect(screen.getAllByText('Inicio').length).toBeGreaterThan(0)
  })

  it('hides tenant role labels from non-admin users in the workspace chrome', async () => {
    seedWorkspaceSession(['workspace:read'])
    renderWorkspaceShell()

    expect(await screen.findAllByText('Ana Torres')).not.toHaveLength(0)
    expect(screen.queryByText('Owner')).not.toBeInTheDocument()
  })

  it('keeps tenant role labels hidden for internal developer sessions', async () => {
    seedWorkspaceInternalDeveloperSession(['workspace:read'])
    renderWorkspaceShell()

    expect(await screen.findAllByText('Ana Torres')).not.toHaveLength(0)
    expect(screen.queryByText('Owner')).not.toBeInTheDocument()
  })

  it('marks only the current workspace destination as active', async () => {
    seedWorkspaceSession(['workspace:read', 'candidate_directory:read', 'application:read', 'role:read'])
    renderWorkspaceShell(surfacePaths.workspace.jobs)

    const jobsButtons = await screen.findAllByRole('button', { name: 'Vacantes' })
    const dashboardButtons = screen.getAllByRole('button', { name: 'Resumen' })

    expect(jobsButtons.some((button) => isActiveNavigationButton(button))).toBe(true)
    expect(dashboardButtons.some((button) => isActiveNavigationButton(button))).toBe(false)
  })

  it('keeps only the current candidate destination active when workspace access is also visible', async () => {
    seedWorkspaceSession(['workspace:read'])
    renderCandidateShell(surfacePaths.candidate.applications)

    const applicationsButtons = await screen.findAllByRole('button', { name: 'Aplicaciones' })
    const dashboardButtons = screen.getAllByRole('button', { name: 'Resumen' })

    expect(applicationsButtons.some((button) => isActiveNavigationButton(button))).toBe(true)
    expect(dashboardButtons.some((button) => isActiveNavigationButton(button))).toBe(false)
  })
})
