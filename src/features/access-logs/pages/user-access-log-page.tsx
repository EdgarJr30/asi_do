import { useDeferredValue, useMemo, useState } from 'react'

import { useInfiniteQuery } from '@tanstack/react-query'
import { Clock3, Globe2, MonitorSmartphone, Search, ShieldCheck } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  fetchUserAccessLogPage,
  parseAccessDevice,
  type AccessLogRange
} from '@/features/access-logs/lib/access-log-api'
import { useInfiniteScroll } from '@/shared/ui/use-infinite-scroll'

const ACCESS_LOG_QUERY_KEY = ['admin', 'user-access-logs'] as const
const ACCESS_LOG_PAGE_SIZE = 24

function formatDateTime(value: string | null) {
  if (!value) {
    return 'No disponible'
  }

  return new Intl.DateTimeFormat('es-DO', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value))
}

function formatUserName(values: { display_name: string; full_name: string; email: string | null }) {
  return values.display_name || values.full_name || values.email || 'Usuario sin nombre'
}

export function UserAccessLogPage() {
  const [query, setQuery] = useState('')
  const [range, setRange] = useState<AccessLogRange>('month')
  const deferredQuery = useDeferredValue(query.trim())

  const accessLogsQuery = useInfiniteQuery({
    queryKey: [...ACCESS_LOG_QUERY_KEY, deferredQuery, range],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      fetchUserAccessLogPage({
        query: deferredQuery,
        range,
        limit: ACCESS_LOG_PAGE_SIZE,
        offset: pageParam
      }),
    getNextPageParam: (lastPage) => lastPage.page.next_offset
  })

  const { fetchNextPage, hasNextPage, isFetchingNextPage } = accessLogsQuery
  const pages = useMemo(() => accessLogsQuery.data?.pages ?? [], [accessLogsQuery.data])
  const accessLogs = useMemo(() => pages.flatMap((page) => page.rows), [pages])
  const stats = pages[0]?.stats
  const totalCount = pages[0]?.page.total_count ?? 0

  const sentinelRef = useInfiniteScroll({
    hasNextPage: Boolean(hasNextPage),
    isFetchingNextPage,
    onLoadMore: () => void fetchNextPage(),
    deps: [accessLogs.length]
  })

  return (
    <AdminPage
      eyebrow="Admin · Seguridad"
      title="Registro de accesos"
      description="Consulta los inicios de sesión de los usuarios, su IP y el contexto técnico del dispositivo. La ubicación es aproximada y nunca corresponde a GPS."
      actions={
        <Button
          className="h-9 rounded-control"
          variant="outline"
          onClick={() => void accessLogsQuery.refetch()}
        >
          Refrescar
        </Button>
      }
    >
      <div className="space-y-4">
        <AdminStatBar columns={4}>
          <AdminStat
            label="Accesos registrados"
            value={stats?.total_accesses ?? '—'}
            helper="Historial retenido hasta 180 días."
            tone="blue"
          />
          <AdminStat
            label="Últimas 24 horas"
            value={stats?.accesses_last_24_hours ?? '—'}
            helper="Sesiones nuevas en el último día."
            tone="green"
          />
          <AdminStat
            label="Usuarios"
            value={stats?.users_with_access ?? '—'}
            helper="Usuarios con al menos un acceso."
            tone="teal"
          />
          <AdminStat
            label="IP distintas"
            value={stats?.unique_ip_count ?? '—'}
            helper="No equivale a personas o ubicaciones."
            tone="violet"
          />
        </AdminStatBar>

        <AdminCard>
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <label className="relative block">
              <span className="sr-only">Buscar por usuario, correo o IP</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-(--app-text-subtle)" />
              <Input
                className="h-10 rounded-control pl-9"
                placeholder="Buscar por nombre, correo o IP…"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <AdminTabs
              value={range}
              onChange={setRange}
              tabs={[
                { value: 'day', label: '24 horas' },
                { value: 'week', label: '7 días' },
                { value: 'month', label: '30 días' },
                { value: 'all', label: 'Todo' }
              ]}
            />
          </div>
          <div className="mt-3 flex items-start gap-2 rounded-control border border-primary-200 bg-primary-50 px-3 py-2 text-[0.75rem] leading-5 text-primary-800 dark:border-primary-500/25 dark:bg-primary-500/10 dark:text-primary-100">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" />
            <p>
              Información restringida para seguridad y soporte. Cada consulta de este módulo queda auditada y los
              registros se eliminan automáticamente al cumplir 180 días.
            </p>
          </div>
        </AdminCard>

        {accessLogsQuery.isLoading ? (
          <PageLoader
            inline
            label="Cargando accesos registrados"
            hint="Recuperando el historial de autenticación"
          />
        ) : accessLogsQuery.isError ? (
          <AdminCard>
            <div className="py-5 text-center">
              <p className="text-sm font-bold text-(--app-text)">No pudimos cargar el registro de accesos.</p>
              <p className="mt-1 text-sm text-(--app-text-muted)">
                Verifica tu permiso de auditoría o vuelve a intentarlo.
              </p>
              <Button className="mt-3 h-9 rounded-control" onClick={() => void accessLogsQuery.refetch()}>
                Reintentar
              </Button>
            </div>
          </AdminCard>
        ) : accessLogs.length === 0 ? (
          <AdminCard>
            <div className="py-6 text-center">
              <ShieldCheck className="mx-auto size-7 text-(--app-text-subtle)" />
              <p className="mt-2 text-sm font-bold text-(--app-text)">No hay accesos para estos filtros.</p>
              <p className="mt-1 text-sm text-(--app-text-muted)">
                Prueba otro período o modifica la búsqueda.
              </p>
            </div>
          </AdminCard>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3 px-0.5">
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-(--app-text-subtle)">
                {totalCount} resultado{totalCount === 1 ? '' : 's'}
              </p>
              {deferredQuery !== query.trim() ? (
                <span className="text-xs text-(--app-text-muted)">Actualizando búsqueda…</span>
              ) : null}
            </div>

            {accessLogs.map((accessLog) => {
              const device = parseAccessDevice(accessLog.user_agent)

              return (
                <article
                  key={accessLog.id}
                  className="rounded-card border border-(--app-border) bg-(--app-surface-elevated) px-3.5 py-3 shadow-[0_1px_2px_rgba(20,40,90,0.04)]"
                >
                  <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {accessLog.is_latest_for_user ? (
                          <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/12 dark:text-emerald-200">
                            Último acceso
                          </Badge>
                        ) : (
                          <Badge variant="outline">Acceso anterior</Badge>
                        )}
                        <span className="text-[0.72rem] text-(--app-text-subtle)">
                          {formatDateTime(accessLog.signed_in_at)}
                        </span>
                      </div>
                      <h2 className="mt-1.5 truncate text-[0.9rem] font-bold text-(--app-text)">
                        {formatUserName(accessLog)}
                      </h2>
                      <p className="truncate text-[0.78rem] text-(--app-text-muted)">
                        {accessLog.email || accessLog.user_id}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5 text-[0.75rem] text-(--app-text-muted)">
                      <Clock3 className="size-3.5" />
                      Última actividad: {formatDateTime(accessLog.last_seen_at)}
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2 md:grid-cols-3">
                    <div className="rounded-control bg-(--app-surface-muted) px-3 py-2.5">
                      <p className="flex items-center gap-1.5 text-[0.64rem] font-bold uppercase tracking-[0.08em] text-(--app-text-subtle)">
                        <Globe2 className="size-3.5" />
                        Red y zona aproximada
                      </p>
                      <p className="mt-1 truncate text-[0.8rem] font-bold text-(--app-text)">
                        {accessLog.ip_address || 'IP no disponible'}
                      </p>
                      <p className="mt-0.5 truncate text-[0.72rem] text-(--app-text-muted)">
                        {accessLog.client_timezone || 'Zona horaria no informada'}
                      </p>
                    </div>

                    <div className="rounded-control bg-(--app-surface-muted) px-3 py-2.5">
                      <p className="flex items-center gap-1.5 text-[0.64rem] font-bold uppercase tracking-[0.08em] text-(--app-text-subtle)">
                        <MonitorSmartphone className="size-3.5" />
                        Dispositivo
                      </p>
                      <p className="mt-1 truncate text-[0.8rem] font-bold text-(--app-text)">
                        {device.deviceType} · {device.operatingSystem}
                      </p>
                      <p className="mt-0.5 truncate text-[0.72rem] text-(--app-text-muted)">
                        {device.browser}
                      </p>
                    </div>

                    <div className="rounded-control bg-(--app-surface-muted) px-3 py-2.5">
                      <p className="text-[0.64rem] font-bold uppercase tracking-[0.08em] text-(--app-text-subtle)">
                        Contexto
                      </p>
                      <p className="mt-1 truncate text-[0.8rem] font-bold text-(--app-text)">
                        Idioma: {accessLog.client_language || 'No informado'}
                      </p>
                      <p className="mt-0.5 truncate text-[0.72rem] text-(--app-text-muted)">
                        Método: {accessLog.authentication_method || 'No disponible'}
                      </p>
                    </div>
                  </div>

                  <AdminMetaDetails title="Ver identificadores y user-agent">
                    <dl className="grid gap-2 sm:grid-cols-2">
                      <div>
                        <dt className="font-bold text-(--app-text)">Usuario</dt>
                        <dd className="break-all">{accessLog.user_id}</dd>
                      </div>
                      <div>
                        <dt className="font-bold text-(--app-text)">Registro</dt>
                        <dd className="break-all">{accessLog.id}</dd>
                      </div>
                      <div>
                        <dt className="font-bold text-(--app-text)">Sesión de autenticación</dt>
                        <dd className="break-all">{accessLog.auth_session_id}</dd>
                      </div>
                      <div>
                        <dt className="font-bold text-(--app-text)">Último login de cuenta</dt>
                        <dd>{formatDateTime(accessLog.last_sign_in_at)}</dd>
                      </div>
                      <div className="sm:col-span-2">
                        <dt className="font-bold text-(--app-text)">User-agent</dt>
                        <dd className="break-all">{accessLog.user_agent || 'No disponible'}</dd>
                      </div>
                    </dl>
                  </AdminMetaDetails>
                </article>
              )
            })}

            <div ref={sentinelRef} className="flex min-h-10 items-center justify-center py-2">
              {isFetchingNextPage ? (
                <span className="inline-flex items-center gap-2 text-sm text-(--app-text-muted)">
                  <Spinner className="size-4" />
                  Cargando más accesos…
                </span>
              ) : hasNextPage ? (
                <span className="text-xs text-(--app-text-subtle)">Desplázate para cargar más</span>
              ) : (
                <span className="text-xs text-(--app-text-subtle)">Fin del historial disponible</span>
              )}
            </div>
          </div>
        )}
      </div>
    </AdminPage>
  )
}
