import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { useAppSession } from '@/app/providers/app-session-provider'
import type { AppNotification } from '@/lib/notifications/api'
import { useRealtimeSync } from '@/lib/realtime/use-realtime-sync'

// Clave (prefijo) del inbox de notificaciones que mantiene el shell. Invalidamos
// por prefijo para no depender de `experience`/`userId` concretos desde aquí.
const NOTIFICATION_QUERY_PREFIX = ['workspace-shell', 'notifications'] as const

/**
 * Puente global de tiempo real de la sesión. Vive en el árbol eager (dentro de
 * AppSessionProvider + QueryClientProvider) para que TODA la app —esté en la
 * superficie que esté— reaccione en vivo a cambios que afectan al usuario actual,
 * sin recargar la página:
 *
 * - `users`      → re-hidrata la sesión (activación de membresía, expiración,
 *                  cambios de rol/flags ⇒ `hasActiveAsiAccess`, permisos, chrome).
 * - `memberships`→ re-hidrata la sesión (alta/baja en un workspace ⇒ acceso al ATS).
 * - `notifications` → refresca el inbox y avisa con un toast al instante cuando
 *                  llega una notificación nueva (membresía activada, postulación
 *                  aceptada, etc.).
 *
 * La seguridad la da RLS: Realtime solo entrega los eventos de las filas que el
 * usuario ya puede leer (su propio registro, sus membresías, sus notificaciones).
 */
export function SessionRealtimeBridge() {
  const session = useAppSession()
  const queryClient = useQueryClient()
  const userId = session.authUser?.id ?? null

  useRealtimeSync(
    userId ? `session-live-${userId}` : 'session-live',
    [
      {
        table: 'users',
        filter: userId ? `id=eq.${userId}` : undefined,
        onChange: () => {
          void session.refresh()
        }
      },
      {
        table: 'memberships',
        filter: userId ? `user_id=eq.${userId}` : undefined,
        onChange: () => {
          void session.refresh()
        }
      },
      {
        table: 'notifications',
        event: 'INSERT',
        filter: userId ? `recipient_user_id=eq.${userId}` : undefined,
        onChange: (payload) => {
          void queryClient.invalidateQueries({ queryKey: NOTIFICATION_QUERY_PREFIX })

          const row = payload.new as Partial<AppNotification>
          if (row?.title) {
            toast(row.title, { description: row.body ?? undefined })
          }
        }
      },
      {
        // Cambios de estado leída/no-leída u otras ediciones: mantén el inbox al día.
        table: 'notifications',
        event: 'UPDATE',
        filter: userId ? `recipient_user_id=eq.${userId}` : undefined,
        invalidate: [NOTIFICATION_QUERY_PREFIX]
      }
    ],
    { enabled: session.isAuthenticated && Boolean(userId) }
  )

  return null
}
