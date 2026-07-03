const storefrontPaths = {
  home: '/platform',
  jobs: '/account/jobs',
  jobsRoot: '/account/jobs',
  jobDetail: (jobSlug: string) => `/account/jobs/${jobSlug}`,
  jobApply: (jobSlug: string) => `/account/jobs/${jobSlug}/apply`,
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
    legalCenter: '/legal',
    terms: '/terms',
    privacy: '/privacy',
    refunds: '/refunds-cancellations',
    delivery: '/delivery-policy',
    paymentSecurity: '/payment-security',
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
  account: {
    root: '/account',
    home: '/account',
    jobs: '/account/jobs',
    jobsRoot: '/account/jobs',
    jobDetail: (jobSlug: string) => `/account/jobs/${jobSlug}`,
    jobApply: (jobSlug: string) => `/account/jobs/${jobSlug}/apply`,
    membership: '/account/membership',
    profile: '/account/profile',
    applications: '/account/applications',
    onboarding: '/account/onboarding',
    recruiterRequest: '/account/recruiter-request',
    authorityRequest: '/account/authority-request',
    authorityRequestLink: (token: string) => `/account/authority-request/${token}`,
    membershipQueue: '/account/membership-queue'
  },
  candidate: {
    root: '/account',
    home: '/account',
    profile: '/account/profile',
    applications: '/account/applications',
    onboarding: '/account/onboarding',
    recruiterRequest: '/account/recruiter-request',
    authorityRequest: '/account/authority-request',
    authorityRequestLink: (token: string) => `/account/authority-request/${token}`,
    membershipQueue: '/account/membership-queue'
  },
  legacy: {
    candidateRoot: '/candidate',
    candidateHome: '/candidate',
    candidateProfile: '/candidate/profile',
    candidateApplications: '/candidate/applications',
    candidateOnboarding: '/candidate/onboarding',
    candidateRecruiterRequest: '/candidate/recruiter-request',
    candidateAuthorityRequest: '/candidate/authority-request',
    candidateAuthorityRequestLink: (token: string) => `/candidate/authority-request/${token}`,
    candidateMembershipQueue: '/candidate/membership-queue',
    platformJobsRoot: '/platform/jobs',
    platformJobDetail: (jobSlug: string) => `/platform/jobs/${jobSlug}`,
    platformJobApply: (jobSlug: string) => `/platform/jobs/${jobSlug}/apply`
  },
  workspace: {
    root: '/workspace',
    dashboard: '/workspace',
    activity: '/workspace/activity',
    jobs: '/workspace/jobs',
    applications: '/workspace/applications',
    talent: '/workspace/talent',
    talentPool: '/workspace/talent-pool',
    pipeline: '/workspace/pipeline',
    pipelineStage: (stage: string) => `/workspace/pipeline/${stage}`,
    reports: '/workspace/reports',
    settings: '/workspace/settings',
    access: '/workspace/settings/access'
  },
  admin: {
    root: '/admin',
    approvals: '/admin/approvals',
    platform: '/admin/platform',
    moderation: '/admin/moderation',
    errors: '/admin/errors',
    membership: '/admin/membership',
    authority: '/admin/authority',
    correos: '/admin/correos',
    payments: '/admin/payments',
    donations: '/admin/donations',
    finances: '/admin/finances',
    communications: '/admin/communications',
    stressHarness: '/admin/stress-harness',
    bootstrapOwner: '/admin/bootstrap-owner'
  }
} as const

export function getAuthenticatedHomePath(hasWorkspaceAccess: boolean, hasCompletedOnboarding = true) {
  if (!hasCompletedOnboarding) {
    return surfacePaths.account.profile
  }

  return hasWorkspaceAccess ? surfacePaths.workspace.root : surfacePaths.account.home
}
