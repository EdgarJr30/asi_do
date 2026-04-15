import { act, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AppSessionProvider, useAppSession } from '@/app/providers/app-session-provider'

const authState = vi.hoisted(() => ({
  authCallback: null as null | ((event: string, session: { user: { id: string; email?: string } } | null) => void),
  session: {
    user: {
      id: 'user-1',
      email: 'user@example.com'
    }
  } as null | { user: { id: string; email?: string } },
  fetchSessionSnapshot: vi.fn()
}))

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
      onAuthStateChange: vi.fn((callback: NonNullable<typeof authState.authCallback>) => {
        authState.authCallback = callback

        return {
          data: {
            subscription: {
              unsubscribe: vi.fn()
            }
          }
        }
      })
    }
  }
}))

vi.mock('@/features/auth/lib/auth-api', () => ({
  fetchSessionSnapshot: authState.fetchSessionSnapshot
}))

function SessionStatus() {
  const session = useAppSession()

  if (session.isLoading) {
    return <div>Cargando sesion</div>
  }

  return <div>Sesion lista: {session.authUser?.id ?? 'anon'}</div>
}

beforeEach(() => {
  authState.session = {
    user: {
      id: 'user-1',
      email: 'user@example.com'
    }
  }
  authState.authCallback = null
  authState.fetchSessionSnapshot.mockReset()
  authState.fetchSessionSnapshot.mockResolvedValue({
    profile: {
      id: 'user-1',
      email: 'user@example.com',
      is_internal_developer: false
    },
    memberships: [],
    permissions: [],
    platformPermissions: [],
    isPlatformAdmin: false
  })
})

describe('AppSessionProvider auth refresh behavior', () => {
  it('keeps the current session mounted when Supabase refreshes the same user token', async () => {
    render(
      <AppSessionProvider>
        <SessionStatus />
      </AppSessionProvider>
    )

    expect(await screen.findByText('Sesion lista: user-1')).toBeInTheDocument()
    expect(authState.fetchSessionSnapshot).toHaveBeenCalledTimes(1)

    act(() => {
      authState.authCallback?.('TOKEN_REFRESHED', {
        user: {
          id: 'user-1',
          email: 'user@example.com'
        }
      })
    })

    expect(screen.queryByText('Cargando sesion')).not.toBeInTheDocument()
    expect(screen.getByText('Sesion lista: user-1')).toBeInTheDocument()
    expect(authState.fetchSessionSnapshot).toHaveBeenCalledTimes(1)
  })
})
