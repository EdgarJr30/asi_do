import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { SignInPage } from '@/features/auth/pages/sign-in-page'
import { SignUpPage } from '@/features/auth/pages/sign-up-page'

const appSessionMock = vi.hoisted(() => ({
  value: {
    isSupabaseConfigured: true,
    isLoading: true,
    isAuthenticated: false,
    session: null,
    authUser: null,
    profile: null,
    memberships: [],
    permissions: [],
    platformPermissions: [],
    activeTenantId: null,
    activeMembership: null,
    hasMultipleWorkspaceMemberships: false,
    isPlatformAdmin: false,
    isInternalDeveloper: false,
    hasActiveAsiAccess: false,
    canAccessAdminConsole: false,
    canReviewRecruiterRequests: false,
    canReviewAppErrors: false,
    isMembershipReviewerPastor: false,
    refresh: vi.fn()
  }
}))

vi.mock('@/app/providers/app-session-provider', () => ({
  useAppSession: () => appSessionMock.value
}))

function renderAuthLoadingPage(route: string, page: React.ReactNode) {
  render(<MemoryRouter initialEntries={[route]}>{page}</MemoryRouter>)
}

describe('auth loading layout', () => {
  it('keeps the sign-in session loader bounded inside the auth form pane', () => {
    renderAuthLoadingPage('/auth/sign-in', <SignInPage />)

    expect(screen.getByRole('status')).not.toHaveClass('min-h-dvh')
  })

  it('keeps the sign-up session loader bounded inside the auth form pane', () => {
    renderAuthLoadingPage('/auth/sign-up', <SignUpPage />)

    expect(screen.getByRole('status')).not.toHaveClass('min-h-dvh')
  })
})
