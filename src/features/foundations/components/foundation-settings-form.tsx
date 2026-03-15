import { useEffect, useState } from 'react'

import { zodResolver } from '@hookform/resolvers/zod'
import { useTheme } from 'next-themes'
import { useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'

import { useAppSession } from '@/app/providers/app-session-provider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import {
  registerBrowserPushSubscription,
  saveNotificationPreferences
} from '@/lib/notifications/api'
import { env } from '@/shared/config/env'
import { isPushSupported, requestNotificationPermission, subscribeToPushNotifications } from '@/lib/notifications/push'

const foundationSettingsSchema = z.object({
  locale: z.enum(['es', 'en']),
  theme: z.enum(['system', 'light', 'dark']),
  emailNotifications: z.boolean(),
  pushNotifications: z.boolean()
})

type FoundationSettingsValues = z.infer<typeof foundationSettingsSchema>

const dependencyPackages = [
  'i18next',
  'react-i18next',
  'i18next-browser-languagedetector',
  'react-hook-form',
  '@hookform/resolvers',
  'next-themes',
  'sonner'
] as const

function toLocale(language: string | undefined) {
  return language?.startsWith('en') ? 'en' : 'es'
}

export function FoundationSettingsForm() {
  const { i18n, t } = useTranslation()
  const { theme, setTheme } = useTheme()
  const session = useAppSession()
  const [pushPermission, setPushPermission] = useState<NotificationPermission | 'unsupported'>(() => {
    if (typeof window === 'undefined') {
      return 'default'
    }

    return isPushSupported() ? Notification.permission : 'unsupported'
  })

  const { control, getValues, handleSubmit, register, reset, setValue } = useForm<FoundationSettingsValues>({
    resolver: zodResolver(foundationSettingsSchema),
    defaultValues: {
      locale: 'es',
      theme: 'system',
      emailNotifications: true,
      pushNotifications: false
    }
  })

  useEffect(() => {
    reset({
      locale: toLocale(i18n.resolvedLanguage),
      theme: theme === 'light' || theme === 'dark' ? theme : 'system',
      emailNotifications: true,
      pushNotifications: pushPermission === 'granted'
    })
  }, [i18n.resolvedLanguage, pushPermission, reset, theme])

  const pushEnabled = useWatch({
    control,
    name: 'pushNotifications'
  })

  async function onSubmit(values: FoundationSettingsValues) {
    try {
      await i18n.changeLanguage(values.locale)
      setTheme(values.theme)

      if (session.isAuthenticated) {
        await saveNotificationPreferences({
          locale: values.locale,
          emailEnabled: values.emailNotifications,
          pushEnabled: values.pushNotifications,
          inAppEnabled: true,
          tenantId: session.primaryMembership?.tenantId ?? null
        })
      }

      toast.success(t('foundations.saveSuccessTitle'), {
        description: t('foundations.saveSuccessDescription')
      })
    } catch (error) {
      toast.error(t('notifications.testErrorTitle'), {
        description: error instanceof Error ? error.message : t('notifications.testErrorDescription')
      })
    }
  }

  async function enablePush() {
    try {
      if (!isPushSupported()) {
        setPushPermission('unsupported')
        toast.error(t('foundations.pushDeniedTitle'), {
          description: t('foundations.pushUnsupported')
        })
        return
      }

      const permission = await requestNotificationPermission()
      setPushPermission(permission)
      setValue('pushNotifications', permission === 'granted')

      if (permission !== 'granted') {
        toast.error(t('foundations.pushDeniedTitle'), {
          description: t('foundations.pushDeniedDescription')
        })
        return
      }

      if (!env.webPushPublicKey) {
        toast.message(t('foundations.pushReadyTitle'), {
          description: t('foundations.pushMissingKey')
        })
        return
      }

      const subscription = await subscribeToPushNotifications(env.webPushPublicKey)

      if (session.isAuthenticated) {
        await registerBrowserPushSubscription(subscription, {
          locale: toLocale(i18n.resolvedLanguage),
          tenantId: session.primaryMembership?.tenantId ?? null
        })
        await saveNotificationPreferences({
          locale: toLocale(i18n.resolvedLanguage),
          emailEnabled: getValues('emailNotifications'),
          pushEnabled: true,
          inAppEnabled: true,
          tenantId: session.primaryMembership?.tenantId ?? null
        })
      }

      toast.success(t('foundations.pushReadyTitle'), {
        description: t('foundations.pushReadyDescription')
      })
    } catch (error) {
      toast.error(t('notifications.testErrorTitle'), {
        description: error instanceof Error ? error.message : t('notifications.testErrorDescription')
      })
    }
  }

  return (
    <section className="grid gap-4 lg:grid-cols-[1.35fr_0.95fr]">
      <Card className="border-primary-100 bg-[linear-gradient(180deg,rgba(236,253,245,0.9),rgba(255,255,255,0.96))] dark:border-zinc-800 dark:bg-[linear-gradient(180deg,rgba(10,18,16,0.96),rgba(9,9,11,0.94))]">
        <CardHeader>
          <Badge variant="soft">{t('foundations.title')}</Badge>
          <CardTitle>{t('foundations.title')}</CardTitle>
          <CardDescription>{t('foundations.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={(event) => void handleSubmit(onSubmit)(event)}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm font-medium text-zinc-800 dark:text-zinc-100">
                <span>{t('foundations.localeLabel')}</span>
                <Select {...register('locale')}>
                  <option value="es">{t('language.es')}</option>
                  <option value="en">{t('language.en')}</option>
                </Select>
              </label>

              <label className="space-y-2 text-sm font-medium text-zinc-800 dark:text-zinc-100">
                <span>{t('foundations.themeLabel')}</span>
                <Select {...register('theme')}>
                  <option value="system">{t('theme.system')}</option>
                  <option value="light">{t('theme.light')}</option>
                  <option value="dark">{t('theme.dark')}</option>
                </Select>
              </label>
            </div>

            <div className="grid gap-3">
              <label className="flex items-center justify-between rounded-3xl border border-zinc-200 bg-white/80 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/80">
                <div>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {t('foundations.emailNotificationsLabel')}
                  </p>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">{t('foundations.emailConsistency')}</p>
                </div>
                <input
                  type="checkbox"
                  className="h-5 w-5 rounded border-zinc-300 accent-emerald-500"
                  {...register('emailNotifications')}
                />
              </label>

              <label className="flex items-center justify-between rounded-3xl border border-zinc-200 bg-white/80 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/80">
                <div>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {t('foundations.pushNotificationsLabel')}
                  </p>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    {pushEnabled ? t('foundations.pushGranted') : t('foundations.pushDefault')}
                  </p>
                </div>
                <input
                  type="checkbox"
                  className="h-5 w-5 rounded border-zinc-300 accent-emerald-500"
                  {...register('pushNotifications')}
                />
              </label>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button className="sm:flex-1" type="submit">
                {t('foundations.saveButton')}
              </Button>
              <Button className="sm:flex-1" type="button" variant="outline" onClick={() => void enablePush()}>
                {t('foundations.requestPushButton')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>{t('foundations.dependencyTitle')}</CardTitle>
            <CardDescription>{t('foundations.dependencyDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {dependencyPackages.map((dependencyPackage) => (
              <Badge key={dependencyPackage} variant="outline">
                {dependencyPackage}
              </Badge>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('foundations.pushPermissionLabel')}</CardTitle>
            <CardDescription>
              {pushPermission === 'unsupported'
                ? t('foundations.pushUnsupported')
                : pushPermission === 'granted'
                  ? t('foundations.pushGranted')
                  : pushPermission === 'denied'
                    ? t('foundations.pushDenied')
                    : t('foundations.pushSupported')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-zinc-600 dark:text-zinc-400">
            <p>{t('foundations.auditDescription')}</p>
            <p>
              {env.webPushPublicKey ? t('foundations.vapidConfigured') : t('foundations.pushMissingKey')}
            </p>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
