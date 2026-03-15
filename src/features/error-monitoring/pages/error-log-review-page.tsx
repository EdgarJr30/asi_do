import { useState } from 'react'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { useAppSession } from '@/app/providers/app-session-provider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { reportErrorWithToast } from '@/lib/errors/error-reporting'
import { listAppErrorLogs, updateAppErrorResolution } from '@/lib/errors/api'
import type { Tables } from '@/shared/types/database'

const APP_ERROR_LOGS_QUERY_KEY = ['admin', 'app-error-logs'] as const

type ErrorFilter = 'open' | 'resolved' | 'all'

function formatValue(value: string | null) {
  if (!value) {
    return 'No disponible'
  }

  return value
}

function ErrorSeverityBadge({ severity }: { severity: Tables<'app_error_logs'>['severity'] }) {
  const variant = severity === 'fatal' ? 'default' : severity === 'warning' ? 'outline' : 'soft'

  return <Badge variant={variant}>{severity}</Badge>
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
        throw new Error('Debes iniciar sesion para administrar errores.')
      }

      return updateAppErrorResolution({
        errorId: values.errorId,
        isResolved: values.isResolved,
        resolvedByUserId: session.authUser.id
      })
    },
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: APP_ERROR_LOGS_QUERY_KEY })
      const description = variables.isResolved
        ? 'El error quedo marcado como corregido.'
        : 'El error se reabrio para seguimiento.'

      toast.success(variables.isResolved ? 'Error corregido' : 'Error reabierto', {
        description
      })
    },
    onError: async (error) => {
      await reportErrorWithToast({
        title: 'No pudimos actualizar el estado del error',
        source: 'admin.error-log-resolution',
        route: '/admin/errors',
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
    if (filter === 'open') {
      return !errorLog.is_resolved
    }

    if (filter === 'resolved') {
      return errorLog.is_resolved
    }

    return true
  })

  return (
    <div className="space-y-4">
      <Card className="border-primary-100 bg-[linear-gradient(160deg,#eef2ff,white_42%,#ecfeff)] dark:border-zinc-800 dark:bg-[linear-gradient(160deg,rgba(14,18,34,0.96),rgba(9,9,11,0.94)_42%,rgba(8,22,28,0.95))]">
        <CardHeader>
          <Badge variant="soft">Admin errors</Badge>
          <CardTitle>Bandeja administrativa de errores</CardTitle>
          <CardDescription>
            Todos los errores visibles para el usuario deben llegar a `app_error_logs`, y desde aqui el admin puede revisarlos, marcarlos como corregidos o reabrirlos.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-3xl border border-zinc-200 bg-white/85 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950/80">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Abiertos</p>
            <p className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{openCount}</p>
          </div>
          <div className="rounded-3xl border border-zinc-200 bg-white/85 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950/80">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Corregidos</p>
            <p className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{resolvedCount}</p>
          </div>
          <div className="rounded-3xl border border-zinc-200 bg-white/85 px-4 py-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-400">
            La ruta, el origen tecnico y el mensaje visible quedan juntos para facilitar soporte y priorizacion.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <Button variant={filter === 'open' ? 'secondary' : 'outline'} onClick={() => setFilter('open')}>
              Solo abiertos
            </Button>
            <Button variant={filter === 'resolved' ? 'secondary' : 'outline'} onClick={() => setFilter('resolved')}>
              Solo corregidos
            </Button>
            <Button variant={filter === 'all' ? 'secondary' : 'outline'} onClick={() => setFilter('all')}>
              Ver todo
            </Button>
          </div>
          <Button variant="ghost" onClick={() => void queryClient.invalidateQueries({ queryKey: APP_ERROR_LOGS_QUERY_KEY })}>
            Refrescar
          </Button>
        </CardContent>
      </Card>

      {errorLogsQuery.isLoading ? (
        <Card>
          <CardContent className="py-8 text-sm text-zinc-500">Cargando errores registrados...</CardContent>
        </Card>
      ) : filteredLogs.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-sm text-zinc-500">
            No hay errores para este filtro. Si aparece un fallo visible en la app, debe terminar registrado aqui.
          </CardContent>
        </Card>
      ) : (
        filteredLogs.map((errorLog) => (
          <Card key={errorLog.id}>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <ErrorSeverityBadge severity={errorLog.severity} />
                    <Badge variant={errorLog.is_resolved ? 'soft' : 'outline'}>
                      {errorLog.is_resolved ? 'Corregido' : 'Pendiente'}
                    </Badge>
                  </div>
                  <CardTitle className="text-base">{errorLog.user_message}</CardTitle>
                  <CardDescription>{errorLog.error_message}</CardDescription>
                </div>
                <Button
                  variant={errorLog.is_resolved ? 'outline' : 'secondary'}
                  disabled={resolutionMutation.isPending}
                  onClick={() =>
                    resolutionMutation.mutate({
                      errorId: errorLog.id,
                      isResolved: !errorLog.is_resolved
                    })
                  }
                >
                  {errorLog.is_resolved ? 'Marcar como no corregido' : 'Marcar como corregido'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-3xl bg-zinc-50 px-4 py-3 text-sm text-zinc-700 dark:bg-zinc-900/70 dark:text-zinc-300">
                  <p className="font-semibold text-zinc-900 dark:text-zinc-50">Contexto</p>
                  <p className="mt-1">Ruta: {formatValue(errorLog.route)}</p>
                  <p>Origen: {errorLog.source}</p>
                  <p>Codigo: {formatValue(errorLog.error_code)}</p>
                </div>
                <div className="rounded-3xl bg-zinc-50 px-4 py-3 text-sm text-zinc-700 dark:bg-zinc-900/70 dark:text-zinc-300">
                  <p className="font-semibold text-zinc-900 dark:text-zinc-50">Seguimiento</p>
                  <p className="mt-1">Detectado: {new Date(errorLog.created_at).toLocaleString()}</p>
                  <p>Corregido en: {errorLog.resolved_at ? new Date(errorLog.resolved_at).toLocaleString() : 'Pendiente'}</p>
                  <p>Resuelto por: {formatValue(errorLog.resolved_by_user_id)}</p>
                </div>
              </div>

              <div className="rounded-3xl bg-zinc-50 px-4 py-3 text-sm text-zinc-700 dark:bg-zinc-900/70 dark:text-zinc-300">
                <p className="font-semibold text-zinc-900 dark:text-zinc-50">Metadata</p>
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words text-xs text-zinc-600 dark:text-zinc-400">
                  {JSON.stringify(errorLog.metadata, null, 2)}
                </pre>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}
