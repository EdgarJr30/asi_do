import { useEffect, useState } from 'react'

/**
 * Retrasa la propagación de un valor hasta que deja de cambiar por `delayMs`.
 *
 * Uso típico: buscadores con paginación de servidor. El input sigue siendo
 * inmediato (tecleo sin lag, y si el valor vive en la URL se mantiene la
 * persistencia por enlace), pero el valor debounced es el que se mete en la
 * `queryKey`, de modo que la red solo se golpea ~`delayMs` tras la última tecla
 * en vez de en cada carácter. Mismo criterio que el módulo de roles y usuarios.
 *
 *   const [query, setQuery] = useState('')
 *   const debouncedQuery = useDebouncedValue(query)
 *   useQuery({ queryKey: ['x', debouncedQuery], ... })
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs)
    return () => window.clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}
