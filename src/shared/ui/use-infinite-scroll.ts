import { useCallback, useEffect, useRef } from 'react'

/**
 * Sentinel para scroll infinito: devuelve un `ref` que se coloca al final de la
 * lista. Cuando el sentinel entra en viewport (con margen anticipado) se llama a
 * `onLoadMore`, replicando el patrón usado en Candidatos y el job board público.
 */
export function useInfiniteScroll({
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  deps = [],
  rootMargin = '240px'
}: {
  hasNextPage: boolean
  isFetchingNextPage: boolean
  onLoadMore: () => void
  deps?: unknown[]
  rootMargin?: string
}) {
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      onLoadMore()
    }
  }, [hasNextPage, isFetchingNextPage, onLoadMore])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) {
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMore()
        }
      },
      { rootMargin }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadMore, rootMargin, ...deps])

  return sentinelRef
}
