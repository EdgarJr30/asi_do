import { describe, expect, it } from 'vitest'

import { createTenantSlug } from '@/features/recruiter-requests/lib/recruiter-request'

describe('company request space address', () => {
  it.each([
    ['ASI República Dominicana', 'asi-republica-dominicana'],
    ['  Misión & Vida, SRL  ', 'mision-vida-srl'],
    ['Proyecto 2026', 'proyecto-2026'],
    ['---', ''],
  ])('derives %s as %s', (companyName, expectedSlug) => {
    expect(createTenantSlug(companyName)).toBe(expectedSlug)
  })
})
