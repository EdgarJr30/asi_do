import type { RouteObject } from 'react-router-dom'

import { ApplicationsOverviewPage } from '@/features/applications/pages/applications-overview-page'
import { JobApplicationPage } from '@/features/applications/pages/job-application-page'
import { AppShell } from '@/app/layouts/app-shell'
import { AuthConfirmPage } from '@/features/auth/pages/auth-confirm-page'
import { AuthPage } from '@/features/auth/pages/auth-page'
import { OnboardingPage } from '@/features/auth/pages/onboarding-page'
import { CandidateProfilePage } from '@/features/candidate-profile/pages/candidate-profile-page'
import { ErrorLogReviewPage } from '@/features/error-monitoring/pages/error-log-review-page'
import { JobDetailPage } from '@/features/jobs/pages/job-detail-page'
import { JobsOverviewPage } from '@/features/jobs/pages/jobs-overview-page'
import { ModerationOverviewPage } from '@/features/moderation/pages/moderation-overview-page'
import { PipelineBoardPage } from '@/features/pipeline/pages/pipeline-board-page'
import { PlatformOpsDashboardPage } from '@/features/platform-ops/pages/platform-ops-dashboard-page'
import { RbacOverviewPage } from '@/features/rbac/pages/rbac-overview-page'
import { RecruiterRequestPage } from '@/features/recruiter-requests/pages/recruiter-request-page'
import { RecruiterReviewPage } from '@/features/recruiter-requests/pages/recruiter-review-page'
import { TalentDirectoryPage } from '@/features/talent/pages/talent-directory-page'
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
        path: 'candidate/profile',
        element: (
          <RequireAuth>
            <CandidateProfilePage />
          </RequireAuth>
        )
      },
      {
        path: 'jobs',
        element: <JobsOverviewPage />
      },
      {
        path: 'jobs/:jobSlug',
        element: <JobDetailPage />
      },
      {
        path: 'jobs/:jobSlug/apply',
        element: (
          <RequireAuth>
            <JobApplicationPage />
          </RequireAuth>
        )
      },
      {
        path: 'applications',
        element: (
          <RequireAuth>
            <ApplicationsOverviewPage />
          </RequireAuth>
        )
      },
      {
        path: 'pipeline',
        element: (
          <RequirePermission permission="application:read">
            <PipelineBoardPage />
          </RequirePermission>
        )
      },
      {
        path: 'talent',
        element: (
          <RequirePermission permission="candidate_directory:read">
            <TalentDirectoryPage />
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
        path: 'admin/platform',
        element: (
          <RequirePermission permission="platform_dashboard:read">
            <PlatformOpsDashboardPage />
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
        path: 'admin/errors',
        element: (
          <RequirePermission permission="audit_log:read">
            <ErrorLogReviewPage />
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
