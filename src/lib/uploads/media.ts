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

export const CANDIDATE_RESUME_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
] as const

const MIME_TYPE_EXTENSION_MAP: Record<string, string[]> = {
  'application/pdf': ['pdf'],
  'application/msword': ['doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['docx'],
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/svg+xml': ['svg'],
  'image/webp': ['webp']
}

const RASTER_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MIN_RASTER_CROP_ZOOM = 0.5
const MAX_RASTER_CROP_ZOOM = 4

export interface RasterImageCropOptions {
  outputWidth: number
  outputHeight: number
  panX: number
  panY: number
  zoom: number
  quality?: number
}

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

export function isRasterImageFile(file: File) {
  return RASTER_IMAGE_MIME_TYPES.has(file.type)
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
      `${options.fieldLabel} pesa ${formatFileSize(file.size)} y supera el máximo de ${formatFileSize(maxSizeBytes)}. Comprime el archivo o carga uno de ${MAX_UPLOAD_SIZE_LABEL} o menos.`,
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

function getCropDrawLayout(
  frameWidth: number,
  frameHeight: number,
  imageWidth: number,
  imageHeight: number,
  zoom: number,
  panX: number,
  panY: number
) {
  const safeZoom = Math.max(MIN_RASTER_CROP_ZOOM, Math.min(MAX_RASTER_CROP_ZOOM, zoom))
  const baseScale = Math.max(frameWidth / imageWidth, frameHeight / imageHeight) * safeZoom
  const width = imageWidth * baseScale
  const height = imageHeight * baseScale
  const panRangeX = Math.abs(width - frameWidth) / 2
  const panRangeY = Math.abs(height - frameHeight) / 2
  const x = (frameWidth - width) / 2 + Math.max(-1, Math.min(1, panX)) * panRangeX
  const y = (frameHeight - height) / 2 + Math.max(-1, Math.min(1, panY)) * panRangeY

  return { x, y, width, height }
}

export function getRasterImageCropPreviewLayout(input: {
  frameWidth: number
  frameHeight: number
  imageWidth: number
  imageHeight: number
  zoom: number
  panX: number
  panY: number
}) {
  return getCropDrawLayout(
    input.frameWidth,
    input.frameHeight,
    input.imageWidth,
    input.imageHeight,
    input.zoom,
    input.panX,
    input.panY
  )
}

export async function cropRasterImageFile(file: File, options: RasterImageCropOptions) {
  if (!isRasterImageFile(file)) {
    return file
  }

  const image = await loadImageElement(file)
  const canvas = document.createElement('canvas')
  canvas.width = options.outputWidth
  canvas.height = options.outputHeight

  const context = canvas.getContext('2d')

  if (!context) {
    throw new UploadConstraintError(
      'compression_failed',
      'Could not access canvas context.',
      'No pudimos preparar el encuadre de la imagen. Intenta con otro archivo.',
      {
        fileName: file.name,
        fileType: file.type
      }
    )
  }

  const layout = getCropDrawLayout(
    options.outputWidth,
    options.outputHeight,
    image.width,
    image.height,
    options.zoom,
    options.panX,
    options.panY
  )

  context.fillStyle = '#f8fafc'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(image, layout.x, layout.y, layout.width, layout.height)

  const blob = await canvasToBlob(canvas, options.quality ?? 0.9)

  return new File([blob], replaceFileExtension(file.name, 'webp'), {
    type: 'image/webp',
    lastModified: Date.now()
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
