import type { RouteObject } from 'react-router-dom'

import { surfacePaths } from '@/app/router/surface-paths'
import { SurfaceStatusPage } from '@/app/router/routes/surface-status-page'
import { JobApplicationPage } from '@/features/applications/pages/job-application-page'
import { JobDetailPage } from '@/features/jobs/pages/job-detail-page'
import { JobsOverviewPage } from '@/features/jobs/pages/jobs-overview-page'
import { RequireAuth } from '@/lib/auth/guards'
import { HomePage } from '@/experiences/storefront/pages/home-page'
import { OfflinePage } from '@/experiences/storefront/pages/offline-page'
import { StorefrontPlatformShell } from '@/experiences/storefront/layouts/storefront-platform-shell'
import { StorefrontShell } from '@/experiences/storefront/layouts/storefront-shell'

export const storefrontRoutes: RouteObject[] = [
  {
    path: surfacePaths.storefront.home,
    element: <StorefrontShell />,
    children: [
      {
        index: true,
        element: <HomePage />
      },
      {
        path: 'offline',
        element: <OfflinePage />
      },
      {
        path: '*',
        element: <SurfaceStatusPage kind="not-found" surface="storefront" />
      }
    ]
  },
  {
    path: surfacePaths.storefront.jobsRoot,
    element: <StorefrontPlatformShell />,
    children: [
      {
        index: true,
        element: <JobsOverviewPage />
      },
      {
        path: ':jobSlug',
        element: <JobDetailPage />
      },
      {
        path: ':jobSlug/apply',
        element: (
          <RequireAuth>
            <JobApplicationPage />
          </RequireAuth>
        )
      }
    ]
  }
]
