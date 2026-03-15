export const env = {
  appName: import.meta.env.VITE_APP_NAME?.trim() || 'Talent Marketplace SaaS',
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL?.trim(),
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY?.trim(),
  webPushPublicKey: import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY?.trim(),
  mode: import.meta.env.MODE
}

export function getSupabaseConfig(): { supabaseUrl: string; supabaseAnonKey: string } | null {
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    return null
  }

  return {
    supabaseUrl: env.supabaseUrl,
    supabaseAnonKey: env.supabaseAnonKey
  }
}

export function isSupabaseConfigured() {
  return getSupabaseConfig() !== null
}
