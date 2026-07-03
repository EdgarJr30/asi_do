import type { ReactNode } from 'react'

import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react'
import { X } from 'lucide-react'

import { cn } from '@/lib/utils/cn'

export interface SideSheetProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  /** Ancho máximo del panel (clase Tailwind). Por defecto `max-w-2xl`. */
  widthClassName?: string
  footer?: ReactNode
}

/**
 * Panel lateral deslizante (slide-over / drawer) que entra desde la derecha.
 *
 * Patrón recomendado para formularios largos de crear/editar: mantiene el
 * contexto de la página detrás y da más espacio que un modal centrado.
 * Construido sobre Headless UI `Dialog`, que aporta focus-trap, cierre con ESC,
 * bloqueo de scroll y accesibilidad (rol dialog + título) sin trabajo extra.
 */
export function SideSheet({
  open,
  onClose,
  title,
  description,
  children,
  widthClassName = 'max-w-2xl',
  footer
}: SideSheetProps) {
  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm transition-opacity duration-300 ease-out data-[closed]:opacity-0"
      />
      <div className="fixed inset-0 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10 sm:pl-16">
            <DialogPanel
              transition
              className={cn(
                'pointer-events-auto w-screen transform transition duration-300 ease-out data-[closed]:translate-x-full',
                widthClassName
              )}
            >
              <div className="flex h-full flex-col bg-(--app-surface) shadow-[0_0_60px_rgba(15,23,42,0.18)]">
                <header className="flex items-start justify-between gap-4 border-b border-(--app-border) px-5 py-4 sm:px-6">
                  <div className="min-w-0">
                    <DialogTitle className="text-[1.05rem] font-semibold tracking-tight text-(--app-text)">
                      {title}
                    </DialogTitle>
                    {description ? <p className="mt-0.5 text-sm text-(--app-text-muted)">{description}</p> : null}
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Cerrar"
                    className="flex size-8 shrink-0 items-center justify-center rounded-control text-(--app-text-subtle) transition-colors hover:bg-(--app-surface-muted) hover:text-(--app-text)"
                  >
                    <X className="size-4" />
                  </button>
                </header>
                <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
                {footer ? (
                  <footer className="border-t border-(--app-border) px-5 py-4 sm:px-6">{footer}</footer>
                ) : null}
              </div>
            </DialogPanel>
          </div>
        </div>
      </div>
    </Dialog>
  )
}
