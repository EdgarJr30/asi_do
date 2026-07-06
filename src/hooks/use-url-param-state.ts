import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

/**
 * Estado de filtro/tab respaldado por la URL (query string). La URL es la fuente
 * de verdad: el valor sobrevive a navegaciones, back/forward y recargas, y hace
 * los filtros compartibles por enlace.
 *
 * - Se escribe con `{ replace: true }` para no ensuciar el historial con cada
 *   tecleo/cambio de filtro (un back sigue saliendo de la vista, no deshaciendo
 *   filtros uno a uno).
 * - Cuando el valor es el `defaultValue` (o vacío) se OMITE el parámetro, para
 *   dejar URLs limpias (`?status=hired` en vez de `?status=hired&sort=recent`).
 *
 * Uso:
 *   const [status, setStatus] = useUrlParamState('status')
 *   const [sort, setSort] = useUrlParamState<Sort>('sort', 'recent')
 */
export function useUrlParamState<T extends string = string>(
  key: string,
  defaultValue: T = '' as T
): readonly [T, (next: T) => void] {
  const [searchParams, setSearchParams] = useSearchParams()
  const value = (searchParams.get(key) ?? defaultValue) as T

  const setValue = useCallback(
    (next: T) => {
      setSearchParams(
        (params) => {
          const nextParams = new URLSearchParams(params)

          if (next && next !== defaultValue) {
            nextParams.set(key, next)
          } else {
            nextParams.delete(key)
          }

          return nextParams
        },
        { replace: true }
      )
    },
    [key, defaultValue, setSearchParams]
  )

  return [value, setValue] as const
}
