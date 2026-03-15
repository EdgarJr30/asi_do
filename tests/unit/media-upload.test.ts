import { describe, expect, it } from 'vitest'

import {
  MAX_UPLOAD_SIZE_BYTES,
  ONBOARDING_AVATAR_MIME_TYPES,
  RECRUITER_LOGO_MIME_TYPES,
  UploadConstraintError,
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
