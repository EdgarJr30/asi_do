import { RouterProvider } from 'react-router-dom'

import { AppProviders } from '@/app/providers/app-providers'
import { ErrorBoundary } from '@/components/errors/error-boundary'
import { router } from '@/app/router'

export function App() {
  return (
    // La frontera va por fuera de los providers a proposito: si el que revienta
    // es un provider —la sesion, React Query, i18n—, una frontera interna se
    // caeria con el. Esta es la ultima red antes de la pantalla en blanco.
    <ErrorBoundary source="app.root">
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>
    </ErrorBoundary>
  )
}
