import { supabase } from '@/lib/supabase/client'
import type { Tables } from '@/shared/types/database'

function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase no esta configurado. Completa VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.')
  }

  return supabase
}

export async function listAppErrorLogs(limit = 50) {
  const client = requireSupabase()
  const response = await client.from('app_error_logs').select('*').order('created_at', { ascending: false }).limit(limit)

  if (response.error) {
    throw response.error
  }

  return response.data satisfies Tables<'app_error_logs'>[]
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
