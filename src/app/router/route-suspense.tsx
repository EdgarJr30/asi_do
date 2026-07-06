import { Suspense, type ReactNode } from 'react'

import { PageLoader } from '@/components/ui/loader'

/**
 * Texto canónico ÚNICO del loader de plataforma. Todos los guards de auth y los
 * Suspense de ruta comparten este mismo label para que, aunque técnicamente se
 * resuelvan varias fronteras (sesión → chunk del shell → chunk de la página),
 * el usuario perciba **un solo loader continuo** sin cambios de texto.
 *
 * Para ajustar el copy de todo el arranque de la app, cambia solo esta línea.
 */
export const PLATFORM_LOADER_LABEL = 'Cargando tu sesión'

/**
 * Loader oficial único de la plataforma. Se mantiene este wrapper por
 * compatibilidad con los call-sites (Suspense de rutas y guards de auth),
 * pero delega 100% en `PageLoader` para que exista un solo loader visual.
 */
export function RoutePending({
  label = PLATFORM_LOADER_LABEL,
  hint,
  fullScreen = false
}: {
  label?: string
  hint?: string
  fullScreen?: boolean
}) {
  return <PageLoader label={label} hint={hint} fullScreen={fullScreen} />
}

/**
 * `fullScreen` se usa en las fronteras de nivel shell (el primer chunk tras la
 * sesión) para que el loader ocupe el viewport igual que el de los guards y no
 * haya salto de geometría. Los Suspense de página (ya dentro del shell) usan el
 * modo por defecto: el loader se centra en el área de contenido, con el chrome
 * ya visible alrededor.
 */
export function RouteSuspense({ children, fullScreen = false }: { children: ReactNode; fullScreen?: boolean }) {
  return <Suspense fallback={<RoutePending fullScreen={fullScreen} />}>{children}</Suspense>
}
