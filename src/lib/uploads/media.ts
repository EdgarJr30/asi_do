const ONE_KILOBYTE = 1024
const ONE_MEGABYTE = ONE_KILOBYTE * ONE_KILOBYTE

export const MAX_UPLOAD_SIZE_BYTES = 5 * ONE_MEGABYTE
export const MAX_UPLOAD_SIZE_LABEL = '5 MB'

export const ONBOARDING_AVATAR_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml'
] as const

export const RECRUITER_LOGO_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml'
] as const

export const RECRUITER_DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp'
] as const

const MIME_TYPE_EXTENSION_MAP: Record<string, string[]> = {
  'application/pdf': ['pdf'],
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/svg+xml': ['svg'],
  'image/webp': ['webp']
}

const RASTER_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

interface FileValidationOptions {
  acceptedMimeTypes: readonly string[]
  acceptedFormatsLabel: string
  fieldLabel: string
  maxSizeBytes?: number
}

interface PrepareUploadOptions extends FileValidationOptions {
  maxImageDimension?: number
}

export class UploadConstraintError extends Error {
  code: 'unsupported_type' | 'file_too_large' | 'compression_failed'
  userMessage: string
  metadata: Record<string, unknown>

  constructor(
    code: UploadConstraintError['code'],
    message: string,
    userMessage: string,
    metadata: Record<string, unknown>
  ) {
    super(message)
    this.name = 'UploadConstraintError'
    this.code = code
    this.userMessage = userMessage
    this.metadata = metadata
  }
}

function getFileExtension(file: File) {
  return file.name.split('.').pop()?.trim().toLowerCase() ?? ''
}

function matchesAcceptedMimeType(file: File, acceptedMimeTypes: readonly string[]) {
  if (acceptedMimeTypes.includes(file.type)) {
    return true
  }

  const extension = getFileExtension(file)

  return acceptedMimeTypes.some((mimeType) => MIME_TYPE_EXTENSION_MAP[mimeType]?.includes(extension))
}

function replaceFileExtension(fileName: string, nextExtension: string) {
  return fileName.replace(/\.[^/.]+$/, '') + `.${nextExtension}`
}

export function formatFileSize(bytes: number) {
  if (bytes < ONE_MEGABYTE) {
    return `${(bytes / ONE_KILOBYTE).toFixed(1)} KB`
  }

  return `${(bytes / ONE_MEGABYTE).toFixed(2)} MB`
}

export function validateUploadFile(file: File, options: FileValidationOptions) {
  const maxSizeBytes = options.maxSizeBytes ?? MAX_UPLOAD_SIZE_BYTES

  if (!matchesAcceptedMimeType(file, options.acceptedMimeTypes)) {
    throw new UploadConstraintError(
      'unsupported_type',
      `Unsupported file type for ${options.fieldLabel}.`,
      `${options.fieldLabel} solo acepta ${options.acceptedFormatsLabel}.`,
      {
        acceptedMimeTypes: options.acceptedMimeTypes,
        fieldLabel: options.fieldLabel,
        fileName: file.name,
        fileType: file.type
      }
    )
  }

  if (file.size > maxSizeBytes) {
    throw new UploadConstraintError(
      'file_too_large',
      `${options.fieldLabel} exceeds the maximum upload size.`,
      `${options.fieldLabel} pesa ${formatFileSize(file.size)} y supera el maximo de ${formatFileSize(maxSizeBytes)}. Comprime el archivo o carga uno de ${MAX_UPLOAD_SIZE_LABEL} o menos.`,
      {
        fieldLabel: options.fieldLabel,
        fileName: file.name,
        fileSizeBytes: file.size,
        maxSizeBytes
      }
    )
  }
}

async function loadImageElement(file: File) {
  const objectUrl = URL.createObjectURL(file)

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const nextImage = new Image()

      nextImage.onload = () => resolve(nextImage)
      nextImage.onerror = () => reject(new Error('No pudimos leer la imagen para comprimirla.'))
      nextImage.src = objectUrl
    })

    return image
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

async function canvasToBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('No pudimos serializar la imagen comprimida.'))
          return
        }

        resolve(blob)
      },
      'image/webp',
      quality
    )
  })
}

async function compressRasterImage(file: File, maxSizeBytes: number, maxImageDimension: number) {
  const image = await loadImageElement(file)
  const largestDimension = Math.max(image.width, image.height)
  const baseScale = largestDimension > maxImageDimension ? maxImageDimension / largestDimension : 1
  const attempts = [
    { scale: baseScale, quality: 0.86 },
    { scale: baseScale * 0.9, quality: 0.78 },
    { scale: baseScale * 0.8, quality: 0.68 },
    { scale: baseScale * 0.7, quality: 0.6 }
  ]

  let bestBlob: Blob | null = null

  for (const attempt of attempts) {
    const width = Math.max(1, Math.round(image.width * Math.min(attempt.scale, 1)))
    const height = Math.max(1, Math.round(image.height * Math.min(attempt.scale, 1)))
    const canvas = document.createElement('canvas')

    canvas.width = width
    canvas.height = height

    const context = canvas.getContext('2d')

    if (!context) {
      throw new UploadConstraintError(
        'compression_failed',
        'Could not access canvas context.',
        'No pudimos preparar la compresion de la imagen. Intenta con otro archivo.',
        {
          fileName: file.name,
          fileType: file.type
        }
      )
    }

    context.drawImage(image, 0, 0, width, height)

    const blob = await canvasToBlob(canvas, attempt.quality)

    if (!bestBlob || blob.size < bestBlob.size) {
      bestBlob = blob
    }

    if (blob.size <= maxSizeBytes) {
      return new File([blob], replaceFileExtension(file.name, 'webp'), {
        type: 'image/webp',
        lastModified: Date.now()
      })
    }
  }

  if (!bestBlob) {
    throw new UploadConstraintError(
      'compression_failed',
      'Could not compress image upload.',
      'No pudimos comprimir la imagen. Intenta con otro archivo.',
      {
        fileName: file.name,
        fileType: file.type
      }
    )
  }

  return new File([bestBlob], replaceFileExtension(file.name, 'webp'), {
    type: 'image/webp',
    lastModified: Date.now()
  })
}

export async function prepareUploadFile(file: File, options: PrepareUploadOptions) {
  const maxSizeBytes = options.maxSizeBytes ?? MAX_UPLOAD_SIZE_BYTES

  validateUploadFile(file, options)

  const candidateFile =
    RASTER_IMAGE_MIME_TYPES.has(file.type)
      ? await compressRasterImage(file, maxSizeBytes, options.maxImageDimension ?? 1600)
      : file

  validateUploadFile(candidateFile, options)

  return candidateFile
}
