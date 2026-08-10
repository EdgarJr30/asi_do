import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { InstitutionalFooter } from '@/experiences/institutional/components/institutional-footer'
import { institutionalPrimaryNavigation } from '@/experiences/institutional/content/site-content'

describe('institutional navigation', () => {
  it('orders the primary links as membership, about, and contact', () => {
    expect(institutionalPrimaryNavigation.map((item) => item.label)).toEqual([
      'Membresía',
      'Quiénes somos',
      'Contáctanos'
    ])
  })

  it('keeps platform links in the general footer navigation without a bridge group', () => {
    render(
      <MemoryRouter>
        <InstitutionalFooter />
      </MemoryRouter>
    )

    const navigationGroup = screen.getByText('Explora').parentElement

    expect(navigationGroup).not.toBeNull()
    expect(within(navigationGroup!).getByRole('link', { name: 'Plataforma ASI' })).toBeInTheDocument()
    expect(within(navigationGroup!).getByRole('link', { name: 'Iniciar sesión' })).toBeInTheDocument()
    expect(within(navigationGroup!).getByRole('link', { name: 'Donaciones' })).toBeInTheDocument()
    expect(screen.queryByText('Puente')).not.toBeInTheDocument()
  })
})
