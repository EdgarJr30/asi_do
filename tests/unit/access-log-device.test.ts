import { describe, expect, it } from 'vitest'

import { parseAccessDevice } from '@/features/access-logs/lib/access-log-api'

describe('access log device parser', () => {
  it('recognizes a mobile Safari session', () => {
    const result = parseAccessDevice(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 Version/18.5 Mobile/15E148 Safari/604.1'
    )

    expect(result).toEqual({
      browser: 'Safari',
      operatingSystem: 'iOS / iPadOS',
      deviceType: 'Móvil'
    })
  })

  it('recognizes Edge on Windows as a computer', () => {
    const result = parseAccessDevice(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/136.0.0.0 Safari/537.36 Edg/136.0.0.0'
    )

    expect(result).toEqual({
      browser: 'Microsoft Edge',
      operatingSystem: 'Windows',
      deviceType: 'Computadora'
    })
  })

  it('returns a safe fallback when user-agent is unavailable', () => {
    expect(parseAccessDevice(null)).toEqual({
      browser: 'No disponible',
      operatingSystem: 'No disponible',
      deviceType: 'Desconocido'
    })
  })
})
