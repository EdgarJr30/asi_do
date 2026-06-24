import { cn } from '@/lib/utils/cn'

const paymentBrandAssets = [
  {
    label: 'Visa',
    src: '/payment/visa.jpg',
    className: 'h-5 w-14'
  },
  {
    label: 'Mastercard',
    src: '/payment/mastercard.jpg',
    className: 'h-8 w-12'
  },
  {
    label: 'Visa Secure',
    src: '/payment/visa-secure.png',
    className: 'h-9 w-9'
  },
  {
    label: 'Mastercard ID Check',
    src: '/payment/mastercard-identity-check.png',
    className: 'h-9 w-9'
  }
] as const

export function PaymentBrandStrip({
  className,
  itemClassName,
  show3DSLabel = false
}: {
  className?: string
  itemClassName?: string
  show3DSLabel?: boolean
}) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)} aria-label="Marcas de pago aceptadas">
      {paymentBrandAssets.map((asset) => (
        <span
          key={asset.label}
          className={cn(
            'inline-flex h-10 min-w-13 items-center justify-center rounded-xl border border-slate-200 bg-white px-2 shadow-sm',
            itemClassName
          )}
          title={asset.label}
        >
          <img
            alt={asset.label}
            className={cn('object-contain', asset.className)}
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
