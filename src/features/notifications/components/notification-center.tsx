import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'

import { useAppSession } from '@/app/providers/app-session-provider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { fetchMyNotifications, markNotificationRead, sendNotification } from '@/lib/notifications/api'
import { reportErrorWithToast } from '@/lib/errors/error-reporting'
import { cn } from '@/lib/utils/cn'

const notificationSchema = z.object({
  title: z.string().trim().min(4).max(80),
  body: z.string().trim().min(8).max(240),
  actionUrl: z.string().trim().max(200).optional()
})

type NotificationValues = z.infer<typeof notificationSchema>

export function NotificationCenter() {
  const { t } = useTranslation()
  const session = useAppSession()
  const queryClient = useQueryClient()

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications', session.authUser?.id],
    queryFn: () => fetchMyNotifications(6),
    enabled: session.isAuthenticated
  })

  const { handleSubmit, register, reset } = useForm<NotificationValues>({
    resolver: zodResolver(notificationSchema),
    defaultValues: {
      title: t('notifications.defaultTitle'),
      body: t('notifications.defaultBody'),
      actionUrl: '/'
    }
  })

  const sendMutation = useMutation({
    mutationFn: (values: NotificationValues) =>
      sendNotification({
        recipientUserId: session.authUser?.id ?? '',
        tenantId: null,
        type: 'system.test',
        title: values.title,
        body: values.body,
        actionUrl: values.actionUrl,
        payload: {
          tenantId: session.primaryMembership?.tenantId ?? null,
          source: 'notification-center',
          trigger: 'self-test'
        }
      }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['notifications', session.authUser?.id] })

      toast.success(t('notifications.testSuccessTitle'), {
        description: result.skippedPush
          ? t('notifications.testSuccessNoPush')
          : t('notifications.testSuccessWithPush', {
              sentCount: result.sentCount,
              queuedCount: result.queuedCount
            })
      })

      reset({
        title: t('notifications.defaultTitle'),
        body: t('notifications.defaultBody'),
        actionUrl: '/'
      })
    },
    onError: async (error) => {
      await reportErrorWithToast({
        title: t('notifications.testErrorTitle'),
        source: 'notifications.send-self-test',
        route: window.location.pathname,
        userId: session.authUser?.id ?? null,
        error,
        description: error instanceof Error ? error.message : t('notifications.testErrorDescription'),
        userMessage: t('notifications.testErrorDescription')
      })
    }
  })

  const readMutation = useMutation({
    mutationFn: (notificationId: string) => markNotificationRead(notificationId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications', session.authUser?.id] })
    }
  })

  if (!session.isAuthenticated || !session.authUser) {
    return null
  }

  const unreadCount = notifications.filter((notification) => !notification.read_at).length

  return (
    <section className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
      <Card className="border-sky-100 bg-[linear-gradient(180deg,rgba(239,246,255,0.92),rgba(255,255,255,0.96))] dark:border-zinc-800 dark:bg-[linear-gradient(180deg,rgba(8,18,30,0.95),rgba(9,9,11,0.94))]">
        <CardHeader>
          <Badge variant="soft">{t('notifications.title')}</Badge>
          <CardTitle>{t('notifications.title')}</CardTitle>
          <CardDescription>{t('notifications.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(event) =>
              void handleSubmit((values: NotificationValues) => {
                sendMutation.mutate(values)
              })(event)
            }
          >
            <label className="space-y-2 text-sm font-medium text-zinc-800 dark:text-zinc-100">
              <span>{t('notifications.formTitleLabel')}</span>
              <Input {...register('title')} maxLength={80} />
            </label>

            <label className="space-y-2 text-sm font-medium text-zinc-800 dark:text-zinc-100">
              <span>{t('notifications.formBodyLabel')}</span>
              <Textarea {...register('body')} maxLength={240} />
            </label>

            <label className="space-y-2 text-sm font-medium text-zinc-800 dark:text-zinc-100">
              <span>{t('notifications.formActionUrlLabel')}</span>
              <Input {...register('actionUrl')} placeholder="/" />
            </label>

            <div className="rounded-[24px] border border-zinc-200 bg-white/80 px-4 py-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950/70 dark:text-zinc-400">
              {t('notifications.auditNote')}
            </div>

            <Button className="w-full" disabled={sendMutation.isPending} type="submit">
              {sendMutation.isPending ? t('notifications.sendingButton') : t('notifications.sendButton')}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>{t('notifications.inboxTitle')}</CardTitle>
              <CardDescription>{t('notifications.inboxDescription')}</CardDescription>
            </div>
            <Badge variant="outline">{t('notifications.unreadBadge', { count: unreadCount })}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <div className="rounded-[24px] bg-zinc-50 px-4 py-4 text-sm text-zinc-600 dark:bg-zinc-900/80 dark:text-zinc-400">
              {t('notifications.loading')}
            </div>
          ) : notifications.length === 0 ? (
            <div className="rounded-[24px] bg-zinc-50 px-4 py-4 text-sm text-zinc-600 dark:bg-zinc-900/80 dark:text-zinc-400">
              {t('notifications.empty')}
            </div>
          ) : (
            notifications.map((notification) => (
              <article
                key={notification.id}
                className="rounded-[24px] border border-zinc-200 bg-zinc-50 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-900/80"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{notification.title}</p>
                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{notification.body}</p>
                  </div>
                  <Badge variant={notification.read_at ? 'outline' : 'soft'}>
                    {notification.read_at ? t('notifications.readBadge') : t('notifications.unreadState')}
                  </Badge>
                </div>

                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                    {new Date(notification.created_at).toLocaleString()}
                  </p>
                  <div className="flex gap-2">
                    {notification.action_url ? (
                      <a
                        className={cn(
                          'inline-flex h-11 items-center justify-center rounded-2xl border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-900 transition hover:border-primary-300 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:border-primary-500 dark:hover:text-primary-300'
                        )}
                        href={notification.action_url}
                      >
                        {t('notifications.openAction')}
                      </a>
                    ) : null}
                    {!notification.read_at ? (
                      <Button
                        disabled={readMutation.isPending}
                        type="button"
                        variant="outline"
                        onClick={() => readMutation.mutate(notification.id)}
                      >
                        {t('notifications.markReadButton')}
                      </Button>
                    ) : null}
                  </div>
                </div>
              </article>
            ))
          )}
        </CardContent>
      </Card>
    </section>
  )
}
