import { describe, expect, it } from 'vitest'

import { filterNavigationItems, hasAnyPermission, hasPermission } from '@/lib/permissions/guards'
import { adminNavigationItems, candidateNavigationItems, employerNavigationItems } from '@/shared/constants/navigation'

describe('permission guards', () => {
  it('allows public capabilities without inventing a permission requirement', () => {
    expect(hasPermission([], undefined)).toBe(true)
    expect(hasAnyPermission([], undefined)).toBe(true)
    expect(hasAnyPermission([], [])).toBe(true)
  })

  it('allows access when the required permission exists', () => {
    expect(hasPermission(['workspace:read', 'job:read'], 'job:read')).toBe(true)
  })

  it('denies access when the required permission is missing', () => {
    expect(hasPermission(['workspace:read'], 'job:read')).toBe(false)
    expect(hasPermission(new Set(['workspace:read']), 'job:read')).toBe(false)
  })

  it('allows access when one of the accepted permissions exists', () => {
    expect(hasAnyPermission(['user:approve'], ['recruiter_request:review', 'user:approve'])).toBe(true)
  })

  it('denies access when none of the accepted permissions exists', () => {
    expect(hasAnyPermission(['workspace:read'], ['recruiter_request:review', 'user:approve'])).toBe(false)
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
      'Inicio',
      'Membresía',
      'Jobs',
      'Postulaciones',
      'Perfil',
      'Reclutar con mi empresa',
      'Resumen',
      'Vacantes',
      'Aplicaciones',
      'Candidatos',
      'Proceso de selección',
      'Reportes',
      'Configuración de empresa',
      'Overview',
      'Plataforma',
      'Errores',
      'Registro de accesos',
      'Finanzas',
      'Stress Harness'
    ])
  })

  it('keeps protected navigation hidden from unauthenticated visitors', () => {
    const visibleItems = filterNavigationItems(candidateNavigationItems, [], false)

    expect(visibleItems.map((item) => item.title)).toEqual(['Jobs'])
  })

  it('hides owner-only admin navigation unless the session is platform owner', () => {
    const visibleForAdmin = filterNavigationItems(
      adminNavigationItems,
      ['platform_dashboard:read'],
      true
    )
    const visibleForOwner = filterNavigationItems(
      adminNavigationItems,
      ['platform_dashboard:read'],
      true,
      { isPlatformOwner: true }
    )

    expect(visibleForAdmin.map((item) => item.title)).not.toContain('Usuarios y roles')
    expect(visibleForOwner.map((item) => item.title)).toContain('Usuarios y roles')
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
      'Aprobaciones'
    ])
  })
})
