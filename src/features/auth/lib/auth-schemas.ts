import { z } from 'zod'

export const signInSchema = z.object({
  email: z.email('Escribe un correo valido.'),
  password: z.string().min(8, 'La contrasena debe tener al menos 8 caracteres.')
})

export const signUpSchema = z.object({
  fullName: z.string().trim().min(2, 'Escribe tu nombre completo.'),
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

export const recruiterRequestSchema = z.object({
  requestedCompanyName: z.string().trim().min(2, 'El nombre comercial es obligatorio.'),
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
  companyDescription: z.string().trim().min(20, 'Describe brevemente la empresa y su operacion.')
})

export const recruiterReviewSchema = z.object({
  reviewNotes: z.string().trim().optional()
})

export type SignInValues = z.infer<typeof signInSchema>
export type SignUpValues = z.infer<typeof signUpSchema>
export type OnboardingValues = z.infer<typeof onboardingSchema>
export type RecruiterRequestValues = z.infer<typeof recruiterRequestSchema>
export type RecruiterReviewValues = z.infer<typeof recruiterReviewSchema>
