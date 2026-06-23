import { createHmac } from 'node:crypto'

/**
 * Hashing del AuthHash de AZUL (Página de Pago).
 *
 * Reglas tomadas del Documento técnico de AZUL y del vector de prueba
 * `docs/pasarelaDePagos/Ejemplo Calculo Hash SALE.txt`:
 *
 * - El mensaje a firmar es la **concatenación de los campos en orden exacto + AuthKey**
 *   (la AuthKey se concatena también al final del mensaje, no solo se usa como llave).
 * - La llave del HMAC-SHA512 es la AuthKey en bytes UTF-8 (PHP `hash_hmac` trata la
 *   llave como string crudo).
 * - El **requerimiento** se firma desde una cadena UTF-8 (coincide con el ejemplo PHP).
 * - La **respuesta** se firma desde una cadena UTF-16LE
 *   (`mb_convert_encoding($s, 'UTF-16LE')` en el ejemplo PHP de respuesta).
 * - La salida es hex en minúsculas.
 */

export type AzulHashEncoding = 'utf-8' | 'utf-16le'

/** HMAC-SHA512 → hex minúsculas. El mensaje se codifica según `encoding`; la llave va en UTF-8. */
export function hmacSha512Hex(message: string, authKey: string, encoding: AzulHashEncoding): string {
  const messageBytes = Buffer.from(message, encoding === 'utf-16le' ? 'utf16le' : 'utf8')
  const keyBytes = Buffer.from(authKey, 'utf8')
  return createHmac('sha512', keyBytes).update(messageBytes).digest('hex')
}

/** Campos del requerimiento de venta (Sale), en el orden exacto que exige el AuthHash. */
export interface AzulRequestHashFields {
  MerchantId: string
  MerchantName: string
  MerchantType: string
  CurrencyCode: string
  OrderNumber: string
  Amount: string
  ITBIS: string
  ApprovedUrl: string
  DeclinedUrl: string
  CancelUrl: string
  UseCustomField1: string
  CustomField1Label: string
  CustomField1Value: string
  UseCustomField2: string
  CustomField2Label: string
  CustomField2Value: string
}

const REQUEST_FIELD_ORDER: Array<keyof AzulRequestHashFields> = [
  'MerchantId',
  'MerchantName',
  'MerchantType',
  'CurrencyCode',
  'OrderNumber',
  'Amount',
  'ITBIS',
  'ApprovedUrl',
  'DeclinedUrl',
  'CancelUrl',
  'UseCustomField1',
  'CustomField1Label',
  'CustomField1Value',
  'UseCustomField2',
  'CustomField2Label',
  'CustomField2Value'
]

/** AuthHash del requerimiento (UTF-8). */
export function buildRequestAuthHash(fields: AzulRequestHashFields, authKey: string): string {
  const message = REQUEST_FIELD_ORDER.map((key) => fields[key]).join('') + authKey
  return hmacSha512Hex(message, authKey, 'utf-8')
}

/** Campos de la respuesta de AZUL, en el orden exacto que exige el AuthHash. */
export interface AzulResponseHashFields {
  OrderNumber: string
  Amount: string
  AuthorizationCode: string
  DateTime: string
  ResponseCode: string
  IsoCode: string
  ResponseMessage: string
  ErrorDescription: string
  RRN: string
}

const RESPONSE_FIELD_ORDER: Array<keyof AzulResponseHashFields> = [
  'OrderNumber',
  'Amount',
  'AuthorizationCode',
  'DateTime',
  'ResponseCode',
  'IsoCode',
  'ResponseMessage',
  'ErrorDescription',
  'RRN'
]

/** AuthHash de la respuesta (UTF-16LE). */
export function buildResponseAuthHash(fields: AzulResponseHashFields, authKey: string): string {
  const message = RESPONSE_FIELD_ORDER.map((key) => fields[key]).join('') + authKey
  return hmacSha512Hex(message, authKey, 'utf-16le')
}

/** Comparación de hashes en tiempo constante (defensa anti-timing), case-insensitive. */
export function safeHashEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a.trim().toLowerCase(), 'utf8')
  const bufB = Buffer.from(b.trim().toLowerCase(), 'utf8')
  if (bufA.length !== bufB.length || bufA.length === 0) {
    return false
  }
  // timingSafeEqual exige longitudes iguales (ya garantizado arriba).
  let diff = 0
  for (let i = 0; i < bufA.length; i += 1) {
    diff |= (bufA[i] ?? 0) ^ (bufB[i] ?? 0)
  }
  return diff === 0
}

/**
 * Convierte un monto decimal (p. ej. 150.00) al formato entero de AZUL en centavos
 * ("15000"). Sin coma ni punto; los dos últimos dígitos son los decimales.
 */
export function toAzulAmount(value: number): string {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Monto inválido para AZUL: ${value}`)
  }
  return String(Math.round(value * 100))
}
