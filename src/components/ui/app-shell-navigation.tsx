import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

import {
  BriefcaseBusiness,
  Building2,
  FileText,
  Grid2x2,
  Layers3,
  Shield,
  Sparkles,
  UserRound,
  UsersRound,
  Wrench
} from 'lucide-react'

import { cn } from '@/lib/utils/cn'

export interface AppNavItem {
  title: string
  href: string
  description?: string
  icon?: LucideIcon
}

const iconByHref: Record<string, LucideIcon> = {
  '/': Sparkles,
  '/jobs': BriefcaseBusiness,
  '/jobs/manage': BriefcaseBusiness,
  '/candidate/profile': UserRound,
  '/applications': FileText,
  '/onboarding': Layers3,
  '/recruiter-request': Building2,
  '/workspace': Building2,
  '/talent': UsersRound,
  '/pipeline': Grid2x2,
  '/rbac': Shield,
  '/internal': Wrench,
  '/internal/approvals': Shield,
  '/internal/platform': Building2,
  '/internal/moderation': Layers3,
  '/internal/errors': FileText,
  '/internal/bootstrap-owner': Wrench
}

function resolveIcon(item: AppNavItem) {
  return item.icon ?? iconByHref[item.href] ?? Sparkles
}

export function AppSidebarNav({
  title,
  description,
  brand,
  items,
  activeHref,
  onNavigate,
  footer
}: {
  title: string
  description: string
  brand: string
  items: AppNavItem[]
  activeHref: string
  onNavigate: (href: string) => void
  footer?: ReactNode
}) {
  return (
    <aside className="hidden w-[296px] shrink-0 rounded-[28px] border bg-[var(--app-surface-elevated)] p-5 shadow-[var(--app-shadow-soft)] lg:flex lg:flex-col">
      <div className="space-y-4">
        <div className="tm-kicker w-fit">{brand}</div>
        <div className="space-y-2">
          <p className="text-[1.5rem] font-semibold tracking-tight text-[var(--app-text)] sm:text-[1.65rem]">{title}</p>
          <p className="text-sm leading-6 text-[var(--app-text-muted)]">{description}</p>
        </div>
      </div>

      <nav className="mt-8 flex flex-1 flex-col gap-2">
        {items.map((item) => {
          const Icon = resolveIcon(item)
          const isActive = activeHref === item.href

          return (
            <button
              key={item.href}
              className={cn(
                'flex items-start gap-3 rounded-[20px] px-4 py-3 text-left transition',
                isActive
                  ? 'border border-primary-200 bg-primary-50 text-primary-700 shadow-sm dark:border-primary-500/18 dark:bg-primary-500/10 dark:text-primary-200'
                  : 'border border-transparent text-[var(--app-text-muted)] hover:bg-[var(--app-surface-muted)] hover:text-[var(--app-text)]'
              )}
              type="button"
              onClick={() => void onNavigate(item.href)}
            >
              <span className="mt-0.5 rounded-[16px] bg-[var(--app-surface)] p-2 text-current shadow-sm">
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{item.title}</span>
                {item.description ? <span className="mt-1 block text-[0.78rem] leading-5 text-current/75">{item.description}</span> : null}
              </span>
            </button>
          )
        })}
      </nav>

      {footer ? <div className="mt-6">{footer}</div> : null}
    </aside>
  )
}

export function AppBottomNav({
  items,
  activeHref,
  onNavigate
}: {
  items: AppNavItem[]
  activeHref: string
  onNavigate: (href: string) => void
}) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 border-t bg-[color:var(--app-surface-elevated)] px-3 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 shadow-[0_-10px_26px_rgba(60,42,88,0.12)] backdrop-blur-xl lg:hidden">
      <div className="grid grid-cols-4 gap-2">
        {items.map((item) => {
          const Icon = resolveIcon(item)
          const isActive = activeHref === item.href

          return (
            <button
              key={item.href}
              className={cn(
                'flex min-h-12 flex-col items-center justify-center gap-1 rounded-[18px] px-2 py-2 text-[0.7rem] font-semibold transition',
                isActive
                  ? 'bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-200'
                  : 'text-[var(--app-text-subtle)] hover:bg-[var(--app-surface-muted)] hover:text-[var(--app-text)]'
              )}
              type="button"
              onClick={() => void onNavigate(item.href)}
            >
              <Icon className="h-4 w-4" />
              <span className="truncate">{item.title}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
