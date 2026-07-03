/* eslint-disable react-refresh/only-export-components */
import type { ComponentType, ReactNode } from 'react'

import {
  CalendarDays,
  CheckCircle2,
  Clock,
  CreditCard,
  FileText,
  Lock,
  MessageSquare,
  RotateCcw,
  ShieldCheck,
  UserCheck
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { surfacePaths } from '@/app/router/surface-paths'

import { merchantCompliance, type PaymentPolicyKind } from './payment-compliance-content'

export type LegalDocKind = PaymentPolicyKind

type IconComponent = ComponentType<{ className?: string }>

type ClauseBlock =
  | { kind: 'paragraph'; content: ReactNode }
  | { kind: 'subheading'; text: string }
  | { kind: 'list'; items: ReactNode[] }
  | { kind: 'definitions'; items: Array<{ term: string; description: ReactNode }> }
  | { kind: 'steps'; items: Array<{ title: string; description: ReactNode }> }
  | { kind: 'callout'; tone: 'green' | 'blue'; icon: IconComponent; content: ReactNode }

export type LegalClause = {
  id: string
  tocLabel: string
  title: string
  blocks: ClauseBlock[]
}

export type LegalChangelogEntry = {
  version: string
  date: string
  note: string
}

export type LegalDocument = {
  kind: LegalDocKind
  slug: string
  path: string
  tabLabel: string
  cardLabel: string
  icon: IconComponent
  title: string
  lede: string
  summary: string
  effectiveDate: string
  version: string
  readingTime: string
  intro: ReactNode
  clauses: LegalClause[]
  changelog: LegalChangelogEntry[]
}

// Inline link styling shared by cross-references and mail links inside the copy.
// Se define como cadena (no componente) para mantener este archivo solo-datos.
const inlineLinkClass = 'font-semibold text-(--asi-primary) underline-offset-2 hover:underline'

const DocLink = ({ to, children }: { to: string; children: ReactNode }) => (
  <Link className={inlineLinkClass} to={to}>
    {children}
  </Link>
)

const MailLink = ({ address }: { address: string }) => (
  <a className={inlineLinkClass} href={`mailto:${address}`}>
    {address}
  </a>
)

const paths = surfacePaths.institutional

const termsDocument: LegalDocument = {
  kind: 'terms',
  slug: 'terminos',
  path: paths.terms,
  tabLabel: 'Términos y condiciones',
  cardLabel: 'Términos y condiciones',
  icon: FileText,
  title: 'Términos y condiciones de uso',
  lede: 'Estas condiciones explican qué estás pagando o aportando y qué esperar antes de completar un pago en línea con ASI República Dominicana.',
  summary: 'Alcance del portal, membresías, donaciones y la aceptación previa al pago.',
  effectiveDate: '1 de julio, 2026',
  version: '3.1',
  readingTime: '~6 min',
  intro: (
    <>
      Bienvenido al portal de <strong>ASI República Dominicana</strong>. Este documento es un acuerdo entre tú (el{' '}
      <strong>tarjetahabiente o usuario</strong>) y {merchantCompliance.legalName} (la{' '}
      <strong>“Institución”</strong>). Al registrarte, pagar una membresía o realizar una donación confirmas que has
      leído, entendido y aceptado estas condiciones y las políticas relacionadas.
    </>
  ),
  clauses: [
    {
      id: 'definiciones',
      tocLabel: 'Definiciones',
      title: 'Definiciones',
      blocks: [
        { kind: 'paragraph', content: 'Para efectos de estos términos se entiende por:' },
        {
          kind: 'definitions',
          items: [
            { term: 'Portal', description: 'El sitio institucional de ASI República Dominicana y sus funciones de membresía y donación en línea.' },
            { term: 'Institución', description: merchantCompliance.legalName + '.' },
            { term: 'Miembro', description: 'Persona con una membresía institucional solicitada, aprobada o activa dentro del portal.' },
            { term: 'Donante', description: 'Persona que realiza un aporte voluntario a un fondo o proyecto institucional.' },
            { term: 'Pasarela de pagos', description: `El proveedor externo certificado (${merchantCompliance.paymentProcessor}) que procesa los cobros con tarjeta.` }
          ]
        }
      ]
    },
    {
      id: 'objeto',
      tocLabel: 'Objeto y alcance',
      title: 'Objeto y alcance del servicio',
      blocks: [
        {
          kind: 'paragraph',
          content: `${merchantCompliance.businessName} opera como portal institucional para gestionar membresías, recibir donaciones y coordinar la participación en programas y proyectos de ASI en República Dominicana.`
        },
        {
          kind: 'paragraph',
          content: (
            <>
              El portal es una herramienta de gestión institucional: <strong>no comercializa productos físicos</strong> y no
              sustituye las decisiones, aprobaciones ni obligaciones que correspondan a los órganos de ASI. Todos los montos
              se muestran en pesos dominicanos ({merchantCompliance.currency}).
            </>
          )
        }
      ]
    },
    {
      id: 'membresias',
      tocLabel: 'Membresías',
      title: 'Membresías',
      blocks: [
        {
          kind: 'paragraph',
          content: 'Los pagos de membresía cubren la cuota institucional del período de vigencia según la categoría seleccionada y aprobada. Al solicitar o renovar una membresía aceptas que:'
        },
        {
          kind: 'list',
          items: [
            <>La activación inicial queda sujeta a la <strong>aprobación administrativa</strong> conforme a las reglas de membresía.</>,
            'La renovación actualiza la vigencia del período correspondiente una vez confirmado el pago.',
            <>Los detalles de vigencia y comprobantes se describen en <DocLink to={paths.delivery}>Entrega del servicio</DocLink>.</>
          ]
        }
      ]
    },
    {
      id: 'donaciones',
      tocLabel: 'Donaciones',
      title: 'Donaciones',
      blocks: [
        {
          kind: 'paragraph',
          content: 'Las donaciones son aportes voluntarios destinados al fondo o proyecto que indiques durante el proceso de pago. El destino seleccionado orienta el uso administrativo del aporte y no implica la entrega de un bien a cambio.'
        },
        {
          kind: 'callout',
          tone: 'blue',
          icon: UserCheck,
          content: (
            <>
              Como norma general, una donación confirmada se considera un aporte a la misión institucional. Los casos de
              cobro duplicado o error se revisan según{' '}
              <DocLink to={paths.refunds}>Devoluciones y cancelaciones</DocLink>.
            </>
          )
        }
      ]
    },
    {
      id: 'aceptacion',
      tocLabel: 'Aceptación antes del pago',
      title: 'Aceptación antes del pago',
      blocks: [
        {
          kind: 'paragraph',
          content: (
            <>
              Antes de ser redirigido a la pasarela {merchantCompliance.paymentProcessor}, debes confirmar que aceptas estos
              términos y las políticas relacionadas. Al completar el pago, declaras que la información suministrada es correcta
              y que estás <strong>autorizado a utilizar la tarjeta</strong>.
            </>
          )
        }
      ]
    },
    {
      id: 'uso-portal',
      tocLabel: 'Uso del portal',
      title: 'Uso aceptable del portal',
      blocks: [
        { kind: 'paragraph', content: 'Al usar el portal te comprometes a no:' },
        {
          kind: 'list',
          items: [
            'Suministrar información falsa o utilizar medios de pago no autorizados.',
            'Intentar vulnerar la seguridad del portal o el acceso de otros usuarios.',
            'Emplear el portal con fines distintos a la membresía, la donación o la participación institucional.'
          ]
        },
        { kind: 'paragraph', content: 'El uso indebido puede motivar la suspensión del acceso y, cuando corresponda, la reversión de una transacción.' }
      ]
    },
    {
      id: 'propiedad',
      tocLabel: 'Propiedad y contenido',
      title: 'Propiedad intelectual y contenido',
      blocks: [
        {
          kind: 'paragraph',
          content: 'La marca, el diseño y el contenido del portal pertenecen a la Institución y a las entidades de ASI. Estos términos no transfieren derechos de propiedad al usuario.'
        }
      ]
    },
    {
      id: 'responsabilidad',
      tocLabel: 'Responsabilidad',
      title: 'Limitación de responsabilidad',
      blocks: [
        {
          kind: 'paragraph',
          content: (
            <>
              El portal se ofrece <strong>“tal cual” y “según disponibilidad”</strong>. En la máxima medida permitida por la ley,
              la Institución no será responsable de fallos atribuibles a terceros —como proveedores de infraestructura o la
              pasarela de pagos— ni de interrupciones ajenas a su control razonable.
            </>
          )
        }
      ]
    },
    {
      id: 'cambios',
      tocLabel: 'Cambios y contacto',
      title: 'Cambios y contacto',
      blocks: [
        {
          kind: 'paragraph',
          content: 'La Institución podrá actualizar estos términos para reflejar mejoras del servicio o cambios legales. Las modificaciones relevantes se publican en esta misma página con su fecha de vigencia y versión.'
        },
        {
          kind: 'paragraph',
          content: (
            <>
              Para cualquier duda escribe a <MailLink address={merchantCompliance.email} /> o llama al{' '}
              <strong>{merchantCompliance.phone}</strong>. Estas condiciones se rigen por la legislación aplicable en{' '}
              {merchantCompliance.country}.
            </>
          )
        }
      ]
    }
  ],
  changelog: [
    { version: '3.1', date: '1 jul 2026', note: 'Lenguaje simplificado y referencias cruzadas a pagos, entrega y cancelaciones.' },
    { version: '3.0', date: '12 mar 2026', note: 'Reestructura del documento en cláusulas de membresía y donación.' },
    { version: '2.2', date: '4 nov 2025', note: 'Actualización de la limitación de responsabilidad.' }
  ]
}

const privacyDocument: LegalDocument = {
  kind: 'privacy',
  slug: 'privacidad',
  path: paths.privacy,
  tabLabel: 'Privacidad',
  cardLabel: 'Política de privacidad',
  icon: Lock,
  title: 'Política de privacidad',
  lede: 'Cómo recopilamos, usamos y protegemos tus datos al procesar membresías y donaciones. En lenguaje claro y sin letra pequeña innecesaria.',
  summary: 'Qué datos tratamos, para qué, con quién los compartimos y tus derechos.',
  effectiveDate: '1 de julio, 2026',
  version: '2.4',
  readingTime: '~5 min',
  intro: (
    <>
      Tu confianza es la base de este portal. Esta política explica{' '}
      <strong>qué datos tratamos, para qué y con qué controles</strong> cuando gestionas una membresía o realizas una donación
      en ASI República Dominicana.
    </>
  ),
  clauses: [
    {
      id: 'que-recopilamos',
      tocLabel: 'Qué datos recopilamos',
      title: 'Qué datos recopilamos',
      blocks: [
        {
          kind: 'list',
          items: [
            <><strong>Datos de contacto:</strong> nombre, correo electrónico y teléfono.</>,
            <><strong>Datos de la transacción:</strong> categoría de membresía o destino de donación, monto, orden de pago y respuesta operativa de la pasarela.</>,
            <><strong>Datos técnicos:</strong> dirección IP y datos de navegación básicos para seguridad y trazabilidad.</>
          ]
        }
      ]
    },
    {
      id: 'como-usamos',
      tocLabel: 'Cómo usamos tus datos',
      title: 'Cómo usamos tus datos',
      blocks: [
        { kind: 'paragraph', content: 'Usamos la información únicamente para fines legítimos y concretos:' },
        {
          kind: 'list',
          items: [
            'Confirmar pagos y emitir comprobantes.',
            'Dar soporte y responder solicitudes de servicio al cliente.',
            'Mantener auditoría interna y cumplir obligaciones administrativas y fiscales.'
          ]
        },
        {
          kind: 'paragraph',
          content: <><strong>Nunca vendemos tus datos</strong> ni los usamos para publicidad de terceros.</>
        }
      ]
    },
    {
      id: 'datos-tarjeta',
      tocLabel: 'Datos de tarjeta',
      title: 'Datos de tarjeta',
      blocks: [
        {
          kind: 'callout',
          tone: 'green',
          icon: ShieldCheck,
          content: (
            <>
              <strong>No almacenamos los datos de tu tarjeta.</strong> No guardamos el número completo, el código de seguridad
              (CVV) ni tus credenciales bancarias: esa información la ingresas y la gestiona íntegramente la pasarela{' '}
              {merchantCompliance.paymentProcessor}. Más detalle en{' '}
              <DocLink to={paths.paymentSecurity}>Seguridad de pagos</DocLink>.
            </>
          )
        }
      ]
    },
    {
      id: 'con-quien-compartimos',
      tocLabel: 'Con quién compartimos',
      title: 'Con quién compartimos datos',
      blocks: [
        { kind: 'paragraph', content: 'Solo compartimos datos con proveedores estrictamente necesarios para operar el servicio:' },
        {
          kind: 'list',
          items: [
            <><strong>Infraestructura en la nube</strong> para alojar el portal de forma segura.</>,
            <><strong>Pasarela de pagos certificada</strong> para procesar los cobros.</>,
            <><strong>Autoridades</strong>, únicamente cuando la ley lo exija.</>
          ]
        }
      ]
    },
    {
      id: 'conservacion',
      tocLabel: 'Conservación y protección',
      title: 'Conservación y protección',
      blocks: [
        {
          kind: 'paragraph',
          content: 'Conservamos los registros de pagos y comprobantes durante el tiempo necesario para fines administrativos, fiscales, de auditoría y soporte.'
        },
        {
          kind: 'paragraph',
          content: 'Aplicamos control de accesos, registros de auditoría y servicios de infraestructura seguros con cifrado en tránsito para proteger la información.'
        }
      ]
    },
    {
      id: 'cookies',
      tocLabel: 'Cookies',
      title: 'Cookies',
      blocks: [
        {
          kind: 'paragraph',
          content: 'Usamos cookies necesarias para el funcionamiento del portal (por ejemplo, mantener tu sesión) y cookies opcionales para entender el uso y mejorar la experiencia. Puedes gestionar las opcionales desde tu navegador.'
        }
      ]
    },
    {
      id: 'tus-derechos',
      tocLabel: 'Tus derechos',
      title: 'Tus derechos',
      blocks: [
        {
          kind: 'paragraph',
          content: (
            <>
              Puedes solicitar acceder, corregir o eliminar tus datos personales escribiendo a{' '}
              <MailLink address={merchantCompliance.email} />. Responderemos en los plazos que marque la ley aplicable.
            </>
          )
        }
      ]
    },
    {
      id: 'contacto-privacidad',
      tocLabel: 'Contacto',
      title: 'Seguridad y contacto',
      blocks: [
        {
          kind: 'paragraph',
          content: (
            <>
              Si tienes dudas sobre privacidad, escribe a <MailLink address={merchantCompliance.email} /> o llama al{' '}
              <strong>{merchantCompliance.phone}</strong> en horario de {merchantCompliance.supportHours}.
            </>
          )
        }
      ]
    }
  ],
  changelog: [
    { version: '2.4', date: '1 jul 2026', note: 'Se detalla que no se almacenan datos de tarjeta y se aclara la conservación.' },
    { version: '2.3', date: '20 feb 2026', note: 'Sección de cookies ampliada.' },
    { version: '2.0', date: '1 sep 2025', note: 'Se precisa el uso de datos para membresías y donaciones.' }
  ]
}

const refundsDocument: LegalDocument = {
  kind: 'refunds',
  slug: 'devoluciones',
  path: paths.refunds,
  tabLabel: 'Devoluciones y cancelaciones',
  cardLabel: 'Devoluciones y cancelaciones',
  icon: RotateCcw,
  title: 'Devoluciones, reembolsos y cancelaciones',
  lede: 'Cuándo puede solicitarse una revisión, cómo se gestiona una cancelación y en qué casos aplican reembolsos. Sin condiciones ocultas.',
  summary: 'Reglas de membresías, donaciones, cancelaciones y reembolsos.',
  effectiveDate: '1 de julio, 2026',
  version: '2.0',
  readingTime: '~4 min',
  intro: (
    <>
      Estas políticas deben leerse <strong>antes de pagar</strong>. Explican de forma sencilla cuándo puede solicitarse una
      revisión, cómo funciona una cancelación y cuándo procede un reembolso.
    </>
  ),
  clauses: [
    {
      id: 'principios',
      tocLabel: 'Principios generales',
      title: 'Principios generales',
      blocks: [
        {
          kind: 'paragraph',
          content: 'Las membresías y donaciones no son productos físicos retornables. Aun así, revisamos con transparencia cualquier cobro duplicado, error operativo o transacción no reconocida.'
        }
      ]
    },
    {
      id: 'membresias-reembolso',
      tocLabel: 'Membresías',
      title: 'Membresías',
      blocks: [
        {
          kind: 'paragraph',
          content: 'Las cuotas de membresía aprobadas cubren un período de vigencia institucional. Si un pago fue duplicado, realizado por error o no pudo asociarse correctamente a la cuenta del miembro, puedes solicitar una revisión a Servicio al Cliente.'
        }
      ]
    },
    {
      id: 'donaciones-reembolso',
      tocLabel: 'Donaciones',
      title: 'Donaciones',
      blocks: [
        {
          kind: 'paragraph',
          content: 'Las donaciones confirmadas se consideran aportes voluntarios y, por regla general, no son reembolsables. La Institución podrá revisar casos excepcionales como cargos duplicados, error operativo o transacción no reconocida, sujeto a verificación.'
        }
      ]
    },
    {
      id: 'cancelaciones',
      tocLabel: 'Cancelaciones y plazos',
      title: 'Cancelaciones y plazos',
      blocks: [
        {
          kind: 'paragraph',
          content: (
            <>
              Si cancelas en la pantalla de {merchantCompliance.paymentProcessor} antes de autorizar, <strong>no se completa el
              cargo</strong>. Las solicitudes de revisión deben enviarse con número de orden, monto, fecha y correo usado en la
              transacción.
            </>
          )
        }
      ]
    },
    {
      id: 'solicitar-revision',
      tocLabel: 'Cómo solicitar una revisión',
      title: 'Cómo solicitar una revisión',
      blocks: [
        {
          kind: 'paragraph',
          content: (
            <>
              Escribe a <MailLink address={merchantCompliance.email} /> o llama al <strong>{merchantCompliance.phone}</strong>{' '}
              en horario de {merchantCompliance.supportHours}. Revisaremos la transacción contigo y, si corresponde, gestionaremos
              la devolución.
            </>
          )
        }
      ]
    },
    {
      id: 'reembolsos-aprobados',
      tocLabel: 'Reembolsos aprobados',
      title: 'Reembolsos aprobados',
      blocks: [
        {
          kind: 'callout',
          tone: 'blue',
          icon: RotateCcw,
          content: (
            <>
              Los reembolsos aprobados se devuelven <strong>al mismo medio de pago</strong> a través de la pasarela, normalmente
              en un plazo de 5 a 10 días hábiles según tu banco.
            </>
          )
        }
      ]
    }
  ],
  changelog: [
    { version: '2.0', date: '1 jul 2026', note: 'Se aclaran plazos de reembolso y el flujo de solicitud de revisión.' },
    { version: '1.5', date: '15 ene 2026', note: 'Se detalla el manejo de cargos duplicados en donaciones.' }
  ]
}

const deliveryDocument: LegalDocument = {
  kind: 'delivery',
  slug: 'entrega',
  path: paths.delivery,
  tabLabel: 'Entrega del servicio',
  cardLabel: 'Entrega del servicio',
  icon: CheckCircle2,
  title: 'Entrega del servicio',
  lede: 'Qué recibes al pagar, cómo se activa tu membresía o donación y dónde encuentras tu comprobante. No hay envíos físicos.',
  summary: 'Naturaleza del servicio, activación, comprobantes y soporte.',
  effectiveDate: '1 de julio, 2026',
  version: '1.8',
  readingTime: '~4 min',
  intro: (
    <>
      ASI República Dominicana presta un servicio <strong>100% en línea</strong>: no hay envíos físicos. Al confirmarse tu
      pago, el registro queda disponible de inmediato. Aquí te contamos cómo funciona la entrega.
    </>
  ),
  clauses: [
    {
      id: 'naturaleza',
      tocLabel: 'Naturaleza del servicio',
      title: 'Naturaleza del servicio',
      blocks: [
        {
          kind: 'paragraph',
          content: 'El portal gestiona servicios institucionales digitales: membresías y donaciones. No entrega mercancía física a cambio de un pago en línea.'
        }
      ]
    },
    {
      id: 'activacion',
      tocLabel: 'Activación y acceso',
      title: 'Activación y acceso',
      blocks: [
        {
          kind: 'steps',
          items: [
            { title: 'Eliges y pagas', description: 'Seleccionas la categoría de membresía o el destino de tu donación y confirmas el pago en la pasarela segura.' },
            { title: 'Se registra al instante', description: 'Cuando la pasarela confirma el pago, la transacción queda registrada de forma inmediata.' },
            { title: 'Activación', description: 'La membresía inicial se activa según la aprobación administrativa; la renovación actualiza la vigencia automáticamente.' }
          ]
        }
      ]
    },
    {
      id: 'comprobante',
      tocLabel: 'Comprobante',
      title: 'Comprobante',
      blocks: [
        {
          kind: 'paragraph',
          content: 'Después de la confirmación, el sistema muestra —o permite descargar— un comprobante con el comercio, número de orden, monto, resultado, autorización, referencia y fecha.'
        },
        {
          kind: 'callout',
          tone: 'blue',
          icon: MessageSquare,
          content: (
            <>
              Si el comprobante no aparece luego de un pago aprobado, contáctanos con tu número de orden a{' '}
              <MailLink address={merchantCompliance.email} />.
            </>
          )
        }
      ]
    },
    {
      id: 'disponibilidad',
      tocLabel: 'Disponibilidad y soporte',
      title: 'Disponibilidad y soporte',
      blocks: [
        {
          kind: 'paragraph',
          content: 'Procuramos mantener el portal disponible de forma continua. Nuestro equipo te acompaña en horario de ' + merchantCompliance.supportHours + '.'
        }
      ]
    },
    {
      id: 'requisitos',
      tocLabel: 'Requisitos técnicos',
      title: 'Requisitos técnicos',
      blocks: [
        {
          kind: 'paragraph',
          content: 'Solo necesitas una conexión a internet y un navegador actualizado (Chrome, Safari, Edge o Firefox) en computadora o móvil. No hay nada que instalar.'
        }
      ]
    }
  ],
  changelog: [
    { version: '1.8', date: '1 jul 2026', note: 'Se añade la línea de tiempo de activación del servicio.' },
    { version: '1.5', date: '10 dic 2025', note: 'Requisitos técnicos actualizados.' }
  ]
}

const securityDocument: LegalDocument = {
  kind: 'security',
  slug: 'pagos',
  path: paths.paymentSecurity,
  tabLabel: 'Seguridad de pagos',
  cardLabel: 'Seguridad de pagos',
  icon: CreditCard,
  title: 'Seguridad de pagos',
  lede: 'Cómo protegemos tus pagos: pasarela certificada, cifrado y —lo más importante— nunca almacenamos los datos de tu tarjeta.',
  summary: 'Transmisión de datos de tarjeta, pasarela AZUL, cifrado y 3D Secure.',
  effectiveDate: '1 de julio, 2026',
  version: '2.2',
  readingTime: '~4 min',
  intro: (
    <>
      Pagar en el portal es seguro por diseño. Trabajamos con una <strong>pasarela de pagos certificada</strong> y aplicamos el
      principio de <strong>guardar lo mínimo</strong>: nunca almacenamos los datos sensibles de tu tarjeta.
    </>
  ),
  clauses: [
    {
      id: 'no-guardamos',
      tocLabel: 'No guardamos tu tarjeta',
      title: 'No almacenamos los datos de tu tarjeta',
      blocks: [
        {
          kind: 'callout',
          tone: 'green',
          icon: ShieldCheck,
          content: (
            <>
              <strong>Tus datos de tarjeta nunca pasan por nuestros servidores.</strong> No guardamos el número completo, el
              código de seguridad (CVV) ni tus credenciales bancarias. Esa información la introduces directamente en la página
              segura de {merchantCompliance.paymentProcessor}.
            </>
          )
        },
        {
          kind: 'paragraph',
          content: 'Solo conservamos referencias no sensibles que no permiten realizar cobros por sí solas, como el estado de cada pago, el número de orden y la autorización.'
        }
      ]
    },
    {
      id: 'pasarela',
      tocLabel: 'Pasarela certificada',
      title: 'Pasarela de pagos certificada',
      blocks: [
        {
          kind: 'paragraph',
          content: (
            <>
              Todas las transacciones se procesan a través de {merchantCompliance.paymentProcessor}, un proveedor externo que
              cumple con el estándar internacional <strong>PCI-DSS</strong>, el mismo nivel de seguridad que exigen los bancos
              para proteger la información de las tarjetas.
            </>
          )
        }
      ]
    },
    {
      id: 'cifrado',
      tocLabel: 'Cifrado',
      title: 'Cifrado de la información',
      blocks: [
        {
          kind: 'paragraph',
          content: 'La comunicación entre tu navegador, el portal y la pasarela viaja siempre cifrada mediante HTTPS/TLS. El portal envía a la pasarela el monto, comercio, orden y URLs de retorno; la respuesta firmada se valida antes de marcar una transacción como aprobada.'
        }
      ]
    },
    {
      id: '3d-secure',
      tocLabel: '3D Secure y fraude',
      title: '3D Secure y prevención de fraude',
      blocks: [
        {
          kind: 'paragraph',
          content: 'Cuando el emisor lo requiere, la transacción usa autenticación 3D Secure mediante Visa Secure o Mastercard ID Check. Sigue las instrucciones de tu banco para completar la verificación.'
        }
      ]
    },
    {
      id: 'facturacion',
      tocLabel: 'Facturación transparente',
      title: 'Facturación transparente',
      blocks: [
        {
          kind: 'paragraph',
          content: 'Cada cobro genera un comprobante disponible en tu cuenta. Verás con claridad el concepto, el período y los montos aplicables, sin cargos sorpresa ni conceptos ocultos.'
        }
      ]
    },
    {
      id: 'cargo-no-reconocido',
      tocLabel: 'Cargo no reconocido',
      title: '¿Un cargo que no reconoces?',
      blocks: [
        {
          kind: 'paragraph',
          content: (
            <>
              Si detectas un cobro que no reconoces, escríbenos cuanto antes a{' '}
              <MailLink address={merchantCompliance.email} />. Revisaremos la transacción y, si corresponde, gestionaremos la
              devolución según <DocLink to={paths.refunds}>Devoluciones y cancelaciones</DocLink>.
            </>
          )
        }
      ]
    }
  ],
  changelog: [
    { version: '2.2', date: '1 jul 2026', note: 'Detalle de cifrado, 3D Secure y prevención de fraude.' },
    { version: '2.0', date: '5 oct 2025', note: 'Certificación PCI-DSS de la pasarela de pagos.' }
  ]
}

export const legalDocuments: Record<LegalDocKind, LegalDocument> = {
  terms: termsDocument,
  privacy: privacyDocument,
  refunds: refundsDocument,
  delivery: deliveryDocument,
  security: securityDocument
}

export const legalDocumentOrder: LegalDocKind[] = ['terms', 'privacy', 'refunds', 'delivery', 'security']

export const legalDocumentList: LegalDocument[] = legalDocumentOrder.map((kind) => legalDocuments[kind])

export const metaPillIcons = {
  date: CalendarDays,
  version: ShieldCheck,
  reading: Clock
} as const
