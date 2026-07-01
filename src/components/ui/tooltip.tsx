import type { FocusEvent, KeyboardEvent, ReactNode } from 'react'

import { useRef, useState } from 'react'

import { cn } from '@/lib/utils/cn'

type TooltipSide = 'top' | 'right' | 'bottom' | 'left'

const bubbleBySide: Record<TooltipSide, string> = {
  top: 'bottom-[calc(100%+0.5rem)] left-1/2 -translate-x-1/2 translate-y-1',
  bottom: 'top-[calc(100%+0.5rem)] left-1/2 -translate-x-1/2 -translate-y-1',
  right: 'left-[calc(100%+0.5rem)] top-1/2 -translate-y-1/2 translate-x-1',
  left: 'right-[calc(100%+0.5rem)] top-1/2 -translate-y-1/2 -translate-x-1'
}

const visibleBySide: Record<TooltipSide, string> = {
  top: 'translate-y-0',
  bottom: 'translate-y-0',
  right: 'translate-x-0',
  left: 'translate-x-0'
}

const arrowBySide: Record<TooltipSide, string> = {
  top: 'left-1/2 top-full -mt-1 -translate-x-1/2 border-b border-r',
  bottom: 'left-1/2 bottom-full -mb-1 -translate-x-1/2 border-t border-l',
  right: '-left-1 top-1/2 -translate-y-1/2 border-b border-l',
  left: '-right-1 top-1/2 -translate-y-1/2 border-t border-r'
}

/**
 * Tooltip ligero (mismo lenguaje visual que el del sidebar): se muestra al hover
 * o al enfocar con teclado. Envuelve el trigger; éste debe
 * seguir teniendo su propio `aria-label` porque el tooltip es sólo visual.
 */
export function Tooltip({
  label,
  side = 'top',
  className,
  children
}: {
  label: string
  side?: TooltipSide
  className?: string
  children: ReactNode
}) {
  const [isVisible, setIsVisible] = useState(false)
  const dismissedUntilExitRef = useRef(false)

  function showTooltip() {
    if (!dismissedUntilExitRef.current) {
      setIsVisible(true)
    }
  }

  function hideTooltip() {
    dismissedUntilExitRef.current = false
    setIsVisible(false)
  }

  function dismissTooltip() {
    dismissedUntilExitRef.current = true
    setIsVisible(false)
  }

  function handleBlur(event: FocusEvent<HTMLSpanElement>) {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      hideTooltip()
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLSpanElement>) {
    if (event.key === 'Enter' || event.key === ' ') {
      dismissTooltip()
    }
  }

  return (
    <span
      className={cn('relative inline-flex', className)}
      onBlur={handleBlur}
      onClickCapture={dismissTooltip}
      onFocus={showTooltip}
      onKeyDownCapture={handleKeyDown}
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onPointerDownCapture={dismissTooltip}
    >
      {children}
      <span
        role="tooltip"
        className={cn(
          'pointer-events-none absolute z-50 whitespace-nowrap rounded-lg border border-white/10 bg-slate-900/95 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-[0_12px_28px_rgba(8,12,24,0.45)] backdrop-blur transition-[opacity,transform] duration-150',
          bubbleBySide[side],
          isVisible && ['opacity-100', visibleBySide[side]]
        )}
      >
        <span className={cn('absolute size-2 rotate-45 border-white/10 bg-slate-900/95', arrowBySide[side])} />
        {label}
      </span>
    </span>
  )
}
