import { z } from 'zod'

import { compensationTypeValues, opportunityTypeValues } from '@/features/opportunities/lib/opportunity-taxonomy'

export const jobPostingSchema = z
  .object({
    opportunityType: z.enum(opportunityTypeValues),
    title: z.string().trim().min(3, 'Usa un titulo de al menos 3 caracteres.').max(120),
    slug: z
      .string()
      .trim()
      .min(3, 'Usa un slug de al menos 3 caracteres.')
      .max(120)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Usa solo minusculas, numeros y guiones.'),
    summary: z.string().trim().min(24, 'Resume la vacante en al menos 24 caracteres.').max(320),
    description: z.string().trim().min(80, 'Describe la vacante con al menos 80 caracteres.').max(5000),
    workplaceType: z.enum(['on_site', 'hybrid', 'remote']),
    employmentType: z.enum(['full_time', 'part_time', 'contract', 'temporary', 'internship']),
    cityName: z.string().trim().max(120).optional().or(z.literal('')),
    countryCode: z.string().trim().max(2).optional().or(z.literal('')),
    compensationVisible: z.boolean(),
    compensationType: z.enum(compensationTypeValues),
    compensationMinAmount: z.string().trim().optional().or(z.literal('')),
    compensationMaxAmount: z.string().trim().optional().or(z.literal('')),
    compensationCurrency: z.string().trim().max(3).optional().or(z.literal('')),
    experienceLevel: z.string().trim().max(80).optional().or(z.literal('')),
    expiresAt: z.string().trim().optional().or(z.literal('')),
    operatingScope: z.string().trim().optional().or(z.literal('')),
    deliveryTimeline: z.string().trim().optional().or(z.literal('')),
    engagementModel: z.string().trim().optional().or(z.literal('')),
    serviceScope: z.string().trim().optional().or(z.literal(''))
  })
  .superRefine((values, context) => {
    const minAmount = values.compensationMinAmount ? Number(values.compensationMinAmount) : null
    const maxAmount = values.compensationMaxAmount ? Number(values.compensationMaxAmount) : null

    if (values.compensationVisible) {
      if (minAmount !== null && Number.isNaN(minAmount)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['compensationMinAmount'],
          message: 'El monto minimo debe ser numerico.'
        })
      }

      if (maxAmount !== null && Number.isNaN(maxAmount)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['compensationMaxAmount'],
          message: 'El monto maximo debe ser numerico.'
        })
      }

      if (minAmount !== null && maxAmount !== null && minAmount > maxAmount) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['compensationMaxAmount'],
          message: 'El monto maximo debe ser mayor o igual al minimo.'
        })
      }
    }

    if (
      values.compensationVisible &&
      ['salary', 'stipend', 'budget'].includes(values.compensationType) &&
      (minAmount !== null || maxAmount !== null) &&
      !values.compensationCurrency
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['compensationCurrency'],
        message: 'Indica la moneda para esta compensacion.'
      })
    }

    if (values.opportunityType === 'project' && !values.deliveryTimeline) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['deliveryTimeline'],
        message: 'Define una ventana o timeline estimado para el proyecto.'
      })
    }

    if (values.opportunityType === 'volunteer' && !values.engagementModel) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['engagementModel'],
        message: 'Describe la dedicacion o modelo de servicio esperado.'
      })
    }

    if (values.opportunityType === 'professional_service' && !values.serviceScope) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['serviceScope'],
        message: 'Describe el alcance del servicio profesional.'
      })
    }

    if ((values.opportunityType === 'project' || values.opportunityType === 'volunteer') && !values.operatingScope) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['operatingScope'],
        message: 'Describe el alcance operativo esperado.'
      })
    }
  })

export type JobPostingFormValues = z.infer<typeof jobPostingSchema>

export interface JobScreeningQuestionDraft {
  id: string
  questionText: string
  answerType: 'short_text' | 'long_text' | 'yes_no' | 'single_select'
  helperText: string
  optionList: string
  isRequired: boolean
}

export function createEmptyScreeningQuestion(): JobScreeningQuestionDraft {
  return {
    id: crypto.randomUUID(),
    questionText: '',
    answerType: 'short_text',
    helperText: '',
    optionList: '',
    isRequired: false
  }
}

export function sanitizeScreeningQuestions(items: JobScreeningQuestionDraft[]) {
  return items
    .map((item) => ({
      ...item,
      questionText: item.questionText.trim(),
      helperText: item.helperText.trim(),
      optionList: item.optionList
        .split('\n')
        .map((value) => value.trim())
        .filter(Boolean)
    }))
    .filter((item) => item.questionText)
}

export function toJobSlug(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
}
