import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { surfacePaths } from '@/app/router/surface-paths'

/**
 * El contrato del enlace de recuperación (R7.1).
 *
 * Dos formas de romper la recuperación sin romper ninguna prueba de UI:
 *
 * 1. Cambiar a dónde apunta `redirectTo`. El enlace del correo dejaría de
 *    aterrizar en la pantalla de contraseña nueva.
 * 2. Añadir un origen a `config.toml` sin su ruta `/auth/reset-password`. GoTrue
 *    **ignora en silencio** un `redirectTo` que no esté en la lista y devuelve al
 *    `site_url`, así que quien pide el enlace desde ese origen aterriza en otro
 *    sitio sin ningún error de por medio.
 *
 * Lo segundo es una comprobación de coherencia entre dos archivos del repo, no
 * del proyecto remoto —cuya lista vive en el panel de Supabase—. Sirve para lo
 * que de verdad pasa: alguien añade un dominio nuevo copiando la línea de
 * `/auth/confirm` y se olvida de la gemela.
 */

const resetPasswordForEmail = vi.hoisted(() => vi.fn())

vi.mock('@/lib/supabase/client', () => ({
  supabase: { auth: { resetPasswordForEmail } }
}))

const { getPasswordRecoveryRedirectUrl, requestPasswordRecovery } = await import(
  '@/features/auth/lib/auth-api'
)

function readRedirectAllowlist() {
  const config = readFileSync(resolve(process.cwd(), 'supabase/config.toml'), 'utf8')
  const block = /additional_redirect_urls\s*=\s*\[([^\]]*)\]/.exec(config)

  if (!block) {
    throw new Error('No se encontró `additional_redirect_urls` en supabase/config.toml')
  }

  return [...block[1].matchAll(/"([^"]+)"/g)].map((match) => match[1])
}

describe('contrato del enlace de recuperación', () => {
  beforeEach(() => {
    resetPasswordForEmail.mockReset()
    resetPasswordForEmail.mockResolvedValue({ data: {}, error: null })
  })

  it('aterriza en la pantalla de contraseña nueva, no en el callback de registro', () => {
    const redirectUrl = getPasswordRecoveryRedirectUrl()

    expect(redirectUrl).toBe(`${window.location.origin}${surfacePaths.auth.resetPassword}`)
    expect(redirectUrl).not.toContain(surfacePaths.auth.confirm)
  })

  it('pide el enlace al proveedor con ese destino', async () => {
    await requestPasswordRecovery('miembro@asido.test')

    expect(resetPasswordForEmail).toHaveBeenCalledWith('miembro@asido.test', {
      redirectTo: getPasswordRecoveryRedirectUrl()
    })
  })

  // Sin esto el fallo se traga: la página mostraría "revisa tu correo" después de
  // que el proveedor rechazara el envío por límite de frecuencia.
  it('propaga el error del proveedor en vez de darlo por enviado', async () => {
    resetPasswordForEmail.mockResolvedValue({ data: null, error: new Error('email rate limit exceeded') })

    await expect(requestPasswordRecovery('miembro@asido.test')).rejects.toThrow('email rate limit exceeded')
  })

  it('todo origen habilitado para el callback lo está también para la recuperación', () => {
    const allowlist = readRedirectAllowlist()
    const originsWithCallback = allowlist
      .filter((url) => url.endsWith(surfacePaths.auth.confirm))
      .map((url) => new URL(url).origin)

    expect(originsWithCallback.length).toBeGreaterThan(0)

    for (const origin of originsWithCallback) {
      expect(allowlist).toContain(`${origin}${surfacePaths.auth.resetPassword}`)
    }
  })
})
