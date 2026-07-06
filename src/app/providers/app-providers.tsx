import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type PropsWithChildren, useState } from 'react'
import { useTheme } from 'next-themes'
import { Toaster } from 'sonner'

import { ErrorEventBridge } from '@/app/providers/error-event-bridge'
import { NotificationEventBridge } from '@/app/providers/notification-event-bridge'
import { SessionRealtimeBridge } from '@/app/providers/session-realtime-bridge'
import { AppSessionProvider } from '@/app/providers/app-session-provider'
import { ThemeProvider } from '@/app/providers/theme-provider'

function AppToaster() {
  const { resolvedTheme, theme } = useTheme()
  return <Toaster closeButton position="top-center" richColors theme={(resolvedTheme ?? theme) === 'dark' ? 'dark' : 'light'} />
}

export function AppProviders({ children }: PropsWithChildren) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Datos "frescos" por 60s: al volver a una vista dentro de ese lapso
            // no se refetchea. Fuera de él, React Query hace stale-while-revalidate
            // (muestra lo cacheado al instante y refresca en segundo plano), no un
            // loader duro. El Realtime bridge invalida lo sensible (sesión, inbox)
            // en vivo, así que este valor no arriesga datos rancios en lo crítico.
            staleTime: 60_000,
            // Mantener en caché los datos inactivos 15 min (antes 5 min por defecto):
            // volver a una página tras navegar muestra el contenido cacheado sin
            // recarga con loader. Esta era la causa del "se siente como refresh".
            gcTime: 15 * 60_000,
            retry: 1,
            refetchOnWindowFocus: false
          },
          mutations: {
            retry: 0
          }
        }
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      <AppSessionProvider>
        <ThemeProvider>
          <ErrorEventBridge />
          <NotificationEventBridge />
          <SessionRealtimeBridge />
          {children}
          <AppToaster />
        </ThemeProvider>
      </AppSessionProvider>
    </QueryClientProvider>
  )
}
