import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { AppEnvironmentBadge } from '@/components/ui/app-environment-badge'
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
    render(<AppEnvironmentBadge environment="staging" />)

    expect(screen.getByText('Staging')).toBeInTheDocument()
    expect(screen.getByText('Beta')).toBeInTheDocument()
    expect(screen.getByLabelText('Entorno Staging; fase Beta')).toBeInTheDocument()
    expect(screen.queryByText(/\d+\.\d+\.\d+/)).not.toBeInTheDocument()
  })
})
