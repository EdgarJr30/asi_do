import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
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
    }
  }
}))

describe('home page hover affordances', () => {
  it('keeps hover affordances on active landing actions while pricing is hidden', async () => {
    render(
      <MemoryRouter>
        <AppSessionProvider>
          <HomePage />
        </AppSessionProvider>
      </MemoryRouter>
    )

    const primaryCta = await screen.findByRole('button', { name: 'Entrar a la aplicación' })
    const faqCta = screen.getByRole('button', { name: 'Resolver dudas' })

    expect(primaryCta).toBeEnabled()
    expect(primaryCta.className).toContain('hover:border-[#21438e]')
    expect(primaryCta.className).toContain('hover:bg-[#21438e]')
    expect(screen.queryByRole('heading', { name: /Planes claros/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ver pricing' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Comparar planes/i })).not.toBeInTheDocument()

    expect(faqCta.className).toContain('hover:border-primary-400')
    expect(faqCta.className).toContain('hover:shadow-[0_18px_34px_rgba(15,23,42,0.12)]')
  })
})
