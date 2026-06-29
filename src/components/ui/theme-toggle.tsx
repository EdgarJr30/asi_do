import type { MouseEvent } from 'react'

import { flushSync } from 'react-dom'
import { MoonStar, SunMedium } from 'lucide-react'
import { useTheme } from 'next-themes'

import { cn } from '@/lib/utils/cn'

import { Button } from './button'

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => { finished: Promise<void> }
}

export function ThemeToggle({ className, compact = false }: { className?: string; compact?: boolean }) {
  const { resolvedTheme, theme, setTheme } = useTheme()
  const isDark = (resolvedTheme ?? theme) === 'dark'
  const label = isDark ? 'Modo claro' : 'Modo oscuro'
  const Icon = isDark ? SunMedium : MoonStar

  function handleToggle(event: MouseEvent<HTMLButtonElement>) {
    const next = isDark ? 'light' : 'dark'
    const doc = document as ViewTransitionDocument
    const prefersReduced =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

    // Sin soporte de View Transitions o con motion reducido: cambio directo.
    if (!doc.startViewTransition || prefersReduced) {
      setTheme(next)
      return
    }

    // Origen del barrido = centro del botón; radio = esquina más lejana.
    const rect = event.currentTarget.getBoundingClientRect()
    const x = rect.left + rect.width / 2
    const y = rect.top + rect.height / 2
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))

    const root = document.documentElement
    root.style.setProperty('--theme-x', `${x}px`)
    root.style.setProperty('--theme-y', `${y}px`)
    root.style.setProperty('--theme-r', `${radius}px`)
    root.classList.add('theme-transition-active')

    const transition = doc.startViewTransition(() => {
      // flushSync fuerza que next-themes aplique la clase en el DOM antes de
      // que el navegador capture el snapshot del nuevo estado.
      flushSync(() => setTheme(next))
    })

    void transition.finished.finally(() => {
      root.classList.remove('theme-transition-active')
    })
  }

  return (
    <Button
      aria-label={label}
      className={cn(compact ? 'size-11 min-w-11 rounded-full px-0 sm:size-11' : 'h-12 w-12 px-0 sm:w-auto sm:px-4', className)}
      title={label}
      variant="outline"
      onClick={handleToggle}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {compact ? null : <span className="hidden whitespace-nowrap sm:inline">{label}</span>}
    </Button>
  )
}
