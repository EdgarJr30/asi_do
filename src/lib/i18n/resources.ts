export const resources = {
  es: {
    translation: {
      app: {
        name: 'ASI Rep. Dominicana'
      },
      navigation: {
        home: {
          title: 'Inicio',
          description: 'Base del proyecto'
        },
        access: {
          title: 'Acceso',
          description: 'Registro e inicio de sesión'
        },
        onboarding: {
          title: 'Perfil',
          description: 'Datos base del usuario'
        },
        candidate: {
          title: 'Perfil candidato',
          description: 'CV y completitud'
        },
        recruiterRequest: {
          title: 'Operador',
          description: 'Solicitud de validación'
        },
        jobs: {
          title: 'Jobs',
          description: 'Vacantes y discovery'
        },
        talent: {
          title: 'Talento',
          description: 'Directorio candidato'
        },
        applications: {
          title: 'Applications',
          description: 'Historial y applicants'
        },
        pipeline: {
          title: 'Pipeline',
          description: 'Flujo de oportunidades'
        },
        workspace: {
          title: 'Workspace',
          description: 'Tenant y company'
        },
        rbac: {
          title: 'RBAC',
          description: 'Roles y permisos'
        },
        approvals: {
          title: 'Approvals',
          description: 'Revisión de operadores'
        },
        platform: {
          title: 'Plataforma',
          description: 'Ops y planes'
        },
        moderation: {
          title: 'Moderation',
          description: 'Trust and safety'
        }
      },
      shell: {
        offlineBanner:
          'Modo offline activo. La shell sigue disponible y las mutaciones deben reintentarse cuando vuelva la red.',
        phaseBadge: 'Fase 7',
        description:
          'Base mobile-first, PWA-first, RBAC-first y Supabase-first con flujo de oportunidades, notificaciones y operaciones de plataforma.',
        liveSession: 'Sesión activa',
        guestSession: 'Sesión invitada',
        authenticatedBadge: 'Autenticado',
        guestBadge: 'Invitado',
        configBadge: 'Config pendiente',
        adminBadge: 'Admin reviewer',
        navNote: 'Las rutas y la navegación ya respetan auth, permisos y estados visibles del MVP.',
        eyebrow: 'Opportunity SaaS Platform',
        title: 'Launch readiness del MVP',
        profileAction: 'Perfil',
        candidateAction: 'Perfil candidato',
        recruiterAction: 'Solicitud de operador',
        reviewAction: 'Review admin',
        accessAction: 'Entrar',
        signOutAction: 'Cerrar sesión',
        signingOutAction: 'Cerrando...',
        signOutSuccess: 'Sesión cerrada',
        signOutErrorTitle: 'No se pudo cerrar la sesión'
      },
      home: {
        heroBadge: 'MVP identity',
        heroTitle:
          'Autenticación, perfil inicial guiado y aprobación de operadores sobre una base multi-tenant real.',
        heroDescription:
          'Todos entran como usuario normal, los adjuntos sensibles viven en Supabase Storage y la creación del workspace operativo queda controlada por aprobación administrativa.',
        accountCardEyebrow: 'Cuenta actual',
        statusCardEyebrow: 'Estado de acceso',
        statusAuthenticated: 'Sesión con Supabase',
        statusGuest: 'Sin sesión iniciada',
        statusRecruiterApproved: 'Workspace operativo habilitado con tenant activo.',
        statusRecruiterStandard: 'Usuario estándar pendiente de validación como operador.',
        primaryGuestAction: 'Crear cuenta o iniciar sesión',
        secondaryGuestAction: 'Conocer el flujo de operador',
        primaryAuthenticatedAction: 'Preparar perfil',
        secondaryAuthenticatedAction: 'Enviar solicitud de operador',
        moduleCardEyebrow: 'Regla de negocio activa',
        moduleCardTitle: 'No existe signup directo de operador',
        moduleCardDescription:
          'El flujo del MVP protege la plataforma con RBAC, aprobación humana y assets privados hasta que la empresa sea validada.',
        moduleCardRuleOne: 'Todo signup crea un usuario normal de plataforma.',
        moduleCardRuleTwo: 'Solo admins pueden aprobar y provisionar el tenant operativo.',
        moduleCardRuleThree: 'Logos y documentos de verificación se guardan en Supabase Storage.',
        journeyTitle: 'Journey del módulo',
        journeyDescription: 'El home ahora sirve como tablero de entrada para los pasos base del MVP.',
        stepAccountTitle: 'Registro e inicio de sesión',
        stepAccountDescription: 'Email + contraseña con sesión real de Supabase Auth.',
        stepProfileTitle: 'Perfil inicial guiado',
        stepProfileDescription: 'Perfil base, locale, país y avatar privado del usuario.',
        stepRequestTitle: 'Solicitud de operador',
        stepRequestDescription: 'Empresa, slug, logo temporal y documento de verificación.',
        stepReviewTitle: 'Revisión administrativa',
        stepReviewDescription: 'Aprobación que crea tenant, company profile y membership owner.',
        stepStateDone: 'Listo',
        stepStateCurrent: 'Actual',
        stepStatePending: 'Pendiente',
        stepStateAvailable: 'Disponible',
        stepStateControlled: 'Controlado por admin',
        accessTitle: 'Controles activos',
        accessDescription: 'Estas reglas ya están aterrizadas en base de datos, permisos y UI.',
        accessUserTitle: 'Acceso inicial',
        accessUserDescription:
          'Todo usuario entra como standard user y no hereda permisos employer por registrarse.',
        accessRecruiterTitle: 'Provisioning operativo',
        accessRecruiterDescription:
          'El tenant solo nace cuando una solicitud de operador es aprobada por un admin con permiso.',
        accessStorageTitle: 'Storage privado',
        accessStorageDescription:
          'Avatar, logo temporal y documentos sensibles viajan por buckets privados y signed URLs.',
        actionAccessTitle: 'Entrar a la plataforma',
        actionAccessDescription: 'Crea tu cuenta base o inicia sesión para preparar tu perfil.',
        actionAccessButton: 'Ir a Auth',
        actionProfileTitle: 'Preparar tu perfil',
        actionProfileDescription:
          'El perfil inicial vive detrás de auth y consolida los datos mínimos del usuario.',
        actionProfileButton: 'Abrir Auth',
        actionReviewGuestTitle: 'Flujo de operador',
        actionReviewGuestDescription:
          'La validación como operador se habilita después del registro y no desde el signup.',
        actionReviewGuestButton: 'Ver acceso',
        actionOnboardingTitle: 'Preparar perfil',
        actionOnboardingPending:
          'Todavía faltan datos del perfil base para dejar la cuenta lista.',
        actionOnboardingReady:
          'Tu perfil ya tiene la data mínima; puedes revisarlo o actualizarlo.',
        actionOnboardingButton: 'Abrir perfil',
        actionRecruiterTitle: 'Solicitar validación de operador',
        actionRecruiterPending:
          'Envía tu empresa para revisión administrativa y provisioning del tenant.',
        actionRecruiterApproved:
          'Tu cuenta ya tiene acceso employer, pero puedes revisar el historial de solicitudes.',
        actionRecruiterButton: 'Abrir solicitud de operador',
        actionAdminTitle: 'Review administrativo',
        actionAdminEnabled:
          'Tu sesión puede aprobar solicitudes y provisionar operadores desde la app.',
        actionAdminLocked:
          'Solo usuarios con `recruiter_request:review` pueden abrir esta bandeja.',
        actionAdminButton: 'Abrir approvals',
        actionAdminSecondaryButton: 'Ver acceso'
      },
      foundations: {
        title: 'Foundations operativas',
        description:
          'i18n, formularios, dark mode y notificaciones quedan listos para reutilizar desde el design system.',
        localeLabel: 'Idioma base',
        themeLabel: 'Tema',
        emailNotificationsLabel: 'Notificaciones por email',
        pushNotificationsLabel: 'Push notifications',
        pushPermissionLabel: 'Permiso del navegador',
        emailConsistency: 'In-app y email usan la misma semántica de evento.',
        vapidConfigured: 'Clave VAPID pública configurada.',
        saveButton: 'Guardar preferencias UI',
        requestPushButton: 'Habilitar push',
        saveSuccessTitle: 'Preferencias actualizadas',
        saveSuccessDescription:
          'La configuración visual y de idioma ya está lista para nuevos módulos.',
        pushSupported: 'Push soportado por este navegador.',
        pushUnsupported: 'Push no soportado por este navegador.',
        pushGranted: 'Permiso concedido.',
        pushDenied: 'Permiso denegado.',
        pushDefault: 'Permiso aún no solicitado.',
        pushMissingKey:
          'Falta `VITE_WEB_PUSH_PUBLIC_KEY`. La suscripción queda pendiente hasta configurar la clave pública.',
        pushReadyTitle: 'Push listo',
        pushReadyDescription:
          'La suscripción del navegador ya se puede guardar en Supabase junto al historial de entrega.',
        pushDeniedTitle: 'Permiso no concedido',
        pushDeniedDescription:
          'El usuario necesita aceptar notificaciones para registrar una suscripción push.',
        dependencyTitle: 'Paquetes instalados',
        dependencyDescription:
          'Estas dependencias ya forman parte del baseline del proyecto para i18n, forms, tema y feedback UX.',
        auditTitle: 'Auditoría requerida',
        auditDescription:
          'La base de datos registra cambios de filas, entregas de notificaciones y metadatos de solicitud para trazabilidad completa.'
      },
      notifications: {
        title: 'Centro de notificaciones',
        description:
          'La app ya puede enviar notificaciones de prueba, guardarlas en el inbox y registrar entregas push con historial auditable.',
        defaultTitle: 'Prueba de notificación push',
        defaultBody: 'Este evento valida el flujo end-to-end con Supabase, service worker y logs de entrega.',
        formTitleLabel: 'Título',
        formBodyLabel: 'Mensaje',
        formActionUrlLabel: 'Ruta de destino',
        sendButton: 'Enviar prueba a mi sesión',
        sendingButton: 'Enviando...',
        auditNote:
          'Cada envío crea registro en `notifications`, `notification_deliveries`, `notification_delivery_logs` y `audit_logs`.',
        inboxTitle: 'Inbox reciente',
        inboxDescription: 'Estas son tus notificaciones más recientes guardadas en base de datos.',
        unreadBadge: '{{count}} sin leer',
        unreadState: 'Pendiente',
        readBadge: 'Leída',
        openAction: 'Abrir destino',
        markReadButton: 'Marcar leída',
        loading: 'Cargando notificaciones...',
        empty: 'Todavía no hay notificaciones registradas para esta cuenta.',
        testSuccessTitle: 'Notificación registrada',
        testSuccessNoPush:
          'El inbox ya quedó creado y auditado. Si no hubo push enviado, revisa la suscripción del navegador o las claves VAPID.',
        testSuccessWithPush:
          'La prueba quedó registrada y {{sentCount}} entregas push salieron de {{queuedCount}} intentos en cola.',
        testErrorTitle: 'No se pudo enviar la prueba',
        testErrorDescription: 'Revisa permisos, configuración de Supabase o claves VAPID del proyecto.'
      },
      theme: {
        light: 'Claro',
        dark: 'Oscuro',
        system: 'Sistema'
      },
      language: {
        es: 'Español',
        en: 'English'
      },
      offline: {
        title: 'Offline fallback',
        description:
          'La shell de la aplicación debe seguir disponible aunque la red falle. Las acciones de escritura deben reintentarse cuando vuelva la conexión.',
        body1:
          'Esta ruta sirve como referencia para estados offline y reintentos de red dentro del PWA.',
        body2:
          'En fases siguientes conectaremos aquí las vistas de reintento para auth, jobs, applications y sincronización de cambios.'
      }
    }
  },
  en: {
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
        secondaryAuthenticatedAction: 'Submit operator request',
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
        stepRequestTitle: 'Operator request',
        stepRequestDescription: 'Company data, slug, temporary logo, and verification document.',
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
        actionRecruiterTitle: 'Request operator validation',
        actionRecruiterPending:
          'Submit your company for administrative review and tenant provisioning.',
        actionRecruiterApproved:
          'Your account already has employer access, but you can review request history.',
        actionRecruiterButton: 'Open operator request',
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
} as const

export type AppLocale = keyof typeof resources
