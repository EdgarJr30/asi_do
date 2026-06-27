function readEnvValue(...candidates: Array<string | undefined>) {
  for (const candidate of candidates) {
    const normalized = candidate?.trim()

    if (normalized) {
      return normalized
    }
  }

  return undefined
}

function readProcessEnv(key: string) {
  if (typeof process === 'undefined') {
    return undefined
  }

  return process.env[key]
}

export const env = {
  appName: readEnvValue(import.meta.env.VITE_APP_NAME, readProcessEnv('VITE_APP_NAME')) || 'ASI Rep. Dominicana',
  authSiteUrl: readEnvValue(
    import.meta.env.VITE_AUTH_SITE_URL,
    readProcessEnv('VITE_AUTH_SITE_URL'),
    readProcessEnv('APP_URL')
  ),
  supabaseUrl: readEnvValue(import.meta.env.VITE_SUPABASE_URL, readProcessEnv('VITE_SUPABASE_URL')),
  supabaseAnonKey: readEnvValue(import.meta.env.VITE_SUPABASE_ANON_KEY, readProcessEnv('VITE_SUPABASE_ANON_KEY')),
  webPushPublicKey: readEnvValue(import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY, readProcessEnv('VITE_WEB_PUSH_PUBLIC_KEY')),
  azulPaymentsUrl: readEnvValue(import.meta.env.VITE_AZUL_PAYMENTS_URL, readProcessEnv('VITE_AZUL_PAYMENTS_URL')),
  mode: readEnvValue(import.meta.env.MODE, readProcessEnv('MODE'))
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

/** URL pública de un objeto en un bucket público de Supabase Storage. */
export function publicStorageUrl(bucket: string, path: string): string {
  const base = env.supabaseUrl?.replace(/\/$/, '') ?? ''
  const cleanPath = path.replace(/^\//, '')
  return `${base}/storage/v1/object/public/${bucket}/${cleanPath}`
}
