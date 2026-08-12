import type { AppConfig } from '../src/config.ts'
import type { SettlementDatabase } from '../src/azul/settle.ts'
import { buildResponseAuthHash, type AzulResponseHashFields } from '../src/azul/hash.ts'

/** Configuración de pruebas: mismos valores para todos los archivos del servicio. */
export const testConfig: AppConfig = {
  port: 0,
  allowedOrigin: 'https://asidominicana.do',
  allowedOrigins: ['https://asidominicana.do', 'http://localhost:5173'],
  servicePublicUrl: 'https://svc.example.com',
  appUrl: 'https://asidominicana.do',
  supabaseUrl: 'https://example.supabase.co',
  supabasePublishableKey: 'sb_publishable_test',
  supabaseSecretKey: 'sb_secret_test',
  azul: {
    merchantId: '39038540035',
    merchantName: 'ASI Rep. Dominicana',
    merchantType: 'ECommerce',
    authKey: 'test-auth-key-xyz',
    paymentUrl: 'https://pruebas.azul.com.do/PaymentPage/',
    paymentAltUrl: '',
    environment: 'test',
    currencyCode: '$',
    showTransactionResult: false,
    verifyApiUrl: '',
    verifyApiKey: ''
  },
  reconcile: { cron: '*/5 * * * *', staleMinutes: 15, enabled: false }
}

export interface RpcCall {
  fn: string
  params: Record<string, unknown>
}

export interface SettlementDouble {
  /** Se pasa a `buildApp`/`settle*ViaRpc` sin cast: `tsc` obliga a que no se aleje del cliente real. */
  db: SettlementDatabase
  /** Todo lo que se *habría* escrito en la base, en orden. */
  calls: RpcCall[]
  /** Qué responde el próximo `rpc`. Por defecto, liquidación verificada. */
  respond: (call: RpcCall) => { data?: unknown; error?: unknown }
}

/**
 * Doble de la base de liquidación: registra cada RPC en vez de ejecutarla.
 * Es lo que permite aseverar el camino feliz —a qué orden y con qué respuesta de
 * AZUL se liquida— sin escribir en el proyecto de verdad.
 */
export function createSettlementDouble(): SettlementDouble {
  const calls: RpcCall[] = []
  const double: SettlementDouble = {
    calls,
    respond: () => ({ data: [{ status: 'verified', member_user_id: null, application_id: null }] }),
    db: {
      rpc(fn, params) {
        const call = { fn, params }
        calls.push(call)
        const result = double.respond(call)
        return Promise.resolve({ data: result.data ?? null, error: result.error ?? null })
      }
    }
  }
  return double
}

export type AzulCallbackFields = Partial<AzulResponseHashFields> & Record<string, string>

const RESPONSE_DEFAULTS: AzulResponseHashFields = {
  OrderNumber: 'ASI-260809-abc123',
  Amount: '250000',
  AuthorizationCode: 'OK4321',
  DateTime: '20260809181500',
  ResponseCode: 'Approved',
  IsoCode: '00',
  ResponseMessage: 'APROBADA',
  ErrorDescription: '',
  RRN: '260809000123'
}

/**
 * Construye la URL del callback tal como la emite AZUL: los campos firmados más el
 * `AuthHash` calculado sobre ellos (UTF-16LE). `tamper` se aplica **después** de
 * firmar, para simular manipulación en el navegador.
 */
export function signedCallbackUrl(
  fields: Partial<AzulResponseHashFields> = {},
  options: { authKey?: string; extra?: Record<string, string>; tamper?: Record<string, string> } = {}
): string {
  const signed: AzulResponseHashFields = { ...RESPONSE_DEFAULTS, ...fields }
  const authHash = buildResponseAuthHash(signed, options.authKey ?? testConfig.azul.authKey)

  const params = new URLSearchParams({
    ...signed,
    ...(options.extra ?? {}),
    ...(options.tamper ?? {}),
    AuthHash: authHash
  })

  return `/payments/azul/callback?${params.toString()}`
}
