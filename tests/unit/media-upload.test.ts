import { describe, expect, it } from 'vitest'

import {
  MAX_UPLOAD_SIZE_BYTES,
  ONBOARDING_AVATAR_MIME_TYPES,
  RECRUITER_LOGO_MIME_TYPES,
  THUMBNAIL_MAX_DIMENSION,
  UploadConstraintError,
  createRasterThumbnailFile,
  deriveThumbnailPath,
  formatFileSize,
  validateUploadFile
} from '@/lib/uploads/media'

function createFile(parts: BlobPart[], name: string, type: string) {
  return new File(parts, name, { type })
}

describe('media upload rules', () => {
  it('formats file sizes for user-facing errors', () => {
    expect(formatFileSize(512)).toBe('0.5 KB')
    expect(formatFileSize(1024 * 1024)).toBe('1.00 MB')
    expect(formatFileSize(5 * 1024 * 1024)).toBe('5.00 MB')
  })

  it('accepts modern web image formats like svg and webp', () => {
    expect(() =>
      validateUploadFile(createFile(['<svg></svg>'], 'avatar.svg', 'image/svg+xml'), {
        acceptedMimeTypes: ONBOARDING_AVATAR_MIME_TYPES,
        acceptedFormatsLabel: 'SVG, PNG, JPG o WEBP',
        fieldLabel: 'El avatar'
      })
    ).not.toThrow()

    expect(() =>
      validateUploadFile(createFile([new Uint8Array([1, 2, 3])], 'logo.webp', 'image/webp'), {
        acceptedMimeTypes: RECRUITER_LOGO_MIME_TYPES,
        acceptedFormatsLabel: 'SVG, PNG, JPG o WEBP',
        fieldLabel: 'El logo'
      })
    ).not.toThrow()
  })

  it('rejects files larger than 5 MB with the exact reason', () => {
    const largePdf = createFile(
      [new Uint8Array(MAX_UPLOAD_SIZE_BYTES + 1)],
      'candidate-cv.pdf',
      'application/pdf'
    )

    expect(() =>
      validateUploadFile(largePdf, {
        acceptedMimeTypes: ['application/pdf'],
        acceptedFormatsLabel: 'PDF',
        fieldLabel: 'El CV'
      })
    ).toThrowError(UploadConstraintError)

    try {
      validateUploadFile(largePdf, {
        acceptedMimeTypes: ['application/pdf'],
        acceptedFormatsLabel: 'PDF',
        fieldLabel: 'El CV'
      })
    } catch (error) {
      expect(error).toBeInstanceOf(UploadConstraintError)

      const uploadError = error as UploadConstraintError

      expect(uploadError.code).toBe('file_too_large')
      expect(uploadError.userMessage).toContain('El CV pesa')
      expect(uploadError.userMessage).toContain('5.00 MB')
      expect(uploadError.userMessage).toContain('Comprime el archivo')
    }
  })
})

describe('miniaturas de imágenes públicas', () => {
  it('deriva la ruta de la miniatura junto al original, conservando la carpeta', () => {
    expect(deriveThumbnailPath('user-id/avatar-uuid.webp')).toBe(
      `user-id/avatar-uuid-${THUMBNAIL_MAX_DIMENSION}.webp`
    )
    // El original puede no ser WebP (SVG, PNG): la miniatura siempre lo es.
    expect(deriveThumbnailPath('tenant-id/logo-uuid.png')).toBe(
      `tenant-id/logo-uuid-${THUMBNAIL_MAX_DIMENSION}.webp`
    )
  })

  it('no derivar una miniatura de otra: la ruta es estable e idempotente por archivo', () => {
    const original = 'user-id/avatar-uuid.webp'
    const thumbnail = deriveThumbnailPath(original)

    // Volver a derivar sobre la miniatura produciría una ruta distinta, así que
    // el consumidor siempre debe partir del original guardado en la base.
    expect(deriveThumbnailPath(thumbnail)).not.toBe(thumbnail)
    expect(deriveThumbnailPath(original)).toBe(thumbnail)
  })

  it('omite la miniatura para archivos que no son imágenes raster (p. ej. logos SVG)', async () => {
    const svgLogo = createFile(['<svg></svg>'], 'logo.svg', 'image/svg+xml')

    await expect(createRasterThumbnailFile(svgLogo)).resolves.toBeNull()
  })
})
