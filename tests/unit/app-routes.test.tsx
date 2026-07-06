import { describe, expect, it } from 'vitest'

import { appRoutes } from '@/app/router/routes'
import { surfacePaths } from '@/app/router/surface-paths'

function findTopLevelRoute(path: string) {
  return appRoutes.find((route) => route.path === path)
}

describe('app route contract', () => {
  it('defines the canonical top-level surfaces', () => {
    expect(findTopLevelRoute(surfacePaths.institutional.home)).toBeDefined()
    expect(findTopLevelRoute(surfacePaths.public.home)).toBeDefined()
    expect(findTopLevelRoute(surfacePaths.auth.root)).toBeDefined()
    expect(findTopLevelRoute(surfacePaths.app.home)).toBeDefined()
    expect(findTopLevelRoute(surfacePaths.account.root)).toBeDefined()
    expect(findTopLevelRoute(surfacePaths.workspace.root)).toBeDefined()
    expect(findTopLevelRoute(surfacePaths.admin.root)).toBeDefined()
  })

  it('keeps legacy candidate and platform jobs aliases as redirects', () => {
    expect(findTopLevelRoute(surfacePaths.legacy.candidateRoot)).toBeDefined()
    expect(findTopLevelRoute(surfacePaths.legacy.platformJobsRoot)).toBeDefined()
  })

  it('does not keep legacy route families in the top-level route contract', () => {
    expect(findTopLevelRoute('/applications')).toBeUndefined()
    expect(findTopLevelRoute('/onboarding')).toBeUndefined()
    expect(findTopLevelRoute('/recruiter-request')).toBeUndefined()
    expect(findTopLevelRoute('/candidate/profile')).toBeUndefined()
    expect(findTopLevelRoute('/jobs/manage')).toBeUndefined()
    expect(findTopLevelRoute('/talent')).toBeUndefined()
    expect(findTopLevelRoute('/pipeline')).toBeUndefined()
    expect(findTopLevelRoute('/rbac')).toBeUndefined()
    expect(findTopLevelRoute('/internal')).toBeUndefined()
    expect(findTopLevelRoute('/internal/approvals')).toBeUndefined()
    expect(findTopLevelRoute('/internal/platform')).toBeUndefined()
    expect(findTopLevelRoute('/internal/moderation')).toBeUndefined()
    expect(findTopLevelRoute('/internal/errors')).toBeUndefined()
    expect(findTopLevelRoute('/internal/bootstrap-owner')).toBeUndefined()
  })

  it('defines catch-all routes inside every route surface', () => {
    const institutionalRoute = findTopLevelRoute(surfacePaths.institutional.home)
    const publicRoute = findTopLevelRoute(surfacePaths.public.home)
    const authRoute = findTopLevelRoute(surfacePaths.auth.root)
    const accountRoute = findTopLevelRoute(surfacePaths.account.root)
    const workspaceRoute = findTopLevelRoute(surfacePaths.workspace.root)
    const adminRoute = findTopLevelRoute(surfacePaths.admin.root)

    expect(institutionalRoute?.children?.some((route) => route.path === '*')).toBe(true)
    expect(publicRoute?.children?.some((route) => route.path === '*')).toBe(true)
    expect(authRoute?.children?.some((route) => route.path === '*')).toBe(true)
    expect(accountRoute?.children?.some((route) => route.path === '*')).toBe(true)
    expect(workspaceRoute?.children?.some((route) => route.path === '*')).toBe(true)
    expect(adminRoute?.children?.some((route) => route.path === '*')).toBe(true)
  })

  it('keeps bootstrap-owner as an explicit admin-only route', () => {
    const adminRoute = findTopLevelRoute(surfacePaths.admin.root)

    expect(adminRoute?.children?.some((route) => route.path === 'bootstrap-owner')).toBe(true)
  })

  it('keeps platform access control as an explicit admin-only route', () => {
    const adminRoute = findTopLevelRoute(surfacePaths.admin.root)

    expect(adminRoute?.children?.some((route) => route.path === 'access-control')).toBe(true)
  })
})
