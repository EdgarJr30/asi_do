import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { demoSession } from '@/shared/constants/navigation'
import { requiredDirectories, requiredRuleFiles } from '@/shared/contracts/project-contract'

const phaseZeroItems = [
  'Scaffold React 19 + Vite + TypeScript',
  'Tailwind CSS v4 con tokens alineados al design system',
  'Base PWA instalable con service worker',
  'Estructura modular por dominio para candidato, empresas, jobs, applications y RBAC',
  'Reglas nuevas para documentacion, testing y seguridad'
]

const moduleCards = [
  {
    title: 'Candidate foundation',
    description: 'Perfil reutilizable, CV por versiones, historial de aplicaciones y estado visible.'
  },
  {
    title: 'Employer workspace',
    description: 'Tenant, company profile, miembros, branding, permisos y configuracion.'
  },
  {
    title: 'Jobs + applications',
    description: 'Publicacion de vacantes, descubrimiento, fast apply y snapshots historicos.'
  },
  {
    title: 'ATS-lite + moderation',
    description: 'Stages, notas, ratings, activity log, confianza y seguridad.'
  }
]

export function HomePage() {
  return (
    <div className="space-y-6">
      <Card className="overflow-hidden bg-[linear-gradient(135deg,#ecfdf5,white_40%,#f0f9ff)]">
        <CardHeader>
          <Badge variant="soft">Scaffold inicial</Badge>
          <CardTitle className="max-w-2xl text-2xl sm:text-3xl">
            Plataforma SaaS de reclutamiento y empleo con perfiles profesionales, CV precargado y aplicacion a vacantes.
          </CardTitle>
          <CardDescription className="max-w-2xl">
            Esta base ya arranca con reglas sincronizadas, estructura multi-tenant y una shell PWA preparada para crecer sin perder consistencia.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-3xl bg-white/80 p-4">
            <p className="text-sm font-semibold text-zinc-900">Rol demo activo</p>
            <p className="mt-1 text-sm text-zinc-600">
              {demoSession.displayName} · {demoSession.activeRole}
            </p>
          </div>
          <div className="rounded-3xl bg-white/80 p-4">
            <p className="text-sm font-semibold text-zinc-900">Comandos base</p>
            <p className="mt-1 text-sm text-zinc-600">`npm run dev`, `npm run test`, `npm run verify`</p>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Fase 0 ya fijada</CardTitle>
            <CardDescription>
              Todo el repo quedo alineado para que el MVP arranque con arquitectura, testing y seguridad como reglas duraderas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm text-zinc-700">
              {phaseZeroItems.map((item) => (
                <li key={item} className="rounded-2xl bg-zinc-50 px-4 py-3">
                  {item}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contrato documental</CardTitle>
            <CardDescription>
              Los archivos de reglas se prueban como parte del contrato del proyecto.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-2xl bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
              <span className="font-semibold text-zinc-900">{requiredRuleFiles.length}</span> archivos fuente obligatorios
            </div>
            <div className="rounded-2xl bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
              <span className="font-semibold text-zinc-900">{requiredDirectories.length}</span> carpetas estructurales verificadas
            </div>
            <Button className="w-full" onClick={() => window.location.assign('/rbac')}>
              Revisar guardrails
            </Button>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {moduleCards.map((card) => (
          <Card key={card.title}>
            <CardHeader>
              <CardTitle>{card.title}</CardTitle>
              <CardDescription>{card.description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </section>
    </div>
  )
}
