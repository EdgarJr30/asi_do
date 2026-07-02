import type { ReactNode } from 'react'

import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils/cn'

type Tone = 'blue' | 'green' | 'amber' | 'rose' | 'violet' | 'teal' | 'gray'

const toneClasses: Record<Tone, string> = {
  blue: 'border-primary-200 bg-primary-50 text-primary-700 dark:border-primary-500/20 dark:bg-primary-500/12 dark:text-primary-200',
  green: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/12 dark:text-emerald-200',
  amber: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/25 dark:bg-amber-500/12 dark:text-amber-200',
  rose: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/25 dark:bg-rose-500/12 dark:text-rose-200',
  violet: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/25 dark:bg-violet-500/12 dark:text-violet-200',
  teal: 'border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-500/25 dark:bg-teal-500/12 dark:text-teal-200',
  gray: 'border-(--app-border) bg-(--app-surface-muted) text-(--app-text-muted)'
}

const dotClasses: Record<Tone, string> = {
  blue: 'bg-primary-500',
  green: 'bg-emerald-500',
  amber: 'bg-amber-500',
  rose: 'bg-rose-500',
  violet: 'bg-violet-500',
  teal: 'bg-teal-500',
  gray: 'bg-(--app-text-subtle)'
}

export function AdminPage({
  eyebrow,
  title,
  description,
  actions,
  children,
  superAdmin = false
}: {
  eyebrow: ReactNode
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  children: ReactNode
  superAdmin?: boolean
}) {
  return (
    <div className="mx-auto w-full max-w-310 space-y-5 pb-12">
      <section className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2.5">
          <div
            className={cn(
              'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[0.68rem] font-bold uppercase tracking-[0.08em]',
              superAdmin ? toneClasses.violet : toneClasses.blue
            )}
          >
            <span className={cn('size-1.5 rounded-full', superAdmin ? dotClasses.violet : dotClasses.blue)} />
            {eyebrow}
          </div>
          <div className="space-y-1.5">
            <h1 className="text-[1.55rem] font-bold leading-tight tracking-normal text-(--app-text) sm:text-[1.72rem]">{title}</h1>
            {description ? <p className="max-w-3xl text-[0.92rem] leading-6 text-(--app-text-muted)">{description}</p> : null}
          </div>
        </div>
        {actions ? <div className="flex flex-wrap gap-2.5 lg:justify-end">{actions}</div> : null}
      </section>
      {children}
    </div>
  )
}

export function AdminSectionLabel({ title, count }: { title: string; count?: ReactNode }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-(--app-text-subtle)">{title}</h2>
      {count != null ? <span className="rounded-full bg-(--app-surface-muted) px-2 py-0.5 text-[0.68rem] font-bold text-(--app-text-subtle)">{count}</span> : null}
    </div>
  )
}

export function AdminInfoGrid({ items }: { items: Array<{ label: string; value: ReactNode; helper: ReactNode }> }) {
  return (
    <div className="grid overflow-hidden rounded-2xl border border-(--app-border) bg-(--app-surface-elevated) sm:grid-cols-3">
      {items.map((item) => (
        <div key={item.label} className="border-b border-(--app-border)/70 px-4 py-4 last:border-b-0 sm:border-r sm:border-b-0 sm:last:border-r-0">
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.08em] text-(--app-text-subtle)">{item.label}</p>
          <p className="mt-1.5 text-sm font-bold text-(--app-text)">{item.value}</p>
          <p className="mt-1 text-xs leading-5 text-(--app-text-muted)">{item.helper}</p>
        </div>
      ))}
    </div>
  )
}

export function AdminStatBar({ children, columns = 4 }: { children: ReactNode; columns?: 3 | 4 | 5 | 6 }) {
  const columnClass = {
    3: 'lg:grid-cols-3',
    4: 'lg:grid-cols-4',
    5: 'lg:grid-cols-5',
    6: 'lg:grid-cols-6'
  }[columns]

  return (
    <div className={cn('grid overflow-hidden rounded-2xl border border-(--app-border) bg-(--app-surface-elevated) sm:grid-cols-2', columnClass)}>
      {children}
    </div>
  )
}

