import { render, screen } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { AppProviders } from '@/app/providers/app-providers'
import { appRoutes } from '@/app/router/routes'

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: {
          session: null
        }
      }),
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

describe('route shells', () => {
  it('renders the public shell without authenticated dashboard navigation for guests', async () => {
    const router = createMemoryRouter(appRoutes, {
      initialEntries: ['/']
    })

    render(
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>
    )

    expect(await screen.findByRole('link', { name: /Plataforma ASI/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Jobs' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Crear cuenta' }).length).toBeGreaterThan(0)
    expect(screen.queryByText('Workspace')).not.toBeInTheDocument()
    expect(screen.queryByText('Internal console')).not.toBeInTheDocument()
  })

  it('renders auth as an isolated shell', async () => {
    const router = createMemoryRouter(appRoutes, {
      initialEntries: ['/auth/sign-in']
    })

    render(
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>
    )

    expect(await screen.findByRole('heading', { name: 'Entra a tu cuenta' })).toBeInTheDocument()
    expect(screen.queryByText('Workspace')).not.toBeInTheDocument()
    expect(screen.queryByText('Pipeline')).not.toBeInTheDocument()
  })
})
