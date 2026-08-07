import { render, screen } from '@testing-library/react'
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
      'text-[clamp(1.75rem,3.2vw,2.2rem)]'
    )
    expect(screen.getByRole('link', { name: /Términos y condiciones/i })).toHaveClass('p-4')
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
})
