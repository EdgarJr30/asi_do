import type { PermissionCode } from '@/shared/constants/permissions'

export interface NavigationItem {
  title: string
  titleKey?: string
  href: string
  description: string
  descriptionKey?: string
  requiresAuth?: boolean
  requiredPermission?: PermissionCode
}
