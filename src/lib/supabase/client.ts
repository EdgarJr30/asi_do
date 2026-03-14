import { createClient } from '@supabase/supabase-js'

import { env, getSupabaseConfig } from '@/shared/config/env'

const supabaseConfig = getSupabaseConfig()

export const supabase = supabaseConfig
  ? createClient(supabaseConfig.supabaseUrl, supabaseConfig.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true
      },
      global: {
        headers: {
          'x-application-name': env.appName
        }
      }
    })
  : null
