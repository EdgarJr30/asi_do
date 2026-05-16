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
  it('keeps locked registration and hover affordances on active landing actions', async () => {
    render(
      <MemoryRouter>
        <AppSessionProvider>
          <HomePage />
        </AppSessionProvider>
      </MemoryRouter>
    )

    const primaryCta = (await screen.findAllByRole('button', { name: 'Registro cerrado' }))[0]
    const comparisonTrigger = screen.getByRole('button', { name: /Comparar planes/i })
    const footerPricing = screen.getByRole('button', { name: 'Pricing' })

    expect(primaryCta).toBeDisabled()

    expect(comparisonTrigger.className).toContain('cursor-pointer')
    expect(comparisonTrigger.className).toContain('hover:border-primary-200')
    expect(comparisonTrigger.className).toContain('hover:text-primary-700')

    expect(footerPricing.className).toContain('cursor-pointer')
    expect(footerPricing.className).toContain('hover:bg-(--app-surface)')
    expect(footerPricing.className).toContain('hover:shadow-(--app-shadow-card)')
  })
})
