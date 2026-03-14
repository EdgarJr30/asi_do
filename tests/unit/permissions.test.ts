import { describe, expect, it } from 'vitest'

import { filterNavigationItems, hasPermission } from '@/lib/permissions/guards'
import { navigationItems } from '@/shared/constants/navigation'

describe('permission guards', () => {
  it('allows access when the required permission exists', () => {
    expect(hasPermission(['workspace:read', 'job:read'], 'job:read')).toBe(true)
  })

  it('filters navigation items that the current session cannot access', () => {
    const visibleItems = filterNavigationItems(navigationItems, ['workspace:read', 'job:read', 'role:read'])

    expect(visibleItems.map((item) => item.title)).toEqual(['Inicio', 'Jobs', 'Workspace', 'RBAC'])
  })
})
