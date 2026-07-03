import type { SupabaseClient } from '@supabase/supabase-js'

import {
  buildResponseAuthHash,
  safeHashEqual,
  type AzulResponseHashFields
} from './hash.ts'

/** Campos de respuesta de AZUL, normalizados desde el querystring del redirect. */
export interface AzulResponse extends AzulResponseHashFields {
  ITBIS: string
  AuthHash: string
  CustomOrderId: string
  CardNumber: string
  DataVaultTokenPresent: boolean
  DataVaultBrand: string
  AzulOrderId: string
}

/** Lee un valor del querystring tolerando variaciones de capitalización. */
function pick(source: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === 'string') {
      return value
    }
    if (Array.isArray(value) && typeof value[0] === 'string') {
      return value[0]
    }
  }
  return ''
}

function maskCardNumber(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) {
    return ''
  }
  if (trimmed.includes('*') || trimmed.includes('...')) {
    return trimmed
  }

  const digits = trimmed.replace(/\D/g, '')
  if (digits.length < 8) {
    return ''
  }
  return `${digits.slice(0, 6)}****${digits.slice(-4)}`
}

/** Normaliza el querystring del redirect de AZUL a un objeto de respuesta tipado. */
export function parseAzulResponse(query: Record<string, unknown>): AzulResponse {
  const dataVaultToken = pick(query, 'DataVaultToken', 'dataVaultToken')
  return {
    OrderNumber: pick(query, 'OrderNumber', 'orderNumber'),
    Amount: pick(query, 'Amount', 'amount'),
    ITBIS: pick(query, 'ITBIS', 'Itbis', 'itbis'),
    AuthorizationCode: pick(query, 'AuthorizationCode', 'authorizationCode'),
    DateTime: pick(query, 'DateTime', 'dateTime'),
    ResponseCode: pick(query, 'ResponseCode', 'responseCode'),
    IsoCode: pick(query, 'IsoCode', 'ISOCode', 'isoCode'),
    ResponseMessage: pick(query, 'ResponseMessage', 'responseMessage'),
    ErrorDescription: pick(query, 'ErrorDescription', 'errorDescription'),
    RRN: pick(query, 'RRN', 'Rrn', 'rrn'),
    AuthHash: pick(query, 'AuthHash', 'authHash'),
    CustomOrderId: pick(query, 'CustomOrderId', 'customOrderId'),
    CardNumber: maskCardNumber(pick(query, 'CardNumber', 'cardNumber')),
    DataVaultTokenPresent: !!dataVaultToken,
    DataVaultBrand: pick(query, 'DataVaultBrand', 'dataVaultBrand'),
    AzulOrderId: pick(query, 'AzulOrderId', 'azulOrderId')
  }
}

/** Verifica que el AuthHash recibido coincida con el calculado (UTF-16LE) usando la AuthKey. */
export function verifyResponseAuthHash(response: AzulResponse, authKey: string): boolean {
  if (!response.AuthHash) {
    return false
  }
  const expected = buildResponseAuthHash(response, authKey)
  return safeHashEqual(expected, response.AuthHash)
}

/**
 * ¿La transacción fue aprobada?
 *
 * AZUL puede devolver `ResponseCode=ISO8583` para transacciones procesadas y usar
 * `IsoCode=00` + `ResponseMessage=APROBADA` como señal de aprobación. Algunas guías
 * también muestran `ResponseCode=Approved`, por eso se toleran ambos formatos.
 */
export function isApproved(
  response: Pick<AzulResponse, 'ResponseCode' | 'IsoCode' | 'ResponseMessage'>
): boolean {
  const responseCode = response.ResponseCode.trim().toLowerCase()
  const isoCode = response.IsoCode.trim()
  const responseMessage = response.ResponseMessage.trim().toLowerCase()

  return isoCode === '00' && (responseCode === 'approved' || responseMessage === 'aprobada')
}

export interface SettleResult {
  status: 'verified' | 'failed' | 'noop'
  member_user_id: string | null
  application_id: string | null
}

export interface DonationSettleResult {
  status: 'verified' | 'failed' | 'cancelled' | 'noop'
  donor_user_id: string | null
  donation_id: string | null
}

/**
 * Liquida el pago vía RPC `azul_settle_membership_payment` (service_role, idempotente
 * en SQL). Devuelve el estado resultante para construir el redirect/notificación.
 */
export async function settlePaymentViaRpc(
  service: SupabaseClient,
  input: { orderNumber: string; approved: boolean; response: Record<string, unknown> }
): Promise<SettleResult> {
  const { data, error } = await service.rpc('azul_settle_membership_payment', {
    p_order_number: input.orderNumber,
    p_approved: input.approved,
    p_response: input.response
  })

  if (error) {
    throw error
  }

  const row = (Array.isArray(data) ? data[0] : data) as SettleResult | undefined
  return (
    row ?? { status: 'noop', member_user_id: null, application_id: null }
  )
}

/**
 * Liquida una donación vía RPC `azul_settle_donation_payment` (service_role).
 * Mantiene las donaciones separadas del pipeline de membresía.
 */
export async function settleDonationViaRpc(
  service: SupabaseClient,
  input: { orderNumber: string; approved: boolean; response: Record<string, unknown> }
): Promise<DonationSettleResult> {
  const { data, error } = await service.rpc('azul_settle_donation_payment', {
    p_order_number: input.orderNumber,
    p_approved: input.approved,
    p_response: input.response
  })

  if (error) {
    throw error
  }

  const row = (Array.isArray(data) ? data[0] : data) as DonationSettleResult | undefined
  return (
    row ?? { status: 'noop', donor_user_id: null, donation_id: null }
  )
}
