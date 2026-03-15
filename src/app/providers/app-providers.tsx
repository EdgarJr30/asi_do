import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type PropsWithChildren, useState } from 'react'
import { Toaster } from 'sonner'

import { NotificationEventBridge } from '@/app/providers/notification-event-bridge'
import { AppSessionProvider } from '@/app/providers/app-session-provider'
import { ThemeProvider } from '@/app/providers/theme-provider'

export function AppProviders({ children }: PropsWithChildren) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
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
          <NotificationEventBridge />
          {children}
          <Toaster position="top-center" richColors theme="system" />
        </ThemeProvider>
      </AppSessionProvider>
    </QueryClientProvider>
  )
}
