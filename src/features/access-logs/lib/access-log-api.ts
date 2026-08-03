import { toControlledError } from '@/lib/errors/error-utils'
import { supabase } from '@/lib/supabase/client'

export type AccessLogRange = 'all' | 'day' | 'week' | 'month'

export interface UserAccessLogRecord {
  id: string
  user_id: string
  auth_session_id: string
  email: string | null
  full_name: string
  display_name: string
  last_sign_in_at: string | null
  signed_in_at: string
  last_seen_at: string
  ip_address: string | null
  user_agent: string | null
  authentication_method: string | null
  client_timezone: string | null
  client_language: string | null
  is_latest_for_user: boolean
}

export interface UserAccessLogStats {
  total_accesses: number
  users_with_access: number
  accesses_last_24_hours: number
  unique_ip_count: number
}

export interface UserAccessLogPage {
  limit: number
  offset: number
  total_count: number
  loaded_count: number
  next_offset: number | null
}

export interface UserAccessLogSnapshot {
  /**
   * Solo viene en la primera página (`offset = 0`). En las siguientes llega
   * `null` para no recalcular las métricas globales en cada scroll: la vista
   * conserva las de `pages[0]`.
   */
  stats: UserAccessLogStats | null
  page: UserAccessLogPage
  rows: UserAccessLogRecord[]
}

export interface AccessDeviceSummary {
  browser: string
  operatingSystem: string
  deviceType: 'Computadora' | 'Móvil' | 'Tableta' | 'Desconocido'
}

function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase no está configurado. Completa VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.')
  }

  return supabase
}

function rangeStart(range: AccessLogRange) {
  if (range === 'all') {
    return null
  }

  const milliseconds = {
    day: 24 * 60 * 60 * 1000,
    week: 7 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000
  }[range]

  return new Date(Date.now() - milliseconds).toISOString()
}

export async function fetchUserAccessLogPage(input: {
  query?: string
  range?: AccessLogRange
  limit?: number
  offset?: number
}) {
  const client = requireSupabase()
  const response = await client.rpc('admin_user_access_log_page' as never, {
    p_query: input.query?.trim() || null,
    p_since: rangeStart(input.range ?? 'all'),
    p_limit: input.limit ?? 30,
    p_offset: input.offset ?? 0
  } as never)

  if (response.error) {
    throw toControlledError(response.error)
  }

  return response.data as unknown as UserAccessLogSnapshot
}

export async function enrichCurrentAccessLog() {
  const client = requireSupabase()
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || null
  const language = typeof navigator === 'undefined' ? null : navigator.language || null
  const response = await client.rpc('enrich_current_access_log' as never, {
    p_timezone: timezone,
    p_language: language
  } as never)

  if (response.error) {
    throw toControlledError(response.error)
  }
}

export function parseAccessDevice(userAgent: string | null): AccessDeviceSummary {
  if (!userAgent) {
    return {
      browser: 'No disponible',
      operatingSystem: 'No disponible',
      deviceType: 'Desconocido'
    }
  }

  const browser =
    /Edg\//.test(userAgent)
      ? 'Microsoft Edge'
      : /OPR\/|Opera\//.test(userAgent)
        ? 'Opera'
        : /CriOS\/|Chrome\//.test(userAgent)
          ? 'Google Chrome'
          : /FxiOS\/|Firefox\//.test(userAgent)
            ? 'Mozilla Firefox'
            : /Safari\//.test(userAgent)
              ? 'Safari'
              : 'Otro navegador'

  const operatingSystem =
    /iPhone|iPad|iPod/.test(userAgent)
      ? 'iOS / iPadOS'
      : /Android/.test(userAgent)
        ? 'Android'
        : /Windows NT/.test(userAgent)
          ? 'Windows'
          : /Mac OS X|Macintosh/.test(userAgent)
            ? 'macOS'
            : /CrOS/.test(userAgent)
              ? 'ChromeOS'
              : /Linux/.test(userAgent)
                ? 'Linux'
                : 'Otro sistema'

  const deviceType =
    /iPad|Tablet|PlayBook|Silk/.test(userAgent) || (/Android/.test(userAgent) && !/Mobile/.test(userAgent))
      ? 'Tableta'
      : /Mobi|iPhone|iPod|Android/.test(userAgent)
        ? 'Móvil'
        : /Windows NT|Mac OS X|Macintosh|CrOS|Linux/.test(userAgent)
          ? 'Computadora'
          : 'Desconocido'

  return { browser, operatingSystem, deviceType }
}
