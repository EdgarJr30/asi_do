import type { Transition } from 'motion/react'
import { motion, useReducedMotion } from 'motion/react'

import { BrandMark } from '@/components/ui/app-brand'
import { cn } from '@/lib/utils/cn'

type LoaderSize = 'sm' | 'md' | 'lg'

const ringSizeByVariant: Record<LoaderSize, string> = {
  sm: 'size-5 border-[2px]',
  md: 'size-8 border-[2.5px]',
  lg: 'size-11 border-[3px]'
}

const spinTransition: Transition = {
  repeat: Infinity,
  ease: 'linear',
  duration: 0.85
}

/**
 * Spinner ligero para usos inline (botones, filas, secciones de tarjeta).
 * Dos arcos contrarrotatorios con los colores de marca.
 */
export function Spinner({ size = 'md', className }: { size?: LoaderSize; className?: string }) {
  const shouldReduceMotion = useReducedMotion()

  return (
    <span className={cn('relative inline-flex', ringSizeByVariant[size], className)} role="status" aria-label="Cargando">
      <motion.span
        className="absolute inset-0 rounded-full border-(--app-border) border-t-primary-500"
        style={{ borderWidth: 'inherit' }}
        animate={shouldReduceMotion ? undefined : { rotate: 360 }}
        transition={spinTransition}
      />
    </span>
  )
}

/**
 * Loader de página: estado de carga centralizado y con sello de marca.
 * Halo pulsante + dos anillos contrarrotatorios alrededor del logo ASI que respira.
 * Respeta `prefers-reduced-motion`.
 */
export function PageLoader({
  label = 'Preparando tu espacio',
  hint,
  className,
  fullScreen = false
}: {
  label?: string
  hint?: string
  className?: string
  fullScreen?: boolean
}) {
  const shouldReduceMotion = useReducedMotion()

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex w-full flex-col items-center justify-center gap-6 px-6 text-center',
        fullScreen ? 'min-h-dvh' : 'min-h-[clamp(16rem,42vh,28rem)]',
        className
      )}
    >
      <div className="relative flex size-24 items-center justify-center">
        {/* Halo pulsante */}
        <motion.span
          className="absolute inset-0 rounded-full bg-primary-500/15 blur-[2px]"
          animate={shouldReduceMotion ? undefined : { scale: [1, 1.3, 1], opacity: [0.55, 0, 0.55] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
        {/* Anillo exterior */}
        <motion.span
          className="absolute inset-0 rounded-full border-[3px] border-primary-500/15 border-t-primary-500"
          animate={shouldReduceMotion ? undefined : { rotate: 360 }}
          transition={{ duration: 1.1, repeat: Infinity, ease: 'linear' }}
        />
        {/* Anillo interior contrarrotatorio */}
        <motion.span
          className="absolute inset-[0.55rem] rounded-full border-[3px] border-accent-400/15 border-b-accent-400"
          animate={shouldReduceMotion ? undefined : { rotate: -360 }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'linear' }}
        />
        {/* Marca que respira */}
        <motion.span
          animate={shouldReduceMotion ? undefined : { scale: [1, 1.06, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <BrandMark className="size-7" panelClassName="size-12 rounded-2xl shadow-[0_12px_28px_rgba(43,69,143,0.28)]" />
        </motion.span>
      </div>

      <div className="space-y-1.5">
        <p className="flex items-center justify-center gap-1 text-sm font-semibold text-(--app-text)">
          {label}
          {shouldReduceMotion ? null : (
            <span aria-hidden className="inline-flex">
              {[0, 1, 2].map((index) => (
                <motion.span
                  key={index}
                  className="inline-block"
                  animate={{ opacity: [0.2, 1, 0.2] }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut', delay: index * 0.18 }}
                >
                  .
                </motion.span>
              ))}
            </span>
          )}
        </p>
        {hint ? <p className="text-xs text-(--app-text-muted)">{hint}</p> : null}
      </div>
    </div>
  )
}
