import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  formatPasswordResetCountdown,
  PASSWORD_RESET_WINDOW_SECONDS,
  readAccessTokenIssuedAt,
  resolvePasswordResetDeadline
} from '@/features/auth/lib/password-reset-window'

const configToml = readFileSync(resolve(process.cwd(), 'supabase/config.toml'), 'utf8')

function readTomlValue(key: string) {
  const match = new RegExp(`^${key}\\s*=\\s*(.+)$`, 'm').exec(configToml)

  return match?.[1]?.trim().replace(/^"|"$/g, '')
}

function fakeAccessToken(claims: Record<string, unknown>) {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url')

  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(claims)}.firma-no-verificada`
}

describe('ventana de recuperación de contraseña', () => {
  it('promete el mismo plazo que aplica el servidor', () => {
    // La pantalla no puede prometer más tiempo del que da GoTrue ni menos: lo
    // primero deja a alguien escribiendo una contraseña que ya no se puede
    // guardar, lo segundo le corta el paso antes de tiempo.
    expect(readTomlValue('otp_expiry')).toBe(String(PASSWORD_RESET_WINDOW_SECONDS))
  })

  it('no vuelve a la hora que traía GoTrue por defecto', () => {
    expect(PASSWORD_RESET_WINDOW_SECONDS).toBeLessThanOrEqual(15 * 60)
  })

  it('cuenta desde que el servidor firmó el token, no desde que abrió la página', () => {
    // El caso que arregla: recargar la pantalla. Si el plazo se midiera desde el
    // montaje, refrescar regalaría quince minutos nuevos cada vez.
    const issuedAt = 1_770_000_000
    const token = fakeAccessToken({ iat: issuedAt })

    expect(readAccessTokenIssuedAt(token)).toBe(issuedAt * 1000)
    expect(resolvePasswordResetDeadline(token, (issuedAt + 600) * 1000)).toBe(
      (issuedAt + PASSWORD_RESET_WINDOW_SECONDS) * 1000
    )
  })

  it('sin `iat` legible cuenta desde ahora en vez de caducar de golpe', () => {
    const now = 1_770_000_000_000

    for (const token of [null, undefined, '', 'no-es-un-jwt', fakeAccessToken({ sub: 'sin-iat' })]) {
      expect(resolvePasswordResetDeadline(token, now)).toBe(now + PASSWORD_RESET_WINDOW_SECONDS * 1000)
    }
  })

  it('formatea el contador en mm:ss y nunca en negativo', () => {
    expect(formatPasswordResetCountdown(15 * 60 * 1000)).toBe('15:00')
    expect(formatPasswordResetCountdown(62_000)).toBe('1:02')
    expect(formatPasswordResetCountdown(9_400)).toBe('0:10')
    expect(formatPasswordResetCountdown(0)).toBe('0:00')
    expect(formatPasswordResetCountdown(-5_000)).toBe('0:00')
  })
})
