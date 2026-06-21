import { z } from 'zod'

export const candidateProfileSchema = z.object({
  headline: z.string().trim().max(120, 'Usa un titular de 120 caracteres o menos.').optional().or(z.literal('')),
  desiredRole: z.string().trim().max(120, 'Usa un rol objetivo de 120 caracteres o menos.').optional().or(z.literal('')),
  cityName: z.string().trim().max(120, 'La ciudad debe tener 120 caracteres o menos.').optional().or(z.literal('')),
  countryCode: z
    .string()
    .trim()
    .max(2, 'Usa el código de país de 2 letras.')
    .transform((value) => value.toUpperCase())
    .optional()
    .or(z.literal('')),
  summary: z.string().trim().max(2000, 'El resumen debe tener 2000 caracteres o menos.').optional().or(z.literal(''))
})

export type CandidateProfileFormValues = z.infer<typeof candidateProfileSchema>

export interface CandidateExperienceDraft {
  id: string
  companyName: string
  roleTitle: string
  employmentType: string
  cityName: string
  countryCode: string
  startDate: string
  endDate: string
  isCurrent: boolean
  summary: string
}

export interface CandidateEducationDraft {
  id: string
  institutionName: string
  degreeName: string
  fieldOfStudy: string
  startDate: string
  endDate: string
  isCurrent: boolean
  summary: string
}

export interface CandidateSkillDraft {
  id: string
  skillName: string
  proficiencyLabel: string
}

export interface CandidateLanguageDraft {
  id: string
  languageName: string
  proficiencyLabel: string
}

export interface CandidateLinkDraft {
  id: string
  linkType: 'portfolio' | 'linkedin' | 'github' | 'website' | 'other'
  label: string
  url: string
}

export function createEmptyCandidateExperience(): CandidateExperienceDraft {
  return {
    id: crypto.randomUUID(),
    companyName: '',
    roleTitle: '',
    employmentType: '',
    cityName: '',
    countryCode: '',
    startDate: '',
    endDate: '',
    isCurrent: false,
    summary: ''
  }
}

export function createEmptyCandidateEducation(): CandidateEducationDraft {
  return {
    id: crypto.randomUUID(),
    institutionName: '',
    degreeName: '',
    fieldOfStudy: '',
    startDate: '',
    endDate: '',
    isCurrent: false,
    summary: ''
  }
}

export function createEmptyCandidateSkill(): CandidateSkillDraft {
  return {
    id: crypto.randomUUID(),
    skillName: '',
    proficiencyLabel: ''
  }
}

export function createEmptyCandidateLanguage(): CandidateLanguageDraft {
  return {
    id: crypto.randomUUID(),
    languageName: '',
    proficiencyLabel: ''
  }
}

export function createEmptyCandidateLink(): CandidateLinkDraft {
  return {
    id: crypto.randomUUID(),
    linkType: 'other',
    label: '',
    url: ''
  }
}

export function sanitizeCandidateExperienceList(items: CandidateExperienceDraft[]) {
  return items
    .map((item) => ({
      ...item,
      companyName: item.companyName.trim(),
      roleTitle: item.roleTitle.trim(),
      employmentType: item.employmentType.trim(),
      cityName: item.cityName.trim(),
      countryCode: item.countryCode.trim().toUpperCase(),
      startDate: item.startDate.trim(),
      endDate: item.endDate.trim(),
      summary: item.summary.trim()
    }))
    .filter((item) => item.companyName && item.roleTitle && item.startDate)
}

export function sanitizeCandidateEducationList(items: CandidateEducationDraft[]) {
  return items
    .map((item) => ({
      ...item,
      institutionName: item.institutionName.trim(),
      degreeName: item.degreeName.trim(),
      fieldOfStudy: item.fieldOfStudy.trim(),
      startDate: item.startDate.trim(),
      endDate: item.endDate.trim(),
      summary: item.summary.trim()
    }))
    .filter((item) => item.institutionName && item.degreeName)
}

export function sanitizeCandidateSkillList(items: CandidateSkillDraft[]) {
  return items
    .map((item) => ({
      ...item,
      skillName: item.skillName.trim(),
      proficiencyLabel: item.proficiencyLabel.trim()
    }))
    .filter((item) => item.skillName)
}

export function sanitizeCandidateLanguageList(items: CandidateLanguageDraft[]) {
  return items
    .map((item) => ({
      ...item,
      languageName: item.languageName.trim(),
      proficiencyLabel: item.proficiencyLabel.trim()
    }))
    .filter((item) => item.languageName && item.proficiencyLabel)
}

export function sanitizeCandidateLinkList(items: CandidateLinkDraft[]) {
  return items
    .map((item) => ({
      ...item,
      label: item.label.trim(),
      url: item.url.trim()
    }))
    .filter((item) => item.url)
}
