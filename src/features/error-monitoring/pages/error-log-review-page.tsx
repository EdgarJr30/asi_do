import type { ReactNode } from 'react'

import { useMemo, useState } from 'react'

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { useAppSession } from '@/app/providers/app-session-provider'
import { surfacePaths } from '@/app/router/surface-paths'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PageLoader, Spinner } from '@/components/ui/loader'
import {
  AdminCard,
  AdminMetaDetails,
  AdminPage,
  AdminStat,
  AdminStatBar,
  AdminTabs
} from '@/features/internal/components/admin-redesign'
import {
  countAppErrorLogs,
  listAppErrorLogsPage,
  updateAppErrorResolution,
  type AppErrorLogFilter,
  type AppErrorLogRecord
} from '@/lib/errors/api'
import { reportErrorWithToast } from '@/lib/errors/error-reporting'
import { useInfiniteScroll } from '@/shared/ui/use-infinite-scroll'
import type { Tables } from '@/shared/types/database'

const APP_ERROR_LOGS_QUERY_KEY = ['admin', 'app-error-logs'] as const
const APP_ERROR_COUNTS_QUERY_KEY = ['admin', 'app-error-log-counts'] as const
const ERROR_LOGS_PAGE_SIZE = 12

type ErrorFilter = AppErrorLogFilter

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

  const errorLogsQuery = useInfiniteQuery({
    queryKey: [...APP_ERROR_LOGS_QUERY_KEY, filter],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      listAppErrorLogsPage({ filter, limit: ERROR_LOGS_PAGE_SIZE, offset: pageParam }),
    getNextPageParam: (lastPage) => lastPage.nextOffset
  })

  const countsQuery = useQuery({
    queryKey: APP_ERROR_COUNTS_QUERY_KEY,
    queryFn: async () => {
      const [open, resolved] = await Promise.all([countAppErrorLogs('open'), countAppErrorLogs('resolved')])
      return { open, resolved }
    }
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
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: APP_ERROR_LOGS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: APP_ERROR_COUNTS_QUERY_KEY })
      ])
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

  const { fetchNextPage, hasNextPage, isFetchingNextPage } = errorLogsQuery
  const pages = useMemo(() => errorLogsQuery.data?.pages ?? [], [errorLogsQuery.data])
  const filteredLogs = useMemo(() => pages.flatMap((entry) => entry.rows), [pages])
  const totalCount = pages[0]?.totalCount ?? 0
  const openCount = countsQuery.data?.open ?? 0
  const resolvedCount = countsQuery.data?.resolved ?? 0
  const allCount = openCount + resolvedCount

  const sentinelRef = useInfiniteScroll({
    hasNextPage: Boolean(hasNextPage),
    isFetchingNextPage,
    onLoadMore: () => void fetchNextPage(),
    deps: [filteredLogs.length]
  })

  function handleFilterChange(nextFilter: ErrorFilter) {
    setFilter(nextFilter)
  }

  return (
    <AdminPage
      eyebrow="Admin · Errores"
      title="Bandeja administrativa de errores"
      description="Revisa errores visibles para usuarios, marca incidencias corregidas o reabre seguimiento con contexto técnico colapsable."
    >
      <div className="space-y-4">
        <AdminStatBar columns={3}>
          <AdminStat label="Abiertos" value={openCount} tone="rose" />
          <AdminStat label="Corregidos" value={resolvedCount} tone="green" />
          <AdminStat label="Usuario afectado" value="Visible" helper="Soporte puede identificar a quién contactar." tone="teal" />
        </AdminStatBar>

        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <AdminTabs
            value={filter}
            onChange={handleFilterChange}
            tabs={[
              { value: 'open', label: 'Solo abiertos', count: openCount },
              { value: 'resolved', label: 'Solo corregidos', count: resolvedCount },
              { value: 'all', label: 'Ver todo', count: allCount }
            ]}
          />
          <Button
            variant="ghost"
            className="h-9 rounded-control"
            onClick={() => {
              void queryClient.invalidateQueries({ queryKey: APP_ERROR_LOGS_QUERY_KEY })
              void queryClient.invalidateQueries({ queryKey: APP_ERROR_COUNTS_QUERY_KEY })
            }}
          >
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
          <div className="space-y-2">
            {filteredLogs.map((errorLog) => (
              <div key={errorLog.id} className="rounded-card border border-(--app-border) bg-(--app-surface-elevated) px-3.5 py-3 shadow-[0_1px_2px_rgba(20,40,90,0.04)]">
                <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <ErrorSeverityBadge severity={errorLog.severity} />
                      <Badge variant={errorLog.is_resolved ? 'default' : 'outline'}>
                        {errorLog.is_resolved ? 'Corregido' : 'Pendiente'}
                      </Badge>
                      <span className="text-[0.72rem] text-(--app-text-subtle)">
                        {new Date(errorLog.created_at).toLocaleString('es-DO')}
                      </span>
                    </div>
                    <h2 className="text-[0.9rem] font-bold leading-snug text-(--app-text)">{errorLog.user_message}</h2>
                    <p className="text-[0.8rem] leading-5 text-(--app-text-muted)">{errorLog.error_message}</p>
                  </div>
                  <Button
                    className="h-8 shrink-0 rounded-control px-3 text-[0.8rem]"
                    variant={errorLog.is_resolved ? 'outline' : 'secondary'}
                    disabled={resolutionMutation.isPending}
                    onClick={() =>
                      resolutionMutation.mutate({
                        errorId: errorLog.id,
                        isResolved: !errorLog.is_resolved
                      })
                    }
                  >
                    {errorLog.is_resolved ? 'Reabrir' : 'Marcar corregido'}
                  </Button>
                </div>

                <div className="mt-2.5 grid gap-2 md:grid-cols-3">
                  <InfoBlock title="Usuario afectado">
                    <p className="truncate">{formatUserLabel(errorLog.affected_user)}</p>
                    <p className="truncate">{formatUserDetail(errorLog.affected_user)}</p>
                    <p className="truncate">ID: {formatValue(errorLog.user_id)}</p>
                  </InfoBlock>
                  <InfoBlock title="Contexto">
                    <p className="truncate">Ruta: {formatValue(errorLog.route)}</p>
                    <p className="truncate">Origen: {errorLog.source}</p>
                    <p className="truncate">Código: {formatValue(errorLog.error_code)}</p>
                  </InfoBlock>
                  <InfoBlock title="Seguimiento">
                    <p>Corregido: {errorLog.resolved_at ? new Date(errorLog.resolved_at).toLocaleDateString('es-DO') : 'Pendiente'}</p>
                    <p className="truncate">Resuelto por: {formatUserLabel(errorLog.resolved_by_user)}</p>
                  </InfoBlock>
                </div>

                <div className="mt-2.5">
                  <AdminMetaDetails>
                    <pre className="whitespace-pre-wrap break-words">{JSON.stringify(errorLog.metadata, null, 2)}</pre>
                  </AdminMetaDetails>
                </div>
              </div>
            ))}

            <div ref={sentinelRef} aria-hidden className="h-px w-full" />
            {isFetchingNextPage ? (
              <div className="flex items-center justify-center gap-2 py-3 text-[0.78rem] text-(--app-text-subtle)">
                <Spinner size="sm" /> Cargando más errores…
              </div>
            ) : !hasNextPage ? (
              <p className="py-3 text-center text-[0.74rem] text-(--app-text-subtle)">
                {totalCount} {totalCount === 1 ? 'error' : 'errores'} · no hay más
              </p>
            ) : null}
          </div>
        )}
      </div>
    </AdminPage>
  )
}

function InfoBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-control bg-(--app-surface-muted) px-3 py-2 text-[0.76rem] text-(--app-text-muted)">
      <p className="text-[0.68rem] font-bold uppercase tracking-[0.06em] text-(--app-text-subtle)">{title}</p>
      <div className="mt-1 space-y-0.5">{children}</div>
    </div>
  )
}
