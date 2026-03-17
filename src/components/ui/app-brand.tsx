import { useTheme } from 'next-themes'

import { cn } from '@/lib/utils/cn'

const BRAND_NAME = 'ASI Rep. Dominicana'

export function BrandLockup({
  className,
  surface = 'light',
  decorative = false
}: {
  className?: string
  surface?: 'light' | 'dark' | 'auto'
  decorative?: boolean
}) {
  const { resolvedTheme, theme } = useTheme()
  const activeSurface = surface === 'auto' ? ((resolvedTheme ?? theme) === 'dark' ? 'dark' : 'light') : surface
  const src = activeSurface === 'dark' ? '/brand/asi-logo-white-transparent.png' : '/brand/asi-logo-light.png'

  return (
    <img
      alt={decorative ? '' : BRAND_NAME}
      aria-hidden={decorative || undefined}
      className={cn('block h-auto w-full object-contain', className)}
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
      <img alt={BRAND_NAME} className={cn('h-full w-full object-contain', className)} src="/brand/asi-logo-white-transparent.png" />
    </span>
  )
}
