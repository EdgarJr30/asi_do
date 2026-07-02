/* eslint-disable react-refresh/only-export-components */
import { lazy } from 'react'
import type { RouteObject } from 'react-router-dom'
import { Navigate } from 'react-router-dom'

import { RouteSuspense } from '@/app/router/route-suspense'
import {
  RequireActiveAsiAccess,
  RequireAdminAccess,
  RequireAnyPermission,
  RequireAuth,
  RequireCompletedBaseOnboarding,
  RequirePermission,
  RequirePlatformAdmin
} from '@/lib/auth/guards'
import { surfacePaths } from '@/app/router/surface-paths'
import { LazySurfaceStatusPage } from '@/app/router/routes/lazy-surface-status-page'
import { approvalReviewPermissions } from '@/shared/constants/navigation'

const ApplicationsOverviewPage = lazy(() =>
  import('@/features/applications/pages/applications-overview-page').then(({ ApplicationsOverviewPage }) => ({ default: ApplicationsOverviewPage }))
)
const WorkspaceApplicationsPage = lazy(() =>
  import('@/features/applications/pages/workspace-applications-page').then(({ WorkspaceApplicationsPage }) => ({ default: WorkspaceApplicationsPage }))
)
const AuthConfirmPage = lazy(() => import('@/features/auth/pages/auth-confirm-page').then(({ AuthConfirmPage }) => ({ default: AuthConfirmPage })))
const AuthPage = lazy(() => import('@/features/auth/pages/auth-page').then(({ AuthPage }) => ({ default: AuthPage })))
const BootstrapOwnerPage = lazy(() => import('@/features/auth/pages/bootstrap-owner-page').then(({ BootstrapOwnerPage }) => ({ default: BootstrapOwnerPage })))
const SignInPage = lazy(() => import('@/features/auth/pages/sign-in-page').then(({ SignInPage }) => ({ default: SignInPage })))
const SignUpPage = lazy(() => import('@/features/auth/pages/sign-up-page').then(({ SignUpPage }) => ({ default: SignUpPage })))
const AuthorityRequestPage = lazy(() => import('@/features/authority-requests/pages/authority-request-page').then(({ AuthorityRequestPage }) => ({ default: AuthorityRequestPage })))
const CandidateProfilePage = lazy(() => import('@/features/candidate-profile/pages/candidate-profile-page').then(({ CandidateProfilePage }) => ({ default: CandidateProfilePage })))
const CandidateHomePage = lazy(() => import('@/features/dashboard/pages/candidate-home-page').then(({ CandidateHomePage }) => ({ default: CandidateHomePage })))
const ResumenDashboardPage = lazy(() => import('@/features/dashboard/pages/resumen-dashboard-page').then(({ ResumenDashboardPage }) => ({ default: ResumenDashboardPage })))
const WorkspaceActivityPage = lazy(() => import('@/features/dashboard/pages/workspace-activity-page').then(({ WorkspaceActivityPage }) => ({ default: WorkspaceActivityPage })))
const WorkspaceReportsPage = lazy(() => import('@/features/dashboard/pages/workspace-reports-page').then(({ WorkspaceReportsPage }) => ({ default: WorkspaceReportsPage })))
const WorkspaceSectionPlaceholderPage = lazy(() =>
  import('@/features/dashboard/pages/workspace-section-placeholder-page').then(({ WorkspaceSectionPlaceholderPage }) => ({ default: WorkspaceSectionPlaceholderPage }))
)
const ErrorLogReviewPage = lazy(() => import('@/features/error-monitoring/pages/error-log-review-page').then(({ ErrorLogReviewPage }) => ({ default: ErrorLogReviewPage })))
const AdminConsolePage = lazy(() => import('@/features/internal/pages/admin-console-page').then(({ AdminConsolePage }) => ({ default: AdminConsolePage })))
const AdminCommunicationsPage = lazy(() =>
  import('@/features/internal/pages/admin-communications-page').then(({ AdminCommunicationsPage }) => ({ default: AdminCommunicationsPage }))
)
const AdminFinancePage = lazy(() => import('@/features/internal/pages/admin-finance-page').then(({ AdminFinancePage }) => ({ default: AdminFinancePage })))
const StressHarnessPage = lazy(() => import('@/features/internal/pages/stress-harness-page').then(({ StressHarnessPage }) => ({ default: StressHarnessPage })))
const JobsOverviewPage = lazy(() => import('@/features/jobs/pages/jobs-overview-page').then(({ JobsOverviewPage }) => ({ default: JobsOverviewPage })))
const MembershipConsolePage = lazy(() => import('@/features/membership/pages/membership-console-page').then(({ MembershipConsolePage }) => ({ default: MembershipConsolePage })))
const MembershipStatusPage = lazy(() => import('@/features/membership/pages/membership-status-page').then(({ MembershipStatusPage }) => ({ default: MembershipStatusPage })))
const PastorMembershipQueuePage = lazy(() =>
  import('@/features/membership/pages/pastor-membership-queue-page').then(({ PastorMembershipQueuePage }) => ({ default: PastorMembershipQueuePage }))
)
const ModerationOverviewPage = lazy(() => import('@/features/moderation/pages/moderation-overview-page').then(({ ModerationOverviewPage }) => ({ default: ModerationOverviewPage })))
const PipelineBoardPage = lazy(() => import('@/features/pipeline/pages/pipeline-board-page').then(({ PipelineBoardPage }) => ({ default: PipelineBoardPage })))
const PlatformOpsDashboardPage = lazy(() =>
  import('@/features/platform-ops/pages/platform-ops-dashboard-page').then(({ PlatformOpsDashboardPage }) => ({ default: PlatformOpsDashboardPage }))
)
const RbacOverviewPage = lazy(() => import('@/features/rbac/pages/rbac-overview-page').then(({ RbacOverviewPage }) => ({ default: RbacOverviewPage })))
const RecruiterRequestPage = lazy(() => import('@/features/recruiter-requests/pages/recruiter-request-page').then(({ RecruiterRequestPage }) => ({ default: RecruiterRequestPage })))
const RecruiterReviewPage = lazy(() => import('@/features/recruiter-requests/pages/recruiter-review-page').then(({ RecruiterReviewPage }) => ({ default: RecruiterReviewPage })))
const TalentDirectoryPage = lazy(() => import('@/features/talent/pages/talent-directory-page').then(({ TalentDirectoryPage }) => ({ default: TalentDirectoryPage })))
const WorkspaceOverviewPage = lazy(() => import('@/features/tenants/pages/workspace-overview-page').then(({ WorkspaceOverviewPage }) => ({ default: WorkspaceOverviewPage })))
const AdminShell = lazy(() => import('@/experiences/app/layouts/admin-shell').then(({ AdminShell }) => ({ default: AdminShell })))
const AuthShell = lazy(() => import('@/experiences/app/layouts/auth-shell').then(({ AuthShell }) => ({ default: AuthShell })))
const CandidateShell = lazy(() => import('@/experiences/app/layouts/candidate-shell').then(({ CandidateShell }) => ({ default: CandidateShell })))
const EmployerShell = lazy(() => import('@/experiences/app/layouts/employer-shell').then(({ EmployerShell }) => ({ default: EmployerShell })))
const AppEntryRedirect = lazy(() => import('@/experiences/app/routes/app-entry-redirect').then(({ AppEntryRedirect }) => ({ default: AppEntryRedirect })))

