import { useState } from 'react'

import { useSearchParams } from 'react-router-dom'

import { FoundationSettingsForm } from '@/features/foundations/components/foundation-settings-form'
import { EmailPipelinePage } from '@/features/internal/pages/email-pipeline-page'
import { NotificationCenter } from '@/features/notifications/components/notification-center'
import { AdminPage, AdminTabs } from '@/features/internal/components/admin-redesign'

type CommunicationsTab = 'emails' | 'notifications'

export function AdminCommunicationsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [tab, setTab] = useState<CommunicationsTab>(searchParams.get('tab') === 'notifications' ? 'notifications' : 'emails')
  const handleTabChange = (nextTab: CommunicationsTab) => {
    setTab(nextTab)
    setSearchParams({ tab: nextTab }, { replace: true })
  }

  return (
    <AdminPage
      title="Comunicaciones"
      description="Pipeline de correos, pruebas controladas, centro de notificaciones in-app, push y preferencias de UI."
    >
      <div className="space-y-4">
        <AdminTabs
          value={tab}
          onChange={handleTabChange}
          tabs={[
            { value: 'emails', label: 'Correos' },
            { value: 'notifications', label: 'Notificaciones' }
          ]}
        />
        {tab === 'emails' ? (
          <EmailPipelinePage embedded />
        ) : (
          <div className="space-y-4">
            <FoundationSettingsForm />
            <NotificationCenter />
          </div>
        )}
      </div>
    </AdminPage>
  )
}
