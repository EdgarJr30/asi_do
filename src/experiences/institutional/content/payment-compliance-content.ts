import { surfacePaths } from '@/app/router/surface-paths'

export const merchantCompliance = {
  businessName: 'ASI República Dominicana',
  legalName: 'Servicios e Industrias de Laicos Adventistas, República Dominicana',
  email: 'secretaria@asirdo.org',
  phone: '+1 809 555 0140',
  address: 'Santo Domingo, Distrito Nacional, República Dominicana',
  country: 'República Dominicana',
  currency: 'RD$ / DOP$',
  checkoutDescription:
    'Membresías institucionales ASI y donaciones de apoyo a programas, proyectos misioneros, convención nacional, salud comunitaria y evangelismo en el mercado.',
  supportHours: 'lunes a viernes, 9:00 a. m. a 5:00 p. m.',
  // NOTA: reemplazar con los datos registrales reales antes de producción.
  taxId: 'RNC 4-30-XXXXX-X',
  jurisdiction: 'Tribunales competentes de Santo Domingo, Distrito Nacional, República Dominicana',
  paymentProcessor: 'AZUL (Servicios Digitales Popular)'
} as const

/**
 * Datos registrales del comercio para el pie legal del Centro legal.
 * Importante para la exigibilidad de las políticas cuando hay cobros de por medio.
 */
export const legalIdentity = [
  { label: 'Razón social', value: merchantCompliance.legalName },
  { label: 'Nombre comercial', value: merchantCompliance.businessName },
  { label: 'Domicilio', value: merchantCompliance.address },
  { label: 'Identificación fiscal', value: merchantCompliance.taxId },
  { label: 'Contacto legal', value: merchantCompliance.email },
  { label: 'Procesador de pagos', value: merchantCompliance.paymentProcessor },
  { label: 'Jurisdicción', value: merchantCompliance.jurisdiction }
] as const

export const paymentPolicyLinks = [
  { label: 'Centro legal', to: surfacePaths.institutional.legalCenter },
  { label: 'Términos y condiciones', to: surfacePaths.institutional.terms },
  { label: 'Privacidad', to: surfacePaths.institutional.privacy },
  { label: 'Devoluciones y cancelaciones', to: surfacePaths.institutional.refunds },
  { label: 'Entrega del servicio', to: surfacePaths.institutional.delivery },
  { label: 'Seguridad de pagos', to: surfacePaths.institutional.paymentSecurity }
] as const

export type PaymentPolicyKind = 'terms' | 'privacy' | 'refunds' | 'delivery' | 'security'
