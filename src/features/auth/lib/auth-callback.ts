import type { EmailOtpType } from '@supabase/supabase-js'

export interface AuthCallbackResolution {
  code: string | null
  tokenHash: string | null
  type: EmailOtpType | null
  nextPath: string
}

const supportedEmailOtpTypes = new Set<EmailOtpType>([
  'signup',
  'invite',
  'magiclink',
  'recovery',
  'email_change',
  'email'
])

export function sanitizeNextPath(value: string | null) {
  if (!value || !value.startsWith('/')) {
    return '/onboarding'
  }

  if (value.startsWith('//')) {
    return '/onboarding'
  }

  return value
}

export function resolveAuthCallback(searchParams: URLSearchParams): AuthCallbackResolution {
  const typeCandidate = searchParams.get('type')

  return {
    code: searchParams.get('code'),
    tokenHash: searchParams.get('token_hash'),
    type:
      typeCandidate && supportedEmailOtpTypes.has(typeCandidate as EmailOtpType)
        ? (typeCandidate as EmailOtpType)
        : null,
    nextPath: sanitizeNextPath(searchParams.get('next'))
  }
}
