import type { PermissionCode } from '@/shared/constants/permissions'
import type { NavigationItem } from '@/shared/types/navigation'

function toPermissionSet(permissions: Iterable<PermissionCode>) {
  return permissions instanceof Set ? permissions : new Set(permissions)
}

export function hasPermission(permissions: Iterable<PermissionCode>, requiredPermission?: PermissionCode) {
  if (!requiredPermission) {
    return true
  }

  return toPermissionSet(permissions).has(requiredPermission)
}

export function filterNavigationItems(
  items: NavigationItem[],
  permissions: Iterable<PermissionCode>,
  isAuthenticated: boolean
) {
  return items.filter((item) => {
    if (item.requiresAuth && !isAuthenticated) {
      return false
    }

    return hasPermission(permissions, item.requiredPermission)
  })
}
