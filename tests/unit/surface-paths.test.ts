import { describe, expect, it } from 'vitest'

import { getAuthenticatedHomePath, surfacePaths } from '@/app/router/surface-paths'

describe('surface paths', () => {
  it('resolves the authenticated home for candidate-only users', () => {
    expect(getAuthenticatedHomePath(false)).toBe(surfacePaths.account.home)
  })

  it('resolves the authenticated home for workspace users', () => {
    expect(getAuthenticatedHomePath(true)).toBe(surfacePaths.workspace.root)
  })

  it('routes incomplete users to profile setup before any authenticated home', () => {
    expect(getAuthenticatedHomePath(false, false)).toBe(surfacePaths.account.profile)
    expect(getAuthenticatedHomePath(true, false)).toBe(surfacePaths.account.profile)
  })
})
