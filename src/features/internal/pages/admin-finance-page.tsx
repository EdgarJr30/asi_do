import { useState } from 'react'

import { Save } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { AdminDonationAmountsPage } from '@/features/donations/pages/admin-donation-amounts-page'
import { MembershipPaymentsSettingsPage } from '@/features/membership/pages/membership-payments-settings-page'
import { AdminPage, AdminTabs } from '@/features/internal/components/admin-redesign'
import { AdminPaymentAuditPage } from '@/features/internal/pages/admin-payment-audit-page'

type FinanceTab = 'payments' | 'donations' | 'audit'

function resolveFinanceTab(value: string | null): FinanceTab {
  if (value === 'donations' || value === 'audit') {
    return value
  }
  return 'payments'
}

export function AdminFinancePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [tab, setTab] = useState<FinanceTab>(resolveFinanceTab(searchParams.get('tab')))
  const handleTabChange = (nextTab: FinanceTab) => {
    setTab(nextTab)
    setSearchParams({ tab: nextTab }, { replace: true })
  }

  return (
    <AdminPage
      title="Finanzas"
      description="Configuración financiera visible a miembros y donantes: pasarela AZUL, cuotas por categoría y montos sugeridos."
      actions={
        tab === 'payments' ? (
          <Button type="submit" form="membership-payments-settings-form" className="h-9 rounded-control">
            <Save className="size-4" /> Guardar cambios
          </Button>
        ) : null
      }
    >
      <div className="space-y-4">
        <AdminTabs
          value={tab}
          onChange={handleTabChange}
          tabs={[
            { value: 'payments', label: 'Cobros y cuotas' },
            { value: 'donations', label: 'Donaciones' },
            { value: 'audit', label: 'Auditoría de pagos AZUL' }
          ]}
        />
        {tab === 'payments' ? <MembershipPaymentsSettingsPage embedded /> : null}
        {tab === 'donations' ? <AdminDonationAmountsPage embedded /> : null}
        {tab === 'audit' ? <AdminPaymentAuditPage /> : null}
      </div>
    </AdminPage>
  )
}
