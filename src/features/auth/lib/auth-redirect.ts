/**
 * Devuelve un destino `next` interno y seguro desde el querystring, o null.
 * Solo acepta rutas internas (empiezan con "/" y no "//") para evitar open-redirects.
 */
export function getSafeNextPath(search: string): string | null {
  const next = new URLSearchParams(search).get('next')
  if (!next) {
    return null
  }
  if (!next.startsWith('/') || next.startsWith('//')) {
    return null
  }
  return next
}

/** Construye un querystring que preserva `next` y `email` entre sign-in y sign-up. */
export function buildAuthRedirectQuery(search: string): string {
  const source = new URLSearchParams(search)
  const params = new URLSearchParams()
  const next = getSafeNextPath(search)
  if (next) {
    params.set('next', next)
  }
  const email = source.get('email')
  if (email) {
    params.set('email', email)
  }
  const query = params.toString()
  return query ? `?${query}` : ''
}
