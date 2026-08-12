/**
 * Ventana de la recuperación de contraseña.
 *
 * `otp_expiry` (supabase/config.toml) gobierna cuánto vive el enlace del correo
 * *antes* de abrirlo. Al abrirlo, GoTrue emite una sesión normal que dura
 * `jwt_expiry` (una hora) y que el SDK refresca sola: si el enlace se acorta a 15
 * minutos pero la sesión no, quien deje la pestaña abierta conserva la
 * credencial que llegó por correo mucho más tiempo del que dice el correo. Por eso
 * la pantalla aplica aquí el mismo tope, y lo mide desde el `iat` que firmó el
 * servidor —no desde que montó el componente— para que recargar no regale tiempo.
 *
 * Este valor y `otp_expiry` son el mismo número por contrato; lo comprueba
 * `tests/unit/password-reset-window.test.ts`.
 */
export const PASSWORD_RESET_WINDOW_SECONDS = 15 * 60

/** Cómo se nombra la ventana en la interfaz y en los correos. */
export const PASSWORD_RESET_WINDOW_LABEL = '15 minutos'

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=')

  return atob(padded)
}

/**
 * Momento (ms) en que el servidor firmó el token, o `null` si no se puede leer.
 * No valida la firma —para eso está el servidor—: solo lee una marca de tiempo
 * que ya viaja en el token para no tener que confiar en el reloj del montaje.
 */
export function readAccessTokenIssuedAt(accessToken: string | null | undefined) {
  if (!accessToken) {
    return null
  }

  const payload = accessToken.split('.')[1]

  if (!payload) {
    return null
  }

  try {
    const claims = JSON.parse(decodeBase64Url(payload)) as { iat?: unknown }

    return typeof claims.iat === 'number' && Number.isFinite(claims.iat) ? claims.iat * 1000 : null
  } catch {
    return null
  }
}

/**
 * Instante (ms) en que la pantalla deja de aceptar el cambio de contraseña.
 * Sin `iat` legible se cuenta desde ahora: es el lado seguro para la persona
 * (nunca le corta antes de tiempo) y el servidor sigue siendo quien decide.
 */
export function resolvePasswordResetDeadline(accessToken: string | null | undefined, nowMs: number) {
  const issuedAt = readAccessTokenIssuedAt(accessToken)

  return (issuedAt ?? nowMs) + PASSWORD_RESET_WINDOW_SECONDS * 1000
}

/** `mm:ss` para el contador. Nunca devuelve negativos ni horas: la ventana es corta. */
export function formatPasswordResetCountdown(remainingMs: number) {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${minutes}:${String(seconds).padStart(2, '0')}`
}
