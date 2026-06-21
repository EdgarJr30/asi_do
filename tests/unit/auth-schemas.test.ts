import { describe, expect, it } from 'vitest'

import { signUpFormSchema } from '@/features/auth/lib/auth-schemas'

const validSignUpForm = {
  firstName: 'John',
  lastName: 'Doe',
  email: 'john.doe@example.com',
  password: 'Password1',
  confirmPassword: 'Password1'
}

describe('auth schemas', () => {
  it('requires the sign-up password confirmation to match', () => {
    const result = signUpFormSchema.safeParse({
      ...validSignUpForm,
      confirmPassword: 'Password2'
    })

    expect(result.success).toBe(false)
    expect(result.error?.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ['confirmPassword'],
          message: 'Las contraseñas deben coincidir.'
        })
      ])
    )
  })

  it('accepts matching sign-up passwords', () => {
    expect(signUpFormSchema.safeParse(validSignUpForm).success).toBe(true)
  })
})
