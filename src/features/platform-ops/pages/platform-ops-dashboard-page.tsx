import { useState } from 'react'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { useAppSession } from '@/app/providers/app-session-provider'
import { surfacePaths } from '@/app/router/surface-paths'
import { Badge } from '@/components/ui/badge'
import {
  AdminCard,
  AdminEmpty,
  AdminPage,
  AdminStat,
  AdminStatBar,
  AdminTabs,
  AdminToggle
} from '@/features/internal/components/admin-redesign'
import { membershipCategories } from '@/experiences/institutional/content/eligibility-content'
import { MembershipPlansPanel } from '@/features/platform-ops/components/membership-plans-panel'
import {
  fetchPlatformOpsSnapshot,
  listFeatureFlags,
  listMembershipSubscriptions,
  updateFeatureFlag
} from '@/features/platform-ops/lib/platform-ops-api'
import { reportErrorWithToast } from '@/lib/errors/error-reporting'

type PlatformTab = 'plans' | 'subscriptions' | 'flags'

const DAY_MS = 24 * 60 * 60 * 1000

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' })
}

/** "en 12 días" / "venció hace 3 días", para leer la urgencia de la renovación de un vistazo. */
function formatRemaining(expiresAt: string | null) {
  if (!expiresAt) return 'Sin vencimiento'

  const days = Math.round((new Date(expiresAt).getTime() - Date.now()) / DAY_MS)
  if (days === 0) return 'Vence hoy'
  if (days > 0) return `en ${days} ${days === 1 ? 'día' : 'días'}`

  const overdue = Math.abs(days)
  return `venció hace ${overdue} ${overdue === 1 ? 'día' : 'días'}`
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

  const subscriptionsQuery = useQuery({
    queryKey: ['platform-ops-subscriptions'],
    queryFn: () => listMembershipSubscriptions()
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
  const subscriptions = subscriptionsQuery.data ?? []
  const featureFlags = featureFlagsQuery.data ?? []

  return (
    <AdminPage
      eyebrow="Admin · Plataforma"
      title="Plataforma"
      description="Salud operativa, gobierno de planes, suscripciones y feature flags para controlar el producto sin tocar deploys."
    >
      <div className="space-y-5">
        <AdminStatBar columns={6} mobileTwoColumns>
          <AdminStat label="Tenants activos" value={stats?.activeTenants ?? '—'} />
          <AdminStat
            label="Membresías activas"
            value={stats?.activeMemberships ?? '—'}
            helper={
              stats
                ? `${stats.membershipsExpiringSoon} por renovar · ${stats.membershipsInGrace} en gracia`
                : undefined
            }
            tone="green"
          />
          <AdminStat label="Moderación" value={stats?.openModerationCases ?? '—'} tone="violet" />
          <AdminStat label="Operadores pend." value={stats?.pendingRecruiterRequests ?? '—'} tone="amber" />
          <AdminStat label="Emails pendientes" value={stats?.pendingEmailHooks ?? '—'} tone="rose" />
          <AdminStat label="Feature flags" value={stats?.featureFlagsEnabled ?? '—'} tone="teal" />
        </AdminStatBar>

        <AdminTabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'plans', label: 'Planes', count: membershipCategories.length },
            { value: 'subscriptions', label: 'Suscripciones', count: subscriptions.length },
            { value: 'flags', label: 'Feature flags', count: featureFlags.length }
          ]}
        />

        {tab === 'plans' ? <MembershipPlansPanel /> : null}

        {tab === 'subscriptions' ? (
          <AdminCard
            title="Membresías vigentes"
            description="Quién está al día y cuándo le toca renovar. Ordenadas por la que vence primero."
          >
            {subscriptions.length === 0 ? (
              <AdminEmpty
                title="Sin membresías vigentes"
                description="Aquí aparecerán los miembros activos y los que estén en periodo de gracia."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-180 text-sm">
                  <thead>
                    <tr className="border-b border-(--app-border) text-left text-[0.68rem] uppercase tracking-[0.08em] text-(--app-text-subtle)">
                      <th className="px-3 py-2 font-bold">Miembro</th>
                      <th className="px-3 py-2 font-bold">Plan</th>
                      <th className="px-3 py-2 font-bold">Activada</th>
                      <th className="px-3 py-2 font-bold">Vence</th>
                      <th className="px-3 py-2 text-right font-bold">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subscriptions.map((subscription) => (
                      <tr
                        key={subscription.userId}
                        className="border-b border-(--app-border)/60 transition-colors hover:bg-(--app-surface-muted)"
                      >
                        <td className="px-3 py-2 font-semibold text-(--app-text)">
                          {subscription.fullName}
                          <span className="block text-xs font-normal text-(--app-text-muted)">{subscription.email}</span>
                        </td>
                        <td className="px-3 py-2 text-(--app-text-muted)">{subscription.categoryName ?? 'Sin categoría'}</td>
                        <td className="px-3 py-2 text-(--app-text-muted)">{formatDate(subscription.activatedAt)}</td>
                        <td className="px-3 py-2 text-(--app-text-muted)">
                          {formatDate(subscription.expiresAt)}
                          <span className="block text-xs text-(--app-text-subtle)">{formatRemaining(subscription.expiresAt)}</span>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Badge variant={subscription.status === 'active' ? 'default' : 'outline'}>
                            {subscription.status === 'active' ? 'Vigente' : 'En gracia'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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
