import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const workspaceRules = [
  'Cada company workspace es un tenant.',
  'Los miembros heredan permisos por membership + tenant roles.',
  'Los datos sensibles nunca deben cruzar tenants.',
  'Los limites de plan viven a nivel tenant.'
]

export function WorkspaceOverviewPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Workspace y tenant foundations</CardTitle>
        <CardDescription>
          La organizacion del repo ya separa tenant, company profile, membresias y plan enforcement como dominios coordinados.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3 text-sm text-zinc-700">
          {workspaceRules.map((rule) => (
            <li key={rule} className="rounded-2xl bg-zinc-50 px-4 py-3">
              {rule}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
