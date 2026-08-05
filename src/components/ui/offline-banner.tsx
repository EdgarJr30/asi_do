import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { WifiOff } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/loader'
import { useOnlineStatus } from '@/hooks/use-online-status'
import { cn } from '@/lib/utils/cn'

/**
 * Aviso de conexión perdida, con reintento.
 *
 * `useOnlineStatus` existía desde hacía tiempo **sin un solo consumidor**, así
 * que quedarse sin red no producía ninguna señal: las consultas fallaban, las
 * vistas mostraban su estado vacío y el usuario no tenía forma de distinguir
 * "no hay datos" de "no hay internet". El service worker sirve el shell desde
 * caché, lo que agrava la confusión: la app **parece** funcionar.
 *
 * Al volver la conexión se reintenta solo, porque obligar a pulsar un botón
 * despues de que la red ya volvió es trabajo que la app puede ahorrarse. El
 * botón queda para el caso en que `navigator.onLine` diga que hay red y aun así
 * no la haya — que es común en wifi cautivos.
 */
export function OfflineBanner() {
  const isOnline = useOnlineStatus()
  const queryClient = useQueryClient()
  const [isRetrying, setIsRetrying] = useState(false)
  const wasOfflineRef = useRef(false)

  useEffect(() => {
    if (!isOnline) {
      wasOfflineRef.current = true
      return
    }

    if (!wasOfflineRef.current) {
      return
    }

    // Al recuperar la red, refrescar lo que se quedó a medias. `type: 'all'`
    // incluye las consultas inactivas, que son justamente las de las vistas que
    // el usuario dejó atrás mientras estaba sin conexión.
    wasOfflineRef.current = false
    void queryClient.refetchQueries({ type: 'all' })
  }, [isOnline, queryClient])

  if (isOnline) {
    return null
  }

  const retry = () => {
    setIsRetrying(true)
    void queryClient
      .refetchQueries({ type: 'all' })
      .finally(() => setIsRetrying(false))
  }

  return (
    // `role="status"` y no `alert`: es una condición persistente, no una
    // interrupción. `aria-live="polite"` lo anuncia sin cortar lo que el lector
    // de pantalla esté leyendo.
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'fixed inset-x-0 bottom-0 z-100 flex items-center justify-center gap-3 px-4 py-2.5',
        'border-t border-amber-300 bg-amber-50 text-amber-900',
        'dark:border-amber-500/30 dark:bg-amber-950 dark:text-amber-100'
      )}
    >
      <WifiOff aria-hidden="true" className="size-4 shrink-0" />
      <p className="text-sm font-medium">
        Sin conexión. Estás viendo la última información guardada.
      </p>
      <Button
        variant="outline"
        className="h-8 shrink-0 px-3 text-xs"
        disabled={isRetrying}
        onClick={retry}
      >
        {isRetrying ? <Spinner className="size-3.5" /> : 'Reintentar'}
      </Button>
    </div>
  )
}
