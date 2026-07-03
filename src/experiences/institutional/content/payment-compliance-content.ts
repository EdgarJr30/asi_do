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

export const paymentPolicyContent: Record<
  PaymentPolicyKind,
  {
    eyebrow: string
    title: string
    description: string
    sections: Array<{ title: string; body: string[] }>
  }
> = {
  terms: {
    eyebrow: 'Condiciones de compra',
    title: 'Términos y condiciones',
    description:
      'Estos términos explican qué está comprando o aportando el tarjetahabiente antes de completar un pago en línea con ASI República Dominicana.',
    sections: [
      {
        title: 'Nombre comercial y alcance',
        body: [
          `${merchantCompliance.businessName} opera como portal institucional para membresías, donaciones y participación en proyectos de ASI en República Dominicana.`,
          `El comercio se identifica como ${merchantCompliance.legalName}.`
        ]
      },
      {
        title: 'Productos y servicios',
        body: [
          'Los pagos de membresía cubren cuotas institucionales anuales o multianuales según la categoría seleccionada y aprobada.',
          'Las donaciones son aportes voluntarios destinados a fondos o proyectos institucionales indicados durante el proceso de pago.',
          'Todos los montos se muestran en pesos dominicanos: RD$ / DOP$.'
        ]
      },
      {
        title: 'Aceptación antes del pago',
        body: [
          'Antes de ser redirigido a AZUL, el tarjetahabiente debe confirmar mediante checkbox que acepta estos términos y las políticas relacionadas.',
          'Al completar el pago, el tarjetahabiente declara que la información suministrada es correcta y que está autorizado a utilizar la tarjeta.'
        ]
      }
    ]
  },
  privacy: {
    eyebrow: 'Datos personales',
    title: 'Políticas de privacidad',
    description:
      'ASI usa los datos del tarjetahabiente únicamente para procesar membresías, donaciones, comprobantes, soporte y trazabilidad administrativa.',
    sections: [
      {
        title: 'Información que recopilamos',
        body: [
          'Podemos recopilar nombre, correo electrónico, teléfono, categoría de membresía, monto, destino de donación, orden de pago y respuesta operativa de AZUL.',
          'No almacenamos número completo de tarjeta, CVV ni credenciales de autenticación bancaria.'
        ]
      },
      {
        title: 'Uso de la información',
        body: [
          'La información se utiliza para confirmar pagos, emitir comprobantes, responder solicitudes de servicio al cliente y mantener auditoría interna.',
          'Los datos pueden ser consultados por personal autorizado de ASI cuando sea necesario para soporte, conciliación o cumplimiento.'
        ]
      },
      {
        title: 'Conservación y protección',
        body: [
          'Conservamos registros de pagos y comprobantes durante el tiempo necesario para fines administrativos, fiscales, auditoría y soporte.',
          'Aplicamos controles de acceso, registros de auditoría y servicios de infraestructura seguros para proteger la información.'
        ]
      }
    ]
  },
  refunds: {
    eyebrow: 'Derechos del tarjetahabiente',
    title: 'Políticas de devoluciones, reembolsos y cancelaciones',
    description:
      'Estas políticas deben ser leídas antes de pagar. Explican cuándo puede solicitarse revisión, cancelación o reembolso.',
    sections: [
      {
        title: 'Membresías',
        body: [
          'Las cuotas de membresía aprobadas cubren un período de vigencia institucional y no se consideran productos físicos retornables.',
          'Si un pago fue duplicado, realizado por error o no pudo asociarse correctamente a la cuenta del miembro, el tarjetahabiente puede solicitar revisión a Servicio al Cliente.'
        ]
      },
      {
        title: 'Donaciones',
        body: [
          'Las donaciones confirmadas se consideran aportes voluntarios a la misión institucional y, por regla general, no son reembolsables.',
          'ASI podrá revisar casos excepcionales como cargos duplicados, error operativo o transacción no reconocida, sujeto a verificación.'
        ]
      },
      {
        title: 'Cancelaciones y plazos',
        body: [
          'Si el usuario cancela en la pantalla de AZUL antes de autorizar, no se completa el cargo.',
          `Las solicitudes de revisión deben enviarse a ${merchantCompliance.email} o ${merchantCompliance.phone} con número de orden, monto, fecha y correo usado en la transacción.`
        ]
      }
    ]
  },
  delivery: {
    eyebrow: 'Entrega del servicio',
    title: 'Política clara de entrega',
    description:
      'ASI presta servicios digitales/institucionales; no entrega mercancía física para membresías o donaciones procesadas en línea.',
    sections: [
      {
        title: 'Membresía',
        body: [
          'Cuando AZUL confirma un pago de membresía inicial, el pago queda registrado para activación administrativa según las reglas de membresía.',
          'Cuando un miembro activo renueva, la vigencia se actualiza automáticamente y el nuevo comprobante queda disponible en el panel de membresía.'
        ]
      },
      {
        title: 'Donaciones',
        body: [
          'Una donación aprobada queda registrada inmediatamente como aporte institucional y se muestra el comprobante correspondiente.',
          'El destino seleccionado orienta el uso administrativo del aporte; no implica entrega física al tarjetahabiente.'
        ]
      },
      {
        title: 'Comprobante',
        body: [
          'Después de la confirmación, el sistema muestra o permite descargar un comprobante con comercio, orden, monto, resultado, autorización, referencia y fecha.',
          'Si el comprobante no aparece luego de un pago aprobado, el usuario debe contactar a Servicio al Cliente con el número de orden.'
        ]
      }
    ]
  },
  security: {
    eyebrow: 'Pagos seguros',
    title: 'Políticas de seguridad para la transmisión de datos de tarjetas',
    description:
      'La tarjeta se captura en la Página de Pago de AZUL. ASI no almacena número completo de tarjeta ni CVV.',
    sections: [
      {
        title: 'Website',
        body: [
          'Tomamos medidas razonables para proteger la información personal y reducir el riesgo de uso inapropiado, alteración o destrucción.',
          'La plataforma usa conexiones seguras HTTPS/TLS para proteger la transmisión entre el navegador y los servicios de la aplicación.'
        ]
      },
      {
        title: 'Pagos',
        body: [
          'Los pagos con tarjeta son procesados por AZUL como proveedor externo de pasarela de pagos.',
          'ASI envía a AZUL el monto, comercio, orden y URLs de retorno; la tarjeta es ingresada por el tarjetahabiente en la página segura de AZUL.',
          'AZUL devuelve una respuesta firmada que ASI valida antes de marcar una transacción como aprobada.'
        ]
      },
      {
        title: '3D Secure',
        body: [
          'Cuando el emisor lo requiere, la transacción puede usar autenticación 3D Secure mediante Visa Secure o Mastercard ID Check.',
          'El tarjetahabiente debe seguir las instrucciones del banco emisor para completar la autenticación.'
        ]
      }
    ]
  }
}
