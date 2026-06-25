/* eslint-disable react-refresh/only-export-components */
import { lazy } from 'react'
import type { RouteObject } from 'react-router-dom'

import { surfacePaths } from '@/app/router/surface-paths'
import { RouteSuspense } from '@/app/router/route-suspense'
import { LazySurfaceStatusPage } from '@/app/router/routes/lazy-surface-status-page'

const InstitutionalShell = lazy(() =>
  import('@/experiences/institutional/layouts/institutional-shell').then(({ InstitutionalShell }) => ({ default: InstitutionalShell }))
)
const ContactUsPage = lazy(() => import('@/experiences/institutional/pages/contact-us-page').then(({ ContactUsPage }) => ({ default: ContactUsPage })))
const DirectoryPage = lazy(() => import('@/experiences/institutional/pages/directory-page').then(({ DirectoryPage }) => ({ default: DirectoryPage })))
const DonatePage = lazy(() => import('@/experiences/institutional/pages/donate-page').then(({ DonatePage }) => ({ default: DonatePage })))
const EligibilityPage = lazy(() => import('@/experiences/institutional/pages/eligibility-page').then(({ EligibilityPage }) => ({ default: EligibilityPage })))
const InstitutionalHomePage = lazy(() =>
  import('@/experiences/institutional/pages/institutional-home-page').then(({ InstitutionalHomePage }) => ({ default: InstitutionalHomePage }))
)
const MembershipApplyPage = lazy(() =>
  import('@/experiences/institutional/pages/membership-apply-page').then(({ MembershipApplyPage }) => ({ default: MembershipApplyPage }))
)
const MembershipCategoriesPage = lazy(() =>
  import('@/experiences/institutional/pages/membership-categories-page').then(({ MembershipCategoriesPage }) => ({ default: MembershipCategoriesPage }))
)
const MembershipPage = lazy(() => import('@/experiences/institutional/pages/membership-page').then(({ MembershipPage }) => ({ default: MembershipPage })))
const NewsPage = lazy(() => import('@/experiences/institutional/pages/news-page').then(({ NewsPage }) => ({ default: NewsPage })))
const PaymentPolicyPage = lazy(() =>
  import('@/experiences/institutional/pages/payment-policy-page').then(({ PaymentPolicyPage }) => ({ default: PaymentPolicyPage }))
)
const ProjectFundingPage = lazy(() =>
  import('@/experiences/institutional/pages/project-funding-page').then(({ ProjectFundingPage }) => ({ default: ProjectFundingPage }))
)
const ProjectsPage = lazy(() => import('@/experiences/institutional/pages/projects-page').then(({ ProjectsPage }) => ({ default: ProjectsPage })))
const WhoWeArePage = lazy(() => import('@/experiences/institutional/pages/who-we-are-page').then(({ WhoWeArePage }) => ({ default: WhoWeArePage })))

export const institutionalRoutes: RouteObject[] = [
  {
    path: surfacePaths.institutional.home,
    element: (
      <RouteSuspense>
        <InstitutionalShell />
      </RouteSuspense>
    ),
    children: [
      {
        index: true,
        element: (
          <RouteSuspense>
            <InstitutionalHomePage />
          </RouteSuspense>
        )
      },
      {
        path: 'home',
        element: (
          <RouteSuspense>
            <InstitutionalHomePage />
          </RouteSuspense>
        )
      },
      {
        path: 'membership',
        element: (
          <RouteSuspense>
            <MembershipPage />
          </RouteSuspense>
        )
      },
      {
        path: 'membership/categories',
        element: (
          <RouteSuspense>
            <MembershipCategoriesPage />
          </RouteSuspense>
        )
      },
      {
        path: 'membership/apply',
        element: (
          <RouteSuspense>
            <MembershipApplyPage />
          </RouteSuspense>
        )
      },
      {
        path: 'eligibility',
        element: (
          <RouteSuspense>
            <EligibilityPage />
          </RouteSuspense>
        )
      },
      {
        path: 'projects',
        element: (
          <RouteSuspense>
            <ProjectsPage />
          </RouteSuspense>
        )
      },
      {
        path: 'projects/funding',
        element: (
          <RouteSuspense>
            <ProjectFundingPage />
          </RouteSuspense>
        )
      },
      {
        path: 'donate',
        element: (
          <RouteSuspense>
            <DonatePage />
          </RouteSuspense>
        )
      },
      {
        path: 'terms',
        element: (
          <RouteSuspense>
            <PaymentPolicyPage kind="terms" />
          </RouteSuspense>
        )
      },
      {
        path: 'privacy',
        element: (
          <RouteSuspense>
            <PaymentPolicyPage kind="privacy" />
          </RouteSuspense>
        )
      },
      {
        path: 'refunds-cancellations',
        element: (
          <RouteSuspense>
            <PaymentPolicyPage kind="refunds" />
          </RouteSuspense>
        )
      },
      {
        path: 'delivery-policy',
        element: (
          <RouteSuspense>
            <PaymentPolicyPage kind="delivery" />
          </RouteSuspense>
        )
      },
      {
        path: 'payment-security',
        element: (
          <RouteSuspense>
            <PaymentPolicyPage kind="security" />
          </RouteSuspense>
        )
      },
      {
        path: 'payment-receipt-model',
        element: (
          <RouteSuspense>
            <PaymentPolicyPage kind="receipt" />
          </RouteSuspense>
        )
      },
      {
        path: 'who-we-are',
        element: (
          <RouteSuspense>
            <WhoWeArePage />
          </RouteSuspense>
        )
      },
      {
        path: 'contact-us',
        element: (
          <RouteSuspense>
            <ContactUsPage />
          </RouteSuspense>
        )
      },
      {
        path: 'directory',
        element: (
          <RouteSuspense>
            <DirectoryPage />
          </RouteSuspense>
        )
      },
      {
        path: 'news',
        element: (
          <RouteSuspense>
            <NewsPage />
          </RouteSuspense>
        )
      },
      {
        path: '*',
        element: <LazySurfaceStatusPage kind="not-found" surface="institutional" />
      }
    ]
  }
]
