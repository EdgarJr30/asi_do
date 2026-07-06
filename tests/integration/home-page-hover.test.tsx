import { fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { AppSessionProvider } from '@/app/providers/app-session-provider'
import { HomePage } from '@/experiences/storefront/pages/home-page'

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

describe('home page hover affordances', () => {
  it('keeps hover affordances on active landing actions while product pricing is hidden', async () => {
    const router = createMemoryRouter(
      [
        {
          path: '/platform',
          element: (
            <AppSessionProvider>
              <HomePage />
            </AppSessionProvider>
          )
        },
        {
          path: '/membership/categories',
          element: <h1>Cuotas Anuales de Membresía</h1>
        }
      ],
      {
        initialEntries: ['/platform']
      }
    )

    render(
      <RouterProvider router={router} />
    )

    const primaryCta = await screen.findByRole('button', { name: 'Entrar a la aplicación' })
    const pricingCta = screen.getByRole('button', { name: 'Ver pricing' })

    expect(primaryCta).toBeEnabled()
    expect(primaryCta.className).toContain('hover:border-[#21438e]')
    expect(primaryCta.className).toContain('hover:bg-[#21438e]')
    expect(screen.queryByRole('heading', { name: /Planes claros/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Comparar planes/i })).not.toBeInTheDocument()

    expect(pricingCta).toBeEnabled()
    expect(pricingCta.className).toContain('hover:text-[#21438e]')

    fireEvent.click(pricingCta)

    expect(await screen.findByRole('heading', { name: 'Cuotas Anuales de Membresía' })).toBeInTheDocument()
  })
})
