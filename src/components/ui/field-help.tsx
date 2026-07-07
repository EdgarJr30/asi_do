import { Info } from 'lucide-react'

import { Tooltip } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils/cn'

type FieldHelpSide = 'top' | 'right' | 'bottom' | 'left'

export function FieldHelp({
  help,
  fieldLabel,
  side = 'top',
  className,
  iconClassName,
}: {
  help: string
  fieldLabel: string
  side?: FieldHelpSide
  className?: string
  iconClassName?: string
}) {
  return (
    <Tooltip activation="toggle" className="shrink-0" label={help} side={side}>
      <button
        type="button"
        aria-label={`Ayuda sobre ${fieldLabel}`}
        className={cn(
          '-m-1 inline-flex size-6 items-center justify-center rounded-full text-(--app-text-subtle) transition-colors hover:bg-(--app-surface-muted) hover:text-(--app-text-muted) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--app-ring)',
          className
        )}
      >
        <Info aria-hidden="true" className={cn('size-3.5', iconClassName)} />
      </button>
    </Tooltip>
  )
}
