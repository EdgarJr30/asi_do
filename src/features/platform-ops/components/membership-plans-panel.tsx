import { useForm, useWatch } from 'react-hook-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ExternalLink, Save } from 'lucide-react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { useAppSession } from '@/app/providers/app-session-provider'
import { surfacePaths } from '@/app/router/surface-paths'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PageLoader } from '@/components/ui/loader'
import { AdminCard } from '@/features/internal/components/admin-redesign'
import { membershipCategories } from '@/experiences/institutional/content/eligibility-content'
import {
  fetchMembershipPaymentSettings,
  getCategoryDue,
  updateMembershipPaymentSettings,
  type MembershipPaymentSettings
} from '@/features/membership/lib/membership-api'
import { fetchMembershipPlanAdoption } from '@/features/platform-ops/lib/platform-ops-api'
import { reportErrorWithToast } from '@/lib/errors/error-reporting'

/** Misma key que la consola de finanzas: ambas pantallas editan la misma configuración. */
const SETTINGS_QUERY_KEY = ['membership', 'payment-settings'] as const

const categorySlugs = membershipCategories.map((category) => category.slug)

interface PlansForm {
  currency: string
  dues: Record<string, string>
}

function toFormValues(settings: MembershipPaymentSettings): PlansForm {
  return {
    currency: settings.currency,
    dues: Object.fromEntries(
      membershipCategories.map((category) => {
        const due = getCategoryDue(settings, category.slug)
        return [category.slug, due?.amount != null ? String(due.amount) : '']
      })
    )
  }
}

