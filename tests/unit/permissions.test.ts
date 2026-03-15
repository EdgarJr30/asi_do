import { describe, expect, it } from 'vitest'

import { filterNavigationItems, hasPermission } from '@/lib/permissions/guards'
import { navigationItems } from '@/shared/constants/navigation'

describe('permission guards', () => {
  it('allows access when the required permission exists', () => {
    expect(hasPermission(['workspace:read', 'job:read'], 'job:read')).toBe(true)
  })

  it('filters navigation items that the current session cannot access', () => {
    const visibleItems = filterNavigationItems(
      navigationItems,
      [
        'workspace:read',
        'job:read',
        'candidate_directory:read',
        'application:read',
        'role:read',
        'audit_log:read',
        'platform_dashboard:read'
      ],
      true
    )

    expect(visibleItems.map((item) => item.title)).toEqual([
      'Inicio',
      'Acceso',
      'Perfil',
      'Perfil candidato',
      'Recruiter',
      'Jobs',
      'Talento',
      'Applications',
      'Pipeline',
      'Workspace',
      'RBAC',
      'Plataforma',
      'Errores'
    ])
  })
})
