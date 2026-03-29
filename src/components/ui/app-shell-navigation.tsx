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
  Wrench,
  X
} from 'lucide-react'

import { BrandMark } from '@/components/ui/app-brand'
import { cn } from '@/lib/utils/cn'

export interface AppNavItem {
  title: string
  href: string
  description?: string
  icon?: LucideIcon
}

export interface AppNavGroup {
  title?: string
  items: AppNavItem[]
}

const iconByHref: Record<string, LucideIcon> = {
  '/': Sparkles,
  '/platform': Sparkles,
  '/platform/jobs': BriefcaseBusiness,
  '/workspace/jobs': BriefcaseBusiness,
  '/candidate/profile': UserRound,
  '/candidate/applications': FileText,
  '/candidate/onboarding': Layers3,
  '/candidate/recruiter-request': Building2,
  '/workspace': Building2,
  '/workspace/talent': UsersRound,
  '/workspace/pipeline': Grid2x2,
  '/workspace/settings/access': Shield,
  '/admin': Wrench,
  '/admin/approvals': Shield,
  '/admin/platform': Building2,
  '/admin/moderation': Layers3,
  '/admin/errors': FileText,
  '/admin/bootstrap-owner': Wrench
}

function resolveIcon(item: AppNavItem) {
  return item.icon ?? iconByHref[item.href] ?? Sparkles
}

function isActiveHref(activeHref: string, itemHref: string) {
  if (activeHref === itemHref) {
    return true
  }

  if (itemHref === '/' || itemHref.includes('#')) {
    return false
  }

  return activeHref.startsWith(`${itemHref}/`)
}

