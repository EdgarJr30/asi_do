import { afterEach, describe, expect, it, vi } from 'vitest'

import { loadConfig } from '../src/config.ts'

function stubRequiredEnvironment(): void {
  vi.stubEnv('ALLOWED_ORIGIN', 'https://asidominicana.do')
  vi.stubEnv('SERVICE_PUBLIC_URL', 'https://pagos.example.com')
  vi.stubEnv('APP_URL', 'https://asidominicana.do')
  vi.stubEnv('SUPABASE_URL', 'https://production.supabase.co')
  vi.stubEnv('AZUL_MERCHANT_ID', 'merchant-production')
  vi.stubEnv('AZUL_AUTH_KEY', 'azul-production-secret')
  vi.stubEnv('AZUL_PAYMENT_URL', 'https://payments.example.com')
}

describe('configuración Supabase del servicio AZUL', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('usa exclusivamente los nombres publishable y secret actuales', () => {
    stubRequiredEnvironment()
    vi.stubEnv('SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_production')
    vi.stubEnv('SUPABASE_SECRET_KEY', 'sb_secret_production')
    vi.stubEnv('SUPABASE_ANON_KEY', 'legacy-anon')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'legacy-service-role')

    const config = loadConfig()

    expect(config.supabasePublishableKey).toBe('sb_publishable_production')
    expect(config.supabaseSecretKey).toBe('sb_secret_production')
    expect(config).not.toHaveProperty('supabaseAnonKey')
    expect(config).not.toHaveProperty('supabaseServiceRoleKey')
  })

  it('rechaza los nombres heredados como fallback', () => {
    stubRequiredEnvironment()
    vi.stubEnv('SUPABASE_ANON_KEY', 'legacy-anon')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'legacy-service-role')

    expect(() => loadConfig()).toThrow('SUPABASE_PUBLISHABLE_KEY')
  })
})
