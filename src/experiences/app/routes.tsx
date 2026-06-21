import type { RouteObject } from 'react-router-dom'
import { Navigate } from 'react-router-dom'

import { ApplicationsOverviewPage } from '@/features/applications/pages/applications-overview-page'
import { AuthConfirmPage } from '@/features/auth/pages/auth-confirm-page'
import { AuthPage } from '@/features/auth/pages/auth-page'
import { BootstrapOwnerPage } from '@/features/auth/pages/bootstrap-owner-page'
import { SignInPage } from '@/features/auth/pages/sign-in-page'
import { SignUpPage } from '@/features/auth/pages/sign-up-page'
import { AuthorityRequestPage } from '@/features/authority-requests/pages/authority-request-page'
import { WorkspaceApplicationsPage } from '@/features/applications/pages/workspace-applications-page'
import { CandidateProfilePage } from '@/features/candidate-profile/pages/candidate-profile-page'
import { CandidateHomePage } from '@/features/dashboard/pages/candidate-home-page'
import { ResumenDashboardPage } from '@/features/dashboard/pages/resumen-dashboard-page'
import { WorkspaceActivityPage } from '@/features/dashboard/pages/workspace-activity-page'
import { WorkspaceReportsPage } from '@/features/dashboard/pages/workspace-reports-page'
import { WorkspaceSectionPlaceholderPage } from '@/features/dashboard/pages/workspace-section-placeholder-page'
import { ErrorLogReviewPage } from '@/features/error-monitoring/pages/error-log-review-page'
import { AdminConsolePage } from '@/features/internal/pages/admin-console-page'
import { JobsOverviewPage } from '@/features/jobs/pages/jobs-overview-page'
import { ModerationOverviewPage } from '@/features/moderation/pages/moderation-overview-page'
import { PipelineBoardPage } from '@/features/pipeline/pages/pipeline-board-page'
import { PlatformOpsDashboardPage } from '@/features/platform-ops/pages/platform-ops-dashboard-page'
import { RbacOverviewPage } from '@/features/rbac/pages/rbac-overview-page'
import { RecruiterRequestPage } from '@/features/recruiter-requests/pages/recruiter-request-page'
import { RecruiterReviewPage } from '@/features/recruiter-requests/pages/recruiter-review-page'
import { TalentDirectoryPage } from '@/features/talent/pages/talent-directory-page'
import { WorkspaceOverviewPage } from '@/features/tenants/pages/workspace-overview-page'
import {
  RequireActiveAsiAccess,
  RequireAdminAccess,
  RequireAnyPermission,
  RequireAuth,
  RequireCompletedBaseOnboarding,
  RequirePermission
} from '@/lib/auth/guards'
import { surfacePaths } from '@/app/router/surface-paths'
import { SurfaceStatusPage } from '@/app/router/routes/surface-status-page'
import { AdminShell } from '@/experiences/app/layouts/admin-shell'
import { AuthShell } from '@/experiences/app/layouts/auth-shell'
import { CandidateShell } from '@/experiences/app/layouts/candidate-shell'
import { EmployerShell } from '@/experiences/app/layouts/employer-shell'
import { AppEntryRedirect } from '@/experiences/app/routes/app-entry-redirect'
import { MembershipStatusPage } from '@/features/membership/pages/membership-status-page'
import { approvalReviewPermissions } from '@/shared/constants/navigation'

