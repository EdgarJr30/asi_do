/** Carga y valida la configuración del servicio desde variables de entorno (12-factor). */

function required(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Falta la variable de entorno requerida: ${name}`)
  }
  return value
}

function optional(name: string, fallback = ''): string {
  return process.env[name]?.trim() || fallback
}

export interface AppConfig {
  port: number
  /** Origin principal de la SPA permitido para CORS en /payments/azul/create. */
  allowedOrigin: string
  /** Lista completa de origins permitidos para CORS. */
  allowedOrigins: string[]
  /** URL pública de este servicio (base de Approved/Declined/CancelUrl). */
  servicePublicUrl: string
  /** URL pública de la SPA (destino del redirect tras el pago). */
  appUrl: string

  supabaseUrl: string
  supabaseAnonKey: string
  supabaseServiceRoleKey: string

  azul: {
    merchantId: string
    merchantName: string
    merchantType: string
    authKey: string
    paymentUrl: string
    paymentAltUrl: string
    environment: 'test' | 'production'
    currencyCode: string
    /** Si AZUL muestra su pantalla de resultado ("Finish"/"Download"). Por defecto true para evitar retorno inmediato. */
    showTransactionResult: boolean
    /** Webservice de consulta de transacción (conciliación). Opcional hasta tener credenciales. */
    verifyApiUrl: string
    verifyApiKey: string
  }

  reconcile: {
    cron: string
    /** Antigüedad mínima (min) de un pago 'initiated' para conciliar. */
    staleMinutes: number
    enabled: boolean
  }
}

export function loadConfig(): AppConfig {
  const environment = (optional('AZUL_ENVIRONMENT', 'test') === 'production' ? 'production' : 'test') as
    | 'test'
    | 'production'
  const allowedOrigins = required('ALLOWED_ORIGIN')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean)

  return {
    port: Number(optional('PORT', '8080')),
    allowedOrigin: allowedOrigins[0],
    allowedOrigins,
    servicePublicUrl: required('SERVICE_PUBLIC_URL').replace(/\/+$/, ''),
    appUrl: required('APP_URL').replace(/\/+$/, ''),

    supabaseUrl: required('SUPABASE_URL').replace(/\/+$/, ''),
    supabaseAnonKey: required('SUPABASE_ANON_KEY'),
    supabaseServiceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),

    azul: {
      merchantId: required('AZUL_MERCHANT_ID'),
      merchantName: optional('AZUL_MERCHANT_NAME', 'ASI Rep. Dominicana'),
      merchantType: optional('AZUL_MERCHANT_TYPE', 'ECommerce'),
      authKey: required('AZUL_AUTH_KEY'),
      paymentUrl: required('AZUL_PAYMENT_URL'),
      paymentAltUrl: optional('AZUL_PAYMENT_ALT_URL'),
      environment,
      currencyCode: optional('AZUL_CURRENCY_CODE', '$'),
      showTransactionResult: optional('AZUL_SHOW_TRANSACTION_RESULT', '1') === '1',
      verifyApiUrl: optional('AZUL_VERIFY_API_URL'),
      verifyApiKey: optional('AZUL_VERIFY_API_KEY')
    },

    reconcile: {
      cron: optional('RECONCILE_CRON', '*/5 * * * *'),
      staleMinutes: Number(optional('RECONCILE_STALE_MINUTES', '15')),
      enabled: optional('RECONCILE_ENABLED', 'true') !== 'false'
    }
  }
}
