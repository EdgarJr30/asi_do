import type { NavigationItem } from '@/shared/types/navigation'

export const navigationItems: NavigationItem[] = [
  {
    title: 'Inicio',
    titleKey: 'navigation.home.title',
    href: '/',
    description: 'Base del proyecto',
    descriptionKey: 'navigation.home.description'
  },
  {
    title: 'Acceso',
    titleKey: 'navigation.access.title',
    href: '/auth',
    description: 'Registro e inicio de sesion',
    descriptionKey: 'navigation.access.description'
  },
  {
    title: 'Perfil',
    titleKey: 'navigation.onboarding.title',
    href: '/onboarding',
    description: 'Datos base del usuario',
    descriptionKey: 'navigation.onboarding.description',
    requiresAuth: true
  },
  {
    title: 'Recruiter',
    titleKey: 'navigation.recruiterRequest.title',
    href: '/recruiter-request',
    description: 'Solicitud de validacion',
    descriptionKey: 'navigation.recruiterRequest.description',
    requiresAuth: true
  },
  {
    title: 'Jobs',
    titleKey: 'navigation.jobs.title',
    href: '/jobs',
    description: 'Vacantes y discovery',
    descriptionKey: 'navigation.jobs.description',
    requiresAuth: true,
    requiredPermission: 'job:read'
  },
  {
    title: 'Workspace',
    titleKey: 'navigation.workspace.title',
    href: '/workspace',
    description: 'Tenant y company',
    descriptionKey: 'navigation.workspace.description',
    requiresAuth: true,
    requiredPermission: 'workspace:read'
  },
  {
    title: 'RBAC',
    titleKey: 'navigation.rbac.title',
    href: '/rbac',
    description: 'Roles y permisos',
    descriptionKey: 'navigation.rbac.description',
    requiresAuth: true,
    requiredPermission: 'role:read'
  },
  {
    title: 'Approvals',
    titleKey: 'navigation.approvals.title',
    href: '/admin/recruiter-requests',
    description: 'Revision de recruiters',
    descriptionKey: 'navigation.approvals.description',
    requiresAuth: true,
    requiredPermission: 'recruiter_request:review'
  },
  {
    title: 'Moderation',
    titleKey: 'navigation.moderation.title',
    href: '/admin/moderation',
    description: 'Trust and safety',
    descriptionKey: 'navigation.moderation.description',
    requiresAuth: true,
    requiredPermission: 'moderation:read'
  },
  {
    title: 'Errores',
    href: '/admin/errors',
    description: 'Revision operativa',
    requiresAuth: true,
    requiredPermission: 'audit_log:read'
  }
]
