import type { FocusEvent, KeyboardEvent, ReactNode } from 'react'

import { useRef, useState } from 'react'

import { cn } from '@/lib/utils/cn'

type TooltipSide = 'top' | 'right' | 'bottom' | 'left'
type TooltipActivation = 'dismiss' | 'toggle'

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
  activation = 'dismiss',
  className,
  children
}: {
  label: string
  side?: TooltipSide
  activation?: TooltipActivation
  className?: string
  children: ReactNode
}) {
  const [isVisible, setIsVisible] = useState(false)
  const dismissedUntilExitRef = useRef(false)
  const pointerToggleStartedRef = useRef(false)

  function showTooltip() {
    if (activation === 'toggle' && pointerToggleStartedRef.current) {
      return
    }
    if (!dismissedUntilExitRef.current) {
      setIsVisible(true)
    }
  }

  function hideTooltip() {
    dismissedUntilExitRef.current = false
    pointerToggleStartedRef.current = false
    setIsVisible(false)
  }

  function dismissTooltip() {
    dismissedUntilExitRef.current = true
    pointerToggleStartedRef.current = false
    setIsVisible(false)
  }

  function handleClickCapture() {
    if (activation === 'toggle') {
      if (pointerToggleStartedRef.current) {
        pointerToggleStartedRef.current = false
        setIsVisible((current) => !current)
        return
      }

      setIsVisible(true)
      return
    }

    dismissTooltip()
  }

  function handlePointerDownCapture() {
    if (activation === 'toggle') {
      pointerToggleStartedRef.current = true
      return
    }

    dismissTooltip()
  }

  function handleBlur(event: FocusEvent<HTMLSpanElement>) {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      hideTooltip()
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLSpanElement>) {
    if (event.key === 'Escape') {
      hideTooltip()
      return
    }
    if (activation === 'toggle') {
      return
    }
    if (event.key === 'Enter' || event.key === ' ') {
      dismissTooltip()
    }
  }

  return (
    <span
      className={cn('relative inline-flex', className)}
      onBlur={handleBlur}
      onClickCapture={handleClickCapture}
      onFocus={showTooltip}
      onKeyDownCapture={handleKeyDown}
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onPointerDownCapture={handlePointerDownCapture}
    >
      {children}
      <span
        role="tooltip"
        className={cn(
          'pointer-events-none absolute z-50 max-w-72 whitespace-normal rounded-control border border-white/10 bg-slate-900/95 px-2.5 py-1.5 text-left text-xs font-medium leading-5 text-white opacity-0 shadow-[0_12px_28px_rgba(8,12,24,0.45)] backdrop-blur transition-[opacity,transform] duration-150',
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
