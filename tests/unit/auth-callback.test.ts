import { describe, expect, it } from 'vitest'

import { resolveAuthCallback, sanitizeNextPath } from '@/features/auth/lib/auth-callback'

describe('auth callback helpers', () => {
  it('defaults to onboarding when next is missing or unsafe', () => {
    expect(sanitizeNextPath(null)).toBe('/onboarding')
    expect(sanitizeNextPath('https://malicious.site')).toBe('/onboarding')
    expect(sanitizeNextPath('//malicious.site')).toBe('/onboarding')
  })

  it('preserves internal app paths', () => {
    expect(sanitizeNextPath('/recruiter-request')).toBe('/recruiter-request')
  })

  it('extracts code and token hash callback params safely', () => {
    const searchParams = new URLSearchParams(
      'code=abc123&token_hash=hash123&type=email&next=/onboarding'
    )

    expect(resolveAuthCallback(searchParams)).toEqual({
      code: 'abc123',
      tokenHash: 'hash123',
      type: 'email',
      nextPath: '/onboarding'
    })
  })
})
