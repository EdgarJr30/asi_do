/**
 * Divide un nombre completo en nombre(s) y apellido(s) de forma best-effort, para
 * autocargar formularios a partir del `full_name` que ya tenemos del usuario.
 * La primera palabra es el nombre; el resto, el apellido.
 */
export function splitFullName(fullName?: string | null): { first: string; last: string } {
  const parts = (fullName ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) {
    return { first: '', last: '' }
  }
  if (parts.length === 1) {
    return { first: parts[0], last: '' }
  }
  return { first: parts[0], last: parts.slice(1).join(' ') }
}
