import { useLocation } from 'react-router-dom'

import { BrandLockup } from '@/components/ui/app-brand'

const authPanelContent = {
  signIn: {
    badge: 'ATS · Edicion 2026',
    title: 'Talento que mueve a Republica Dominicana.',
    description:
      'La plataforma operativa para gestionar vacantes, candidatos y procesos de contratacion en una sola vista.',
    footer: 'Disenado para equipos de RR.HH. en el Caribe.'
  },
  signUp: {
    badge: 'Cuenta base · ASI',
    title: 'Tu acceso personal es el punto de partida.',
    description:
      'Crea tu cuenta, completa tu perfil y conecta nuevos espacios de trabajo cuando tu empresa entre a la plataforma.',
    footer: 'Pensado para crecimiento progresivo, sin friccion innecesaria.'
  }
} as const

const statTiles = [
  { value: '12,4k', label: 'Candidatos' },
  { value: '340', label: 'Empresas' },
  { value: '98%', label: 'Uptime' }
] as const

export function AuthHeroPanel() {
  const location = useLocation()
  const isSignUp = location.pathname.includes('/sign-up')
  const content = isSignUp ? authPanelContent.signUp : authPanelContent.signIn

  return (
    <aside className="relative hidden min-h-screen overflow-hidden bg-[linear-gradient(135deg,#1a3b88_0%,#2d52a8_50%,#4869b6_100%)] px-10 py-12 text-white lg:flex lg:flex-col lg:justify-between xl:px-14 xl:py-14">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-10"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.55) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.55) 1px, transparent 1px)',
          backgroundSize: '40px 40px'
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-32 -top-32 size-[30rem] rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(138,162,216,0.4), transparent 70%)' }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-24 -left-24 size-[24rem] rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.14), transparent 70%)' }}
      />

      <div className="relative z-10 flex items-center justify-between gap-4">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/16 bg-white/10 px-3 py-1.5 text-[11px] font-semibold tracking-[0.14em] text-white/90 uppercase">
          <span className="size-1.5 rounded-full bg-emerald-300" />
          {content.badge}
        </div>

        <BrandLockup className="w-24 opacity-95 xl:w-28" surface="dark" />
      </div>

      <div className="relative z-10 max-w-[30rem]">
        <h2 className="max-w-[24rem] font-[var(--font-display)] text-[2.3rem] font-bold leading-[1.08] tracking-[-0.03em] text-white xl:text-[2.55rem]">
          {content.title}
        </h2>
        <p className="mt-5 max-w-[28rem] text-sm leading-7 text-white/78 xl:text-[0.95rem]">
          {content.description}
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {statTiles.map((item) => (
            <div
              key={item.label}
              className="rounded-[18px] border border-white/14 bg-white/8 px-4 py-3 backdrop-blur-[6px]"
            >
              <div className="font-[var(--font-display)] text-[1.4rem] font-bold tracking-[-0.03em] text-white">
                {item.value}
              </div>
              <div className="mt-1 text-[0.72rem] text-white/70">{item.label}</div>
            </div>
          ))}
        </div>
      </div>

      <p className="relative z-10 text-xs text-white/55">{content.footer}</p>
    </aside>
  )
}
