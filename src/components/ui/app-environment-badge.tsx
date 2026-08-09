import { Badge } from '@/components/ui/badge'
import { env } from '@/shared/config/env'
import { cn } from '@/lib/utils/cn'
import {
  resolveAppEnvironment,
  type AppEnvironment
} from '@/shared/config/app-environment'

const environmentMeta: Record<
  AppEnvironment,
  { label: string; badgeClassName: string; dotClassName: string }
> = {
  local: {
    label: 'Local',
    badgeClassName:
      'border-slate-300 bg-white/95 text-slate-700 dark:border-white/15 dark:bg-slate-900/95 dark:text-slate-200',
    dotClassName: 'bg-slate-500 dark:bg-slate-300'
  },
  staging: {
    label: 'Staging',
    badgeClassName:
      'border-amber-300 bg-amber-50/95 text-amber-800 dark:border-amber-400/25 dark:bg-amber-500/12 dark:text-amber-200',
    dotClassName: 'bg-amber-500'
  },
  production: {
    label: 'Producción',
    badgeClassName:
      'border-emerald-300 bg-emerald-50/95 text-emerald-800 dark:border-emerald-400/25 dark:bg-emerald-500/12 dark:text-emerald-200',
    dotClassName: 'bg-emerald-500'
  }
}

export function AppEnvironmentBadge({
  className,
  compact = false,
  environment = resolveAppEnvironment(env.deployEnvironment, env.mode),
  surface = 'default'
}: {
  className?: string
  compact?: boolean
  environment?: AppEnvironment
  surface?: 'default' | 'dark'
}) {
  const meta = environmentMeta[environment]

  return (
    <Badge
      aria-label={`Entorno ${meta.label}; fase Beta`}
      title={`Entorno ${meta.label} · Beta`}
      variant="outline"
      className={cn(
        'gap-2 px-2.5 py-1.5 text-[0.68rem] shadow-none',
        surface === 'dark'
          ? 'border-white/14 bg-white/8 text-white/74'
          : meta.badgeClassName,
        compact && 'size-8 justify-center gap-0 px-0 py-0',
        className
      )}
    >
      <span aria-hidden="true" className={cn('size-1.5 shrink-0 rounded-full', meta.dotClassName)} />
      {!compact ? (
        <>
          <span>{meta.label}</span>
          <span aria-hidden="true" className="h-3 w-px bg-current opacity-25" />
          <span className="uppercase tracking-[0.14em]">Beta</span>
        </>
      ) : null}
    </Badge>
  )
}
