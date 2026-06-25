import { Suspense, type ReactNode } from 'react'

import { PageLoader } from '@/components/ui/loader'

/**
 * Loader oficial único de la plataforma. Se mantiene este wrapper por
 * compatibilidad con los call-sites (Suspense de rutas y guards de auth),
 * pero delega 100% en `PageLoader` para que exista un solo loader visual.
 */
export function RoutePending({
  label = 'Cargando vista',
  hint,
  fullScreen = false
}: {
  label?: string
  hint?: string
  fullScreen?: boolean
}) {
  return <PageLoader label={label} hint={hint} fullScreen={fullScreen} />
}

export function RouteSuspense({ children }: { children: ReactNode }) {
  return <Suspense fallback={<RoutePending />}>{children}</Suspense>
}
