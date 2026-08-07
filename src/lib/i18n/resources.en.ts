import type { TranslationResource } from '@/lib/i18n/resources.es'

/**
 * Recursos en inglés, cargados **solo si hacen falta**.
 *
 * Antes viajaban en el bundle inicial junto al español, aunque la mayoría de la
 * audiencia es dominicana y nunca cambia de idioma. Se importa en diferido desde
 * `config.ts` cuando el idioma detectado es `en` o cuando el usuario lo cambia.
 */
const enResources: TranslationResource = {
    translation: {
      app: {
        name: 'ASI Rep. Dominicana'
      },
      navigation: {
        home: {
          title: 'Home',
          description: 'Project baseline'
        },
        access: {
          title: 'Access',
          description: 'Sign up and sign in'
        },
        onboarding: {
          title: 'Profile',
          description: 'User baseline data'
        },
        candidate: {
          title: 'Candidate profile',
          description: 'Resume and completeness'
        },
        recruiterRequest: {
          title: 'Operator',
          description: 'Validation request'
        },
        jobs: {
          title: 'Jobs',
          description: 'Vacancies and discovery'
        },
        talent: {
          title: 'Talent',
          description: 'Candidate directory'
        },
        applications: {
          title: 'Applications',
          description: 'History and applicants'
        },
        pipeline: {
          title: 'Pipeline',
          description: 'Opportunity workflow'
        },
        workspace: {
          title: 'Workspace',
          description: 'Tenant and company'
        },
        rbac: {
          title: 'RBAC',
          description: 'Roles and permissions'
        },
        approvals: {
          title: 'Approvals',
          description: 'Operator reviews'
        },
        platform: {
          title: 'Platform',
          description: 'Ops and plans'
        },
        moderation: {
          title: 'Moderation',
          description: 'Trust and safety'
        }
      },
      shell: {
        offlineBanner:
          'Offline mode is active. The shell remains available and mutations should retry when the network returns.',
        phaseBadge: 'Phase 7',
        description:
          'Mobile-first, PWA-first, RBAC-first, and Supabase-first baseline with opportunity workflow, notifications, and platform operations.',
        liveSession: 'Live session',
        guestSession: 'Guest session',
        authenticatedBadge: 'Authenticated',
        guestBadge: 'Guest',
        configBadge: 'Setup pending',
        adminBadge: 'Admin reviewer',
        navNote: 'Routes and navigation already honor auth, permissions, and visible MVP states.',
        eyebrow: 'Opportunity SaaS Platform',
        title: 'MVP launch-readiness foundations',
        profileAction: 'Profile',
        candidateAction: 'Candidate profile',
        recruiterAction: 'Operator request',
        reviewAction: 'Admin review',
        accessAction: 'Access',
        signOutAction: 'Sign out',
        signingOutAction: 'Signing out...',
        signOutSuccess: 'Signed out',
        signOutErrorTitle: 'Could not sign out'
      },
      home: {
        heroBadge: 'MVP identity',
        heroTitle:
          'Authentication, guided profile setup, and operator approval on top of a real multi-tenant foundation.',
        heroDescription:
          'Every account starts as a standard user, sensitive attachments live in Supabase Storage, and operational workspace creation stays behind administrative approval.',
        accountCardEyebrow: 'Current account',
        statusCardEyebrow: 'Access state',
        statusAuthenticated: 'Supabase session active',
        statusGuest: 'No active session',
        statusRecruiterApproved: 'Operational workspace access is active with a tenant.',
        statusRecruiterStandard: 'Standard user still pending operator validation.',
        primaryGuestAction: 'Create account or sign in',
        secondaryGuestAction: 'Learn the operator flow',
        primaryAuthenticatedAction: 'Prepare profile',
        secondaryAuthenticatedAction: 'Request recruiting access',
        moduleCardEyebrow: 'Active business rule',
        moduleCardTitle: 'There is no direct operator signup',
        moduleCardDescription:
          'The MVP flow protects the platform with RBAC, human approval, and private assets until the company is validated.',
        moduleCardRuleOne: 'Every signup creates a standard platform user.',
        moduleCardRuleTwo: 'Only admins can approve and provision an operational tenant.',
        moduleCardRuleThree: 'Temporary logos and verification documents live in Supabase Storage.',
        journeyTitle: 'Module journey',
        journeyDescription: 'Home now acts as the entry dashboard for the MVP identity flow.',
        stepAccountTitle: 'Sign up and sign in',
        stepAccountDescription: 'Email + password backed by a real Supabase Auth session.',
        stepProfileTitle: 'Guided profile setup',
        stepProfileDescription: 'Baseline profile, locale, country, and private user avatar.',
        stepRequestTitle: 'Recruiting request',
        stepRequestDescription: 'Company details, visual identity, and supporting document.',
        stepReviewTitle: 'Administrative review',
        stepReviewDescription: 'Approval creates the tenant, company profile, and owner membership.',
        stepStateDone: 'Done',
        stepStateCurrent: 'Current',
        stepStatePending: 'Pending',
        stepStateAvailable: 'Available',
        stepStateControlled: 'Admin controlled',
        accessTitle: 'Active controls',
        accessDescription: 'These rules are already enforced through database, permissions, and UI.',
        accessUserTitle: 'Initial access',
        accessUserDescription:
          'Every user starts as a standard user and does not inherit employer access from signup.',
        accessRecruiterTitle: 'Operator provisioning',
        accessRecruiterDescription:
          'The tenant only exists after an approved operator request by an authorized admin.',
        accessStorageTitle: 'Private storage',
        accessStorageDescription:
          'Avatar, temporary logo, and sensitive documents use private buckets and signed URLs.',
        actionAccessTitle: 'Enter the platform',
        actionAccessDescription: 'Create your base account or sign in to prepare your profile.',
        actionAccessButton: 'Open auth',
        actionProfileTitle: 'Prepare your profile',
        actionProfileDescription:
          'Initial profile setup stays behind auth and consolidates the user baseline data.',
        actionProfileButton: 'Open auth',
        actionReviewGuestTitle: 'Operator flow',
        actionReviewGuestDescription:
          'Operator validation is enabled after signup, never directly from registration.',
        actionReviewGuestButton: 'See access',
        actionOnboardingTitle: 'Prepare profile',
        actionOnboardingPending:
          'Some baseline profile data is still missing before the account is ready.',
        actionOnboardingReady:
          'Your profile already has the minimum data; you can review or update it.',
        actionOnboardingButton: 'Open profile',
        actionRecruiterTitle: 'Request recruiting access',
        actionRecruiterPending:
          'Submit your company details to enable its recruiting tools.',
        actionRecruiterApproved:
          'Your account already has employer access, but you can review request history.',
        actionRecruiterButton: 'Complete company request',
        actionAdminTitle: 'Administrative review',
        actionAdminEnabled: 'Your session can approve requests and provision operators from the app.',
        actionAdminLocked: 'Only users with `recruiter_request:review` can open this inbox.',
        actionAdminButton: 'Open approvals',
        actionAdminSecondaryButton: 'See access'
      },
      foundations: {
        title: 'Operational foundations',
        description:
          'i18n, forms, dark mode, and notifications are ready to be reused from the design system.',
        localeLabel: 'Default language',
        themeLabel: 'Theme',
        emailNotificationsLabel: 'Email notifications',
        pushNotificationsLabel: 'Push notifications',
        pushPermissionLabel: 'Browser permission',
        emailConsistency: 'In-app and email share the same event semantics.',
        vapidConfigured: 'Public VAPID key is configured.',
        saveButton: 'Save UI preferences',
        requestPushButton: 'Enable push',
        saveSuccessTitle: 'Preferences updated',
        saveSuccessDescription:
          'Visual and language configuration is now ready for new modules.',
        pushSupported: 'Push is supported by this browser.',
        pushUnsupported: 'Push is not supported by this browser.',
        pushGranted: 'Permission granted.',
        pushDenied: 'Permission denied.',
        pushDefault: 'Permission has not been requested yet.',
        pushMissingKey:
          '`VITE_WEB_PUSH_PUBLIC_KEY` is missing. Subscription stays pending until the public key is configured.',
        pushReadyTitle: 'Push is ready',
        pushReadyDescription:
          'The browser subscription can now be stored in Supabase together with delivery history.',
        pushDeniedTitle: 'Permission was not granted',
        pushDeniedDescription:
          'The user must accept notifications before a push subscription can be registered.',
        dependencyTitle: 'Installed packages',
        dependencyDescription:
          'These dependencies are now part of the project baseline for i18n, forms, theming, and UX feedback.',
        auditTitle: 'Audit required',
        auditDescription:
          'The database records row changes, notification deliveries, and request metadata for full traceability.'
      },
      notifications: {
        title: 'Notification center',
        description:
          'The app can now send test notifications, store them in the inbox, and record push deliveries with auditable history.',
        defaultTitle: 'Push notification test',
        defaultBody: 'This event validates the end-to-end flow across Supabase, the service worker, and delivery logs.',
        formTitleLabel: 'Title',
        formBodyLabel: 'Message',
        formActionUrlLabel: 'Target route',
        sendButton: 'Send test to my session',
        sendingButton: 'Sending...',
        auditNote:
          'Every send writes into `notifications`, `notification_deliveries`, `notification_delivery_logs`, and `audit_logs`.',
        inboxTitle: 'Recent inbox',
        inboxDescription: 'These are your most recent notifications stored in the database.',
        unreadBadge: '{{count}} unread',
        unreadState: 'Pending',
        readBadge: 'Read',
        openAction: 'Open destination',
        markReadButton: 'Mark read',
        loading: 'Loading notifications...',
        empty: 'No notifications have been recorded for this account yet.',
        testSuccessTitle: 'Notification recorded',
        testSuccessNoPush:
          'The inbox record is already stored and audited. If no push was sent, check the browser subscription or project VAPID keys.',
        testSuccessWithPush:
          'The test was recorded and {{sentCount}} push deliveries were sent from {{queuedCount}} queued attempts.',
        testErrorTitle: 'The test could not be sent',
        testErrorDescription: 'Review permissions, Supabase configuration, or the project VAPID keys.'
      },
      theme: {
        light: 'Light',
        dark: 'Dark',
        system: 'System'
      },
      language: {
        es: 'Spanish',
        en: 'English'
      },
      offline: {
        title: 'Offline fallback',
        description:
          'The app shell must remain available even when the network fails. Write actions should retry once connectivity returns.',
        body1: 'This route acts as a reference for offline states and network retries inside the PWA.',
        body2:
          'In later phases we will connect retry views here for auth, jobs, applications, and change synchronization.'
      }
    }
  }

export default enResources
