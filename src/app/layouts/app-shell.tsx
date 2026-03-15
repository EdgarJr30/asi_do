import { useState } from 'react'

import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { useAppSession } from '@/app/providers/app-session-provider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { signOutCurrentUser, toErrorMessage } from '@/features/auth/lib/auth-api'
import { useOnlineStatus } from '@/hooks/use-online-status'
import { filterNavigationItems } from '@/lib/permissions/guards'
import { cn } from '@/lib/utils/cn'
import { navigationItems } from '@/shared/constants/navigation'
import type { NavigationItem } from '@/shared/types/navigation'

function NavigationLinks({ items, compact = false }: { items: NavigationItem[]; compact?: boolean }) {
  const { t } = useTranslation()

  return (
    <>
      {items.map((item) => (
        <NavLink
          key={item.href}
          to={item.href}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition',
              compact ? 'justify-center' : 'justify-between',
              isActive
                ? 'bg-primary-100 text-primary-700 shadow-sm'
                : 'text-zinc-600 hover:bg-white hover:text-zinc-900'
            )
          }
        >
          <span>{item.titleKey ? t(item.titleKey, { defaultValue: item.title }) : item.title}</span>
          {!compact ? (
            <span className="text-xs text-zinc-400 dark:text-zinc-500">
              {item.descriptionKey ? t(item.descriptionKey, { defaultValue: item.description }) : item.description}
            </span>
          ) : null}
        </NavLink>
      ))}
    </>
  )
}

export function AppShell() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const session = useAppSession()
  const isOnline = useOnlineStatus()
  const [isSigningOut, setIsSigningOut] = useState(false)
  const visibleNavigation = filterNavigationItems(
    navigationItems,
    session.permissions,
    session.isAuthenticated
  )
  const bottomNavigationItems = visibleNavigation.slice(0, 4)
  const sessionDisplayName =
    session.profile?.display_name ?? session.profile?.full_name ?? session.profile?.email ?? 'Standard User'
  const sessionActiveRole =
    session.primaryMembership?.roleNames[0] ?? (session.isPlatformAdmin ? 'Platform Admin' : 'Platform User')
  const sessionLabel = session.isAuthenticated ? t('shell.liveSession') : t('shell.guestSession')

  async function handleSignOut() {
    setIsSigningOut(true)

    try {
      await signOutCurrentUser()
      toast.success(t('shell.signOutSuccess'))
      await navigate('/auth')
    } catch (error) {
      toast.error(t('shell.signOutErrorTitle'), {
        description: toErrorMessage(error)
      })
    } finally {
      setIsSigningOut(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      {!isOnline ? (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/50 dark:text-amber-200">
          {t('shell.offlineBanner')}
        </div>
      ) : null}

      <div className="mx-auto flex min-h-screen max-w-7xl flex-col md:flex-row">
        <aside className="hidden w-80 shrink-0 border-r border-zinc-200 bg-white/70 px-6 py-8 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/65 md:flex md:flex-col">
          <div className="space-y-4">
            <Badge variant="soft">{t('shell.phaseBadge')}</Badge>
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                {t('app.name')}
              </h1>
              <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">{t('shell.description')}</p>
            </div>
          </div>

          <div className="mt-8 rounded-3xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/75">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">{sessionLabel}</p>
            <p className="mt-2 text-base font-semibold text-zinc-900 dark:text-zinc-50">{sessionDisplayName}</p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{sessionActiveRole}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {session.isSupabaseConfigured ? (
                <Badge variant="soft">
                  {session.isAuthenticated ? t('shell.authenticatedBadge') : t('shell.guestBadge')}
                </Badge>
              ) : (
                <Badge variant="outline">{t('shell.configBadge')}</Badge>
              )}
              {session.canReviewRecruiterRequests ? <Badge>{t('shell.adminBadge')}</Badge> : null}
            </div>
          </div>

          <nav className="mt-8 flex flex-1 flex-col gap-2">
            <NavigationLinks items={visibleNavigation} />
          </nav>

          <div className="rounded-3xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
            {t('shell.navNote')}
          </div>
        </aside>

        <div className="flex min-h-screen flex-1 flex-col">
          <header className="sticky top-0 z-10 border-b border-zinc-200 bg-zinc-50/90 px-4 py-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/85 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                  {t('shell.eyebrow')}
                </p>
                <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">{t('shell.title')}</h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="soft">
                  {session.isAuthenticated ? t('shell.authenticatedBadge') : t('shell.guestBadge')}
                </Badge>
                <Badge>React 19</Badge>
                <Badge>Tailwind v4</Badge>
                <Badge>Supabase-first</Badge>
                <Badge>PWA</Badge>
                {session.isAuthenticated ? (
                  <>
                    <Button variant="outline" onClick={() => void navigate('/onboarding')}>
                      {t('shell.profileAction')}
                    </Button>
                    <Button variant="outline" onClick={() => void navigate('/recruiter-request')}>
                      {t('shell.recruiterAction')}
                    </Button>
                    {session.canReviewRecruiterRequests ? (
                      <Button variant="secondary" onClick={() => void navigate('/admin/recruiter-requests')}>
                        {t('shell.reviewAction')}
                      </Button>
                    ) : null}
                    <Button variant="ghost" onClick={() => void handleSignOut()} disabled={isSigningOut}>
                      {isSigningOut ? t('shell.signingOutAction') : t('shell.signOutAction')}
                    </Button>
                  </>
                ) : (
                  <Button onClick={() => void navigate('/auth')}>{t('shell.accessAction')}</Button>
                )}
              </div>
            </div>
          </header>

          <main className="flex-1 px-4 pb-28 pt-6 sm:px-6 lg:px-8">
            <Outlet />
          </main>
        </div>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-zinc-200 bg-white/95 px-3 py-2 shadow-[0_-10px_30px_rgba(15,23,42,0.08)] backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95 md:hidden">
        <div
          className="grid gap-2"
          style={{
            gridTemplateColumns: `repeat(${Math.max(bottomNavigationItems.length, 1)}, minmax(0, 1fr))`
          }}
        >
          <NavigationLinks items={bottomNavigationItems} compact />
        </div>
      </nav>
    </div>
  )
}
