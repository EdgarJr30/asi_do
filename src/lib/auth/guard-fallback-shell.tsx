import { lazy } from 'react'

import { RouteSuspense } from '@/app/router/route-suspense'
import { LazySurfaceStatusPage } from '@/app/router/routes/lazy-surface-status-page'
import type { AppSurface } from '@/app/router/routes/surface-status-page'

const AdminShell = lazy(() => import('@/experiences/app/layouts/admin-shell').then(({ AdminShell }) => ({ default: AdminShell })))
const CandidateShell = lazy(() => import('@/experiences/app/layouts/candidate-shell').then(({ CandidateShell }) => ({ default: CandidateShell })))
const EmployerShell = lazy(() => import('@/experiences/app/layouts/employer-shell').then(({ EmployerShell }) => ({ default: EmployerShell })))

export function GuardFallbackShell({ surface }: { surface: Extract<AppSurface, 'candidate' | 'workspace' | 'admin'> }) {
  const content = <LazySurfaceStatusPage kind="forbidden" surface={surface} />

  if (surface === 'candidate') {
    return (
      <RouteSuspense>
        <CandidateShell fallbackContent={content} />
      </RouteSuspense>
    )
  }

  if (surface === 'admin') {
    return (
      <RouteSuspense>
        <AdminShell fallbackContent={content} />
      </RouteSuspense>
    )
  }

  return (
    <RouteSuspense>
      <EmployerShell fallbackContent={content} />
    </RouteSuspense>
  )
}
