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
    terms: '/terms',
    privacy: '/privacy',
    refunds: '/refunds-cancellations',
    delivery: '/delivery-policy',
    paymentSecurity: '/payment-security',
    receiptModel: '/payment-receipt-model',
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
    membership: '/account/membership'
  },
  candidate: {
    root: '/candidate',
    home: '/candidate',
    profile: '/candidate/profile',
    applications: '/candidate/applications',
    onboarding: '/candidate/onboarding',
    recruiterRequest: '/candidate/recruiter-request',
    authorityRequest: '/candidate/authority-request',
    authorityRequestLink: (token: string) => `/candidate/authority-request/${token}`,
    membershipQueue: '/candidate/membership-queue'
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
    return surfacePaths.candidate.profile
  }

  return hasWorkspaceAccess ? surfacePaths.workspace.root : surfacePaths.candidate.home
}
