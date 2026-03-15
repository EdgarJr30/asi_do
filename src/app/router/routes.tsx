import type { RouteObject } from 'react-router-dom'

import { AppShell } from '@/app/layouts/app-shell'
import { AuthConfirmPage } from '@/features/auth/pages/auth-confirm-page'
import { AuthPage } from '@/features/auth/pages/auth-page'
import { OnboardingPage } from '@/features/auth/pages/onboarding-page'
import { JobsOverviewPage } from '@/features/jobs/pages/jobs-overview-page'
import { ModerationOverviewPage } from '@/features/moderation/pages/moderation-overview-page'
import { RbacOverviewPage } from '@/features/rbac/pages/rbac-overview-page'
import { RecruiterRequestPage } from '@/features/recruiter-requests/pages/recruiter-request-page'
import { RecruiterReviewPage } from '@/features/recruiter-requests/pages/recruiter-review-page'
import { WorkspaceOverviewPage } from '@/features/tenants/pages/workspace-overview-page'
import { RequireAuth, RequirePermission } from '@/lib/auth/guards'
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
        path: 'auth',
        element: <AuthPage />
      },
      {
        path: 'auth/confirm',
        element: <AuthConfirmPage />
      },
      {
        path: 'onboarding',
        element: (
          <RequireAuth>
            <OnboardingPage />
          </RequireAuth>
        )
      },
      {
        path: 'recruiter-request',
        element: (
          <RequireAuth>
            <RecruiterRequestPage />
          </RequireAuth>
        )
      },
      {
        path: 'jobs',
        element: (
          <RequirePermission permission="job:read">
            <JobsOverviewPage />
          </RequirePermission>
        )
      },
      {
        path: 'workspace',
        element: (
          <RequirePermission permission="workspace:read">
            <WorkspaceOverviewPage />
          </RequirePermission>
        )
      },
      {
        path: 'rbac',
        element: (
          <RequirePermission permission="role:read">
            <RbacOverviewPage />
          </RequirePermission>
        )
      },
      {
        path: 'admin/recruiter-requests',
        element: (
          <RequirePermission permission="recruiter_request:review">
            <RecruiterReviewPage />
          </RequirePermission>
        )
      },
      {
        path: 'admin/moderation',
        element: (
          <RequirePermission permission="moderation:read">
            <ModerationOverviewPage />
          </RequirePermission>
        )
      },
      {
        path: 'offline',
        element: <OfflinePage />
      }
    ]
  }
]
