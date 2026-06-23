import { useEffect, useRef } from 'react'

import { useQueryClient, type QueryKey } from '@tanstack/react-query'
import type {
  RealtimePostgresChangesPayload,
  RealtimePostgresChangesFilter
} from '@supabase/supabase-js'

import { supabase } from '@/lib/supabase/client'

type RealtimeRow = Record<string, unknown>
type RealtimeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*'

export interface RealtimeWatch {
  /** Tabla de Postgres a observar (en el esquema `public` salvo que se indique otro). */
  table: string
  schema?: string
  /** Tipo de cambio. Por defecto `*` (insert + update + delete). */
  event?: RealtimeEvent
  /**
   * Filtro de igualdad de Postgres Changes, p. ej. `tenant_id=eq.<uuid>`.
   * Normalmente NO hace falta: Realtime respeta las políticas RLS, así que cada
   * cliente solo recibe los cambios de las filas que ya puede leer. Usa `filter`
   * solo para acotar aún más el tráfico cuando la tabla es muy activa.
   */
  filter?: string
  /** Claves de React Query a invalidar cuando llega un cambio. */
  invalidate?: QueryKey[]
  /** Handler opcional para lógica a medida (toasts, setQueryData, etc.). */
  onChange?: (payload: RealtimePostgresChangesPayload<RealtimeRow>) => void
}

export interface UseRealtimeSyncOptions {
  /** Desactiva la suscripción sin desmontar el componente (p. ej. sin sesión). */
  enabled?: boolean
}

/**
 * Suscribe un componente a cambios en vivo de Postgres vía Supabase Realtime y
 * mantiene la caché de React Query sincronizada.
 *
 * Convención del proyecto (ver `docs/architecture/REALTIME.md`):
 * React Query es la fuente de verdad de los datos; Realtime solo dispara
 * `invalidateQueries`. Así toda la plataforma se actualiza en vivo entre usuarios
 * sin que nadie tenga que recargar la página.
 *
 * @example
 * useRealtimeSync('public-jobs', [
 *   { table: 'job_postings', invalidate: [['jobs', 'public-board']] }
 * ])
 */
export function useRealtimeSync(
  channelName: string,
  watches: RealtimeWatch[],
  options?: UseRealtimeSyncOptions
) {
  const queryClient = useQueryClient()
  const enabled = options?.enabled ?? true

  // Mantenemos los watches en un ref para leer siempre los callbacks/claves más
  // recientes sin tener que volver a suscribir el canal en cada render. El ref se
  // sincroniza en un effect (no durante el render) para cumplir las reglas de hooks.
  const watchesRef = useRef(watches)
  useEffect(() => {
    watchesRef.current = watches
  })

  // Solo re-suscribimos cuando cambia la topología (tabla/evento/esquema/filtro),
  // no cuando cambian las funciones u objetos por identidad.
  const topology = watches
    .map((watch) => `${watch.schema ?? 'public'}.${watch.table}:${watch.event ?? '*'}:${watch.filter ?? ''}`)
    .join('|')

  useEffect(() => {
    if (!supabase || !enabled || watchesRef.current.length === 0) {
      return
    }

    const client = supabase
    const channel = client.channel(channelName)

    watchesRef.current.forEach((_, index) => {
      const watch = watchesRef.current[index]
      const filter: RealtimePostgresChangesFilter<RealtimeEvent> = {
        event: watch.event ?? '*',
        schema: watch.schema ?? 'public',
        table: watch.table,
        ...(watch.filter ? { filter: watch.filter } : {})
      }

      channel.on('postgres_changes', filter, (payload: RealtimePostgresChangesPayload<RealtimeRow>) => {
        // Releemos desde el ref para usar siempre la versión vigente del watch.
        const current = watchesRef.current[index]
        if (!current) {
          return
        }
        current.onChange?.(payload)
        current.invalidate?.forEach((queryKey) => {
          void queryClient.invalidateQueries({ queryKey })
        })
      })
    })

    channel.subscribe()

    return () => {
      void client.removeChannel(channel)
    }
    // `topology` cubre los cambios estructurales; los callbacks viven en el ref.
  }, [channelName, enabled, topology, queryClient])
}
