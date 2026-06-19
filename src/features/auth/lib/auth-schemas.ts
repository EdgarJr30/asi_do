import { z } from 'zod'

import { tenantKindValues } from '@/features/opportunities/lib/opportunity-taxonomy'

const authorityScopeTypeValues = ['union', 'association'] as const

export const signInSchema = z.object({
  email: z.email('Escribe un correo valido.'),
  password: z.string().min(8, 'La contrasena debe tener al menos 8 caracteres.')
})

export const signUpSchema = z.object({
  fullName: z.string().trim().min(2, 'Escribe tu nombre completo.'),
  email: z.email('Escribe un correo valido.'),
  password: z.string().min(8, 'La contrasena debe tener al menos 8 caracteres.')
})

export const signUpFormSchema = z.object({
  firstName: z.string().trim().min(2, 'Escribe tu nombre.'),
  lastName: z.string().trim().min(2, 'Escribe tu apellido.'),
  email: z.email('Escribe un correo valido.'),
  password: z.string().min(8, 'La contrasena debe tener al menos 8 caracteres.')
})

export const onboardingSchema = z.object({
  fullName: z.string().trim().min(2, 'El nombre completo es obligatorio.'),
  displayName: z.string().trim().min(2, 'El nombre visible es obligatorio.'),
  locale: z.enum(['es', 'en']),
  countryCode: z
    .string()
    .trim()
    .length(2, 'Usa el codigo ISO de 2 letras.')
    .transform((value) => value.toUpperCase())
})

export const recruiterRequestSchema = z
  .object({
    requestedTenantKind: z.enum(tenantKindValues),
    requestedCompanyName: z.string().trim().min(2, 'El nombre visible es obligatorio.'),
    requestedCompanyLegalName: z.string().trim().optional(),
    requestedTenantSlug: z
      .string()
      .trim()
      .min(3, 'El slug debe tener al menos 3 caracteres.')
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Usa minusculas, numeros y guiones.'),
    companyWebsiteUrl: z.union([z.url('Escribe una URL valida.'), z.literal('')]).optional(),
    companyEmail: z.union([z.email('Escribe un correo valido.'), z.literal('')]).optional(),
    companyPhone: z.string().trim().optional(),
    companyCountryCode: z
      .string()
      .trim()
      .min(2, 'Usa un codigo de pais.')
      .max(2, 'Usa un codigo ISO de 2 letras.'),
    companyDescription: z.string().trim().min(20, 'Describe brevemente el contexto y la operacion.'),
    operatingScope: z.string().trim().optional(),
    sponsoringEntity: z.string().trim().optional(),
    fieldRegion: z.string().trim().optional(),
    conversionIntent: z.string().trim().optional()
  })
  .superRefine((values, context) => {
    if (!values.companyEmail) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['companyEmail'],
        message: 'Necesitamos un email de contacto para revisar la solicitud.'
      })
    }

    if (values.requestedTenantKind === 'company' || values.requestedTenantKind === 'ministry') {
      if (!values.requestedCompanyLegalName?.trim()) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['requestedCompanyLegalName'],
          message: 'Este tipo de tenant requiere razon social o nombre legal.'
        })
      }
    }

    if (values.requestedTenantKind === 'ministry' || values.requestedTenantKind === 'project') {
      if (!values.operatingScope?.trim()) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['operatingScope'],
          message: 'Describe el alcance operativo esperado.'
        })
      }
    }

    if (values.requestedTenantKind === 'project' || values.requestedTenantKind === 'field') {
      if (!values.sponsoringEntity?.trim()) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['sponsoringEntity'],
          message: 'Indica la entidad patrocinadora o supervisora.'
        })
      }
    }

    if (values.requestedTenantKind === 'field' && !values.fieldRegion?.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['fieldRegion'],
        message: 'Indica el campo o region que representara este tenant.'
      })
    }

    if (values.requestedTenantKind === 'generic_profile' && !values.conversionIntent?.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['conversionIntent'],
        message: 'Explica como este perfil podria convertirse luego en tenant formal.'
      })
    }
  })

export const recruiterReviewSchema = z.object({
  reviewNotes: z.string().trim().optional()
})

export const pastorAuthorityRequestSchema = z.object({
  identityDocumentNumber: z.string().trim().min(6, 'Ingresa la cédula o documento de identidad.'),
  firstNames: z.string().trim().min(2, 'Ingresa tus nombres.'),
  lastNames: z.string().trim().min(2, 'Ingresa tus apellidos.'),
  phoneNumber: z.string().trim().min(7, 'Ingresa un teléfono de contacto.'),
  unionId: z.string().trim().uuid('Selecciona la unión.'),
  associationId: z.string().trim().uuid('Selecciona la asociación.'),
  districtId: z.string().trim().uuid('Selecciona el distrito.'),
  churchIds: z.array(z.string().uuid()),
  pastorStatusAttestation: z.boolean(),
  notes: z.string().trim().optional()
}).superRefine((values, context) => {
  if (!values.pastorStatusAttestation) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['pastorStatusAttestation'],
      message: 'Debes confirmar la declaración de estatus pastoral.'
    })
  }
})

export const regionalAuthorityRequestSchema = z.object({
  identityDocumentNumber: z.string().trim().min(6, 'Ingresa la cédula o documento de identidad.'),
  firstNames: z.string().trim().min(2, 'Ingresa tus nombres.'),
  lastNames: z.string().trim().min(2, 'Ingresa tus apellidos.'),
  phoneNumber: z.string().trim().min(7, 'Ingresa un teléfono de contacto.'),
  adminScopeType: z.enum(authorityScopeTypeValues),
  unionId: z.string().trim().uuid('Selecciona la unión.'),
  associationId: z.string().trim().optional(),
  positionTitle: z.string().trim().min(2, 'Indica el cargo administrativo.'),
  notes: z.string().trim().optional()
}).superRefine((values, context) => {
  if (values.adminScopeType === 'association' && !values.associationId?.trim()) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['associationId'],
      message: 'La asociación es obligatoria para ese alcance.'
    })
  }
})

export type SignInValues = z.infer<typeof signInSchema>
export type SignUpValues = z.infer<typeof signUpSchema>
export type SignUpFormValues = z.infer<typeof signUpFormSchema>
export type OnboardingValues = z.infer<typeof onboardingSchema>
export type RecruiterRequestValues = z.infer<typeof recruiterRequestSchema>
export type RecruiterReviewValues = z.infer<typeof recruiterReviewSchema>
export type PastorAuthorityRequestValues = z.infer<typeof pastorAuthorityRequestSchema>
export type RegionalAuthorityRequestValues = z.infer<typeof regionalAuthorityRequestSchema>
