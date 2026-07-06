import { useState } from 'react'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { useAppSession } from '@/app/providers/app-session-provider'
import { surfacePaths } from '@/app/router/surface-paths'
import { Badge } from '@/components/ui/badge'
import {
  AdminCard,
  AdminPage,
  AdminStat,
  AdminStatBar,
  AdminTabs,
  AdminToggle
} from '@/features/internal/components/admin-redesign'
import {
  fetchPlatformOpsSnapshot,
  listFeatureFlags,
  listSubscriptionPlans,
  listTenantSubscriptions,
  updateFeatureFlag,
  type SubscriptionPlanRecord
} from '@/features/platform-ops/lib/platform-ops-api'
import { reportErrorWithToast } from '@/lib/errors/error-reporting'

type PlatformTab = 'plans' | 'subscriptions' | 'flags'

function formatMoney(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function readableLimitKey(key: string) {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function renderLimitValue(value: unknown) {
  if (value == null) return 'Sin límite'
  if (typeof value === 'boolean') return value ? 'Sí' : 'No'
  if (typeof value === 'number') return value.toLocaleString('es-DO')
  if (typeof value === 'string') return value
  return JSON.stringify(value)
}

function PlanCard({ plan }: { plan: SubscriptionPlanRecord }) {
  const limits = Object.entries(plan.limits_json ?? {})

  return (
    <div className="rounded-card border border-(--app-border) bg-(--app-surface-muted)/65 p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[0.9rem] font-bold text-(--app-text)">{plan.name}</p>
          <p className="mt-0.5 text-[0.8rem] leading-5 text-(--app-text-muted)">{plan.description}</p>
        </div>
        <Badge variant={plan.status === 'active' ? 'default' : 'outline'}>{plan.status}</Badge>
      </div>
      <p className="mt-3 text-[1.2rem] font-bold tracking-normal text-(--app-text)">
        {formatMoney(Number(plan.monthly_price_amount), plan.currency_code)}
        <span className="text-[0.8rem] font-semibold text-(--app-text-muted)"> / mes</span>
      </p>
      <div className="mt-3 divide-y divide-(--app-border)/70 rounded-control border border-(--app-border) bg-(--app-surface)">
        {limits.length === 0 ? (
          <div className="px-3 py-2 text-sm text-(--app-text-muted)">Sin límites configurados.</div>
        ) : (
          limits.map(([key, value]) => (
            <div key={key} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span className="text-(--app-text-muted)">{readableLimitKey(key)}</span>
              <code className="rounded-control bg-(--app-surface-muted) px-2 py-1 text-xs font-bold text-(--app-text)">
                {renderLimitValue(value)}
              </code>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export function PlatformOpsDashboardPage() {
  const session = useAppSession()
  const queryClient = useQueryClient()
  const canUpdateFlags = session.permissions.includes('feature_flag:update')
  const [tab, setTab] = useState<PlatformTab>('plans')

  const snapshotQuery = useQuery({
    queryKey: ['platform-ops-snapshot'],
    queryFn: fetchPlatformOpsSnapshot
  })

  const plansQuery = useQuery({
    queryKey: ['platform-ops-plans'],
    queryFn: listSubscriptionPlans
  })

  const subscriptionsQuery = useQuery({
    queryKey: ['platform-ops-subscriptions'],
    queryFn: listTenantSubscriptions
  })

  const featureFlagsQuery = useQuery({
    queryKey: ['platform-ops-feature-flags'],
    queryFn: listFeatureFlags
  })

  const toggleFlagMutation = useMutation({
    mutationFn: updateFeatureFlag,
    onSuccess: async (_data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['platform-ops-feature-flags'] }),
        queryClient.invalidateQueries({ queryKey: ['platform-ops-snapshot'] })
      ])
      toast.success('Feature flag actualizada', {
        description: variables.isEnabled ? 'La capacidad queda habilitada en la plataforma.' : 'La capacidad queda deshabilitada en la plataforma.'
      })
    },
    onError: async (error) => {
      await reportErrorWithToast({
        title: 'No pudimos actualizar la feature flag',
        source: 'platform-ops.feature-flag-update',
        route: surfacePaths.admin.platform,
        userId: session.authUser?.id ?? null,
        error
      })
    }
  })

  const stats = snapshotQuery.data
  const plans = plansQuery.data ?? []
  const subscriptions = subscriptionsQuery.data ?? []
  const featureFlags = featureFlagsQuery.data ?? []

  return (
    <AdminPage
      eyebrow="Admin · Plataforma"
      title="Plataforma"
      description="Salud operativa, gobierno de planes, suscripciones y feature flags para controlar el producto sin tocar deploys."
    >
      <div className="space-y-5">
        <AdminStatBar columns={6}>
          <AdminStat label="Tenants activos" value={stats?.activeTenants ?? '—'} />
          <AdminStat label="Subscripciones" value={stats?.activeSubscriptions ?? '—'} tone="green" />
          <AdminStat label="Moderación" value={stats?.openModerationCases ?? '—'} tone="violet" />
          <AdminStat label="Operadores pend." value={stats?.pendingRecruiterRequests ?? '—'} tone="amber" />
          <AdminStat label="Emails pendientes" value={stats?.pendingEmailHooks ?? '—'} tone="rose" />
          <AdminStat label="Feature flags" value={stats?.featureFlagsEnabled ?? '—'} tone="teal" />
        </AdminStatBar>

        <AdminTabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'plans', label: 'Planes' },
            { value: 'subscriptions', label: 'Suscripciones', count: subscriptions.length },
            { value: 'flags', label: 'Feature flags', count: featureFlags.length }
          ]}
        />

        {tab === 'plans' ? (
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {plans.map((plan) => (
              <PlanCard key={plan.id} plan={plan} />
            ))}
          </div>
        ) : null}

        {tab === 'subscriptions' ? (
          <AdminCard title="Suscripciones recientes" description="Tenants, plan actual, seats y estado de suscripción.">
            <div className="overflow-x-auto">
              <table className="w-full min-w-180 text-sm">
                <thead>
                  <tr className="border-b border-(--app-border) text-left text-[0.68rem] uppercase tracking-[0.08em] text-(--app-text-subtle)">
                    <th className="px-3 py-2 font-bold">Tenant</th>
                    <th className="px-3 py-2 font-bold">Plan</th>
                    <th className="px-3 py-2 text-right font-bold">Seats</th>
                    <th className="px-3 py-2 font-bold">Inicio</th>
                    <th className="px-3 py-2 text-right font-bold">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {subscriptions.map((subscription) => (
                    <tr key={subscription.id} className="border-b border-(--app-border)/60 transition-colors hover:bg-(--app-surface-muted)">
                      <td className="px-3 py-2 font-semibold text-(--app-text)">
                        {subscription.tenant?.name ?? subscription.tenant_id}
                        <span className="block text-xs font-normal text-(--app-text-muted)">{subscription.tenant?.slug}</span>
                      </td>
                      <td className="px-3 py-2 text-(--app-text-muted)">{subscription.plan?.name ?? subscription.plan_id}</td>
                      <td className="px-3 py-2 text-right font-mono text-(--app-text)">{subscription.seat_count}</td>
                      <td className="px-3 py-2 text-(--app-text-muted)">{new Date(subscription.starts_at).toLocaleDateString('es-DO')}</td>
                      <td className="px-3 py-2 text-right">
                        <Badge variant={subscription.status === 'active' ? 'default' : 'outline'}>{subscription.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </AdminCard>
        ) : null}

        {tab === 'flags' ? (
          <AdminCard title="Feature flags" description="Capacidades controladas por scope global, plan o tenant.">
            <div className="divide-y divide-(--app-border)/70">
              {featureFlags.map((flag) => (
                <button
                  key={flag.id}
                  type="button"
                  className="flex w-full items-center justify-between gap-4 py-2.5 text-left"
                  disabled={toggleFlagMutation.isPending || !canUpdateFlags}
                  onClick={() => toggleFlagMutation.mutate({ id: flag.id, isEnabled: !flag.is_enabled })}
                >
                  <span className="min-w-0">
                    <code className="text-[0.8rem] font-bold text-(--app-text)">{flag.code}</code>
                    <span className="mt-0.5 block text-[0.8rem] text-(--app-text-muted)">{flag.description}</span>
                    <span className="mt-1.5 inline-flex rounded-control bg-(--app-surface-muted) px-2 py-0.5 text-[0.64rem] font-bold uppercase text-(--app-text-subtle)">
                      {flag.scope_type}
                    </span>
                  </span>
                  <AdminToggle on={flag.is_enabled} disabled={!canUpdateFlags} />
                </button>
              ))}
            </div>
          </AdminCard>
        ) : null}
      </div>
    </AdminPage>
  )
}
