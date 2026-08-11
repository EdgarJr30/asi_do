import { Building2, Mail, MapPin, MoveRight, Phone } from 'lucide-react';
import { Link } from 'react-router-dom';

import { surfacePaths } from '@/app/router/surface-paths';
import { BrandLockup } from '@/components/ui/app-brand';
import { AppEnvironmentBadge } from '@/components/ui/app-environment-badge';
import { institutionalNavigation } from '@/experiences/institutional/content/site-content';
import {
  merchantCompliance,
  paymentPolicyLinks,
} from '@/experiences/institutional/content/payment-compliance-content';
import { PaymentBrandStrip } from '@/shared/ui/payment-brand-strip';

function CompactFooterLink({ label, to }: { label: string; to: string }) {
  return (
    <Link className="group flex min-h-11 items-center focus:outline-none" to={to}>
      <span className="flex min-h-9 w-full items-center justify-between gap-1.5 rounded-control bg-white/6 px-2.5 text-xs font-medium leading-none whitespace-nowrap text-white/82 transition group-hover:bg-white/12 group-hover:text-white group-focus-visible:ring-2 group-focus-visible:ring-white/70">
        {label}
        <MoveRight className="size-3.5 shrink-0 text-white/44" />
      </span>
    </Link>
  );
}

export function InstitutionalFooter() {
  const currentYear = new Date().getFullYear();
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(merchantCompliance.address)}`;
  const phoneUrl = `tel:${merchantCompliance.phone.replace(/\s/g, '')}`;

  return (
    <div className="asi-site">
      <footer className="bg-(--asi-primary) text-white">
        <div className="asi-container py-7 sm:py-8">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)] xl:gap-5">
            <div
              className="rounded-card-lg border border-white/10 bg-white/6 p-5 shadow-[0_20px_50px_rgba(0,0,0,0.12)] backdrop-blur-sm sm:p-6"
              data-testid="institutional-footer-contact-card"
            >
              <div className="flex items-center gap-4 sm:gap-5">
                <BrandLockup className="w-20 shrink-0 drop-shadow-sm sm:w-24" surface="dark" />
                <div className="min-w-0">
                  <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-white/60">
                    Portal institucional
                  </p>
                  <p className="mt-1.5 text-xl font-bold leading-tight tracking-tight text-white sm:text-2xl">
                    ASI República Dominicana
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-3.5 border-t border-white/10 pt-4 text-sm text-white/76">
                <div className="flex items-start gap-3">
                  <Building2 className="mt-0.5 size-4 shrink-0 text-white/58" />
                  <span className="leading-5">{merchantCompliance.legalName}</span>
                </div>
                <a
                  className="flex items-start gap-3 leading-5 transition hover:text-white"
                  href={mapUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  <MapPin className="mt-0.5 size-4 shrink-0 text-white/58" />
                  <span>{merchantCompliance.address}</span>
                </a>
                <div className="grid gap-3 sm:grid-cols-2">
                  <a
                    className="flex min-h-11 items-center gap-3 rounded-control bg-white/5 px-3 transition hover:bg-white/10 hover:text-white"
                    href={`mailto:${merchantCompliance.email}`}
                  >
                    <Mail className="size-4 shrink-0 text-white/58" />
                    <span className="min-w-0 truncate">{merchantCompliance.email}</span>
                  </a>
                  <a
                    className="flex min-h-11 items-center gap-3 rounded-control bg-white/5 px-3 transition hover:bg-white/10 hover:text-white"
                    href={phoneUrl}
                  >
                    <Phone className="size-4 shrink-0 text-white/58" />
                    <span>{merchantCompliance.phone}</span>
                  </a>
                </div>
              </div>

              <div className="mt-4 border-t border-white/10 pt-4">
                <PaymentBrandStrip compact itemClassName="border-white/12 bg-white" />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <div className="rounded-card-lg border border-white/10 bg-white/6 p-3 backdrop-blur-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/64">
                  Explora
                </p>
                <div className="mt-2 grid grid-cols-1">
                  {institutionalNavigation.map((item) => (
                    <CompactFooterLink key={item.to} label={item.label} to={item.to} />
                  ))}
                  <CompactFooterLink label="Plataforma ASI" to={surfacePaths.public.home} />
                  <CompactFooterLink label="Iniciar sesión" to={surfacePaths.auth.signIn} />
                  <CompactFooterLink label="Donaciones" to={surfacePaths.institutional.donate} />
                </div>
              </div>

              <div className="rounded-card-lg border border-white/10 bg-white/6 p-3 backdrop-blur-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/64">
                  Pagos y políticas
                </p>
                <div className="mt-2 grid grid-cols-1">
                  {paymentPolicyLinks.map((item) => (
                    <CompactFooterLink key={item.to} label={item.label} to={item.to} />
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="mt-5 flex flex-col items-center gap-2 border-t border-white/12 pt-4 text-center text-xs leading-5 text-white/68 sm:flex-row sm:justify-between sm:text-left">
            <p>
              Copyright © {currentYear} ASI República Dominicana. Compartiendo
              el mensaje de esperanza a través de la fe y el servicio.
            </p>
            <AppEnvironmentBadge className="shrink-0" surface="dark" />
          </div>
        </div>
      </footer>
    </div>
  );
}
