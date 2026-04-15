export const tenantKindValues = ['company', 'ministry', 'project', 'field', 'generic_profile'] as const
export const opportunityTypeValues = ['employment', 'project', 'volunteer', 'professional_service'] as const
export const compensationTypeValues = ['salary', 'stipend', 'budget', 'unpaid', 'donation_based', 'not_disclosed'] as const

export const tenantKindOptions = [
  { value: 'company', label: 'Empresa' },
  { value: 'ministry', label: 'Ministerio' },
  { value: 'project', label: 'Proyecto' },
  { value: 'field', label: 'Campo o región' },
  { value: 'generic_profile', label: 'Perfil genérico' }
] as const

export type TenantKindOption = (typeof tenantKindValues)[number]

export const opportunityTypeOptions = [
  { value: 'employment', label: 'Empleo' },
  { value: 'project', label: 'Proyecto' },
  { value: 'volunteer', label: 'Voluntariado' },
  { value: 'professional_service', label: 'Servicio profesional' }
] as const

export type OpportunityTypeOption = (typeof opportunityTypeValues)[number]

export const compensationTypeOptions = [
  { value: 'salary', label: 'Salario' },
  { value: 'stipend', label: 'Estipendio' },
  { value: 'budget', label: 'Presupuesto' },
  { value: 'unpaid', label: 'No remunerado' },
  { value: 'donation_based', label: 'Basado en donaciones' },
  { value: 'not_disclosed', label: 'No divulgado' }
] as const

export type CompensationTypeOption = (typeof compensationTypeValues)[number]

export const opportunityStageLabels: Record<OpportunityTypeOption, string[]> = {
  employment: ['Applied', 'Screening', 'Interview', 'Offer', 'Hired', 'Rejected'],
  project: ['Submitted', 'Under review', 'Approved', 'Active', 'Completed', 'Declined'],
  volunteer: ['Registered', 'Validating', 'Assigned', 'Completed', 'Not selected', 'Withdrawn'],
  professional_service: ['Requested', 'Reviewing', 'Conversation', 'Selected', 'Closed', 'Declined']
}

export const tenantKindRequirementSummary: Record<TenantKindOption, string[]> = {
  company: ['Razón social', 'Email corporativo'],
  ministry: ['Razón social', 'Alcance del ministerio', 'Email de contacto'],
  project: ['Entidad patrocinadora', 'Alcance del proyecto', 'Email de contacto'],
  field: ['Campo o región', 'Entidad supervisora', 'Email de contacto'],
  generic_profile: ['Intención de conversión', 'Email de contacto']
}

export function getTenantKindLabel(value: string | null | undefined) {
  return tenantKindOptions.find((item) => item.value === value)?.label ?? 'Tenant'
}

export function getOpportunityTypeLabel(value: string | null | undefined) {
  return opportunityTypeOptions.find((item) => item.value === value)?.label ?? 'Oportunidad'
}

export function getCompensationTypeLabel(value: string | null | undefined) {
  return compensationTypeOptions.find((item) => item.value === value)?.label ?? 'Compensación'
}
