import type { NavigationItem } from '@/shared/types/navigation'
import { surfacePaths } from '@/app/router/surface-paths'
import type { PermissionCode } from '@/shared/constants/permissions'

export const approvalReviewPermissions: PermissionCode[] = [
  'recruiter_request:review',
  'user:approve',
  'pastor_authority_request:review',
  'regional_authority_request:review',
  'scoped_user_authorization:review'
]

export const publicNavigationItems: NavigationItem[] = [
  {
    title: 'Producto',
    titleKey: 'navigation.home.title',
    href: surfacePaths.public.home,
    description: 'Conoce la experiencia',
    descriptionKey: 'navigation.home.description'
  },
  {
    title: 'Jobs',
    titleKey: 'navigation.jobs.title',
    href: surfacePaths.public.jobsRoot,
    description: 'Oportunidades abiertas',
    descriptionKey: 'navigation.jobs.description'
  }
]

export const candidateNavigationItems: NavigationItem[] = [
  {
    title: 'Inicio',
    href: surfacePaths.candidate.home,
    description: 'Tu panel con todo en un vistazo',
    requiresAuth: true
  },
  {
    title: 'Membresía',
    href: surfacePaths.account.membership,
    description: 'Estado de tu solicitud, pago y activación',
    requiresAuth: true
  },
  {
    title: 'Jobs',
    href: surfacePaths.public.jobsRoot,
    description: 'Explora oportunidades abiertas'
  },
  {
    title: 'Postulaciones',
    href: '/candidate/applications',
    description: 'Sigue tus procesos',
    requiresAuth: true
  },
  {
    title: 'Perfil',
    href: '/candidate/profile',
    description: 'Tu perfil, tu CV y tu presencia',
    requiresAuth: true
  },
  {
    title: 'Reclutar con mi empresa',
    href: '/candidate/recruiter-request',
    description: 'Lleva tu empresa a la plataforma y publica vacantes',
    requiresAuth: true
  }
]

export const employerNavigationItems: NavigationItem[] = [
  {
    title: 'Resumen',
    href: surfacePaths.workspace.dashboard,
    description: 'Estado general del reclutamiento',
    group: 'dashboard',
    requiresAuth: true,
    requiredPermission: 'workspace:read'
  },
  {
    title: 'Mi actividad',
    href: surfacePaths.workspace.activity,
    description: 'Tu historial reciente en la plataforma',
    group: 'dashboard',
    requiresAuth: true,
    requiredPermission: 'workspace:read'
  },
  {
    title: 'Vacantes',
    href: surfacePaths.workspace.jobs,
    description: 'Publica y organiza vacantes',
    group: 'recruitment',
    requiresAuth: true,
    requiredPermission: 'workspace:read'
  },
  {
    title: 'Aplicaciones',
    href: surfacePaths.workspace.applications,
    description: 'Todas las postulaciones en un solo lugar',
    group: 'recruitment',
    requiresAuth: true,
    requiredPermission: 'application:read'
  },
  {
    title: 'Candidatos',
    href: surfacePaths.workspace.talent,
    description: 'Descubre personas abiertas a oportunidades',
    group: 'recruitment',
    requiresAuth: true,
    requiredPermission: 'candidate_directory:read'
  },
  {
    title: 'Banco de talento',
    href: surfacePaths.workspace.talentPool,
    description: 'Talento guardado y preseleccionado',
    group: 'recruitment',
    requiresAuth: true,
    requiredPermission: 'candidate_directory:read'
  },
  {
    title: 'Tablero Kanban',
    href: surfacePaths.workspace.pipeline,
    description: 'Da seguimiento al proceso por etapa',
    group: 'pipeline',
    requiresAuth: true,
    requiredPermission: 'application:read'
  },
  {
    title: 'Reportes',
    href: surfacePaths.workspace.reports,
    description: 'Métricas y desempeño del reclutamiento',
    group: 'general',
    requiresAuth: true,
    requiredPermission: 'workspace:read'
  },
  {
    title: 'Configuración',
    href: surfacePaths.workspace.settings,
    description: 'Empresa, equipo y accesos',
    group: 'general',
    requiresAuth: true,
    requiredPermission: 'workspace:read'
  }
]

export const adminNavigationItems: NavigationItem[] = [
  {
    title: 'Overview',
    href: surfacePaths.admin.root,
    description: 'Centro operativo de plataforma',
    requiresAuth: true
  },
  {
    title: 'Approvals',
    href: surfacePaths.admin.approvals,
    description: 'Operador, membresía y autoridad territorial',
    requiresAuth: true,
    requiredAnyPermission: approvalReviewPermissions
  },
  {
    title: 'Platform',
    href: surfacePaths.admin.platform,
    description: 'Planes y ops',
    requiresAuth: true,
    requiredPermission: 'platform_dashboard:read'
  },
  {
    title: 'Moderation',
    href: surfacePaths.admin.moderation,
    description: 'Trust and safety',
    requiresAuth: true,
    requiredPermission: 'moderation:read'
  },
  {
    title: 'Errors',
    href: surfacePaths.admin.errors,
    description: 'Error review',
    requiresAuth: true,
    requiredPermission: 'audit_log:read'
  },
  {
    title: 'Membresía',
    href: surfacePaths.admin.membership,
    description: 'Revisar solicitudes, validar pagos y activar cuentas',
    requiresAuth: true,
    requiredPermission: 'membership_payment:verify'
  },
  {
    title: 'Autorización territorial',
    href: surfacePaths.admin.authority,
    description: 'Genera invitaciones por link para validar autoridad pastoral o regional',
    requiresAuth: true,
    requiredAnyPermission: approvalReviewPermissions
  },
  {
    title: 'Datos de pago',
    href: surfacePaths.admin.payments,
    description: 'Datos bancarios y cuotas de membresía',
    requiresAuth: true,
    requiredPermission: 'platform_dashboard:read'
  },
  {
    title: 'Donaciones',
    href: surfacePaths.admin.donations,
    description: 'Montos sugeridos de donación',
    requiresAuth: true,
    requiredPermission: 'platform_dashboard:read'
  },
  {
    title: 'Correos',
    href: surfacePaths.admin.correos,
    description: 'Pipeline de correos y modo de prueba',
    requiresAuth: true,
    requiredPermission: 'email:read'
  },
  {
    title: 'Arnés de estrés',
    href: surfacePaths.admin.stressHarness,
    description: 'Datos sintéticos masivos y métricas de capacidad',
    requiresAuth: true,
    requiredPermission: 'platform_dashboard:read'
  }
]
