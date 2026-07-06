import { supabase } from '@/lib/supabase/client'
import type { Tables } from '@/shared/types/database'

type ErrorLogUser = Pick<Tables<'users'>, 'id' | 'email' | 'display_name' | 'full_name'>

export interface AppErrorLogRecord extends Tables<'app_error_logs'> {
  affected_user: ErrorLogUser | null
  resolved_by_user: ErrorLogUser | null
}

function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase no esta configurado. Completa VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.')
  }

  return supabase
}

export type AppErrorLogFilter = 'open' | 'resolved' | 'all'

export interface AppErrorLogPage {
  rows: AppErrorLogRecord[]
  totalCount: number
  nextOffset: number | null
}

/**
 * Paginación real de servidor para la bandeja de errores: usa `range` + count
 * exacto de PostgREST para alimentar el scroll infinito, filtrando por estado en
 * el backend en lugar de traer todo y filtrar en cliente.
 */
export async function listAppErrorLogsPage(params: {
  filter: AppErrorLogFilter
  limit: number
  offset: number
}): Promise<AppErrorLogPage> {
  const client = requireSupabase()
  let query = client
    .from('app_error_logs')
    .select(
      `
        *,
        affected_user:users!app_error_logs_user_id_fkey (
          id,
          email,
          display_name,
          full_name
        ),
        resolved_by_user:users!app_error_logs_resolved_by_user_id_fkey (
          id,
          email,
          display_name,
          full_name
        )
      `,
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .range(params.offset, params.offset + params.limit - 1)

  if (params.filter === 'open') {
    query = query.eq('is_resolved', false)
  } else if (params.filter === 'resolved') {
    query = query.eq('is_resolved', true)
  }

  const response = await query

  if (response.error) {
    throw response.error
  }

  const rows = (response.data ?? []) as AppErrorLogRecord[]
  const totalCount = response.count ?? rows.length
  const loadedCount = params.offset + rows.length

  return {
    rows,
    totalCount,
    nextOffset: loadedCount < totalCount ? loadedCount : null
  }
}

/** Conteo exacto por estado para las tarjetas de resumen, sin traer filas. */
export async function countAppErrorLogs(filter: 'open' | 'resolved'): Promise<number> {
  const client = requireSupabase()
  const response = await client
    .from('app_error_logs')
    .select('id', { count: 'exact', head: true })
    .eq('is_resolved', filter === 'resolved')

  if (response.error) {
    throw response.error
  }

  return response.count ?? 0
}

export async function listAppErrorLogs(limit = 50) {
  const client = requireSupabase()
  const response = await client
    .from('app_error_logs')
    .select(
      `
        *,
        affected_user:users!app_error_logs_user_id_fkey (
          id,
          email,
          display_name,
          full_name
        ),
        resolved_by_user:users!app_error_logs_resolved_by_user_id_fkey (
          id,
          email,
          display_name,
          full_name
        )
      `
    )
    .order('created_at', { ascending: false })
    .limit(limit)

  if (response.error) {
    throw response.error
  }

  return (response.data ?? []) as AppErrorLogRecord[]
}

export async function updateAppErrorResolution(values: {
  errorId: string
  isResolved: boolean
  resolvedByUserId: string
}) {
  const client = requireSupabase()
  const response = await client
    .from('app_error_logs')
    .update({
      is_resolved: values.isResolved,
      resolved_at: values.isResolved ? new Date().toISOString() : null,
      resolved_by_user_id: values.isResolved ? values.resolvedByUserId : null
    })
    .eq('id', values.errorId)
    .select('*')
    .single()

  if (response.error) {
    throw response.error
  }

  return response.data satisfies Tables<'app_error_logs'>
}
