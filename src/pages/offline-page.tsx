import { useTranslation } from 'react-i18next'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function OfflinePage() {
  const { t } = useTranslation()

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>{t('offline.title')}</CardTitle>
        <CardDescription>{t('offline.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
        <p>{t('offline.body1')}</p>
        <p>
          {t('offline.body2')}
        </p>
      </CardContent>
    </Card>
  )
}
