const storefrontPaths = {
  home: '/platform',
  jobs: '/platform/jobs',
  jobsRoot: '/platform/jobs',
  jobDetail: (jobSlug: string) => `/platform/jobs/${jobSlug}`,
  jobApply: (jobSlug: string) => `/platform/jobs/${jobSlug}/apply`,
  offline: '/platform/offline'
} as const

export const surfacePaths = {
  institutional: {
    home: '/',
    homeAlias: '/home',
    membership: '/membership',
    membershipCategories: '/membership/categories',
    membershipApply: '/membership/apply',
    eligibility: '/eligibility',
    projects: '/projects',
    projectFunding: '/projects/funding',
    donate: '/donate',
    whoWeAre: '/who-we-are',
    contactUs: '/contact-us',
    directory: '/directory',
    news: '/news'
  },
  storefront: storefrontPaths,
  public: storefrontPaths,
  auth: {
    root: '/auth',
    signIn: '/auth/sign-in',
    signUp: '/auth/sign-up',
    confirm: '/auth/confirm'
  },
  app: {
    home: '/app'
  },
  candidate: {
    root: '/candidate',
    profile: '/candidate/profile',
    applications: '/candidate/applications',
    onboarding: '/candidate/onboarding',
    recruiterRequest: '/candidate/recruiter-request'
  },
  workspace: {
    root: '/workspace',
    jobs: '/workspace/jobs',
    talent: '/workspace/talent',
    pipeline: '/workspace/pipeline',
    access: '/workspace/settings/access'
  },
  admin: {
    root: '/admin',
    approvals: '/admin/approvals',
    platform: '/admin/platform',
    moderation: '/admin/moderation',
    errors: '/admin/errors',
    bootstrapOwner: '/admin/bootstrap-owner'
  }
} as const

export function getAuthenticatedHomePath(hasWorkspaceAccess: boolean) {
  return hasWorkspaceAccess ? surfacePaths.workspace.root : surfacePaths.candidate.profile
}
