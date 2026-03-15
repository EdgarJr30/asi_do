import { render, screen } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { AppProviders } from '@/app/providers/app-providers'
import { appRoutes } from '@/app/router/routes'

describe('app shell', () => {
  it('renders the project shell and hides restricted navigation items for guests', async () => {
    const router = createMemoryRouter(appRoutes, {
      initialEntries: ['/']
    })

    render(
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>
    )

    expect(await screen.findByText('Talent Marketplace SaaS')).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /Inicio|Home/i }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: /Acceso|Access/i }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: /Jobs/i }).length).toBeGreaterThan(0)
    expect(screen.queryAllByRole('link', { name: /Applications/i })).toHaveLength(0)
    expect(screen.queryAllByRole('link', { name: /Pipeline/i })).toHaveLength(0)
    expect(screen.queryAllByRole('link', { name: /Approvals/i })).toHaveLength(0)
    expect(screen.queryAllByRole('link', { name: /Plataforma|Platform/i })).toHaveLength(0)
    expect(screen.queryAllByRole('link', { name: /Moderation|Moderacion/i })).toHaveLength(0)
    expect(screen.queryAllByRole('link', { name: /Talento|Talent/i })).toHaveLength(0)
  })
})
