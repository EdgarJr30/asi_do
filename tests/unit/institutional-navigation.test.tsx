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

  it('keeps long footer navigation labels on one line', () => {
    render(
      <MemoryRouter>
        <InstitutionalFooter />
      </MemoryRouter>
    )

    const navigationGroup = screen.getByText('Explora').parentElement

    expect(navigationGroup).not.toBeNull()
    expect(within(navigationGroup!).getByText('Plataforma ASI')).toHaveClass('whitespace-nowrap')
    expect(screen.getByText('Devoluciones y cancelaciones')).toHaveClass('whitespace-nowrap')
  })

  it('stacks footer navigation links in one column', () => {
    render(
      <MemoryRouter>
        <InstitutionalFooter />
      </MemoryRouter>
    )

    expect(screen.getByText('Inicio').closest('a')?.parentElement).toHaveClass('grid-cols-1')
    expect(screen.getByText('Centro legal').closest('a')?.parentElement).toHaveClass('grid-cols-1')
  })
})