export const applicationRoutes: RouteObject[] = [
  {
    path: '/auth',
    element: <AuthShell />,
    children: [
      {
        index: true,
        element: <AuthPage />
      },
      {
        path: 'sign-in',
        element: <SignInPage />
      },
      {
        path: 'sign-up',
        element: <SignUpPage />
      },
      {
        path: 'confirm',
        element: <AuthConfirmPage />
      },
      {
        path: '*',
        element: <SurfaceStatusPage kind="not-found" surface="auth" />
      }
    ]
  },
  {
    path: surfacePaths.app.home,
    element: (
      <RequireAuth>
        <RequireCompletedBaseOnboarding>
          <AppEntryRedirect />
        </RequireCompletedBaseOnboarding>
      </RequireAuth>
    )
  },
  {
    // Panel de membresía: destino de los usuarios autenticados aún no activos.
    // No exige membresía activa (evita el loop con RequireActiveAsiAccess).
    path: surfacePaths.account.membership,
    element: (
      <RequireAuth>
        <RequireCompletedBaseOnboarding>
          <MembershipStatusPage />
        </RequireCompletedBaseOnboarding>
      </RequireAuth>
    )
  },
  {
    path: surfacePaths.candidate.root,
    element: (
      <RequireAuth>
        <RequireCompletedBaseOnboarding>
          <CandidateShell />
        </RequireCompletedBaseOnboarding>
      </RequireAuth>
    ),
    children: [
      {
        index: true,
        element: <CandidateHomePage />
      },
      {
        // Legacy alias only. First-run setup now lives inside the profile surface.
        path: 'onboarding',
        element: <Navigate replace to={surfacePaths.candidate.profile} />
      },
      {
        path: 'recruiter-request',
        element: <RecruiterRequestPage />
      },
      {
        path: 'authority-request',
        element: <AuthorityRequestPage />
      },
      {
        path: 'profile',
        element: <CandidateProfilePage />
      },
      {
        path: 'applications',
        element: (
          <RequireActiveAsiAccess surface="candidate">
            <ApplicationsOverviewPage />
          </RequireActiveAsiAccess>
        )
      },
      {
        path: '*',
        element: <SurfaceStatusPage kind="not-found" surface="candidate" />
      }
    ]
  },
  {
    path: surfacePaths.workspace.root,
    element: (
      <RequireCompletedBaseOnboarding>
        <RequireActiveAsiAccess surface="workspace">
          <RequirePermission permission="workspace:read">
            <EmployerShell />
          </RequirePermission>
        </RequireActiveAsiAccess>
      </RequireCompletedBaseOnboarding>
    ),
    children: [
      {
        index: true,
        element: <ResumenDashboardPage />
      },
      {
        path: 'activity',
        element: <WorkspaceActivityPage />
      },
      {
        path: 'jobs',
        element: <JobsOverviewPage />
      },
      {
        path: 'applications',
        element: (
          <RequirePermission permission="application:read" surface="workspace">
            <WorkspaceApplicationsPage />
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
        path: 'talent-pool',
        element: (
          <RequirePermission permission="candidate_directory:read">
            <WorkspaceSectionPlaceholderPage
              eyebrow="Reclutamiento"
              title="Banco de talento"
              description="Talento guardado y preseleccionado para futuras vacantes."
            />
          </RequirePermission>
        )
      },
      {
        path: 'pipeline',
        element: (
          <RequirePermission permission="application:read" surface="workspace">
            <PipelineBoardPage />
          </RequirePermission>
        )
      },
      {
        path: 'reports',
        element: <WorkspaceReportsPage />
      },
      {
        path: 'settings',
        element: <WorkspaceOverviewPage />
      },
      {
        path: 'settings/access',
        element: (
          <RequirePermission permission="role:read" surface="workspace">
            <RbacOverviewPage />
          </RequirePermission>
        )
      },
      {
        path: '*',
        element: <SurfaceStatusPage kind="not-found" surface="workspace" />
      }
    ]
  },
  {
    path: surfacePaths.admin.root,
    element: (
      <RequireCompletedBaseOnboarding>
        <RequireAdminAccess>
          <AdminShell />
        </RequireAdminAccess>
      </RequireCompletedBaseOnboarding>
    ),
    children: [
      {
        index: true,
        element: <AdminConsolePage />
      },
      {
        path: 'approvals',
        element: (
          <RequireAnyPermission permissions={approvalReviewPermissions} surface="admin">
            <RecruiterReviewPage />
          </RequireAnyPermission>
        )
      },
      {
        path: 'platform',
        element: (
          <RequirePermission permission="platform_dashboard:read" surface="admin">
            <PlatformOpsDashboardPage />
          </RequirePermission>
        )
      },
      {
        path: 'moderation',
        element: (
          <RequirePermission permission="moderation:read" surface="admin">
            <ModerationOverviewPage />
          </RequirePermission>
        )
      },
      {
        path: 'errors',
        element: (
          <RequirePermission permission="audit_log:read" surface="admin">
            <ErrorLogReviewPage />
          </RequirePermission>
        )
      },
      {
        path: 'bootstrap-owner',
        element: <BootstrapOwnerPage />
      },
      {
        path: '*',
        element: <SurfaceStatusPage kind="not-found" surface="admin" />
      }
    ]
  }
]
