import type { Tables } from '@/shared/types/database'

type OnboardingProfile = Pick<Tables<'users'>, 'full_name' | 'display_name' | 'locale' | 'country_code'> | null | undefined

function hasUsefulText(value: string | null | undefined) {
  const normalized = value?.trim()

  return Boolean(normalized && normalized.toLowerCase() !== 'new user')
}

export function hasCompletedBaseOnboarding(profile: OnboardingProfile) {
  return (
    hasUsefulText(profile?.full_name) &&
    hasUsefulText(profile?.display_name) &&
    ['es', 'en'].includes(profile?.locale ?? '') &&
    Boolean(profile?.country_code?.trim().match(/^[A-Za-z]{2}$/))
  )
}
