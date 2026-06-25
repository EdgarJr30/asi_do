import type { Transition } from 'motion/react'
import { motion, useReducedMotion } from 'motion/react'

import { BrandMark } from '@/components/ui/app-brand'
import { cn } from '@/lib/utils/cn'

type LoaderSize = 'sm' | 'md' | 'lg'

const spinnerFrameBySize: Record<LoaderSize, string> = {
  sm: 'size-7',
  md: 'size-9',
  lg: 'size-12'
}

const spinnerRingBySize: Record<LoaderSize, string> = {
  sm: 'border-[2px]',
  md: 'border-[2.5px]',
  lg: 'border-[3px]'
}

const spinnerInsetBySize: Record<LoaderSize, string> = {
  sm: 'inset-1',
  md: 'inset-1.5',
  lg: 'inset-2'
}

const spinnerBrandPanelBySize: Record<LoaderSize, string> = {
  sm: 'size-4 rounded-md p-0.5 shadow-[0_6px_14px_rgba(43,69,143,0.22)]',
  md: 'size-5 rounded-lg p-1 shadow-[0_8px_18px_rgba(43,69,143,0.24)]',
  lg: 'size-7 rounded-xl p-1.5 shadow-[0_10px_22px_rgba(43,69,143,0.26)]'
}

const spinTransition: Transition = {
  repeat: Infinity,
  ease: 'linear',
  duration: 0.85
}

/**
 * Loader oficial compacto para usos inline (botones, filas, tablas y tarjetas).
 * Mantiene el logo ASI y los anillos del loader de página en escala pequeña.
 */
export function Spinner({ size = 'md', className }: { size?: LoaderSize; className?: string }) {
  const shouldReduceMotion = useReducedMotion()

  return (
    <span
      className={cn('relative inline-flex shrink-0 items-center justify-center', spinnerFrameBySize[size], className)}
      role="status"
      aria-label="Cargando"
    >
      <motion.span
        className={cn('absolute inset-0 rounded-full border-primary-500/15 border-t-primary-500', spinnerRingBySize[size])}
        animate={shouldReduceMotion ? undefined : { rotate: 360 }}
        transition={spinTransition}
      />
      <motion.span
        className={cn('absolute rounded-full border-accent-400/15 border-b-accent-400', spinnerInsetBySize[size], spinnerRingBySize[size])}
        animate={shouldReduceMotion ? undefined : { rotate: -360 }}
        transition={{ ...spinTransition, duration: 1.35 }}
      />
      <motion.span
        animate={shouldReduceMotion ? undefined : { scale: [1, 1.05, 1] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
      >
        <BrandMark panelClassName={spinnerBrandPanelBySize[size]} />
      </motion.span>
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
