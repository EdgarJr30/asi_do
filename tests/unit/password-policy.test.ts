import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  passwordPolicyRules,
  passwordResetSchema,
  passwordSchema,
  signInSchema
} from '@/features/auth/lib/auth-schemas'

const configToml = readFileSync(resolve(process.cwd(), 'supabase/config.toml'), 'utf8')

function readTomlValue(key: string) {
  const match = new RegExp(`^${key}\\s*=\\s*(.+)$`, 'm').exec(configToml)

  return match?.[1]?.trim().replace(/^"|"$/g, '')
}

// Muestras que cubren cada regla por separado y su combinación. El caso
// `PASSWORD1` es el que importa: tiene 8 caracteres, mayúscula y dígito, así que
// pasaba el checklist que la UI mostraba antes, pero `lower_upper_letters_digits`
// lo rechaza por no llevar minúscula.
const samples = [
  { password: 'Passw1', valid: false, why: 'menos de 8 caracteres' },
  { password: 'password1', valid: false, why: 'sin mayúscula' },
  { password: 'PASSWORD1', valid: false, why: 'sin minúscula' },
  { password: 'PasswordAbc', valid: false, why: 'sin dígito' },
  { password: 'Password1', valid: true, why: 'cumple los cuatro requisitos' },
  { password: 'aB3aB3aB3', valid: true, why: 'cumple con caracteres repetidos' }
] as const

describe('política de contraseña', () => {
  it('replica la política declarada en supabase/config.toml', () => {
    // Si alguien relaja el servidor sin tocar el cliente (o al revés), la UI
    // pasa a mentir sobre lo que se acepta. Este aserto es el que lo impide.
    expect(readTomlValue('minimum_password_length')).toBe('8')
    expect(readTomlValue('password_requirements')).toBe('lower_upper_letters_digits')
  })

  it.each(samples)('$why: "$password"', ({ password, valid }) => {
    expect(passwordSchema.safeParse(password).success).toBe(valid)
  })

  it('el checklist visible y el esquema deciden siempre lo mismo', () => {
    // El fallo original era exactamente este: la UI dibujaba reglas que el
    // esquema no exigía, así que enseñaba requisitos decorativos.
    for (const { password } of samples) {
      const allRulesPass = passwordPolicyRules.every((rule) => rule.test(password))

      expect(allRulesPass).toBe(passwordSchema.safeParse(password).success)
    }
  })

  it('el acceso no aplica la política, para no dejar fuera a cuentas anteriores', () => {
    // Antes del endurecimiento el servidor aceptaba 6 caracteres. Validar la
    // política nueva en el formulario de acceso impediría entrar a esas cuentas
    // sin haberles cambiado nunca la contraseña.
    const result = signInSchema.safeParse({ email: 'john.doe@example.com', password: 'abc123' })

    expect(result.success).toBe(true)
  })

  it('el acceso sigue exigiendo escribir algo', () => {
    expect(signInSchema.safeParse({ email: 'john.doe@example.com', password: '' }).success).toBe(false)
  })
})

describe('esquema de restablecimiento', () => {
  it('aplica la misma política que el registro', () => {
    expect(passwordResetSchema.safeParse({ password: 'password1', confirmPassword: 'password1' }).success).toBe(false)
    expect(passwordResetSchema.safeParse({ password: 'Password1', confirmPassword: 'Password1' }).success).toBe(true)
  })

  it('exige que la confirmación coincida', () => {
    const result = passwordResetSchema.safeParse({ password: 'Password1', confirmPassword: 'Password2' })

    expect(result.success).toBe(false)
    expect(result.error?.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: ['confirmPassword'], message: 'Las contraseñas deben coincidir.' })
      ])
    )
  })
})
