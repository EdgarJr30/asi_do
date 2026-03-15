import { describe, expect, it } from 'vitest'

import { extractErrorDetails, toControlledError, toErrorMessage } from '@/lib/errors/error-utils'
import { toBootstrapFirstPlatformOwnerErrorMessage } from '@/features/auth/lib/auth-api'

describe('error utils', () => {
  it('extracts Supabase-style plain object errors', () => {
    const details = extractErrorDetails({
      code: '23505',
      message: 'A platform owner already exists',
      details: 'duplicate key value violates unique constraint'
    })

    expect(details.errorCode).toBe('23505')
    expect(details.errorMessage).toBe('A platform owner already exists')
    expect(details.metadata.details).toBe('duplicate key value violates unique constraint')
  })

  it('returns a business-friendly bootstrap message when the first admin already exists', () => {
    expect(
      toBootstrapFirstPlatformOwnerErrorMessage({
        message: 'A platform owner already exists'
      })
    ).toBe('Ya existe un primer admin activo. Este boton solo funciona una vez por plataforma.')
  })

  it('falls back to a generic message for unknown values', () => {
    expect(toErrorMessage(null)).toBe('Ocurrio un error inesperado.')
  })

  it('creates a controlled Error preserving the normalized message', () => {
    const error = toControlledError({
      message: 'Push subscription already exists'
    })

    expect(error).toBeInstanceOf(Error)
    expect(error.message).toBe('Push subscription already exists')
  })
})
