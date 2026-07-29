import { useState } from 'react'

import { resolveAvatarThumbnailUrl, resolveAvatarUrl } from '@/features/auth/lib/auth-api'
import { THUMBNAIL_MAX_DIMENSION } from '@/lib/uploads/media'
import { cn } from '@/lib/utils/cn'

function computeInitials(name: string, fallback = '·') {
  return (
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('') || fallback
  )
}

interface UserAvatarProps {
  /** Nombre para derivar las iniciales de respaldo. */
  name: string
  /** Ruta del avatar en el bucket público, o una URL ya resuelta. */
  avatarPath?: string | null
  /** URL directa (tiene prioridad sobre `avatarPath`); útil para previews locales (blob:). */
  avatarUrl?: string | null
  /** Clases de tamaño/forma del contenedor, p. ej. `size-8`. */
  className?: string
  /** Clases de color del respaldo con iniciales. */
  fallbackClassName?: string
  /** Clases de tipografía de las iniciales. */
  textClassName?: string
  /** Iniciales de respaldo cuando no hay nombre. */
  initialsFallback?: string
}

/**
 * Avatar unificado: muestra la foto pública del usuario y cae a iniciales cuando
 * no hay imagen o esta falla al cargar. Se usa en el header, postulaciones,
 * pipeline y directorio de talento para que la foto se vea de forma consistente.
 */
export function UserAvatar({
  name,
  avatarPath,
  avatarUrl,
  className,
  fallbackClassName = 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-white',
  textClassName = 'text-xs font-semibold',
  initialsFallback = '·'
}: UserAvatarProps) {
  // Orden de preferencia: miniatura (~6KB) y, si no existe porque la foto se
  // subió antes de esta optimización, el original. Nunca mostramos el avatar
  // por encima de 64px, así que la miniatura basta incluso en pantallas retina.
  const sources = avatarUrl
    ? [avatarUrl]
    : ([resolveAvatarThumbnailUrl(avatarPath), resolveAvatarUrl(avatarPath)].filter(Boolean) as string[])

  // Recordamos qué URLs fallaron para bajar al siguiente candidato y, al
  // agotarlos, a las iniciales. Si la fuente cambia (p. ej. tras subir otra
  // foto), las URLs nuevas no están en el set y se reintentan solas, sin
  // necesidad de un efecto que reinicie el estado.
  const [failedUrls, setFailedUrls] = useState<ReadonlySet<string>>(() => new Set<string>())

  const resolvedUrl = sources.find((source) => !failedUrls.has(source)) ?? null
  const showImage = resolvedUrl !== null

  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full',
        !showImage && fallbackClassName,
        className
      )}
    >
      {showImage ? (
        <img
          alt={name}
          src={resolvedUrl}
          className="h-full w-full object-cover"
          decoding="async"
          loading="lazy"
          width={THUMBNAIL_MAX_DIMENSION}
          height={THUMBNAIL_MAX_DIMENSION}
          onError={() => setFailedUrls((current) => new Set(current).add(resolvedUrl))}
        />
      ) : (
        <span className={textClassName}>{computeInitials(name, initialsFallback)}</span>
      )}
    </span>
  )
}