function WorkspaceSidebarContent({
  activeHref,
  brand,
  footer,
  groups,
  onNavigate,
  tenantName
}: {
  activeHref: string
  brand: string
  footer?: ReactNode
  groups: AppNavGroup[]
  onNavigate: (href: string) => void
  tenantName: string
}) {
  return (
    <div className="relative flex h-full flex-col overflow-y-auto border-r border-slate-200 bg-white px-6 pb-5 dark:border-white/10 dark:bg-slate-950">
      <div className="flex h-16 shrink-0 items-center gap-3">
        <BrandMark panelClassName="size-10 rounded-[14px] border-primary-200/60 bg-primary-600 p-2 shadow-none dark:border-white/10 dark:bg-white/10" />
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{brand}</p>
          <p className="truncate text-base font-semibold tracking-tight text-slate-950 dark:text-white">{tenantName}</p>
        </div>
      </div>

      <nav aria-label={`${brand} navigation`} className="mt-5 flex flex-1 flex-col">
        <ul className="flex flex-1 flex-col gap-y-7">
          {groups.map((group, groupIndex) => (
            <li key={group.title ?? `group-${groupIndex}`}>
              {group.title ? <div className="text-xs/6 font-semibold text-slate-400">{group.title}</div> : null}

              <ul className="-mx-2 mt-2 space-y-1">
                {group.items.map((item) => {
                  const Icon = resolveIcon(item)
                  const isActive = isActiveHref(activeHref, item.href)

                  return (
                    <li key={item.href}>
                      <button
                        className={cn(
                          'group flex w-full items-center gap-x-3 rounded-md p-2 text-left text-sm/6 font-semibold transition-colors',
                          isActive
                            ? 'bg-slate-100 text-primary-700 dark:bg-white/5 dark:text-white'
                            : 'text-slate-700 hover:bg-slate-50 hover:text-primary-700 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white'
                        )}
                        type="button"
                        onClick={() => void onNavigate(item.href)}
                      >
                        <Icon
                          className={cn(
                            'size-6 shrink-0',
                            isActive
                              ? 'text-primary-700 dark:text-white'
                              : 'text-slate-400 group-hover:text-primary-700 dark:group-hover:text-white'
                          )}
                        />
                        <span className="truncate">{item.title}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </li>
          ))}
          {footer ? <li className="mt-auto pt-6">{footer}</li> : null}
        </ul>
      </nav>
    </div>
  )
}

export function AppWorkspaceSidebar({
  activeHref,
  brand,
  footer,
  groups,
  onNavigate,
  tenantName
}: {
  activeHref: string
  brand: string
  footer?: ReactNode
  groups: AppNavGroup[]
  onNavigate: (href: string) => void
  tenantName: string
}) {
  return (
    <aside className="hidden bg-slate-950 lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-72 lg:flex-col">
      <WorkspaceSidebarContent
        activeHref={activeHref}
        brand={brand}
        footer={footer}
        groups={groups}
        onNavigate={onNavigate}
        tenantName={tenantName}
      />
    </aside>
  )
}

export function AppWorkspaceSidebarDrawer({
  activeHref,
  brand,
  footer,
  groups,
  isOpen,
  onClose,
  onNavigate,
  tenantName
}: {
  activeHref: string
  brand: string
  footer?: ReactNode
  groups: AppNavGroup[]
  isOpen: boolean
  onClose: () => void
  onNavigate: (href: string) => void
  tenantName: string
}) {
  if (!isOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 overflow-x-hidden lg:hidden">
      <button
        aria-label="Cerrar navegacion del workspace"
        className="absolute inset-0 bg-slate-900/80"
        type="button"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 left-0 flex w-full max-w-xs">
        <div className="relative flex min-w-0 flex-1">
          <div className="absolute right-3 top-3 z-10 flex justify-center">
            <button className="rounded-full bg-slate-900/80 p-2.5 text-white shadow-lg" type="button" onClick={onClose}>
              <span className="sr-only">Cerrar sidebar</span>
              <X className="size-6" />
            </button>
          </div>

          <div className="min-w-0 flex-1">
            <WorkspaceSidebarContent
              activeHref={activeHref}
              brand={brand}
              footer={footer}
              groups={groups}
              onNavigate={(href) => {
                onClose()
                onNavigate(href)
              }}
              tenantName={tenantName}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export function AppSidebarNav({
  title,
  description,
  brand,
  brandMark,
  items,
  activeHref,
  onNavigate,
  footer
}: {
  title: string
  description: string
  brand: string
  brandMark?: ReactNode
  items: AppNavItem[]
  activeHref: string
  onNavigate: (href: string) => void
  footer?: ReactNode
}) {
  return (
    <aside className="hidden w-[296px] shrink-0 rounded-[28px] border bg-(--app-surface-elevated) p-5 shadow-(--app-shadow-soft) lg:flex lg:flex-col">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          {brandMark ?? null}
          <div className="tm-kicker w-fit">{brand}</div>
        </div>
        <div className="space-y-2">
          <p className="text-[1.5rem] font-semibold tracking-tight text-(--app-text) sm:text-[1.65rem]">{title}</p>
          <p className="text-sm leading-6 text-(--app-text-muted)">{description}</p>
        </div>
      </div>

      <nav className="mt-8 flex flex-1 flex-col gap-2">
        {items.map((item) => {
          const Icon = resolveIcon(item)
          const isActive = isActiveHref(activeHref, item.href)

          return (
            <button
              key={item.href}
              className={cn(
                'flex items-start gap-3 rounded-[20px] px-4 py-3 text-left transition-[transform,box-shadow,background-color,border-color,color] duration-200 ease-out hover:-translate-y-px',
                isActive
                  ? 'border border-primary-200 bg-primary-50 text-primary-700 shadow-sm hover:border-primary-300 hover:bg-primary-50/90 hover:shadow-[0_14px_28px_rgba(15,23,42,0.08)] dark:border-primary-500/18 dark:bg-primary-500/10 dark:text-primary-200 dark:hover:border-primary-500/24 dark:hover:bg-primary-500/14'
                  : 'border border-transparent text-(--app-text-muted) hover:border-(--app-border) hover:bg-(--app-surface-muted) hover:text-(--app-text) hover:shadow-[0_14px_28px_rgba(15,23,42,0.08)]'
              )}
              type="button"
              onClick={() => void onNavigate(item.href)}
            >
              <span className="mt-0.5 rounded-[16px] bg-(--app-surface) p-2 text-current shadow-sm">
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
  onNavigate,
  variant = 'default'
}: {
  items: AppNavItem[]
  activeHref: string
  onNavigate: (href: string) => void
  variant?: 'default' | 'workspace'
}) {
  const columns = Math.min(Math.max(items.length, 1), 5)

  return (
    <nav
      className={cn(
        'fixed bottom-0 left-0 right-0 z-30 border-t px-3 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl lg:hidden',
        variant === 'workspace'
          ? 'border-white/8 bg-[rgba(12,18,34,0.92)] shadow-[0_-14px_42px_rgba(6,10,22,0.42)]'
          : 'bg-(--app-surface-elevated) shadow-[0_-10px_26px_rgba(24,39,78,0.14)]'
      )}
    >
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {items.map((item) => {
          const Icon = resolveIcon(item)
          const isActive = isActiveHref(activeHref, item.href)

          return (
            <button
              key={item.href}
              className={cn(
                'flex min-h-12 flex-col items-center justify-center gap-1 rounded-[18px] px-2 py-2 text-[0.7rem] font-semibold transition-[transform,box-shadow,background-color,color] duration-200 ease-out hover:-translate-y-px',
                variant === 'workspace'
                  ? isActive
                    ? 'bg-white/10 text-white hover:bg-white/12 hover:shadow-[0_14px_28px_rgba(15,23,42,0.18)]'
                    : 'text-white/58 hover:bg-white/6 hover:text-white hover:shadow-[0_14px_28px_rgba(15,23,42,0.16)]'
                  : isActive
                    ? 'bg-primary-50 text-primary-700 hover:bg-primary-100 hover:shadow-[0_14px_28px_rgba(15,23,42,0.08)] dark:bg-primary-500/10 dark:text-primary-200 dark:hover:bg-primary-500/16'
                    : 'text-(--app-text-subtle) hover:bg-(--app-surface-muted) hover:text-(--app-text) hover:shadow-[0_14px_28px_rgba(15,23,42,0.08)]'
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
