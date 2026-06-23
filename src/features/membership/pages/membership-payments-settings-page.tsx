import { useForm, useWatch } from 'react-hook-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Banknote, Save } from 'lucide-react'
import { toast } from 'sonner'

import { surfacePaths } from '@/app/router/surface-paths'
import { useAppSession } from '@/app/providers/app-session-provider'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { PageLoader } from '@/components/ui/loader'
import { Textarea } from '@/components/ui/textarea'
import { toErrorMessage } from '@/features/auth/lib/auth-api'
import {
  fetchMembershipPaymentSettings,
  getCategoryDue,
  updateMembershipPaymentSettings,
  type MembershipPaymentSettings
} from '@/features/membership/lib/membership-api'
import { membershipCategories } from '@/experiences/institutional/content/eligibility-content'
import { reportErrorWithToast } from '@/lib/errors/error-reporting'

const SETTINGS_QUERY_KEY = ['membership', 'payment-settings'] as const

interface PaymentSettingsForm {
  bankName: string
  accountHolder: string
  accountNumber: string
  accountType: string
  routingOrSwift: string
  currency: string
  instructions: string
  dues: Record<string, string>
  azulEnabled: boolean
  azulCurrencyCode: string
  azulEnvironment: string
}

function toFormValues(settings: MembershipPaymentSettings): PaymentSettingsForm {
  return {
    bankName: settings.bank_name,
    accountHolder: settings.account_holder,
    accountNumber: settings.account_number,
    accountType: settings.account_type,
    routingOrSwift: settings.routing_or_swift,
    currency: settings.currency,
    instructions: settings.instructions,
    dues: Object.fromEntries(
      membershipCategories.map((category) => {
        const due = getCategoryDue(settings, category.slug)
        return [category.slug, due?.amount != null ? String(due.amount) : '']
      })
    ),
    azulEnabled: settings.azul_enabled,
    azulCurrencyCode: settings.azul_currency_code,
    azulEnvironment: settings.azul_environment
  }
}

const bankFields: Array<{ name: keyof PaymentSettingsForm; label: string; placeholder?: string }> = [
  { name: 'bankName', label: 'Banco' },
  { name: 'accountHolder', label: 'Titular de la cuenta' },
  { name: 'accountNumber', label: 'Número de cuenta' },
  { name: 'accountType', label: 'Tipo de cuenta', placeholder: 'Corriente / Ahorros' },
  { name: 'routingOrSwift', label: 'SWIFT / ABA / Routing' },
  { name: 'currency', label: 'Moneda', placeholder: 'DOP' }
]

