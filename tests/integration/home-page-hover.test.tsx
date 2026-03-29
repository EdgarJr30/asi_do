import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { AppSessionProvider } from '@/app/providers/app-session-provider'
import { HomePage } from '@/pages/home-page'

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
  it('keeps hover and pointer affordances on primary landing actions', async () => {
    render(
      <MemoryRouter>
        <AppSessionProvider>
          <HomePage />
        </AppSessionProvider>
      </MemoryRouter>
    )

    const primaryCta = (await screen.findAllByRole('button', { name: 'Crear cuenta' }))[0]
    const comparisonTrigger = screen.getByRole('button', { name: /Comparar planes/i })
    const footerPricing = screen.getByRole('button', { name: 'Pricing' })

    expect(primaryCta.className).toContain('cursor-pointer')
    expect(primaryCta.className).toContain('hover:shadow-')
    expect(primaryCta.className).toContain('hover:bg-primary-')

    expect(comparisonTrigger.className).toContain('cursor-pointer')
    expect(comparisonTrigger.className).toContain('hover:border-primary-200')
    expect(comparisonTrigger.className).toContain('hover:text-primary-700')

    expect(footerPricing.className).toContain('cursor-pointer')
    expect(footerPricing.className).toContain('hover:bg-(--app-surface)')
    expect(footerPricing.className).toContain('hover:shadow-(--app-shadow-card)')
  })
})
