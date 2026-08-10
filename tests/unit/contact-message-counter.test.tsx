import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ContactUsPage } from '@/experiences/institutional/pages/contact-us-page'

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  render(
    <QueryClientProvider client={queryClient}>
      <ContactUsPage />
    </QueryClientProvider>
  )
}

describe('contador del mensaje de contacto', () => {
  it('muestra el limite y actualiza los caracteres disponibles', () => {
    renderPage()

    const message = screen.getByRole('textbox', { name: 'Mensaje' })

    expect(message).toHaveAttribute('maxlength', '4000')
    expect(message).toHaveAccessibleDescription('4000 caracteres disponibles')

    fireEvent.change(message, { target: { value: 'Necesito información' } })

    expect(message).toHaveAccessibleDescription('3980 caracteres disponibles')
  })
})