export function MembershipPaymentsSettingsPage() {
  const session = useAppSession()
  const queryClient = useQueryClient()

  const settingsQuery = useQuery({
    queryKey: SETTINGS_QUERY_KEY,
    queryFn: fetchMembershipPaymentSettings
  })
  const settings = settingsQuery.data ?? null

  const form = useForm<PaymentSettingsForm>({
    values: settings ? toFormValues(settings) : undefined
  })
  const watchedCurrency = useWatch({ control: form.control, name: 'currency' })

  const saveMutation = useMutation({
    mutationFn: async (values: PaymentSettingsForm) => {
      if (!settings) {
        throw new Error('No hay una configuración de pago activa para actualizar.')
      }
      return updateMembershipPaymentSettings(
        settings.id,
        {
          bankName: values.bankName,
          accountHolder: values.accountHolder,
          accountNumber: values.accountNumber,
          accountType: values.accountType,
          routingOrSwift: values.routingOrSwift,
          currency: values.currency,
          instructions: values.instructions,
          duesByCategory: Object.fromEntries(
            membershipCategories.map((category) => {
              const raw = values.dues?.[category.slug] ?? ''
              const amount = raw.trim() === '' ? null : Number(raw)
              return [category.slug, { amount: Number.isFinite(amount as number) ? (amount as number) : null, label: category.name }]
            })
          ),
          azulEnabled: values.azulEnabled,
          azulCurrencyCode: values.azulCurrencyCode,
          azulEnvironment: values.azulEnvironment
        },
        session.authUser?.id ?? null
      )
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: SETTINGS_QUERY_KEY })
      await queryClient.invalidateQueries({ queryKey: ['membership', 'status'] })
      toast.success('Datos de pago actualizados', {
        description: 'Los miembros verán los nuevos datos de transferencia y cuotas.'
      })
    },
    onError: async (error) => {
      await reportErrorWithToast({
        title: 'No pudimos guardar los datos de pago',
        source: 'membership.payment-settings.update',
        route: surfacePaths.admin.payments,
        userId: session.authUser?.id ?? null,
        error
      })
    }
  })

  if (settingsQuery.isLoading) {
    return <PageLoader label="Cargando configuración de pago" hint="Datos bancarios y cuotas" />
  }

  if (settingsQuery.error) {
    return (
      <div className="rounded-panel border border-rose-200 bg-rose-50 px-4 py-6 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
        {toErrorMessage(settingsQuery.error)}
      </div>
    )
  }

  const currency = watchedCurrency || settings?.currency || 'DOP'

  return (
    <form className="space-y-6" onSubmit={(event) => void form.handleSubmit((values) => saveMutation.mutate(values))(event)}>
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="inline-flex items-center gap-2 text-[1.6rem] font-semibold tracking-tight text-(--app-text) sm:text-[1.9rem]">
            <Banknote className="size-6 text-primary-600 dark:text-primary-300" /> Datos de pago y cuotas
          </h1>
          <p className="mt-1 text-sm text-(--app-text-muted)">
            Estos datos se muestran a los miembros para su transferencia. Actualízalos cuando tengas la información real.
          </p>
        </div>
        <Button type="submit" className="h-11 shrink-0" disabled={saveMutation.isPending || !settings}>
          <Save className="size-4" /> {saveMutation.isPending ? 'Guardando…' : 'Guardar cambios'}
        </Button>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Pasarela de pagos AZUL</CardTitle>
          <CardDescription>
            Pago con tarjeta vía la Página de Pago de AZUL. El MerchantID y la AuthKey se configuran como
            secretos en el microservicio de pagos (no se guardan aquí).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-start gap-3 rounded-2xl border border-(--app-border) bg-(--app-surface-muted) px-4 py-3">
            <input type="checkbox" className="mt-1 size-4 accent-primary-600" {...form.register('azulEnabled')} />
            <span>
              <span className="block text-sm font-medium text-(--app-text)">Habilitar pago con tarjeta (AZUL)</span>
              <span className="mt-0.5 block text-xs text-(--app-text-muted)">
                Cuando está activo, los miembros pagan su cuota con tarjeta desde su panel de membresía.
              </span>
            </span>
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium text-(--app-text-muted)">CurrencyCode de AZUL</span>
              <Input placeholder="$" {...form.register('azulCurrencyCode')} />
              <span className="text-xs text-(--app-text-subtle)">Valor provisto por AZUL para tu MID (DOP suele ser “$”).</span>
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium text-(--app-text-muted)">Ambiente</span>
              <select
                className="h-10 rounded-lg border border-(--app-border) bg-(--app-surface) px-3 text-sm text-(--app-text) focus:border-primary-500 focus:outline-none"
                {...form.register('azulEnvironment')}
              >
                <option value="test">Pruebas</option>
                <option value="production">Producción</option>
              </select>
              <span className="text-xs text-(--app-text-subtle)">Debe coincidir con las URLs/llaves configuradas en el microservicio.</span>
            </label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Datos bancarios (referencia)</CardTitle>
          <CardDescription>Cuenta destino para transferencias manuales (respaldo / histórico).</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            {bankFields.map((field) => (
              <label key={field.name} className="grid gap-1.5 text-sm">
                <span className="font-medium text-(--app-text-muted)">{field.label}</span>
                <Input placeholder={field.placeholder} {...form.register(field.name)} />
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Instrucciones para el miembro</CardTitle>
          <CardDescription>Mensaje que verá el miembro junto a los datos de transferencia.</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea rows={3} {...form.register('instructions')} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cuotas por categoría</CardTitle>
          <CardDescription>Monto anual ({currency}) que paga cada categoría de membresía.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2.5">
            {membershipCategories.map((category) => (
              <div
                key={category.slug}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-(--app-border) bg-(--app-surface-muted) px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-(--app-text)">{category.name}</p>
                  <p className="text-xs text-(--app-text-subtle)">{category.slug}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-(--app-text-muted)">{currency}</span>
                  <Input
                    className="h-10 w-32 text-right"
                    inputMode="decimal"
                    placeholder="0"
                    {...form.register(`dues.${category.slug}` as const)}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" className="h-11" disabled={saveMutation.isPending || !settings}>
          <Save className="size-4" /> {saveMutation.isPending ? 'Guardando…' : 'Guardar cambios'}
        </Button>
      </div>
    </form>
  )
}
