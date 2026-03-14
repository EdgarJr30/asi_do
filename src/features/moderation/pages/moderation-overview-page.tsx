import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const moderationGuardrails = [
  'OSINT solo con fuentes publicas y proposito legitimo.',
  'No usar atributos protegidos para decisiones de contratacion.',
  'Las acciones de riesgo deben ser auditables.',
  'Seguridad web, RLS y reglas de negocio son capas inseparables.'
]

export function ModerationOverviewPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Moderation y security guardrails</CardTitle>
        <CardDescription>
          Este modulo resume las reglas nuevas de seguridad, OSINT y proteccion de la arquitectura del proyecto.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3 text-sm text-zinc-700">
          {moderationGuardrails.map((rule) => (
            <li key={rule} className="rounded-2xl bg-zinc-50 px-4 py-3">
              {rule}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
