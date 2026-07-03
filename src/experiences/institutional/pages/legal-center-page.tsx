import { ArrowRight, Clock, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'

import { surfacePaths } from '@/app/router/surface-paths'
import { InstitutionalSection } from '@/experiences/institutional/components/institutional-ui'
import { LegalIdentityPanel } from '@/experiences/institutional/components/legal-center-ui'
import { legalDocumentList } from '@/experiences/institutional/content/legal-center-content'
import { merchantCompliance } from '@/experiences/institutional/content/payment-compliance-content'

export function LegalCenterPage() {
  return (
    <div>
      <InstitutionalSection reveal="mount">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.46fr)] lg:items-start">
          <div>
            <p className="asi-kicker">Centro legal · ASI</p>
            <h1 className="asi-heading-lg mt-4 max-w-[18ch] text-[clamp(2rem,4.4vw,2.8rem)]">
              Todas nuestras políticas, en un solo lugar
            </h1>
            <p className="asi-copy mt-5 max-w-[64ch] text-[1.05rem]">
              Términos, privacidad, devoluciones, entrega y seguridad de pagos para membresías y donaciones de{' '}
              {merchantCompliance.businessName}. Cada documento tiene su propia página citable, con versión, fecha de
              vigencia y opción de imprimir o descargar.
            </p>
          </div>

          {/* Destacado: no guardamos tu tarjeta */}
          <div className="flex gap-3.5 rounded-card-lg border border-[#cdeadb] bg-[#eef8f2] p-5 sm:p-6">
            <span className="grid size-9 shrink-0 place-items-center rounded-control bg-[#1f9d61]/14 text-[#1f9d61]">
              <ShieldCheck className="size-5" />
            </span>
            <div>
              <p className="text-[0.98rem] font-bold text-[#14512f]">No almacenamos los datos de tu tarjeta</p>
              <p className="mt-1.5 text-[0.9rem] leading-6 text-[#1c6844]">
                Los pagos se procesan en la página segura de {merchantCompliance.paymentProcessor}, con certificación
                PCI-DSS. El número completo y el CVV nunca pasan por nuestros servidores.
              </p>
            </div>
          </div>
        </div>
      </InstitutionalSection>

      <InstitutionalSection tone="muted" spacing="default">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {legalDocumentList.map((document) => {
            const Icon = document.icon
            return (
              <Link
                key={document.kind}
                className="group flex flex-col rounded-card-lg border border-(--asi-outline) bg-white/90 p-5 shadow-(--asi-shadow-soft) transition duration-300 hover:-translate-y-1 hover:shadow-(--asi-shadow-strong) sm:p-6"
                to={document.path}
              >
                <div className="flex size-11 items-center justify-center rounded-card bg-(--asi-surface-muted) text-(--asi-primary)">
                  <Icon className="size-5" />
                </div>
                <h2 className="mt-4 text-lg font-bold tracking-tight text-(--asi-text)">{document.cardLabel}</h2>
                <p className="asi-copy mt-2 text-[0.95rem]">{document.summary}</p>
                <div className="mt-5 flex items-center gap-3 border-t border-(--asi-outline) pt-4 text-[0.78rem] font-semibold text-(--asi-secondary)">
                  <span className="rounded-pill bg-(--asi-primary)/8 px-2.5 py-1 text-(--asi-primary)">v{document.version}</span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="size-3.5" />
                    {document.readingTime}
                  </span>
                  <span className="ml-auto inline-flex items-center gap-1 text-(--asi-primary) transition group-hover:gap-2">
                    Leer
                    <ArrowRight className="size-4" />
                  </span>
                </div>
              </Link>
            )
          })}
        </div>

        <p className="mt-6 max-w-[64ch] text-sm leading-6 text-(--asi-text-muted)">
          ¿Vas a citar una política? Cada documento vive en su propia URL —por ejemplo{' '}
          <Link className="font-semibold text-(--asi-primary) hover:underline" to={surfacePaths.institutional.privacy}>
            {surfacePaths.institutional.privacy}
          </Link>
          — para poder enlazarla desde un correo, un comprobante o el checkout.
        </p>
      </InstitutionalSection>

      <InstitutionalSection>
        <LegalIdentityPanel className="bg-(--asi-surface-panel)" />
      </InstitutionalSection>
    </div>
  )
}
