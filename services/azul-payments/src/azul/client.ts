import type { AppConfig } from '../config.ts'
import {
  buildRequestAuthHash,
  toAzulAmount,
  type AzulRequestHashFields
} from './hash.ts'

/** Resultado de un RPC `azul_begin_*` que necesita el form de AZUL. */
export interface BeginPaymentRecord {
  payment_id: string
  donation_id?: string
  order_number: string
  amount: number
  currency: string
  category_label: string | null
  label?: string | null
}

export interface AzulFormPayload {
  /** URL del endpoint POST de la Página de Pago (principal). */
  paymentUrl: string
  /** URL alterna (contingencia) para reintentar si la principal falla. */
  paymentAltUrl: string
  /** Campos hidden que el browser debe enviar por POST a AZUL (incluye AuthHash). */
  fields: Record<string, string>
}

/** Construye la base de las Approved/Declined/CancelUrl que apuntan al callback de este servicio. */
function callbackUrl(config: AppConfig, outcome: 'approved' | 'declined' | 'cancelled', orderNumber: string): string {
  const params = new URLSearchParams({ outcome, order: orderNumber })
  return `${config.servicePublicUrl}/payments/azul/callback?${params.toString()}`
}

/**
 * Arma el payload del formulario de venta (Sale) para la Página de Pago de AZUL,
 * incluyendo el AuthHash firmado server-side. El ITBIS va en '000' (cuotas exentas).
 */
export function buildSaleForm(config: AppConfig, record: BeginPaymentRecord): AzulFormPayload {
  const hashFields: AzulRequestHashFields = {
    MerchantId: config.azul.merchantId,
    MerchantName: config.azul.merchantName,
    MerchantType: config.azul.merchantType,
    CurrencyCode: config.azul.currencyCode,
    OrderNumber: record.order_number,
    Amount: toAzulAmount(record.amount),
    ITBIS: '000',
    ApprovedUrl: callbackUrl(config, 'approved', record.order_number),
    DeclinedUrl: callbackUrl(config, 'declined', record.order_number),
    CancelUrl: callbackUrl(config, 'cancelled', record.order_number),
    UseCustomField1: '0',
    CustomField1Label: '',
    CustomField1Value: '',
    UseCustomField2: '0',
    CustomField2Label: '',
    CustomField2Value: ''
  }

  const authHash = buildRequestAuthHash(hashFields, config.azul.authKey)

  const fields: Record<string, string> = {
    ...hashFields,
    TrxType: 'Sale',
    // 0 = AZUL NO muestra su pantalla de resultado ("Finish"/"Download") y redirige
    // automáticamente a Approved/DeclinedUrl. No entra en el AuthHash.
    ShowTransactionResult: config.azul.showTransactionResult ? '1' : '0',
    Locale: 'ES',
    AuthHash: authHash
  }

  return {
    paymentUrl: config.azul.paymentUrl,
    paymentAltUrl: config.azul.paymentAltUrl,
    fields
  }
}
