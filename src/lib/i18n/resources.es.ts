/**
 * Recursos en español: idioma por defecto **y** `fallbackLng`.
 *
 * Va siempre en el bundle inicial a propósito. Cargarlo en diferido dejaría a
 * i18next sin traducciones durante el primer render y produciría un parpadeo de
 * claves crudas (`navigation.home.title`) antes de resolverse.
 */
export const esResources = {
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
  }

/**
 * Sin `as const` a proposito: con literales fijos, `resources.en.ts` no podria
 * satisfacer este tipo (cada cadena inglesa chocaria con su literal español).
 * Widened a `string`, el chequeo estructural sigue exigiendo **las mismas
 * claves**, que es la garantia que importa: una clave que falte en ingles es un
 * error de compilacion.
 */
export type TranslationResource = typeof esResources
