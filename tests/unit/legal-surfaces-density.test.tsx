import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { LegalCenterPage } from '@/experiences/institutional/pages/legal-center-page'
import { LegalDocumentPage } from '@/experiences/institutional/pages/legal-document-page'

describe('legal surface density', () => {
  it('keeps the legal center heading and policy cards compact', () => {
    render(
      <MemoryRouter initialEntries={['/legal']}>
        <LegalCenterPage />
      </MemoryRouter>
    )

    expect(screen.getByRole('heading', { level: 1 })).toHaveClass(
      'text-[clamp(1.5rem,2.5vw,1.85rem)]',
      'lg:max-w-none',
      'lg:whitespace-nowrap'
    )
    expect(screen.getByTestId('legal-center-masthead')).toHaveClass('py-5', 'lg:py-6')
    expect(screen.getByTestId('legal-policy-grid')).toHaveClass('gap-2.5', 'py-5')
    expect(screen.getByRole('link', { name: /Términos y condiciones/i })).toHaveClass('p-3')
    expect(screen.queryByText(/¿Vas a citar una política\?/i)).not.toBeInTheDocument()
  })

  it('keeps every legal document on the compact reading rhythm', () => {
    render(
      <MemoryRouter initialEntries={['/terms']}>
        <LegalDocumentPage kind="terms" />
      </MemoryRouter>
    )

    expect(screen.getByRole('heading', { level: 1 })).toHaveClass(
      'text-[clamp(1.65rem,3.2vw,2.15rem)]'
    )
    expect(screen.getByTestId('legal-document-body')).toHaveClass('py-8', 'lg:py-10')
  })

  it('keeps the entity legal data collapsed until the reader requests it', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={['/legal']}>
        <LegalCenterPage />
      </MemoryRouter>
    )

    const trigger = screen.getByRole('button', { name: /ver datos legales de la entidad/i })

    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Razón social')).not.toBeInTheDocument()

    await user.click(trigger)

    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Razón social')).toBeInTheDocument()
    expect(screen.getByText('ASI República Dominicana')).toBeInTheDocument()
  })
})