export const applicationRoutes: RouteObject[] = [
  {
    path: '/auth',
    element: (
      <RouteSuspense>
        <AuthShell />
      </RouteSuspense>
    ),
    children: [
      {
        index: true,
        element: (
          <RouteSuspense>
            <AuthPage />
          </RouteSuspense>
        )
      },
      {
        path: 'sign-in',
        element: (
          <RouteSuspense>
            <SignInPage />
          </RouteSuspense>
        )
      },
      {
        path: 'sign-up',
        element: (
          <RouteSuspense>
            <SignUpPage />
          </RouteSuspense>
        )
      },
      {
        path: 'confirm',
        element: (
          <RouteSuspense>
            <AuthConfirmPage />
          </RouteSuspense>
        )
      },
      {
        path: '*',
        element: <LazySurfaceStatusPage kind="not-found" surface="auth" />
      }
    ]
  },
  {
    path: surfacePaths.app.home,
    element: (
      <RequireAuth>
        <RequireCompletedBaseOnboarding>
          <RouteSuspense>
            <AppEntryRedirect />
          </RouteSuspense>
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
          <RouteSuspense>
            <CandidateShell />
          </RouteSuspense>
        </RequireCompletedBaseOnboarding>
      </RequireAuth>
    ),
    children: [
      {
        index: true,
        element: (
          <RouteSuspense>
            <MembershipStatusPage />
          </RouteSuspense>
        )
      }
    ]
  },
  {
    path: surfacePaths.candidate.root,
    element: (
      <RequireAuth>
        <RequireCompletedBaseOnboarding>
          <RouteSuspense>
            <CandidateShell />
          </RouteSuspense>
        </RequireCompletedBaseOnboarding>
      </RequireAuth>
    ),
    children: [
      {
        index: true,
        element: (
          <RouteSuspense>
            <CandidateHomePage />
          </RouteSuspense>
        )
      },
      {
        // Legacy alias only. First-run setup now lives inside the profile surface.
        path: 'onboarding',
        element: <Navigate replace to={surfacePaths.candidate.profile} />
      },
      {
        path: 'recruiter-request',
        element: (
          <RouteSuspense>
            <RecruiterRequestPage />
          </RouteSuspense>
        )
      },
      {
        // Solo accesible con un token de invitación generado por un admin.
        path: 'authority-request/:token',
        element: (
          <RouteSuspense>
            <AuthorityRequestPage />
          </RouteSuspense>
        )
      },
      {
        // Cola del pastor: visible para usuarios con autoridad pastoral activa.
        // La RLS limita las filas a sus iglesias; no requiere acceso ATS activo.
        path: 'membership-queue',
        element: (
          <RouteSuspense>
            <PastorMembershipQueuePage />
          </RouteSuspense>
        )
      },
      {
        path: 'profile',
        element: (
          <RouteSuspense>
            <CandidateProfilePage />
          </RouteSuspense>
        )
      },
      {
        path: 'applications',
        element: (
          <RequireActiveAsiAccess surface="candidate">
            <RouteSuspense>
              <ApplicationsOverviewPage />
            </RouteSuspense>
          </RequireActiveAsiAccess>
        )
      },
      {
        path: '*',
        element: <LazySurfaceStatusPage kind="not-found" surface="candidate" />
      }
    ]
  },
  {
    path: surfacePaths.workspace.root,
    element: (
      <RequireCompletedBaseOnboarding>
        <RequireActiveAsiAccess surface="workspace">
          <RequirePermission permission="workspace:read">
            <RouteSuspense>
              <EmployerShell />
            </RouteSuspense>
          </RequirePermission>
        </RequireActiveAsiAccess>
      </RequireCompletedBaseOnboarding>
    ),
    children: [
      {
        index: true,
        element: (
          <RouteSuspense>
            <ResumenDashboardPage />
          </RouteSuspense>
        )
      },
      {
        path: 'activity',
        element: (
          <RouteSuspense>
            <WorkspaceActivityPage />
          </RouteSuspense>
        )
      },
      {
        path: 'jobs',
        element: (
          <RouteSuspense>
            <JobsOverviewPage />
          </RouteSuspense>
        )
      },
      {
        path: 'applications',
        element: (
          <RequirePermission permission="application:read" surface="workspace">
            <RouteSuspense>
              <WorkspaceApplicationsPage />
            </RouteSuspense>
          </RequirePermission>
        )
      },
      {
        path: 'talent',
        element: (
          <RequirePermission permission="candidate_directory:read">
            <RouteSuspense>
              <TalentDirectoryPage />
            </RouteSuspense>
          </RequirePermission>
        )
      },
      {
        path: 'talent-pool',
        element: (
          <RequirePermission permission="candidate_directory:read">
            <RouteSuspense>
              <WorkspaceSectionPlaceholderPage
                eyebrow="Reclutamiento"
                title="Banco de talento"
                description="Talento guardado y preseleccionado para futuras vacantes."
              />
            </RouteSuspense>
          </RequirePermission>
        )
      },
      {
        path: 'pipeline',
        element: (
          <RequirePermission permission="application:read" surface="workspace">
            <RouteSuspense>
              <PipelineBoardPage />
            </RouteSuspense>
          </RequirePermission>
        )
      },
      {
        path: 'reports',
        element: (
          <RouteSuspense>
            <WorkspaceReportsPage />
          </RouteSuspense>
        )
      },
      {
        path: 'settings',
        element: (
          <RouteSuspense>
            <WorkspaceOverviewPage />
          </RouteSuspense>
        )
      },
      {
        path: 'settings/access',
        element: (
          <RequirePermission permission="role:read" surface="workspace">
            <RouteSuspense>
              <RbacOverviewPage />
            </RouteSuspense>
          </RequirePermission>
        )
      },
      {
        path: '*',
        element: <LazySurfaceStatusPage kind="not-found" surface="workspace" />
      }
    ]
  },
  {
    path: surfacePaths.admin.root,
    element: (
      <RequireCompletedBaseOnboarding>
        <RequireAdminAccess>
          <RouteSuspense>
            <AdminShell />
          </RouteSuspense>
        </RequireAdminAccess>
      </RequireCompletedBaseOnboarding>
    ),
    children: [
      {
        index: true,
        element: (
          <RouteSuspense>
            <AdminConsolePage />
          </RouteSuspense>
        )
      },
      {
        path: 'approvals',
        element: (
          <RequireAnyPermission permissions={approvalReviewPermissions} surface="admin">
            <RouteSuspense>
              <RecruiterReviewPage />
            </RouteSuspense>
          </RequireAnyPermission>
        )
      },
      {
        path: 'platform',
        element: (
          <RequirePermission permission="platform_dashboard:read" surface="admin">
            <RouteSuspense>
              <PlatformOpsDashboardPage />
            </RouteSuspense>
          </RequirePermission>
        )
      },
      {
        path: 'moderation',
        element: (
          <RequirePermission permission="moderation:read" surface="admin">
            <RouteSuspense>
              <ModerationOverviewPage />
            </RouteSuspense>
          </RequirePermission>
        )
      },
      {
        path: 'errors',
        element: (
          <RequirePermission permission="audit_log:read" surface="admin">
            <RouteSuspense>
              <ErrorLogReviewPage />
            </RouteSuspense>
          </RequirePermission>
        )
      },
      {
        path: 'membership',
        element: (
          <RequirePermission permission="membership_payment:verify" surface="admin">
            <RouteSuspense>
              <MembershipConsolePage />
            </RouteSuspense>
          </RequirePermission>
        )
      },
      {
        path: 'authority',
        element: <Navigate replace to={`${surfacePaths.admin.approvals}?tab=authority`} />
      },
      {
        path: 'payments',
        element: <Navigate replace to={`${surfacePaths.admin.finances}?tab=payments`} />
      },
      {
        path: 'donations',
        element: <Navigate replace to={`${surfacePaths.admin.finances}?tab=donations`} />
      },
      {
        path: 'finances',
        element: (
          <RequirePermission permission="platform_dashboard:read" surface="admin">
            <RouteSuspense>
              <AdminFinancePage />
            </RouteSuspense>
          </RequirePermission>
        )
      },
      {
        path: 'correos',
        element: <Navigate replace to={`${surfacePaths.admin.communications}?tab=emails`} />
      },
      {
        path: 'communications',
        element: (
          <RequirePermission permission="email:read" surface="admin">
            <RouteSuspense>
              <AdminCommunicationsPage />
            </RouteSuspense>
          </RequirePermission>
        )
      },
      {
        path: 'stress-harness',
        element: (
          <RequirePlatformAdmin>
            <RouteSuspense>
              <StressHarnessPage />
            </RouteSuspense>
          </RequirePlatformAdmin>
        )
      },
      {
        path: 'bootstrap-owner',
        element: (
          <RouteSuspense>
            <BootstrapOwnerPage />
          </RouteSuspense>
        )
      },
      {
        path: '*',
        element: <LazySurfaceStatusPage kind="not-found" surface="admin" />
      }
    ]
  }
]
