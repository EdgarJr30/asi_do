import { useTheme } from 'next-themes'

import { cn } from '@/lib/utils/cn'

const BRAND_NAME = 'ASI Rep. Dominicana'

// Variantes responsivas del logo (192/384/512). Se sirve la resolución acorde al
// ancho mostrado y al DPR, evitando bajar 512px cuando se ve a ~144-176px en móvil.
function brandSrcSet(src: string): string {
  const base = src.replace(/\.webp$/, '')
  return `${base}-192.webp 192w, ${base}-384.webp 384w, ${src} 512w`
}

export function BrandLockup({
  className,
  surface = 'light',
  decorative = false,
  sizes = '176px'
}: {
  className?: string
  surface?: 'light' | 'dark' | 'auto'
  decorative?: boolean
  /** Ancho mostrado para que el navegador elija la variante (`srcset`). */
  sizes?: string
}) {
  const { resolvedTheme, theme } = useTheme()
  const activeSurface = surface === 'auto' ? ((resolvedTheme ?? theme) === 'dark' ? 'dark' : 'light') : surface
  const src = activeSurface === 'dark' ? '/brand/asi-logo-white-transparent.webp' : '/brand/asi-logo-light.no-bg.webp'

  return (
    <img
      alt={decorative ? '' : BRAND_NAME}
      aria-hidden={decorative || undefined}
      className={cn('block h-auto w-full object-contain', className)}
      width={512}
      height={512}
      sizes={sizes}
      srcSet={brandSrcSet(src)}
      src={src}
    />
  )
}

export function BrandMark({
  className,
  panelClassName
}: {
  className?: string
  panelClassName?: string
}) {
  return (
    <span
      className={cn(
        'flex size-12 shrink-0 items-center justify-center rounded-[18px] border border-primary-400/20 bg-primary-600 p-2.5 shadow-[0_16px_32px_rgba(43,69,143,0.22)]',
        panelClassName
      )}
    >
      {/* Siempre se muestra pequeño (≤48px): la variante de 192px sobra y pesa ~6KB. */}
      <img
        alt={BRAND_NAME}
        className={cn('h-full w-full object-contain', className)}
        width={192}
        height={192}
        src="/brand/asi-logo-white-transparent-192.webp"
      />
    </span>
  )
}
