// Imágenes responsivas de Unsplash SIN pérdida de calidad.
//
// Unsplash redimensiona en su CDN según el parámetro `w` (ancho). El problema de
// rendimiento es que servimos un `w=1200` fijo aunque el contenedor muestre la
// imagen a ~400-600px: se descargan bytes de más. La solución es ofrecer varios
// anchos vía `srcSet` y dejar que el navegador elija según viewport y DPR.
//
// Importante: NO bajamos la calidad (`q`); solo ajustamos dimensiones. Cada
// variante se sirve al ancho exacto que necesita el dispositivo, así que la
// imagen se ve nítida (incluida pantalla retina) sin desperdiciar ancho de banda.

const UNSPLASH_HOST = 'images.unsplash.com'

function isUnsplash(url: string | undefined): url is string {
  return typeof url === 'string' && url.includes(UNSPLASH_HOST)
}

/** Reescribe el ancho (`w`) de una URL de Unsplash conservando el resto de params. */
export function unsplashUrl(url: string, width: number): string {
  if (!isUnsplash(url)) return url

  try {
    const parsed = new URL(url)
    parsed.searchParams.set('w', String(width))
    // Deja que el CDN entregue WebP/AVIF cuando el navegador lo soporte.
    parsed.searchParams.set('auto', 'format')
    return parsed.toString()
  } catch {
    return url
  }
}

/**
 * `srcSet` con varios anchos para que el navegador elija el más adecuado.
 * Devuelve `undefined` para URLs que no son de Unsplash (p. ej. assets locales),
 * de modo que el `<img>` simplemente use su `src` original.
 */
export function unsplashSrcSet(url: string | undefined, widths: readonly number[]): string | undefined {
  if (!isUnsplash(url)) return undefined

  return widths.map((width) => `${unsplashUrl(url, width)} ${width}w`).join(', ')
}
