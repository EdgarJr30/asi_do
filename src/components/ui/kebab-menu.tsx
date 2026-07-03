import type { ReactNode } from 'react'

import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react'
import { MoreVertical } from 'lucide-react'
import { Link } from 'react-router-dom'

import { cn } from '@/lib/utils/cn'

const kebabItemClass =
  'flex w-full items-center rounded-control px-2.5 py-1.5 text-left text-[0.8rem] text-(--app-text-muted) transition-colors data-[focus]:bg-(--app-surface-muted) data-[focus]:text-(--app-text)'

/**
 * Menú "kebab" (tres puntos) accesible y reutilizable.
 *
 * Sobre Headless UI `Menu`: cierra automáticamente al hacer clic afuera o con
 * ESC, soporta navegación con teclado y se posiciona en un portal (`anchor`),
 * por lo que no lo recortan contenedores con `overflow`. Reemplaza el patrón
 * `<details>`, que no cierra al hacer clic fuera.
 */
export function KebabMenu({
  children,
  label = 'Acciones',
  className
}: {
  children: ReactNode
  label?: string
  className?: string
}) {
  return (
    <Menu>
      <MenuButton
        aria-label={label}
        className={cn(
          'flex size-7 items-center justify-center rounded-control text-(--app-text-subtle) transition-colors hover:bg-(--app-surface-muted) hover:text-(--app-text) data-[open]:bg-(--app-surface-muted) data-[open]:text-(--app-text)',
          className
        )}
      >
        <MoreVertical className="size-4" />
      </MenuButton>
      <MenuItems
        transition
        anchor="bottom end"
        className="z-50 w-44 rounded-card border border-(--app-border) bg-(--app-surface-elevated) p-1 shadow-[0_18px_40px_rgba(15,23,42,0.16)] [--anchor-gap:6px] transition duration-150 ease-out focus:outline-none data-[closed]:scale-95 data-[closed]:opacity-0"
      >
        {children}
      </MenuItems>
    </Menu>
  )
}

export function KebabMenuItem({
  children,
  onClick,
  to,
  danger = false
}: {
  children: ReactNode
  onClick?: () => void
  to?: string
  danger?: boolean
}) {
  const className = cn(kebabItemClass, danger && 'text-rose-600 data-[focus]:text-rose-700 dark:text-rose-300')
  return (
    <MenuItem>
      {to ? (
        <Link to={to} className={className}>
          {children}
        </Link>
      ) : (
        <button type="button" onClick={onClick} className={className}>
          {children}
        </button>
      )}
    </MenuItem>
  )
}
