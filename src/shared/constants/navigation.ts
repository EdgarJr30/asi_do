import type { NavigationItem } from '@/shared/types/navigation'

export const publicNavigationItems: NavigationItem[] = [
  {
    title: 'Producto',
    titleKey: 'navigation.home.title',
    href: '/',
    description: 'Conoce la experiencia',
    descriptionKey: 'navigation.home.description'
  },
  {
    title: 'Jobs',
    titleKey: 'navigation.jobs.title',
    href: '/jobs',
    description: 'Oportunidades abiertas',
    descriptionKey: 'navigation.jobs.description'
  }
]

export const candidateNavigationItems: NavigationItem[] = [
  {
    title: 'Jobs',
    href: '/jobs',
    description: 'Explora oportunidades abiertas'
  },
  {
    title: 'Aplicaciones',
    href: '/applications',
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
    href: '/onboarding',
    description: 'Ajustes esenciales de tu cuenta',
    requiresAuth: true
  },
  {
    title: 'Acceso employer',
    href: '/recruiter-request',
    description: 'Lleva tu empresa a la plataforma',
    requiresAuth: true
  }
]

export const employerNavigationItems: NavigationItem[] = [
  {
    title: 'Company',
    href: '/workspace',
    description: 'Marca, equipo y presencia de empresa',
    requiresAuth: true,
    requiredPermission: 'workspace:read'
  },
  {
    title: 'Jobs',
    href: '/jobs/manage',
    description: 'Publica y organiza vacantes',
    requiresAuth: true,
    requiredPermission: 'workspace:read'
  },
  {
    title: 'Candidates',
    href: '/talent',
    description: 'Descubre personas abiertas a oportunidades',
    requiresAuth: true,
    requiredPermission: 'candidate_directory:read'
  },
  {
    title: 'Pipeline',
    href: '/pipeline',
    description: 'Da seguimiento al proceso',
    requiresAuth: true,
    requiredPermission: 'application:read'
  },
  {
    title: 'Roles',
    href: '/rbac',
    description: 'Accesos del equipo',
    requiresAuth: true,
    requiredPermission: 'role:read'
  }
]

export const internalNavigationItems: NavigationItem[] = [
  {
    title: 'Overview',
    href: '/internal',
    description: 'Centro operativo interno',
    requiresAuth: true
  },
  {
    title: 'Approvals',
    href: '/internal/approvals',
    description: 'Recruiter requests',
    requiresAuth: true,
    requiredPermission: 'recruiter_request:review'
  },
  {
    title: 'Platform',
    href: '/internal/platform',
    description: 'Planes y ops',
    requiresAuth: true,
    requiredPermission: 'platform_dashboard:read'
  },
  {
    title: 'Moderation',
    href: '/internal/moderation',
    description: 'Trust and safety',
    requiresAuth: true,
    requiredPermission: 'moderation:read'
  },
  {
    title: 'Errors',
    href: '/internal/errors',
    description: 'Error review',
    requiresAuth: true,
    requiredPermission: 'audit_log:read'
  }
]