export function AdminStat({ label, value, helper, tone = 'blue' }: { label: string; value: ReactNode; helper?: ReactNode; tone?: Tone }) {
  return (
    <div className="border-b border-(--app-border)/70 px-4 py-4 last:border-b-0 sm:border-r sm:last:border-r-0 lg:border-b-0">
      <p className="flex items-center gap-2 text-[0.68rem] font-bold uppercase tracking-[0.08em] text-(--app-text-subtle)">
        <span className={cn('size-1.5 rounded-full', dotClasses[tone])} />
        {label}
      </p>
      <p className="mt-1.5 text-[1.7rem] font-bold leading-none tracking-normal text-(--app-text)">{value}</p>
      {helper ? <p className="mt-1 text-xs text-(--app-text-muted)">{helper}</p> : null}
    </div>
  )
}

export function AdminTabs<T extends string>({
  value,
  tabs,
  onChange
}: {
  value: T
  tabs: Array<{ value: T; label: string; count?: ReactNode }>
  onChange: (value: T) => void
}) {
  return (
    <div className="inline-flex w-full gap-1 overflow-x-auto rounded-2xl bg-(--app-surface-muted) p-1 sm:w-auto">
      {tabs.map((tab) => {
        const active = tab.value === value
        return (
          <button
            key={tab.value}
            type="button"
            className={cn(
              'inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold transition-colors',
              active ? 'bg-(--app-surface) text-(--app-text) shadow-sm' : 'text-(--app-text-muted) hover:text-(--app-text)'
            )}
            onClick={() => onChange(tab.value)}
          >
            {tab.label}
            {tab.count != null ? (
              <span className={cn('rounded-full px-1.5 py-0.5 text-[0.65rem]', active ? 'bg-(--app-surface-muted)' : 'bg-(--app-surface)')}>
                {tab.count}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

export function AdminModuleCard({
  href,
  icon,
  title,
  description,
  count,
  tone = 'blue'
}: {
  href: string
  icon: ReactNode
  title: string
  description: string
  count?: ReactNode
  tone?: Tone
}) {
  return (
    <Link
      to={href}
      className="group rounded-2xl border border-(--app-border) bg-(--app-surface-elevated) p-4 shadow-[0_1px_2px_rgba(20,40,90,0.04),0_4px_16px_rgba(20,40,90,0.05)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_40px_rgba(20,40,90,0.14)]"
    >
      <div className="flex items-center gap-3">
        <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl border', toneClasses[tone])}>{icon}</span>
        <span className="min-w-0 flex-1 text-[0.96rem] font-bold text-(--app-text)">{title}</span>
        {count != null ? <Badge variant="outline" className="shrink-0 px-2 py-0.5">{count}</Badge> : null}
      </div>
      <p className="mt-3 min-h-12 text-[0.84rem] leading-5 text-(--app-text-muted)">{description}</p>
      <span className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-primary-600 dark:text-primary-300">
        Abrir módulo <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  )
}

export function AdminEmpty({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-(--app-border) bg-(--app-surface-muted)/60 px-4 py-8 text-center">
      <p className="text-sm font-bold text-(--app-text)">{title}</p>
      <p className="mt-1 text-sm text-(--app-text-muted)">{description}</p>
    </div>
  )
}

export function AdminMetaDetails({ title = 'Metadata', children }: { title?: string; children: ReactNode }) {
  return (
    <details className="rounded-2xl border border-(--app-border) bg-(--app-surface-muted)/70 px-4 py-3">
      <summary className="cursor-pointer text-sm font-bold text-(--app-text)">{title}</summary>
      <div className="mt-3 overflow-x-auto text-xs text-(--app-text-muted)">{children}</div>
    </details>
  )
}

export function AdminToggle({ on, disabled }: { on: boolean; disabled?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex h-6 w-11 items-center rounded-full px-0.5 transition',
        on ? 'justify-end bg-emerald-500' : 'justify-start bg-zinc-300 dark:bg-zinc-700',
        disabled ? 'opacity-50' : ''
      )}
    >
      <span className="size-5 rounded-full bg-white shadow-sm" />
    </span>
  )
}

export function AdminCard({ title, description, tag, children, className }: { title?: ReactNode; description?: ReactNode; tag?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <Card className={cn('rounded-2xl shadow-[0_1px_2px_rgba(20,40,90,0.04),0_4px_16px_rgba(20,40,90,0.05)]', className)}>
      {(title || description || tag) ? (
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5">
            {title ? <CardTitle>{title}</CardTitle> : null}
            {description ? <CardDescription>{description}</CardDescription> : null}
          </div>
          {tag ? <div className="shrink-0">{tag}</div> : null}
        </CardHeader>
      ) : null}
      <CardContent className={title || description || tag ? undefined : 'mt-0'}>{children}</CardContent>
    </Card>
  )
}
