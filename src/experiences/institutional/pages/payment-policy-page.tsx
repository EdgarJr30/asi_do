import { Link } from 'react-router-dom'

import { surfacePaths } from '@/app/router/surface-paths'
import { InstitutionalCard, InstitutionalSection } from '@/experiences/institutional/components/institutional-ui'
import {
  merchantCompliance,
  paymentPolicyContent,
  paymentPolicyLinks,
  type PaymentPolicyKind
} from '@/experiences/institutional/content/payment-compliance-content'
import { PaymentBrandStrip } from '@/shared/ui/payment-brand-strip'

export function PaymentPolicyPage({ kind }: { kind: PaymentPolicyKind }) {
  const content = paymentPolicyContent[kind]
  const showSecurityExample = kind === 'security'
  const showReceiptModel = kind === 'receipt'

  return (
    <div>
      <InstitutionalSection reveal="mount">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(340px,0.48fr)] lg:items-start">
          <div>
            <p className="asi-kicker">{content.eyebrow}</p>
            <h1 className="asi-heading-lg mt-4 max-w-[14ch]">{content.title}</h1>
            <p className="asi-copy mt-5 max-w-[68ch] text-[1.02rem]">{content.description}</p>
            <PaymentBrandStrip className="mt-6" show3DSLabel />
          </div>

          <InstitutionalCard className="bg-white/88" hoverMotion={false}>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-(--asi-secondary)">
              Comercio
            </p>
            <dl className="mt-4 space-y-3 text-sm">
              <PolicyMeta label="Nombre comercial" value={merchantCompliance.businessName} />
              <PolicyMeta label="Razón institucional" value={merchantCompliance.legalName} />
              <PolicyMeta label="Moneda" value={merchantCompliance.currency} />
              <PolicyMeta label="Correo" value={merchantCompliance.email} />
              <PolicyMeta label="Teléfono" value={merchantCompliance.phone} />
              <PolicyMeta label="Dirección" value={merchantCompliance.address} />
            </dl>
          </InstitutionalCard>
        </div>
      </InstitutionalSection>

      <InstitutionalSection tone="muted">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start">
          <div className="space-y-4">
            {content.sections.map((section) => (
              <InstitutionalCard key={section.title} className="bg-white/92" hoverMotion={false}>
                <h2 className="text-xl font-semibold tracking-tight text-(--asi-text)">{section.title}</h2>
                <div className="mt-4 space-y-3">
                  {section.body.map((paragraph) => (
                    <p key={paragraph} className="asi-copy text-[0.98rem]">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </InstitutionalCard>
            ))}

            {showSecurityExample ? (
              <InstitutionalCard className="bg-white/92" hoverMotion={false}>
                <h2 className="text-xl font-semibold tracking-tight text-(--asi-text)">Referencia visual de seguridad</h2>
                <p className="asi-copy mt-3">
                  La política de transmisión de datos de tarjeta sigue el enfoque operativo del ejemplo provisto:
                  protección razonable del website, cifrado en tránsito y procesamiento de tarjeta por AZUL.
                </p>
                <img
                  alt="Ejemplo de políticas de seguridad para website y pagos"
                  className="mt-4 h-auto w-full rounded-2xl border border-slate-200 bg-white object-contain"
                  decoding="async"
                  height={515}
                  loading="lazy"
                  src="/payment/security-policy-example.webp"
                  width={957}
                />
              </InstitutionalCard>
            ) : null}

            {showReceiptModel ? <ReceiptModelCard /> : null}
          </div>

          <aside className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-[0_10px_30px_rgba(0,47,110,0.05)]">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-(--asi-secondary)">
              Políticas relacionadas
            </p>
            <div className="mt-3 space-y-2">
              {paymentPolicyLinks.map((link) => (
                <Link
                  key={link.to}
                  className="block rounded-2xl bg-(--asi-surface-muted) px-3 py-2.5 text-sm font-semibold text-(--asi-text) transition hover:bg-(--asi-surface-raised) hover:text-(--asi-primary)"
                  to={link.to}
                >
                  {link.label}
                </Link>
              ))}
            </div>
            <Link
              className="asi-button asi-button-primary mt-4 w-full justify-center"
              to={surfacePaths.institutional.donate}
            >
              Ir al checkout
            </Link>
          </aside>
        </div>
      </InstitutionalSection>
    </div>
  )
}

function PolicyMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-t border-slate-100 pt-3 first:border-t-0 first:pt-0">
      <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</dt>
      <dd className="mt-1 font-semibold leading-6 text-(--asi-text)">{value}</dd>
    </div>
  )
}

function ReceiptModelCard() {
  const rows = [
    ['Comercio', merchantCompliance.businessName],
    ['Tipo', 'Membresía / renovación / donación'],
    ['Número de orden', 'ASI-260624-1234abcd'],
    ['Monto', 'RD$ 1,500'],
    ['Resultado', 'Aprobado'],
    ['Autorización', 'OK0190'],
    ['Referencia', '2026062415220044297821'],
    ['Fecha', '24 de junio de 2026, 3:22 p. m.']
  ]

  return (
    <InstitutionalCard className="bg-white/92" hoverMotion={false}>
      <h2 className="text-xl font-semibold tracking-tight text-(--asi-text)">Ejemplo de comprobante</h2>
      <dl className="mt-4 space-y-1.5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-start justify-between gap-4 border-t border-slate-200 pt-2 first:border-t-0 first:pt-0">
            <dt className="text-slate-500">{label}</dt>
            <dd className="text-right font-semibold text-slate-900">{value}</dd>
          </div>
        ))}
      </dl>
    </InstitutionalCard>
  )
}
