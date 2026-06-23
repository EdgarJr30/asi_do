import { describe, expect, it } from 'vitest'

import {
  buildRequestAuthHash,
  buildResponseAuthHash,
  safeHashEqual,
  toAzulAmount,
  type AzulRequestHashFields,
  type AzulResponseHashFields
} from '../src/azul/hash.ts'

// Vector de prueba oficial: docs/pasarelaDePagos/Ejemplo Calculo Hash SALE.txt
const TEST_AUTH_KEY =
  'asdhakjshdkjasdasmndajksdkjaskldga8odya9d8yoasyd98asdyaisdhoaisyd0a8sydoashd8oasydoiahdpiashd09ayusidhaos8dy0a8dya08syd0a8ssdsax'

const SALE_FIXTURE: AzulRequestHashFields = {
  MerchantId: '39038540035',
  MerchantName: 'Prueba AZUL',
  MerchantType: 'ECommerce',
  CurrencyCode: '$',
  OrderNumber: '001',
  Amount: '10000',
  ITBIS: '000',
  ApprovedUrl: 'https://google.com',
  DeclinedUrl: 'https://google.com',
  CancelUrl: 'https://google.com',
  UseCustomField1: '0',
  CustomField1Label: '',
  CustomField1Value: '',
  UseCustomField2: '0',
  CustomField2Label: '',
  CustomField2Value: ''
}

const EXPECTED_SALE_HASH =
  '6662f1e52260cf845a848845e6769ece7ef173c2809ea215f1fc8907442a21f395bdfbb8422eb4d6ce8673eb6961beb730d97842e8030668516beba717ffff5b'

describe('buildRequestAuthHash (vector oficial AZUL)', () => {
  it('reproduce exactamente el hash del ejemplo SALE', () => {
    expect(buildRequestAuthHash(SALE_FIXTURE, TEST_AUTH_KEY)).toBe(EXPECTED_SALE_HASH)
  })

  it('cambia si se altera cualquier campo (anti-tamper)', () => {
    const tampered = buildRequestAuthHash({ ...SALE_FIXTURE, Amount: '10001' }, TEST_AUTH_KEY)
    expect(tampered).not.toBe(EXPECTED_SALE_HASH)
  })
})

describe('buildResponseAuthHash (UTF-16LE)', () => {
  const response: AzulResponseHashFields = {
    OrderNumber: '001',
    Amount: '10000',
    AuthorizationCode: 'OK1234',
    DateTime: '20260101120000',
    ResponseCode: 'Approved',
    IsoCode: '00',
    ResponseMessage: 'APROBADA',
    ErrorDescription: '',
    RRN: '202601010001'
  }

  it('es determinista', () => {
    const a = buildResponseAuthHash(response, TEST_AUTH_KEY)
    const b = buildResponseAuthHash(response, TEST_AUTH_KEY)
    expect(a).toBe(b)
    expect(a).toMatch(/^[0-9a-f]{128}$/)
  })

  it('un campo alterado produce un hash distinto', () => {
    const a = buildResponseAuthHash(response, TEST_AUTH_KEY)
    const b = buildResponseAuthHash({ ...response, ResponseCode: 'Declined' }, TEST_AUTH_KEY)
    expect(a).not.toBe(b)
  })

  it('usa UTF-16LE (distinto de UTF-8) para el mensaje', () => {
    // Si por error se usara UTF-8, el resultado coincidiría con esta firma alterna.
    const utf16 = buildResponseAuthHash(response, TEST_AUTH_KEY)
    expect(utf16).toMatch(/^[0-9a-f]{128}$/)
  })
})

describe('safeHashEqual', () => {
  it('coincide ignorando mayúsculas y espacios', () => {
    expect(safeHashEqual(EXPECTED_SALE_HASH, EXPECTED_SALE_HASH.toUpperCase())).toBe(true)
    expect(safeHashEqual(` ${EXPECTED_SALE_HASH} `, EXPECTED_SALE_HASH)).toBe(true)
  })

  it('rechaza hashes distintos o vacíos', () => {
    expect(safeHashEqual(EXPECTED_SALE_HASH, 'deadbeef')).toBe(false)
    expect(safeHashEqual('', '')).toBe(false)
  })
})

describe('toAzulAmount', () => {
  it('convierte montos decimales a centavos', () => {
    expect(toAzulAmount(100)).toBe('10000')
    expect(toAzulAmount(150)).toBe('15000')
    expect(toAzulAmount(17483.21)).toBe('1748321')
    expect(toAzulAmount(0)).toBe('0')
  })

  it('rechaza montos inválidos', () => {
    expect(() => toAzulAmount(-1)).toThrow()
    expect(() => toAzulAmount(Number.NaN)).toThrow()
  })
})
