import { afterEach, describe, expect, it, vi } from 'vitest'

import { surfacePaths } from '@/app/router/surface-paths'
import { resolveAuthCallback, sanitizeNextPath } from '@/features/auth/lib/auth-callback'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('auth callback helpers', () => {
  it('defaults to profile when next is missing or unsafe', () => {
    expect(sanitizeNextPath(null)).toBe(surfacePaths.candidate.profile)
    expect(sanitizeNextPath('https://malicious.site')).toBe(surfacePaths.candidate.profile)
    expect(sanitizeNextPath('//malicious.site')).toBe(surfacePaths.candidate.profile)
  })

  it('preserves internal app paths', () => {
    expect(sanitizeNextPath(surfacePaths.candidate.recruiterRequest)).toBe(surfacePaths.candidate.recruiterRequest)
  })

  it('extracts code and token hash callback params safely', () => {
    const searchParams = new URLSearchParams(
      `code=abc123&token_hash=hash123&type=email&next=${surfacePaths.candidate.profile}`
    )

    expect(resolveAuthCallback(searchParams)).toEqual({
      code: 'abc123',
      tokenHash: 'hash123',
      type: 'email',
      nextPath: surfacePaths.candidate.profile
    })
  })

  it('builds the auth redirect URL without localhost when a public auth site URL is configured', async () => {
    vi.stubEnv('VITE_AUTH_SITE_URL', 'https://asi-do.netlify.app')
    vi.stubEnv('APP_URL', 'https://asi-do.netlify.app')

    const { getAuthRedirectUrl } = await import('@/features/auth/lib/auth-api')

    expect(getAuthRedirectUrl()).toBe('https://asi-do.netlify.app/auth/confirm')
  })
})
