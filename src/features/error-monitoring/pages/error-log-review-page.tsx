import type { ReactNode } from 'react'

import { useState } from 'react'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { useAppSession } from '@/app/providers/app-session-provider'
import { surfacePaths } from '@/app/router/surface-paths'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PageLoader } from '@/components/ui/loader'
import {
  AdminCard,
  AdminMetaDetails,
  AdminPage,
  AdminStat,
  AdminStatBar,
  AdminTabs
} from '@/features/internal/components/admin-redesign'
import { listAppErrorLogs, updateAppErrorResolution, type AppErrorLogRecord } from '@/lib/errors/api'
import { reportErrorWithToast } from '@/lib/errors/error-reporting'
import type { Tables } from '@/shared/types/database'

const APP_ERROR_LOGS_QUERY_KEY = ['admin', 'app-error-logs'] as const

type ErrorFilter = 'open' | 'resolved' | 'all'

function formatValue(value: string | null) {
  return value || 'No disponible'
}

function formatUserLabel(user: AppErrorLogRecord['affected_user']) {
  if (!user) return 'No identificado'
  return user.display_name || user.full_name || user.email || user.id
}

function formatUserDetail(user: AppErrorLogRecord['affected_user']) {
  if (!user) return 'El error ocurrió sin una referencia legible del usuario.'
  return user.email || user.full_name || user.id
}

function ErrorSeverityBadge({ severity }: { severity: Tables<'app_error_logs'>['severity'] }) {
  const className =
    severity === 'fatal'
      ? 'border-rose-200 bg-rose-50 text-rose-700'
      : severity === 'warning'
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : 'border-primary-200 bg-primary-50 text-primary-700'

  return (
    <Badge variant="outline" className={className}>
      {severity}
    </Badge>
  )
}

