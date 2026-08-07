import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LegalCenterPage } from '@/experiences/institutional/pages/legal-center-page'
import { LegalDocumentPage } from '@/experiences/institutional/pages/legal-document-page'
import { LegalDocActions, LegalDocTabs, LegalMetaPills } from '@/experiences/institutional/components/legal-center-ui'
import { legalDocuments } from '@/experiences/institutional/content/legal-center-content'

const { appSessionState } = vi.hoisted(() => ({
  appSessionState: { isPlatformOwner: false }
}))

vi.mock('@/app/providers/app-session-provider', () => ({
  useAppSession: () => appSessionState
}))

describe('legal surface density', () => {
  beforeEach(() => {
    appSessionState.isPlatformOwner = false
  })

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
    expect(screen.queryByText('v3.1')).not.toBeInTheDocument()
    expect(screen.queryByText(/¿Vas a citar una política\?/i)).not.toBeInTheDocument()
  })

  it('does not expose version labels in legal metadata or change history', async () => {
    const user = userEvent.setup()

    render(
      <>
        <LegalMetaPills document={legalDocuments.terms} />
        <LegalDocActions document={legalDocuments.terms} />
      </>
    )

    expect(screen.queryByText('Versión')).not.toBeInTheDocument()
    expect(screen.queryByText('Vigente desde')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ver cambios' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Ver cambios' }))

    expect(screen.queryByText(/^v\d/)).not.toBeInTheDocument()
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
    expect(screen.queryByText('Vigente desde')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Descargar / Imprimir' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ver cambios' })).not.toBeInTheDocument()
  })

  it('keeps the legal table of contents visible while the document scrolls on desktop', () => {
    render(
      <MemoryRouter initialEntries={['/terms']}>
        <LegalDocumentPage kind="terms" />
      </MemoryRouter>
    )

    expect(screen.getByRole('complementary')).toHaveClass('sticky', 'top-32', 'self-start')
  })

  it('keeps the legal tabs horizontally scrollable without a vertical scrollbar', () => {
    render(
      <MemoryRouter initialEntries={['/terms']}>
        <LegalDocTabs activeKind="terms" />
      </MemoryRouter>
    )

    expect(screen.getByRole('navigation', { name: 'Documentos legales' })).toHaveClass(
      'overflow-x-auto',
      'overflow-y-hidden'
    )
  })

  it('reserves legal document actions for the platform owner', () => {
    appSessionState.isPlatformOwner = true

    render(
      <MemoryRouter initialEntries={['/terms']}>
        <LegalDocumentPage kind="terms" />
      </MemoryRouter>
    )

    expect(screen.getByRole('button', { name: 'Descargar / Imprimir' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ver cambios' })).toBeInTheDocument()
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
