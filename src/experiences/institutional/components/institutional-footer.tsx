import { MoveRight } from 'lucide-react';
import { Link } from 'react-router-dom';

import { surfacePaths } from '@/app/router/surface-paths';
import { BrandLockup } from '@/components/ui/app-brand';
import { institutionalNavigation } from '@/experiences/institutional/content/site-content';
import {
  merchantCompliance,
  paymentPolicyLinks,
} from '@/experiences/institutional/content/payment-compliance-content';
import { PaymentBrandStrip } from '@/shared/ui/payment-brand-strip';

export function InstitutionalFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <div className="asi-site">
      <footer className="bg-(--asi-primary) text-white">
        <div className="asi-container py-10 sm:py-12">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:gap-8">
            <div className="rounded-[1.75rem] border border-white/10 bg-white/6 p-5 shadow-[0_20px_50px_rgba(0,0,0,0.12)] backdrop-blur-sm sm:p-6">
              <div className="flex items-center gap-4">
                <span className="flex h-16 w-24 shrink-0 items-center justify-center rounded-2xl bg-white/10 px-3 backdrop-blur-sm sm:w-28">
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
              <p className="mt-5 max-w-xl text-sm leading-7 text-white/74 sm:mt-6">
                {merchantCompliance.legalName}. Membresías y donaciones
                procesadas en {merchantCompliance.currency}. Dirección
                permanente: {merchantCompliance.address}.
              </p>
              <div className="mt-5">
                <PaymentBrandStrip itemClassName="border-white/12 bg-white" />
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <Link
                  className="asi-button asi-button-secondary w-full justify-center"
                  to={surfacePaths.public.home}
                >
                  Plataforma ASI
                </Link>
                <Link
                  className="asi-button asi-button-primary w-full justify-center"
                  to={surfacePaths.institutional.donate}
                >
                  Donaciones
                </Link>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3 sm:gap-5">
              <div className="rounded-3xl border border-white/10 bg-white/6 p-5 backdrop-blur-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/64">
                  Explora
                </p>
                <div className="mt-4 space-y-2.5">
                  {institutionalNavigation.map((item) => (
                    <Link
                      key={item.to}
                      className="flex items-center justify-between rounded-2xl bg-white/6 px-3.5 py-3 text-sm font-medium text-white/82 transition hover:bg-white/12 hover:text-white"
                      to={item.to}
                    >
                      {item.label}
                      <MoveRight className="size-4 text-white/44" />
                    </Link>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/6 p-5 backdrop-blur-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/64">
                  Puente
                </p>
                <div className="mt-4 space-y-2.5">
                  <Link
                    className="flex items-center justify-between rounded-2xl bg-white/6 px-3.5 py-3 text-sm font-medium text-white/82 transition hover:bg-white/12 hover:text-white"
                    to={surfacePaths.public.home}
                  >
                    Plataforma ASI
                    <MoveRight className="size-4 text-white/44" />
                  </Link>
                  <Link
                    className="flex items-center justify-between rounded-2xl bg-white/6 px-3.5 py-3 text-sm font-medium text-white/82 transition hover:bg-white/12 hover:text-white"
                    to={surfacePaths.auth.signIn}
                  >
                    Iniciar sesión
                    <MoveRight className="size-4 text-white/44" />
                  </Link>
                  <Link
                    className="flex items-center justify-between rounded-2xl bg-white/6 px-3.5 py-3 text-sm font-medium text-white/82 transition hover:bg-white/12 hover:text-white"
                    to={surfacePaths.institutional.contactUs}
                  >
                    Contáctanos
                    <MoveRight className="size-4 text-white/44" />
                  </Link>
                  <Link
                    className="flex items-center justify-between rounded-2xl bg-white/6 px-3.5 py-3 text-sm font-medium text-white/82 transition hover:bg-white/12 hover:text-white"
                    to={surfacePaths.institutional.donate}
                  >
                    Donaciones
                    <MoveRight className="size-4 text-white/44" />
                  </Link>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/6 p-5 backdrop-blur-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/64">
                  Pagos y políticas
                </p>
                <div className="mt-4 space-y-2.5">
                  {paymentPolicyLinks.map((item) => (
                    <Link
                      key={item.to}
                      className="flex items-center justify-between rounded-2xl bg-white/6 px-3.5 py-3 text-sm font-medium text-white/82 transition hover:bg-white/12 hover:text-white"
                      to={item.to}
                    >
                      {item.label}
                      <MoveRight className="size-4 text-white/44" />
                    </Link>
                  ))}
                </div>
                <div className="mt-4 rounded-2xl bg-white/6 px-3.5 py-3 text-xs leading-5 text-white/72">
                  Servicio al Cliente: {merchantCompliance.email} ·{' '}
                  {merchantCompliance.phone}
                </div>
              </div>
            </div>
          </div>
          <div className="mt-8 border-t border-white/12 pt-5 text-center text-sm leading-6 text-white/68 sm:text-left">
            Copyright © {currentYear} ASI República Dominicana. Compartiendo el
            mensaje de esperanza a través de la fe y el servicio.
          </div>
        </div>
      </footer>
    </div>
  );
}