export function ErrorLogReviewPage() {
  const session = useAppSession()
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<ErrorFilter>('open')

  const errorLogsQuery = useQuery({
    queryKey: APP_ERROR_LOGS_QUERY_KEY,
    queryFn: () => listAppErrorLogs(60)
  })

  const resolutionMutation = useMutation({
    mutationFn: async (values: { errorId: string; isResolved: boolean }) => {
      if (!session.authUser) {
        throw new Error('Debes iniciar sesión para administrar errores.')
      }

      return updateAppErrorResolution({
        errorId: values.errorId,
        isResolved: values.isResolved,
        resolvedByUserId: session.authUser.id
      })
    },
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: APP_ERROR_LOGS_QUERY_KEY })
      toast.success(variables.isResolved ? 'Error corregido' : 'Error reabierto', {
        description: variables.isResolved ? 'El error quedó marcado como corregido.' : 'El error se reabrió para seguimiento.'
      })
    },
    onError: async (error) => {
      await reportErrorWithToast({
        title: 'No pudimos actualizar el estado del error',
        source: 'admin.error-log-resolution',
        route: surfacePaths.admin.errors,
        userId: session.authUser?.id ?? null,
        error,
        userMessage: 'No pudimos actualizar el estado de seguimiento del error.'
      })
    }
  })

  const errorLogs = errorLogsQuery.data ?? []
  const openCount = errorLogs.filter((errorLog) => !errorLog.is_resolved).length
  const resolvedCount = errorLogs.filter((errorLog) => errorLog.is_resolved).length
  const filteredLogs = errorLogs.filter((errorLog) => {
    if (filter === 'open') return !errorLog.is_resolved
    if (filter === 'resolved') return errorLog.is_resolved
    return true
  })

  return (
    <AdminPage
      eyebrow="Admin · Errores"
      title="Bandeja administrativa de errores"
      description="Revisa errores visibles para usuarios, marca incidencias corregidas o reabre seguimiento con contexto técnico colapsable."
    >
      <div className="space-y-5">
        <AdminStatBar columns={3}>
          <AdminStat label="Abiertos" value={openCount} tone="rose" />
          <AdminStat label="Corregidos" value={resolvedCount} tone="green" />
          <AdminStat label="Usuario afectado" value="Visible" helper="Soporte puede identificar a quién contactar." tone="teal" />
        </AdminStatBar>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <AdminTabs
            value={filter}
            onChange={setFilter}
            tabs={[
              { value: 'open', label: 'Solo abiertos', count: openCount },
              { value: 'resolved', label: 'Solo corregidos', count: resolvedCount },
              { value: 'all', label: 'Ver todo', count: errorLogs.length }
            ]}
          />
          <Button variant="ghost" className="h-10 rounded-xl" onClick={() => void queryClient.invalidateQueries({ queryKey: APP_ERROR_LOGS_QUERY_KEY })}>
            Refrescar
          </Button>
        </div>

        {errorLogsQuery.isLoading ? (
          <PageLoader inline label="Cargando errores registrados" hint="Recuperando el historial de monitoreo" />
        ) : filteredLogs.length === 0 ? (
          <AdminCard>
            <p className="py-4 text-center text-sm text-(--app-text-muted)">
              No hay errores para este filtro. Si aparece un fallo visible en la app, debe terminar registrado aquí.
            </p>
          </AdminCard>
        ) : (
          <div className="space-y-3">
            {filteredLogs.map((errorLog) => (
              <AdminCard key={errorLog.id}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <ErrorSeverityBadge severity={errorLog.severity} />
                      <Badge variant={errorLog.is_resolved ? 'default' : 'outline'}>
                        {errorLog.is_resolved ? 'Corregido' : 'Pendiente'}
                      </Badge>
                    </div>
                    <h2 className="text-base font-bold text-(--app-text)">{errorLog.user_message}</h2>
                    <p className="text-sm leading-5 text-(--app-text-muted)">{errorLog.error_message}</p>
                  </div>
                  <Button
                    className="h-9 rounded-xl"
                    variant={errorLog.is_resolved ? 'outline' : 'secondary'}
                    disabled={resolutionMutation.isPending}
                    onClick={() =>
                      resolutionMutation.mutate({
                        errorId: errorLog.id,
                        isResolved: !errorLog.is_resolved
                      })
                    }
                  >
                    {errorLog.is_resolved ? 'Reabrir' : 'Marcar como corregido'}
                  </Button>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <InfoBlock title="Usuario afectado">
                    <p>{formatUserLabel(errorLog.affected_user)}</p>
                    <p>{formatUserDetail(errorLog.affected_user)}</p>
                    <p>ID: {formatValue(errorLog.user_id)}</p>
                  </InfoBlock>
                  <InfoBlock title="Contexto">
                    <p>Ruta: {formatValue(errorLog.route)}</p>
                    <p>Origen: {errorLog.source}</p>
                    <p>Código: {formatValue(errorLog.error_code)}</p>
                  </InfoBlock>
                  <InfoBlock title="Seguimiento">
                    <p>Detectado: {new Date(errorLog.created_at).toLocaleString('es-DO')}</p>
                    <p>Corregido: {errorLog.resolved_at ? new Date(errorLog.resolved_at).toLocaleString('es-DO') : 'Pendiente'}</p>
                    <p>Resuelto por: {formatUserLabel(errorLog.resolved_by_user)}</p>
                  </InfoBlock>
                </div>

                <div className="mt-3">
                  <AdminMetaDetails>
                    <pre className="whitespace-pre-wrap break-words">{JSON.stringify(errorLog.metadata, null, 2)}</pre>
                  </AdminMetaDetails>
                </div>
              </AdminCard>
            ))}
          </div>
        )}
      </div>
    </AdminPage>
  )
}

function InfoBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl bg-(--app-surface-muted) px-4 py-3 text-sm text-(--app-text-muted)">
      <p className="font-bold text-(--app-text)">{title}</p>
      <div className="mt-1 space-y-0.5">{children}</div>
    </div>
  )
}
