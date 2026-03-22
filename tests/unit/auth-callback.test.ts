import { describe, expect, it } from 'vitest'

import { surfacePaths } from '@/app/router/surface-paths'
import { getAuthRedirectUrl } from '@/features/auth/lib/auth-api'
import { resolveAuthCallback, sanitizeNextPath } from '@/features/auth/lib/auth-callback'

describe('auth callback helpers', () => {
  it('defaults to onboarding when next is missing or unsafe', () => {
    expect(sanitizeNextPath(null)).toBe(surfacePaths.candidate.onboarding)
    expect(sanitizeNextPath('https://malicious.site')).toBe(surfacePaths.candidate.onboarding)
    expect(sanitizeNextPath('//malicious.site')).toBe(surfacePaths.candidate.onboarding)
  })

  it('preserves internal app paths', () => {
    expect(sanitizeNextPath(surfacePaths.candidate.recruiterRequest)).toBe(surfacePaths.candidate.recruiterRequest)
  })

  it('extracts code and token hash callback params safely', () => {
    const searchParams = new URLSearchParams(
      `code=abc123&token_hash=hash123&type=email&next=${surfacePaths.candidate.onboarding}`
    )

    expect(resolveAuthCallback(searchParams)).toEqual({
      code: 'abc123',
      tokenHash: 'hash123',
      type: 'email',
      nextPath: surfacePaths.candidate.onboarding
    })
  })

  it('builds the auth redirect URL without localhost when a public auth site URL is configured', () => {
    expect(getAuthRedirectUrl()).toBe('https://asi-do.netlify.app/auth/confirm')
  })
})
