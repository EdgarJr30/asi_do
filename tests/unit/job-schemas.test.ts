import { describe, expect, it } from 'vitest'

import { jobPostingSchema, toJobSlug } from '@/features/jobs/lib/job-schemas'

describe('job schemas', () => {
  it('normalizes public slugs from titles', () => {
    expect(toJobSlug('Ingeniero Eléctrico Senior')).toBe('ingeniero-electrico-senior')
  })

  it('rejects invalid salary ranges when salary is visible', () => {
    const result = jobPostingSchema.safeParse({
      title: 'Frontend engineer',
      slug: 'frontend-engineer',
      summary: 'Vacante enfocada en producto digital con ownership técnico.',
      description:
        'Buscamos una persona que pueda construir experiencias web robustas, colaborar con producto y dejar componentes reutilizables en una base React moderna.',
      workplaceType: 'remote',
      employmentType: 'full_time',
      cityName: '',
      countryCode: 'DO',
      salaryVisible: true,
      salaryMinAmount: '3000',
      salaryMaxAmount: '2000',
      salaryCurrency: 'USD',
      experienceLevel: 'Senior',
      expiresAt: ''
    })

    expect(result.success).toBe(false)
  })
})
