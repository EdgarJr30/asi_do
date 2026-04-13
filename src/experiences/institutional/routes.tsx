import type { RouteObject } from 'react-router-dom'

import { surfacePaths } from '@/app/router/surface-paths'
import { SurfaceStatusPage } from '@/app/router/routes/surface-status-page'
import { InstitutionalShell } from '@/experiences/institutional/layouts/institutional-shell'
import { ContactUsPage } from '@/experiences/institutional/pages/contact-us-page'
import { DirectoryPage } from '@/experiences/institutional/pages/directory-page'
import { DonatePage } from '@/experiences/institutional/pages/donate-page'
import { EligibilityPage } from '@/experiences/institutional/pages/eligibility-page'
import { InstitutionalHomePage } from '@/experiences/institutional/pages/institutional-home-page'
import { MembershipApplyPage } from '@/experiences/institutional/pages/membership-apply-page'
import { MembershipCategoriesPage } from '@/experiences/institutional/pages/membership-categories-page'
import { MembershipPage } from '@/experiences/institutional/pages/membership-page'
import { NewsPage } from '@/experiences/institutional/pages/news-page'
import { ProjectFundingPage } from '@/experiences/institutional/pages/project-funding-page'
import { ProjectsPage } from '@/experiences/institutional/pages/projects-page'
import { WhoWeArePage } from '@/experiences/institutional/pages/who-we-are-page'

export const institutionalRoutes: RouteObject[] = [
  {
    path: surfacePaths.institutional.home,
    element: <InstitutionalShell />,
    children: [
      {
        index: true,
        element: <InstitutionalHomePage />
      },
      {
        path: 'home',
        element: <InstitutionalHomePage />
      },
      {
        path: 'membership',
        element: <MembershipPage />
      },
      {
        path: 'membership/categories',
        element: <MembershipCategoriesPage />
      },
      {
        path: 'membership/apply',
        element: <MembershipApplyPage />
      },
      {
        path: 'eligibility',
        element: <EligibilityPage />
      },
      {
        path: 'projects',
        element: <ProjectsPage />
      },
      {
        path: 'projects/funding',
        element: <ProjectFundingPage />
      },
      {
        path: 'donate',
        element: <DonatePage />
      },
      {
        path: 'who-we-are',
        element: <WhoWeArePage />
      },
      {
        path: 'contact-us',
        element: <ContactUsPage />
      },
      {
        path: 'directory',
        element: <DirectoryPage />
      },
      {
        path: 'news',
        element: <NewsPage />
      },
      {
        path: '*',
        element: <SurfaceStatusPage kind="not-found" surface="institutional" />
      }
    ]
  }
]
