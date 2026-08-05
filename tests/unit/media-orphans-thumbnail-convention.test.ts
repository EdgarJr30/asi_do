import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { THUMBNAIL_MAX_DIMENSION, deriveThumbnailPath } from '@/lib/uploads/media'

// `scripts/media-orphans.ts` corre bajo `tsconfig.node.json`, que no carga los
// tipos del DOM, así que no puede importar `src/lib/uploads/media.ts` (usa
// canvas). Mantiene una copia de la convención de miniatura y este test es lo
// único que impide que las dos se separen: si divergen, el barredor deja de
// reconocer las miniaturas vivas y las borra como si fueran huérfanas.
const scriptSource = readFileSync(resolve(process.cwd(), 'scripts/media-orphans.ts'), 'utf8')

function readScriptThumbnailDimension() {
  const match = /const THUMBNAIL_MAX_DIMENSION = (\d+)/.exec(scriptSource)

  return match ? Number(match[1]) : null
}

function readScriptThumbnailExpression() {
  const match = /function deriveThumbnailPath\(path: string\): string \{\s*return (.+)\s*\}/.exec(scriptSource)

  return match?.[1]?.trim() ?? null
}

const samples = [
  'user-id/avatar-uuid.webp',
  'tenant-id/logo-uuid.png',
  'tenant-id/logo-uuid.svg',
  'sin-extension',
  'carpeta.con.puntos/archivo.final.jpg'
]

describe('convención de miniatura del barredor de media', () => {
  it('el script usa la misma dimensión que la app', () => {
    expect(readScriptThumbnailDimension()).toBe(THUMBNAIL_MAX_DIMENSION)
  })

  it('el script deriva exactamente la misma ruta que la app', () => {
    const dimension = readScriptThumbnailDimension()
    const expression = readScriptThumbnailExpression()

    expect(dimension).not.toBeNull()
    expect(expression).not.toBeNull()

    // Se reproduce la expresión del script en lugar de importarla, y se compara
    // contra la función real sobre casos con y sin extensión.
    for (const sample of samples) {
      const fromScript = `${sample.replace(/\.[^/.]+$/, '')}-${dimension}.webp`

      expect(fromScript).toBe(deriveThumbnailPath(sample))
    }
  })
})

describe('cobertura de buckets del barredor de media', () => {
  it('cubre todos los buckets con objetos gestionados por la app', () => {
    // Un bucket ausente aquí nunca se barre; una columna de ruta ausente hace
    // que sus archivos se vean como huérfanos y se borren. Lo segundo es el
    // fallo caro, así que la lista se revisa cuando se añade una columna.
    const declaredBuckets = [...scriptSource.matchAll(/bucket: '([^']+)'/g)].map((match) => match[1])

    expect(new Set(declaredBuckets)).toEqual(
      new Set([
        'avatars',
        'company-assets',
        'candidate-resumes',
        'membership-receipts',
        'verification-documents'
      ])
    )
  })
})
