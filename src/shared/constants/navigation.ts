import type { PermissionCode } from '@/shared/constants/permissions'
import type { NavigationItem } from '@/shared/types/navigation'

export const navigationItems: NavigationItem[] = [
  {
    title: 'Inicio',
    href: '/',
    description: 'Base del proyecto'
  },
  {
    title: 'Jobs',
    href: '/jobs',
    description: 'Vacantes y discovery',
    requiredPermission: 'job:read'
  },
  {
    title: 'Workspace',
    href: '/workspace',
    description: 'Tenant y company',
    requiredPermission: 'workspace:read'
  },
  {
    title: 'RBAC',
    href: '/rbac',
    description: 'Roles y permisos',
    requiredPermission: 'role:read'
  },
  {
    title: 'Moderation',
    href: '/admin/moderation',
    description: 'Trust and safety',
    requiredPermission: 'moderation:read'
  }
]

export const demoSession: {
  displayName: string
  activeRole: string
  permissions: PermissionCode[]
} = {
  displayName: 'Foundation Operator',
  activeRole: 'Tenant Admin',
  permissions: ['workspace:read', 'job:read', 'application:read', 'role:read', 'notification:read']
}
