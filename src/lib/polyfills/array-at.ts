/**
 * `Array.prototype.at` / `String.prototype.at` para navegadores anteriores a
 * Chrome 92 y Safari 15.4.
 *
 * `.at(-1)` es una **API de runtime**, no sintaxis: el `target` de Vite y el de
 * TypeScript transpilan sintaxis, así que ninguno de los dos añade el método.
 * En un navegador viejo el bundle carga sin quejarse y revienta más tarde con
 * `this.i.at is not a function` desde el código minificado, que no dice ni qué
 * arreglo era ni de qué archivo venía.
 *
 * Se importa de primero en `main.tsx`, antes que la app y sus dependencias:
 * varias de ellas también lo usan, así que parchear solo nuestro código no
 * bastaría.
 */
function at(this: { length: number; [index: number]: unknown }, index: number) {
  const length = this.length
  // `at` acepta fraccionarios y NaN: los trunca a entero, y NaN cuenta como 0.
  const relative = Math.trunc(index) || 0
  const absolute = relative < 0 ? length + relative : relative

  return absolute < 0 || absolute >= length ? undefined : this[absolute]
}

for (const prototype of [Array.prototype, String.prototype]) {
  if (typeof (prototype as { at?: unknown }).at === 'function') {
    continue
  }

  Object.defineProperty(prototype, 'at', {
    value: at,
    writable: true,
    enumerable: false,
    configurable: true
  })
}

export {}
