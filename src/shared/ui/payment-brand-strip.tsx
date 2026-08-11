import { cn } from '@/lib/utils/cn'

const paymentBrandAssets = [
  {
    label: 'Visa',
    src: '/payment/visa.webp',
    className: 'h-5 w-14'
  },
  {
    label: 'Mastercard',
    src: '/payment/mastercard.webp',
    className: 'h-8 w-12'
  },
  {
    label: 'Visa Secure',
    src: '/payment/visa-secure.webp',
    className: 'h-9 w-9'
  },
  {
    label: 'Mastercard ID Check',
    src: '/payment/mastercard-identity-check.webp',
    className: 'h-9 w-9'
  }
] as const

export function PaymentBrandStrip({
  className,
  itemClassName,
  compact = false,
  show3DSLabel = false
}: {
  className?: string
  itemClassName?: string
  compact?: boolean
  show3DSLabel?: boolean
}) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)} aria-label="Marcas de pago aceptadas">
      {paymentBrandAssets.map((asset) => (
        <span
          key={asset.label}
          className={cn(
            'inline-flex h-10 min-w-13 items-center justify-center rounded-control border border-slate-200 bg-white px-2 shadow-sm',
            compact && 'h-8 min-w-11 px-1.5',
            itemClassName
          )}
          title={asset.label}
        >
          <img
            alt={asset.label}
            className={cn(
              'object-contain',
              asset.className,
              compact && 'max-h-6 max-w-10'
            )}
            decoding="async"
            loading="lazy"
            src={asset.src}
          />
        </span>
      ))}
      {show3DSLabel ? (
        <span className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600">
          3D Secure habilitado
        </span>
      ) : null}
    </div>
  )
}
