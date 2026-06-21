import { useLocation } from 'react-router-dom'

import { BrandLockup } from '@/components/ui/app-brand'

const authPanelContent = {
  signIn: {
    badge: 'ASI · Edición 2026',
    title: 'Talento que mueve a República Dominicana.',
    description:
      'La plataforma operativa para gestionar vacantes, candidatos y procesos de contratación en una sola vista.',
    footer: 'Diseñado para conectar con quienes comparten tu fe.'
  },
  signUp: {
    badge: 'Cuenta base · ASI',
    title: 'Tu acceso personal es el punto de partida.',
    description:
      'Crea tu cuenta, completa tu perfil y conecta nuevos espacios de trabajo cuando tu empresa entre a la plataforma.',
    footer: 'Pensado para crecimiento progresivo, sin fricción innecesaria.'
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
    <aside className="relative hidden min-h-screen overflow-hidden bg-primary-700 px-10 py-12 text-white lg:flex lg:flex-col lg:justify-between xl:px-14 xl:py-14">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-10"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.55) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.55) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-primary-600/30"
      />

      <div className="relative z-10 flex items-center justify-between gap-4">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/90 uppercase">
          <span className="size-1.5 rounded-full bg-emerald-300" />
          {content.badge}
        </div>

        <BrandLockup className="w-24 opacity-95 xl:w-28" surface="dark" />
      </div>

      <div className="relative z-10 max-w-120">
        <h2 className="max-w-96 text-4xl font-bold leading-tight text-white xl:text-5xl">
          {content.title}
        </h2>
        <p className="mt-5 max-w-112 text-sm leading-7 text-white/80 xl:text-base">
          {content.description}
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {statTiles.map((item) => (
            <div
              key={item.label}
              className="rounded-lg border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm"
            >
              <div className="text-2xl font-bold text-white">
                {item.value}
              </div>
              <div className="mt-1 text-xs text-white/70">
                {item.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="relative z-10 text-xs text-white/55">{content.footer}</p>
    </aside>
  )
}
