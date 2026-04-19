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
    title: 'Jobs',
    href: surfacePaths.public.jobsRoot,
    description: 'Explora oportunidades abiertas'
  },
  {
    title: 'Aplicaciones',
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
    title: 'Onboarding',
    href: '/candidate/onboarding',
    description: 'Ajustes esenciales de tu cuenta',
    requiresAuth: true
  },
  {
    title: 'Acceso operador',
    href: '/candidate/recruiter-request',
    description: 'Lleva tu empresa a la plataforma',
    requiresAuth: true
  },
  {
    title: 'Autorización territorial',
    href: '/candidate/authority-request',
    description: 'Solicita validación pastoral o regional',
    requiresAuth: true
  }
]

export const employerNavigationItems: NavigationItem[] = [
  {
    title: 'Workspace',
    href: surfacePaths.workspace.root,
    description: 'Marca, equipo y presencia de empresa',
    requiresAuth: true,
    requiredPermission: 'workspace:read'
  },
  {
    title: 'Jobs',
    href: surfacePaths.workspace.jobs,
    description: 'Publica y organiza vacantes',
    requiresAuth: true,
    requiredPermission: 'workspace:read'
  },
  {
    title: 'Candidates',
    href: surfacePaths.workspace.talent,
    description: 'Descubre personas abiertas a oportunidades',
    requiresAuth: true,
    requiredPermission: 'candidate_directory:read'
  },
  {
    title: 'Pipeline',
    href: surfacePaths.workspace.pipeline,
    description: 'Da seguimiento al proceso',
    requiresAuth: true,
    requiredPermission: 'application:read'
  },
  {
    title: 'Access',
    href: surfacePaths.workspace.access,
    description: 'Accesos del equipo',
    requiresAuth: true,
    requiredPermission: 'role:read'
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
  }
]
