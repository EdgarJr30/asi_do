import { render, screen } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { AppProviders } from '@/app/providers/app-providers'
import { appRoutes } from '@/app/router/routes'

describe('app shell', () => {
  it('renders the project shell and hides navigation items without permission', async () => {
    const router = createMemoryRouter(appRoutes, {
      initialEntries: ['/']
    })

    render(
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>
    )

    expect(await screen.findByText('Talent Marketplace SaaS')).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /Jobs/i }).length).toBeGreaterThan(0)
    expect(screen.queryAllByRole('link', { name: /Moderation/i })).toHaveLength(0)
  })
})
