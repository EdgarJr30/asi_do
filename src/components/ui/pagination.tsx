import { ChevronLeft, ChevronRight } from 'lucide-react'

import { cn } from '@/lib/utils/cn'
import { getPaginationItems } from '@/components/ui/pagination-items'

export interface PaginationProps {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  ariaLabel?: string
  className?: string
  siblingCount?: number
}

export function Pagination({
  page,
  totalPages,
  onPageChange,
  ariaLabel = 'Paginación',
  className,
  siblingCount = 1
}: PaginationProps) {
  if (totalPages <= 1) return null

  const safePage = Math.min(Math.max(page, 0), totalPages - 1)
  const items = getPaginationItems(safePage, totalPages, siblingCount)
  const buttonClassName =
    'inline-flex size-9 shrink-0 items-center justify-center rounded-control border border-(--app-border) bg-(--app-surface) text-[0.8rem] font-semibold text-(--app-text-muted) transition-colors hover:border-primary-300 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--app-ring) focus-visible:ring-offset-2 focus-visible:ring-offset-(--app-canvas) disabled:pointer-events-none disabled:opacity-45 dark:hover:border-primary-400 dark:hover:text-primary-200'

  return (
    <nav className={cn('flex flex-wrap items-center justify-end gap-1.5', className)} aria-label={ariaLabel}>
      <button
        type="button"
        onClick={() => onPageChange(Math.max(0, safePage - 1))}
        disabled={safePage === 0}
        className={buttonClassName}
        aria-label="Página anterior"
      >
        <ChevronLeft className="size-4" />
      </button>

      {items.map((item, index) =>
        item === 'ellipsis' ? (
          <span
            key={`pagination-ellipsis-${index}`}
            className="flex size-9 shrink-0 items-center justify-center text-[0.78rem] font-semibold text-(--app-text-subtle)"
            aria-hidden="true"
          >
            ...
          </span>
        ) : (
          <button
            key={item}
            type="button"
            onClick={() => onPageChange(item)}
            aria-current={item === safePage ? 'page' : undefined}
            className={cn(
              buttonClassName,
              item === safePage
                ? 'border-primary-600 bg-primary-600 text-white hover:border-primary-600 hover:text-white'
                : 'hover:bg-(--app-surface-muted)'
            )}
          >
            {item + 1}
          </button>
        )
      )}

      <button
        type="button"
        onClick={() => onPageChange(Math.min(totalPages - 1, safePage + 1))}
        disabled={safePage >= totalPages - 1}
        className={buttonClassName}
        aria-label="Página siguiente"
      >
        <ChevronRight className="size-4" />
      </button>
    </nav>
  )
}
