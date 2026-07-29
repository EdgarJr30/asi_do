import { describe, expect, it } from 'vitest'

import {
  candidateProfileSchema,
  sanitizeCandidateEducationList,
  sanitizeCandidateExperienceList,
  sanitizeCandidateLanguageList,
  sanitizeCandidateLinkList,
  sanitizeCandidateSkillList
} from '@/features/candidate-profile/lib/candidate-profile-schemas'

describe('candidate profile schema helpers', () => {
  it('drops incomplete work experiences and keeps valid ones normalized', () => {
    const result = sanitizeCandidateExperienceList([
      {
        id: '1',
        companyName: '  OpenAI  ',
        roleTitle: '  Product Engineer ',
        employmentType: ' Full-time ',
        cityName: ' Santo Domingo ',
        countryCode: ' do ',
        startDate: '2024-01-01',
        endDate: '',
        isCurrent: true,
        summary: ' Built features '
      },
      {
        id: '2',
        companyName: '',
        roleTitle: 'Missing company',
        employmentType: '',
        cityName: '',
        countryCode: '',
        startDate: '',
        endDate: '',
        isCurrent: false,
        summary: ''
      }
    ])

    expect(result).toHaveLength(1)
    expect(result[0]?.companyName).toBe('OpenAI')
    expect(result[0]?.countryCode).toBe('DO')
  })

  it('keeps only meaningful education, skill, language, and link entries', () => {
    expect(
      sanitizeCandidateEducationList([
        {
          id: '1',
          institutionName: '  INTEC ',
          degreeName: '  Systems Engineering ',
          fieldOfStudy: '',
          startDate: '',
          endDate: '',
          isCurrent: false,
          summary: ''
        },
        {
          id: '2',
          institutionName: '',
          degreeName: '',
          fieldOfStudy: '',
          startDate: '',
          endDate: '',
          isCurrent: false,
          summary: ''
        }
      ])
    ).toHaveLength(1)

    expect(
      sanitizeCandidateSkillList([
        { id: '1', skillName: '  Sourcing ', proficiencyLabel: ' Senior ' },
        { id: '2', skillName: ' ', proficiencyLabel: '' }
      ])
    ).toEqual([{ id: '1', skillName: 'Sourcing', proficiencyLabel: 'Senior' }])

    expect(
      sanitizeCandidateLanguageList([
        { id: '1', languageName: ' Espanol ', proficiencyLabel: ' Nativo ' },
        { id: '2', languageName: 'English', proficiencyLabel: '' }
      ])
    ).toEqual([{ id: '1', languageName: 'Espanol', proficiencyLabel: 'Nativo' }])

    expect(
      sanitizeCandidateLinkList([
        { id: '1', linkType: 'linkedin', label: ' Perfil ', url: ' https://linkedin.com/in/demo ' },
        { id: '2', linkType: 'other', label: '', url: ' ' }
      ])
    ).toEqual([
      { id: '1', linkType: 'linkedin', label: 'Perfil', url: 'https://linkedin.com/in/demo' }
    ])
  })

  it('requires nombre y apellido and trims them', () => {
    const valid = candidateProfileSchema.safeParse({
      firstName: '  Juan  ',
      lastName: '  Pérez Gómez ',
      headline: '',
      desiredRole: '',
      cityName: '',
      countryCode: '',
      summary: ''
    })

    expect(valid.success).toBe(true)
    expect(valid.success && valid.data.firstName).toBe('Juan')
    expect(valid.success && valid.data.lastName).toBe('Pérez Gómez')

    const missingLastName = candidateProfileSchema.safeParse({
      firstName: 'Juan',
      lastName: '   ',
      headline: '',
      desiredRole: '',
      cityName: '',
      countryCode: '',
      summary: ''
    })

    expect(missingLastName.success).toBe(false)
  })
})
