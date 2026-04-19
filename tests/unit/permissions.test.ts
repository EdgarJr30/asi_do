import { describe, expect, it } from 'vitest'

import { filterNavigationItems, hasAnyPermission, hasPermission } from '@/lib/permissions/guards'
import { adminNavigationItems, candidateNavigationItems, employerNavigationItems } from '@/shared/constants/navigation'

describe('permission guards', () => {
  it('allows access when the required permission exists', () => {
    expect(hasPermission(['workspace:read', 'job:read'], 'job:read')).toBe(true)
  })

  it('allows access when one of the accepted permissions exists', () => {
    expect(hasAnyPermission(['user:approve'], ['recruiter_request:review', 'user:approve'])).toBe(true)
  })

  it('filters navigation items that the current session cannot access', () => {
    const visibleItems = filterNavigationItems(
      [...candidateNavigationItems, ...employerNavigationItems, ...adminNavigationItems],
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
      'Jobs',
      'Aplicaciones',
      'Perfil',
      'Onboarding',
      'Acceso operador',
      'Autorización territorial',
      'Workspace',
      'Jobs',
      'Candidates',
      'Pipeline',
      'Access',
      'Overview',
      'Platform',
      'Errors'
    ])
  })

  it('keeps internal navigation restricted when platform permissions are missing', () => {
    const visibleInternal = filterNavigationItems(
      adminNavigationItems,
      [],
      true
    )

    expect(visibleInternal.map((item) => item.title)).toEqual([
      'Overview'
    ])
  })

  it('shows the approvals area when one approval permission is present', () => {
    const visibleInternal = filterNavigationItems(
      adminNavigationItems,
      ['user:approve'],
      true
    )

    expect(visibleInternal.map((item) => item.title)).toEqual([
      'Overview',
      'Approvals'
    ])
  })
})
