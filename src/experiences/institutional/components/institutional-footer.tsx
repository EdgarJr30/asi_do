import { MoveRight } from 'lucide-react';
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

type InstitutionalFooterProps = {
  platformButton?: {
    label: string;
    to: string;
  };
};

function CompactFooterLink({ label, to }: { label: string; to: string }) {
  return (
    <Link className="group flex min-h-11 items-center focus:outline-none" to={to}>
      <span className="flex min-h-8 w-full items-center justify-between gap-1 rounded-control bg-white/6 px-2 text-[0.6875rem] font-medium leading-none whitespace-nowrap text-white/82 transition group-hover:bg-white/12 group-hover:text-white group-focus-visible:ring-2 group-focus-visible:ring-white/70">
        {label}
        <MoveRight className="size-3 shrink-0 text-white/44" />
      </span>
    </Link>
  );
}

export function InstitutionalFooter({
  platformButton = {
    label: 'Plataforma ASI',
    to: surfacePaths.public.home,
  },
}: InstitutionalFooterProps) {
  const currentYear = new Date().getFullYear();

  return (
    <div className="asi-site">
      <footer className="bg-(--asi-primary) text-white">
        <div className="asi-container py-7 sm:py-8">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)] xl:gap-5">
            <div className="rounded-card-lg border border-white/10 bg-white/6 p-4 shadow-[0_20px_50px_rgba(0,0,0,0.12)] backdrop-blur-sm sm:p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-20 shrink-0 items-center justify-center rounded-card bg-white/10 px-3 backdrop-blur-sm sm:w-24">
                  <BrandLockup className="w-full" surface="dark" />
                </span>
                <div className="min-w-0">
                  <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-white/60">
                    Portal institucional
                  </p>
                  <p className="mt-1 text-lg font-semibold leading-tight sm:text-[1.35rem]">
                    ASI República Dominicana
                  </p>
                </div>
              </div>
              <p className="mt-3 max-w-xl text-sm leading-6 text-white/74">
                {merchantCompliance.legalName}. Membresías y donaciones
                procesadas en {merchantCompliance.currency}.
                <br />
                Dirección permanente: {merchantCompliance.address}
              </p>
              <div className="mt-3">
                <PaymentBrandStrip compact itemClassName="border-white/12 bg-white" />
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <Link
                  className="asi-button asi-button-secondary w-full justify-center"
                  to={platformButton.to}
                >
                  {platformButton.label}
                </Link>
                <Link
                  className="asi-button asi-button-primary w-full justify-center"
                  to={surfacePaths.institutional.donate}
                >
                  Donaciones
                </Link>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <div className="rounded-card-lg border border-white/10 bg-white/6 p-3 backdrop-blur-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/64">
                  Explora
                </p>
                <div className="mt-2 grid grid-cols-2 gap-x-1">
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
                <div className="mt-2 grid grid-cols-1 gap-x-1 min-[440px]:grid-cols-2">
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
