import { describe, expect, it } from 'vitest'

import { buildResponseAuthHash } from '../src/azul/hash.ts'
import {
  isApproved,
  parseAzulResponse,
  verifyResponseAuthHash,
  type AzulResponse
} from '../src/azul/settle.ts'

const AUTH_KEY = 'test-auth-key-xyz'

function signedResponse(overrides: Partial<AzulResponse> = {}): Record<string, string> {
  const base = {
    OrderNumber: 'ASI-260101-abcd1234',
    Amount: '15000',
    AuthorizationCode: 'OK9999',
    DateTime: '20260101120000',
    ResponseCode: 'Approved',
    IsoCode: '00',
    ResponseMessage: 'APROBADA',
    ErrorDescription: '',
    RRN: '202601010001',
    ...overrides
  }
  const AuthHash = buildResponseAuthHash(base, AUTH_KEY)
  return { ...base, ITBIS: '000', AuthHash }
}

describe('parseAzulResponse', () => {
  it('lee el querystring tolerando capitalización', () => {
    const parsed = parseAzulResponse({ orderNumber: 'X1', ISOCode: '00', responseCode: 'Approved' })
    expect(parsed.OrderNumber).toBe('X1')
    expect(parsed.IsoCode).toBe('00')
    expect(parsed.ResponseCode).toBe('Approved')
  })
})

describe('verifyResponseAuthHash', () => {
  it('acepta una respuesta firmada correctamente', () => {
    const parsed = parseAzulResponse(signedResponse())
    expect(verifyResponseAuthHash(parsed, AUTH_KEY)).toBe(true)
  })

  it('rechaza si se manipula el monto (anti-tamper)', () => {
    const tampered = parseAzulResponse({ ...signedResponse(), Amount: '99999' })
    expect(verifyResponseAuthHash(tampered, AUTH_KEY)).toBe(false)
  })

  it('rechaza si falta el AuthHash', () => {
    const noHash = parseAzulResponse({ ...signedResponse(), AuthHash: '' })
    expect(verifyResponseAuthHash(noHash, AUTH_KEY)).toBe(false)
  })

  it('rechaza con una AuthKey distinta', () => {
    const parsed = parseAzulResponse(signedResponse())
    expect(verifyResponseAuthHash(parsed, 'otra-llave')).toBe(false)
  })
})

describe('isApproved', () => {
  it('aprueba el formato real de AZUL: ResponseCode=ISO8583, IsoCode=00, ResponseMessage=APROBADA', () => {
    expect(isApproved({ ResponseCode: 'ISO8583', IsoCode: '00', ResponseMessage: 'APROBADA' })).toBe(true)
  })

  it('mantiene compatibilidad con guías que devuelven ResponseCode=Approved', () => {
    expect(isApproved({ ResponseCode: 'Approved', IsoCode: '00', ResponseMessage: '' })).toBe(true)
  })

  it('rechaza errores aunque ResponseCode venga como ISO8583', () => {
    expect(isApproved({ ResponseCode: 'ISO8583', IsoCode: '99', ResponseMessage: 'ERROR' })).toBe(false)
    expect(isApproved({ ResponseCode: 'Declined', IsoCode: '00', ResponseMessage: 'ERROR' })).toBe(false)
    expect(isApproved({ ResponseCode: 'Approved', IsoCode: '05', ResponseMessage: '' })).toBe(false)
  })
})
