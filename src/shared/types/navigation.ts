import type { PermissionCode } from '@/shared/constants/permissions'

export type NavigationGroup = 'dashboard' | 'recruitment' | 'pipeline' | 'general'

export interface NavigationItem {
  title: string
  titleKey?: string
  href: string
  description: string
  descriptionKey?: string
  group?: NavigationGroup
  requiresAuth?: boolean
  requiredPermission?: PermissionCode
  requiredAnyPermission?: PermissionCode[]
  requiresPlatformOwner?: boolean
}
