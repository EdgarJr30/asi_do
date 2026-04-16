import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { useAppSession } from '@/app/providers/app-session-provider'
import { surfacePaths } from '@/app/router/surface-paths'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  fetchPlatformOpsSnapshot,
  listFeatureFlags,
  listSubscriptionPlans,
  listTenantSubscriptions,
  updateFeatureFlag
} from '@/features/platform-ops/lib/platform-ops-api'
import { reportErrorWithToast } from '@/lib/errors/error-reporting'

export function PlatformOpsDashboardPage() {
  const session = useAppSession()
  const queryClient = useQueryClient()
  const canUpdateFlags = session.permissions.includes('feature_flag:update')

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

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden bg-(--app-surface-muted)">
        <CardHeader>
          <Badge variant="soft">Platform ops</Badge>
          <CardTitle>Dashboard base de lanzamiento</CardTitle>
          <CardDescription>
            Esta vista consolida salud operativa, hooks de planes y feature flags para que la plataforma sea gobernable.
          </CardDescription>
        </CardHeader>
      </Card>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[
          ['Tenants activos', stats?.activeTenants ?? 0],
          ['Casos de moderacion abiertos', stats?.openModerationCases ?? 0],
          ['Solicitudes de operador pendientes', stats?.pendingRecruiterRequests ?? 0],
          ['Subscriptions activas', stats?.activeSubscriptions ?? 0],
          ['Email hooks pendientes', stats?.pendingEmailHooks ?? 0],
          ['Feature flags habilitadas', stats?.featureFlagsEnabled ?? 0]
        ].map(([label, value]) => (
          <Card key={label}>
            <CardContent className="space-y-2 pt-6">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">{label}</p>
              <p className="text-3xl font-semibold text-zinc-950 dark:text-zinc-50">{value}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <CardTitle>Catalogo de planes</CardTitle>
            <CardDescription>Base para pricing, enforcement y soporte operativo.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(plansQuery.data ?? []).map((plan) => (
              <div key={plan.id} className="rounded-[24px] border border-zinc-200 bg-zinc-50 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-900/80">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">{plan.name}</p>
                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{plan.description}</p>
                  </div>
                  <Badge variant="outline">{plan.status}</Badge>
                </div>
                <p className="mt-3 text-sm text-zinc-700 dark:text-zinc-300">
                  {plan.currency_code} {Number(plan.monthly_price_amount).toFixed(2)} / mes
                </p>
                <pre className="mt-3 overflow-x-auto rounded-2xl bg-white/80 px-3 py-3 text-xs text-zinc-600 dark:bg-zinc-950/80 dark:text-zinc-400">
                  {JSON.stringify(plan.limits_json, null, 2)}
                </pre>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Subscriptions recientes</CardTitle>
            <CardDescription>Visibilidad inicial de tenants, plan actual y estado de suscripcion.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(subscriptionsQuery.data ?? []).map((subscription) => (
              <div key={subscription.id} className="rounded-[24px] border border-zinc-200 bg-zinc-50 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-900/80">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                      {subscription.tenant?.name ?? subscription.tenant_id}
                    </p>
                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                      {subscription.plan?.name ?? subscription.plan_id} · seats {subscription.seat_count}
                    </p>
                  </div>
                  <Badge variant="outline">{subscription.status}</Badge>
                </div>
                <p className="mt-3 text-xs uppercase tracking-[0.16em] text-zinc-500">
                  Inicio {new Date(subscription.starts_at).toLocaleDateString()}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Feature flags</CardTitle>
          <CardDescription>Hooks operativos para habilitar o apagar capacidades sin tocar el deploy.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {(featureFlagsQuery.data ?? []).map((flag) => (
            <div key={flag.id} className="rounded-[24px] border border-zinc-200 bg-zinc-50 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-900/80">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">{flag.code}</p>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{flag.description}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.16em] text-zinc-500">{flag.scope_type}</p>
                </div>
                <Badge variant={flag.is_enabled ? 'soft' : 'outline'}>{flag.is_enabled ? 'On' : 'Off'}</Badge>
              </div>
              <Button
                className="mt-4 w-full"
                variant="outline"
                disabled={toggleFlagMutation.isPending || !canUpdateFlags}
                onClick={() => toggleFlagMutation.mutate({ id: flag.id, isEnabled: !flag.is_enabled })}
              >
                {canUpdateFlags ? (flag.is_enabled ? 'Deshabilitar' : 'Habilitar') : 'Solo lectura'}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
