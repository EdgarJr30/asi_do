import type { LucideIcon } from 'lucide-react';

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
} from 'lucide-react';

import { cn } from '@/lib/utils/cn';
import { prefetchRoute } from '@/lib/navigation/route-prefetch';

export interface AppNavItem {
  title: string;
  href: string;
  description?: string;
  icon?: LucideIcon;
}

export interface AppNavGroup {
  title?: string;
  items: AppNavItem[];
}

const iconByHref: Record<string, LucideIcon> = {
  '/': Sparkles,
  '/platform': Sparkles,
  '/account/jobs': BriefcaseBusiness,
  '/workspace/jobs': BriefcaseBusiness,
  '/account/profile': UserRound,
  '/account/applications': FileText,
  '/account/recruiter-request': Building2,
  '/workspace': Building2,
  '/workspace/talent': UsersRound,
  '/workspace/pipeline': Grid2x2,
  '/workspace/settings/access': Shield,
  '/admin': Wrench,
  '/admin/approvals': Shield,
  '/admin/platform': Building2,
  '/admin/moderation': Layers3,
  '/admin/errors': FileText,
  '/admin/bootstrap-owner': Wrench,
};

function resolveIcon(item: AppNavItem) {
  return item.icon ?? iconByHref[item.href] ?? Sparkles;
}

function resolveActiveItemHref(items: AppNavItem[], pathname: string) {
  return items
    .filter((item) => {
      if (pathname === item.href) {
        return true;
      }

      if (item.href === '/' || item.href.includes('#')) {
        return false;
      }

      return pathname.startsWith(`${item.href}/`);
    })
    .sort((left, right) => right.href.length - left.href.length)[0]?.href;
}

export function AppBottomNav({
  items,
  activeHref,
  onNavigate,
  variant = 'default',
}: {
  items: AppNavItem[];
  activeHref: string;
  onNavigate: (href: string) => void;
  variant?: 'default' | 'workspace';
}) {
  const columns = Math.min(Math.max(items.length, 1), 5);
  const activeItemHref = resolveActiveItemHref(items, activeHref);

  return (
    <nav
      className={cn(
        'fixed bottom-0 left-0 right-0 z-30 border-t px-3 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl lg:hidden',
        variant === 'workspace'
          ? 'border-white/8 bg-[rgba(12,18,34,0.92)] shadow-[0_-14px_42px_rgba(6,10,22,0.42)]'
          : 'bg-(--app-surface-elevated) shadow-[0_-10px_26px_rgba(24,39,78,0.14)]'
      )}
    >
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {items.map((item) => {
          const Icon = resolveIcon(item);
          const isActive = activeItemHref === item.href;

          return (
            <button
              aria-current={isActive ? 'page' : undefined}
              key={item.href}
              className={cn(
                'flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-card px-2 py-2 text-[0.7rem] font-semibold transition-[background-color,color] duration-150 ease-out',
                variant === 'workspace'
                  ? isActive
                    ? 'bg-white/10 text-white hover:bg-white/14'
                    : 'text-white/58 hover:bg-white/6 hover:text-white'
                  : isActive
                  ? 'bg-primary-50 text-primary-700 hover:bg-primary-100 dark:bg-primary-500/10 dark:text-primary-200 dark:hover:bg-primary-500/16'
                  : 'text-(--app-text-subtle) hover:bg-(--app-surface-muted) hover:text-(--app-text)'
              )}
              data-active={isActive ? 'true' : 'false'}
              type="button"
              onClick={() => void onNavigate(item.href)}
              onFocus={() => prefetchRoute(item.href)}
              onMouseEnter={() => prefetchRoute(item.href)}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="w-full truncate text-center">{item.title}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
