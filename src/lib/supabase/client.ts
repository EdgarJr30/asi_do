import { createClient } from '@supabase/supabase-js'

import { env, getSupabaseConfig } from '@/shared/config/env'
import type { Database } from '@/shared/types/database'

const supabaseConfig = getSupabaseConfig()

export const supabase = supabaseConfig
  ? createClient<Database>(supabaseConfig.supabaseUrl, supabaseConfig.supabaseAnonKey, {
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
