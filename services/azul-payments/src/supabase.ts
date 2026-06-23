import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import type { AppConfig } from './config.ts'

/**
 * Cliente con service_role (omite RLS). Úsalo solo para operaciones de sistema:
 * el callback de AZUL y el cron de conciliación.
 */
export function serviceClient(config: AppConfig): SupabaseClient {
  return createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  })
}

/**
 * Cliente con el JWT del usuario final (respeta RLS y `auth.uid()`). Úsalo para
 * operaciones iniciadas por el miembro, como `azul_begin_membership_payment`.
 */
export function userClient(config: AppConfig, accessToken: string): SupabaseClient {
  return createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } }
  })
}
