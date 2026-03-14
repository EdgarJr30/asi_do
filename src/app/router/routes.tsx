import type { RouteObject } from 'react-router-dom'

import { AppShell } from '@/app/layouts/app-shell'
import { JobsOverviewPage } from '@/features/jobs/pages/jobs-overview-page'
import { ModerationOverviewPage } from '@/features/moderation/pages/moderation-overview-page'
import { RbacOverviewPage } from '@/features/rbac/pages/rbac-overview-page'
import { WorkspaceOverviewPage } from '@/features/tenants/pages/workspace-overview-page'
import { HomePage } from '@/pages/home-page'
import { OfflinePage } from '@/pages/offline-page'

export const appRoutes: RouteObject[] = [
  {
    path: '/',
    element: <AppShell />,
    children: [
      {
        index: true,
        element: <HomePage />
      },
      {
        path: 'jobs',
        element: <JobsOverviewPage />
      },
      {
        path: 'workspace',
        element: <WorkspaceOverviewPage />
      },
      {
        path: 'rbac',
        element: <RbacOverviewPage />
      },
      {
        path: 'admin/moderation',
        element: <ModerationOverviewPage />
      },
      {
        path: 'offline',
        element: <OfflinePage />
      }
    ]
  }
]
