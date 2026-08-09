import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { AppEnvironmentBadge } from '@/components/ui/app-environment-badge'
import { InstitutionalFooter } from '@/experiences/institutional/components/institutional-footer'
import { resolveAppEnvironment } from '@/shared/config/app-environment'

describe('application environment badge', () => {
  it.each([
    ['development', 'local'],
    ['test', 'local'],
    ['staging', 'staging'],
    ['production', 'production']
  ] as const)('maps %s to %s', (deployEnvironment, expected) => {
    expect(resolveAppEnvironment(deployEnvironment)).toBe(expected)
  })

  it('falls back to the build mode when the explicit deployment class is absent', () => {
    expect(resolveAppEnvironment(undefined, 'staging')).toBe('staging')
  })

  it('shows the environment and beta phase without exposing an app version', () => {
    const { container } = render(<AppEnvironmentBadge environment="staging" />)

    expect(screen.getByText('Staging')).toBeInTheDocument()
    expect(screen.getByText('Beta')).toBeInTheDocument()
    expect(screen.getByLabelText('Entorno Staging; fase Beta')).toBeInTheDocument()
    expect(screen.queryByText(/\d+\.\d+\.\d+/)).not.toBeInTheDocument()
    expect(container.firstElementChild).not.toHaveClass('fixed')
  })

  it('renders inside the institutional footer instead of floating over the page', () => {
    render(
      <MemoryRouter>
        <InstitutionalFooter />
      </MemoryRouter>
    )

    expect(screen.getByLabelText(/Entorno Local; fase Beta/).closest('footer')).toBeInTheDocument()
  })
})
