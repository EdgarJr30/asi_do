/* eslint-disable react-refresh/only-export-components */
import { lazy } from 'react'
import type { RouteObject } from 'react-router-dom'

import { RouteSuspense } from '@/app/router/route-suspense'
import { surfacePaths } from '@/app/router/surface-paths'
import { LazySurfaceStatusPage } from '@/app/router/routes/lazy-surface-status-page'
import { RequireActiveAsiAccess } from '@/lib/auth/guards'

const JobApplicationPage = lazy(() => import('@/features/applications/pages/job-application-page').then(({ JobApplicationPage }) => ({ default: JobApplicationPage })))
const JobDetailPage = lazy(() => import('@/features/jobs/pages/job-detail-page').then(({ JobDetailPage }) => ({ default: JobDetailPage })))
const JobsOverviewPage = lazy(() => import('@/features/jobs/pages/jobs-overview-page').then(({ JobsOverviewPage }) => ({ default: JobsOverviewPage })))
const HomePage = lazy(() => import('@/experiences/storefront/pages/home-page').then(({ HomePage }) => ({ default: HomePage })))
const OfflinePage = lazy(() => import('@/experiences/storefront/pages/offline-page').then(({ OfflinePage }) => ({ default: OfflinePage })))
const StorefrontPlatformShell = lazy(() =>
  import('@/experiences/storefront/layouts/storefront-platform-shell').then(({ StorefrontPlatformShell }) => ({ default: StorefrontPlatformShell }))
)
const StorefrontShell = lazy(() => import('@/experiences/storefront/layouts/storefront-shell').then(({ StorefrontShell }) => ({ default: StorefrontShell })))

export const storefrontRoutes: RouteObject[] = [
  {
    path: surfacePaths.storefront.home,
    element: (
      <RouteSuspense>
        <StorefrontShell />
      </RouteSuspense>
    ),
    children: [
      {
        index: true,
        element: (
          <RouteSuspense>
            <HomePage />
          </RouteSuspense>
        )
      },
      {
        path: 'offline',
        element: (
          <RouteSuspense>
            <OfflinePage />
          </RouteSuspense>
        )
      },
      {
        path: '*',
        element: <LazySurfaceStatusPage kind="not-found" surface="storefront" />
      }
    ]
  },
  {
    path: surfacePaths.storefront.jobsRoot,
    element: (
      <RequireActiveAsiAccess>
        <RouteSuspense>
          <StorefrontPlatformShell />
        </RouteSuspense>
      </RequireActiveAsiAccess>
    ),
    children: [
      {
        index: true,
        element: (
          <RouteSuspense>
            <JobsOverviewPage />
          </RouteSuspense>
        )
      },
      {
        path: ':jobSlug',
        element: (
          <RouteSuspense>
            <JobDetailPage />
          </RouteSuspense>
        )
      },
      {
        path: ':jobSlug/apply',
        element: (
          <RouteSuspense>
            <JobApplicationPage />
          </RouteSuspense>
        )
      }
    ]
  }
]
