import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { useAppSession } from '@/app/providers/app-session-provider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FoundationSettingsForm } from '@/features/foundations/components/foundation-settings-form'
import { NotificationCenter } from '@/features/notifications/components/notification-center'

export function HomePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const session = useAppSession()
  const sessionDisplayName =
    session.profile?.display_name ?? session.profile?.full_name ?? session.profile?.email ?? 'Standard User'
  const sessionActiveRole =
    session.primaryMembership?.roleNames[0] ?? (session.isPlatformAdmin ? 'Platform Admin' : 'Platform User')
  const profileReady = Boolean(
    session.profile?.full_name && session.profile?.locale && session.profile?.country_code
  )
  const hasRecruiterAccess = session.memberships.length > 0
  const showAdminReview = session.canReviewRecruiterRequests
  const quickActions = session.isAuthenticated
    ? [
        {
          title: t('home.actionOnboardingTitle'),
          description: profileReady ? t('home.actionOnboardingReady') : t('home.actionOnboardingPending'),
          buttonLabel: t('home.actionOnboardingButton'),
          onClick: () => void navigate('/onboarding')
        },
        {
          title: t('home.actionRecruiterTitle'),
          description: hasRecruiterAccess ? t('home.actionRecruiterApproved') : t('home.actionRecruiterPending'),
          buttonLabel: t('home.actionRecruiterButton'),
          onClick: () => void navigate('/recruiter-request')
        },
        {
          title: t('home.actionAdminTitle'),
          description: showAdminReview ? t('home.actionAdminEnabled') : t('home.actionAdminLocked'),
          buttonLabel: showAdminReview ? t('home.actionAdminButton') : t('home.actionAdminSecondaryButton'),
          onClick: () => void navigate(showAdminReview ? '/admin/recruiter-requests' : '/auth')
        }
      ]
    : [
        {
          title: t('home.actionAccessTitle'),
          description: t('home.actionAccessDescription'),
          buttonLabel: t('home.actionAccessButton'),
          onClick: () => void navigate('/auth')
        },
        {
          title: t('home.actionProfileTitle'),
          description: t('home.actionProfileDescription'),
          buttonLabel: t('home.actionProfileButton'),
          onClick: () => void navigate('/auth')
        },
        {
          title: t('home.actionReviewGuestTitle'),
          description: t('home.actionReviewGuestDescription'),
          buttonLabel: t('home.actionReviewGuestButton'),
          onClick: () => void navigate('/auth')
        }
      ]
  const journeySteps = [
    {
      step: '01',
      title: t('home.stepAccountTitle'),
      description: t('home.stepAccountDescription'),
      state: session.isAuthenticated ? t('home.stepStateDone') : t('home.stepStateCurrent')
    },
    {
      step: '02',
      title: t('home.stepProfileTitle'),
      description: t('home.stepProfileDescription'),
      state: profileReady ? t('home.stepStateDone') : t('home.stepStatePending')
    },
    {
      step: '03',
      title: t('home.stepRequestTitle'),
      description: t('home.stepRequestDescription'),
      state: hasRecruiterAccess ? t('home.stepStateDone') : t('home.stepStatePending')
    },
    {
      step: '04',
      title: t('home.stepReviewTitle'),
      description: t('home.stepReviewDescription'),
      state: showAdminReview ? t('home.stepStateAvailable') : t('home.stepStateControlled')
    }
  ]

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-primary-100 bg-[radial-gradient(circle_at_top_left,#fff1c9_0,transparent_32%),linear-gradient(135deg,#fef7ed,white_38%,#eefbf3_72%,#eff6ff)] dark:border-zinc-800 dark:bg-[radial-gradient(circle_at_top_left,rgba(87,54,11,0.32)_0,transparent_26%),linear-gradient(135deg,rgba(35,20,8,0.96),rgba(9,9,11,0.95)_42%,rgba(8,23,18,0.95)_72%,rgba(11,19,30,0.94))]">
        <CardHeader className="space-y-3">
          <Badge variant="soft">{t('home.heroBadge')}</Badge>
          <CardTitle className="max-w-3xl text-2xl sm:text-3xl">{t('home.heroTitle')}</CardTitle>
          <CardDescription className="max-w-2xl">{t('home.heroDescription')}</CardDescription>
        </CardHeader>

        <CardContent className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[24px] border border-white/70 bg-white/85 p-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/75">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                  {t('home.accountCardEyebrow')}
                </p>
                <p className="mt-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">{sessionDisplayName}</p>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{sessionActiveRole}</p>
              </div>

              <div className="rounded-[24px] border border-white/70 bg-white/85 p-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/75">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                  {t('home.statusCardEyebrow')}
                </p>
                <p className="mt-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  {session.isAuthenticated ? t('home.statusAuthenticated') : t('home.statusGuest')}
                </p>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  {hasRecruiterAccess ? t('home.statusRecruiterApproved') : t('home.statusRecruiterStandard')}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                className="sm:flex-1"
                onClick={() => void navigate(session.isAuthenticated ? '/onboarding' : '/auth')}
              >
                {session.isAuthenticated ? t('home.primaryAuthenticatedAction') : t('home.primaryGuestAction')}
              </Button>
              <Button
                className="sm:flex-1"
                variant="outline"
                onClick={() => void navigate(session.isAuthenticated ? '/recruiter-request' : '/auth')}
              >
                {session.isAuthenticated ? t('home.secondaryAuthenticatedAction') : t('home.secondaryGuestAction')}
              </Button>
            </div>
          </div>

          <div className="rounded-[28px] border border-amber-200/70 bg-white/88 p-5 dark:border-zinc-800 dark:bg-zinc-950/80">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
              {t('home.moduleCardEyebrow')}
            </p>
            <h3 className="mt-3 text-xl font-semibold text-zinc-950 dark:text-zinc-50">
              {t('home.moduleCardTitle')}
            </h3>
            <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              {t('home.moduleCardDescription')}
            </p>
            <div className="mt-4 grid gap-2">
              <div className="rounded-2xl bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                {t('home.moduleCardRuleOne')}
              </div>
              <div className="rounded-2xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
                {t('home.moduleCardRuleTwo')}
              </div>
              <div className="rounded-2xl bg-sky-50 px-3 py-2 text-sm text-sky-800 dark:bg-sky-950/40 dark:text-sky-200">
                {t('home.moduleCardRuleThree')}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>{t('home.journeyTitle')}</CardTitle>
            <CardDescription>{t('home.journeyDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {journeySteps.map((item) => (
                <div
                  key={item.step}
                  className="grid gap-3 rounded-[24px] border border-zinc-200 bg-zinc-50 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-900/80 sm:grid-cols-[auto_1fr_auto]"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-900 text-sm font-semibold text-white dark:bg-zinc-100 dark:text-zinc-950">
                    {item.step}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{item.title}</p>
                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{item.description}</p>
                  </div>
                  <Badge variant="outline">{item.state}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('home.accessTitle')}</CardTitle>
            <CardDescription>{t('home.accessDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-[24px] bg-zinc-50 px-4 py-4 text-sm text-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-300">
              <p className="font-semibold text-zinc-900 dark:text-zinc-50">{t('home.accessUserTitle')}</p>
              <p className="mt-1">{t('home.accessUserDescription')}</p>
            </div>
            <div className="rounded-[24px] bg-zinc-50 px-4 py-4 text-sm text-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-300">
              <p className="font-semibold text-zinc-900 dark:text-zinc-50">{t('home.accessRecruiterTitle')}</p>
              <p className="mt-1">{t('home.accessRecruiterDescription')}</p>
            </div>
            <div className="rounded-[24px] bg-zinc-50 px-4 py-4 text-sm text-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-300">
              <p className="font-semibold text-zinc-900 dark:text-zinc-50">{t('home.accessStorageTitle')}</p>
              <p className="mt-1">{t('home.accessStorageDescription')}</p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {quickActions.map((card) => (
          <Card key={card.title}>
            <CardHeader>
              <CardTitle>{card.title}</CardTitle>
              <CardDescription>{card.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" variant="outline" onClick={card.onClick}>
                {card.buttonLabel}
              </Button>
            </CardContent>
          </Card>
        ))}
      </section>

      <FoundationSettingsForm />

      <NotificationCenter />
    </div>
  )
}
