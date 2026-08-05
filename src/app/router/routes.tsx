import type { RouteObject } from 'react-router-dom'

import { RouteErrorElement } from '@/components/errors/route-error-element'
import { applicationRoutes } from '@/experiences/app/routes'
import { institutionalRoutes } from '@/experiences/institutional/routes'
import { storefrontRoutes } from '@/experiences/storefront/routes'

/**
 * Cada ruta de primer nivel recibe su `errorElement`.
 *
 * Se aplica aqui, en un solo sitio, en vez de repetirlo en los tres archivos de
 * rutas: asi una experiencia nueva queda cubierta por construccion y no por
 * acordarse. React Router propaga el error al `errorElement` mas cercano hacia
 * arriba, asi que ponerlo en la raiz de cada experiencia cubre todo su subarbol
 * y deja intacto el layout de las demas.
 */
function withErrorElement(routes: RouteObject[]): RouteObject[] {
  return routes.map((route) =>
    route.errorElement ? route : { ...route, errorElement: <RouteErrorElement /> }
  )
}

export const appRoutes: RouteObject[] = withErrorElement([
  ...institutionalRoutes,
  ...storefrontRoutes,
  ...applicationRoutes
])
