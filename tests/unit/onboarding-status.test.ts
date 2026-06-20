import { describe, expect, it } from 'vitest'

import { hasCompletedBaseOnboarding } from '@/features/auth/lib/onboarding-status'

describe('base onboarding status', () => {
  it('requires useful names, supported locale, and a two-letter country code', () => {
    expect(
      hasCompletedBaseOnboarding({
        full_name: 'Maria Reyes',
        display_name: 'Maria R.',
        locale: 'es',
        country_code: 'DO'
      })
    ).toBe(true)
  })

  it('treats generated placeholder users as incomplete', () => {
    expect(
      hasCompletedBaseOnboarding({
        full_name: 'New user',
        display_name: 'New user',
        locale: 'es',
        country_code: 'DO'
      })
    ).toBe(false)
  })

  it('keeps optional profile assets out of the required gate', () => {
    expect(
      hasCompletedBaseOnboarding({
        full_name: 'Carlos Pena',
        display_name: 'Carlos',
        locale: 'en',
        country_code: 'US'
      })
    ).toBe(true)
  })
})
