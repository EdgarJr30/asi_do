import { ArrowRight, Clock, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'

import { InstitutionalSection } from '@/experiences/institutional/components/institutional-ui'
import { LegalIdentityPanel } from '@/experiences/institutional/components/legal-center-ui'
import { legalDocumentList } from '@/experiences/institutional/content/legal-center-content'
import { merchantCompliance } from '@/experiences/institutional/content/payment-compliance-content'

export function LegalCenterPage() {
  return (
    <div>
      <InstitutionalSection reveal="mount" spacing="none">
        <div className="grid gap-5 py-7 sm:py-8 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.48fr)] lg:items-center lg:gap-10 lg:py-10">
          <div>
            <h1 className="asi-heading-lg max-w-[24ch] text-[clamp(1.75rem,3.2vw,2.2rem)]">
              Todas nuestras políticas, en un solo lugar
            </h1>
            <p className="asi-copy mt-3 max-w-[64ch] text-[0.95rem] leading-6">
              Términos, privacidad, devoluciones, entrega y seguridad de pagos para membresías y donaciones de{' '}
              {merchantCompliance.businessName}.
            </p>
          </div>

          {/* Destacado: no guardamos tu tarjeta */}
          <div className="flex gap-3 rounded-card border border-[#cdeadb] bg-[#eef8f2] p-4">
            <span className="grid size-8 shrink-0 place-items-center rounded-control bg-[#1f9d61]/14 text-[#1f9d61]">
              <ShieldCheck className="size-4" />
            </span>
            <div>
              <p className="text-[0.88rem] font-bold text-[#14512f]">No almacenamos los datos de tu tarjeta</p>
              <p className="mt-1 text-[0.82rem] leading-5 text-[#1c6844]">
                Los pagos se procesan en la página segura de {merchantCompliance.paymentProcessor}, con certificación
                PCI-DSS. El número completo y el CVV nunca pasan por nuestros servidores.
              </p>
            </div>
          </div>
        </div>
      </InstitutionalSection>

      <InstitutionalSection tone="muted" spacing="none">
        <div className="grid gap-3 py-8 md:grid-cols-2 xl:grid-cols-3">
          {legalDocumentList.map((document) => {
            const Icon = document.icon
            return (
              <Link
                key={document.kind}
                className="group flex flex-col rounded-card border border-(--asi-outline) bg-white/90 p-4 shadow-(--asi-shadow-soft) transition duration-200 hover:-translate-y-0.5 hover:shadow-(--asi-shadow-strong)"
                to={document.path}
              >
                <div className="flex size-9 items-center justify-center rounded-control bg-(--asi-surface-muted) text-(--asi-primary)">
                  <Icon className="size-4.5" />
                </div>
                <h2 className="mt-3 text-base font-bold tracking-tight text-(--asi-text)">{document.cardLabel}</h2>
                <p className="mt-1.5 text-[0.88rem] leading-6 text-(--asi-text-muted)">{document.summary}</p>
                <div className="mt-4 flex items-center gap-2.5 border-t border-(--asi-outline) pt-3 text-[0.75rem] font-semibold text-(--asi-secondary)">
                  <span className="rounded-pill bg-(--asi-primary)/8 px-2 py-0.5 text-(--asi-primary)">v{document.version}</span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="size-3" />
                    {document.readingTime}
                  </span>
                  <span className="ml-auto inline-flex items-center gap-1 text-(--asi-primary) transition group-hover:gap-2">
                    Leer
                    <ArrowRight className="size-3.5" />
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      </InstitutionalSection>

      <InstitutionalSection spacing="none">
        <div className="py-8">
          <LegalIdentityPanel className="bg-(--asi-surface-panel)" />
        </div>
      </InstitutionalSection>
    </div>
  )
}
