import type { PermissionCode } from '@/shared/constants/permissions'

export interface NavigationItem {
  title: string
  href: string
  description: string
  requiredPermission?: PermissionCode
}
