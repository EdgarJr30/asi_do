import { lazy } from 'react'

import { RouteSuspense } from '@/app/router/route-suspense'
import type { AppSurface, SurfaceStatusKind } from '@/app/router/routes/surface-status-page'

const SurfaceStatusPage = lazy(() => import('@/app/router/routes/surface-status-page').then(({ SurfaceStatusPage }) => ({ default: SurfaceStatusPage })))

export function LazySurfaceStatusPage({
  surface,
  kind
}: {
  surface: AppSurface
  kind: SurfaceStatusKind
}) {
  return (
    <RouteSuspense>
      <SurfaceStatusPage surface={surface} kind={kind} />
    </RouteSuspense>
  )
}