function formatAmount(amount: number | null, currency: string) {
  if (amount == null) return 'Sin cuota'
  return `${currency} ${amount.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function MembershipPlansPanel() {
  const session = useAppSession()
  const queryClient = useQueryClient()
  const canEdit = session.isPlatformAdmin

  const settingsQuery = useQuery({
    queryKey: SETTINGS_QUERY_KEY,
    queryFn: fetchMembershipPaymentSettings
  })
  const settings = settingsQuery.data ?? null

  const adoptionQuery = useQuery({
    queryKey: ['platform-ops-plan-adoption'],
    queryFn: () => fetchMembershipPlanAdoption(categorySlugs)
  })

  const form = useForm<PlansForm>({
    values: settings ? toFormValues(settings) : undefined
  })
  const watchedCurrency = useWatch({ control: form.control, name: 'currency' })
  const currency = watchedCurrency || settings?.currency || 'DOP'

  const saveMutation = useMutation({
    mutationFn: async (values: PlansForm) => {
      if (!settings) {
        throw new Error('No hay una configuración de pago activa para actualizar.')
      }

      return updateMembershipPaymentSettings(
        settings.id,
        {
          currency: values.currency,
          duesByCategory: Object.fromEntries(
            membershipCategories.map((category) => {
              const raw = values.dues?.[category.slug] ?? ''
              const parsed = raw.trim() === '' ? null : Number(raw)
              return [
                category.slug,
                { amount: parsed != null && Number.isFinite(parsed) ? parsed : null, label: category.name }
              ]
            })
          ),
          // La pasarela se administra en Finanzas; aquí solo se conserva tal cual.
          azulEnabled: settings.azul_enabled,
          azulCurrencyCode: settings.azul_currency_code,
          azulEnvironment: settings.azul_environment
        },
        session.authUser?.id ?? null
      )
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: SETTINGS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: ['membership', 'status'] })
      ])
      toast.success('Planes actualizados', {
        description: 'Las nuevas cuotas aplican a solicitudes, renovaciones y pagos con tarjeta.'
      })
    },
    onError: async (error) => {
      await reportErrorWithToast({
        title: 'No pudimos actualizar los planes',
        source: 'platform-ops.membership-plans.update',
        route: surfacePaths.admin.platform,
        userId: session.authUser?.id ?? null,
        error
      })
    }
  })

  if (settingsQuery.isLoading) {
    return <PageLoader label="Cargando planes de membresía" hint="Cuotas por categoría" />
  }

  if (settingsQuery.error) {
    return (
      <AdminCard>
        <p className="text-sm text-rose-600 dark:text-rose-300">
          No pudimos cargar la configuración de cuotas. Recarga la página o revisa tus permisos.
        </p>
      </AdminCard>
    )
  }

  const adoption = adoptionQuery.data ?? {}

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => void form.handleSubmit((values) => saveMutation.mutate(values))(event)}
    >
      <AdminCard
        title="Planes de membresía"
        description="Las tres categorías oficiales de ASI y su cuota anual. Es la misma cuota que se cobra en la solicitud, en la renovación y en el pago con tarjeta."
        tag={
          <Link
            to={`${surfacePaths.admin.finances}?tab=payments`}
            className="inline-flex items-center gap-1.5 text-[0.78rem] font-semibold text-primary-600 hover:underline dark:text-primary-300"
          >
            Pasarela y datos bancarios <ExternalLink className="size-3.5" />
          </Link>
        }
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <label className="grid w-36 gap-1.5 text-sm">
            <span className="font-medium text-(--app-text-muted)">Moneda</span>
            <Input placeholder="DOP" disabled={!canEdit} {...form.register('currency')} />
          </label>
          <p className="text-[0.78rem] text-(--app-text-subtle)">
            La cuota es anual; el miembro puede pagar de 1 a 5 años (cuota × años).
          </p>
        </div>
      </AdminCard>

      <div className="grid gap-2.5 lg:grid-cols-3">
        {membershipCategories.map((category) => {
          const stored = getCategoryDue(settings, category.slug)
          const counts = adoption[category.slug]

          return (
            <div
              key={category.slug}
              className="flex flex-col rounded-card border border-(--app-border) bg-(--app-surface-muted)/65 p-3.5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[0.9rem] font-bold text-(--app-text)">{category.name}</p>
                  <code className="text-[0.7rem] text-(--app-text-subtle)">{category.slug}</code>
                </div>
                <Badge variant={stored?.amount != null ? 'default' : 'outline'}>
                  {stored?.amount != null ? 'Activo' : 'Sin cuota'}
                </Badge>
              </div>

              <p className="mt-2 text-[0.8rem] leading-5 text-(--app-text-muted)">{category.description}</p>

              <div className="mt-3 rounded-control border border-(--app-border) bg-(--app-surface) px-3 py-2.5">
                <p className="text-[0.64rem] font-bold uppercase tracking-[0.08em] text-(--app-text-subtle)">
                  Cuota anual
                </p>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="text-sm font-semibold text-(--app-text-muted)">{currency}</span>
                  <Input
                    className="h-10 w-full text-right"
                    inputMode="decimal"
                    placeholder="0"
                    disabled={!canEdit}
                    {...form.register(`dues.${category.slug}` as const)}
                  />
                </div>
                <p className="mt-1.5 text-[0.72rem] text-(--app-text-subtle)">
                  Vigente: {formatAmount(stored?.amount ?? null, settings?.currency ?? 'DOP')}
                </p>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                <div className="rounded-control border border-(--app-border) bg-(--app-surface) px-2 py-2">
                  <p className="text-[1.05rem] font-bold leading-none text-(--app-text)">
                    {adoptionQuery.isLoading ? '—' : (counts?.approved ?? 0)}
                  </p>
                  <p className="mt-1 text-[0.68rem] font-semibold uppercase tracking-[0.06em] text-(--app-text-subtle)">
                    Aprobados
                  </p>
                </div>
                <div className="rounded-control border border-(--app-border) bg-(--app-surface) px-2 py-2">
                  <p className="text-[1.05rem] font-bold leading-none text-(--app-text)">
                    {adoptionQuery.isLoading ? '—' : (counts?.inReview ?? 0)}
                  </p>
                  <p className="mt-1 text-[0.68rem] font-semibold uppercase tracking-[0.06em] text-(--app-text-subtle)">
                    En revisión
                  </p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {canEdit ? (
        <div className="flex items-center justify-end gap-3">
          {form.formState.isDirty ? (
            <span className="text-[0.78rem] text-(--app-text-muted)">Hay cambios sin guardar.</span>
          ) : null}
          <Button type="submit" className="h-11" disabled={saveMutation.isPending || !settings}>
            <Save className="size-4" /> {saveMutation.isPending ? 'Guardando…' : 'Guardar planes'}
          </Button>
        </div>
      ) : (
        <p className="text-right text-[0.78rem] text-(--app-text-subtle)">
          Solo un administrador de plataforma puede modificar las cuotas.
        </p>
      )}
    </form>
  )
}
