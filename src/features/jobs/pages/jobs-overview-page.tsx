import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const jobStates = ['draft', 'published', 'closed', 'archived']

export function JobsOverviewPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <Badge>Jobs</Badge>
          <CardTitle>Modulo de vacantes y discovery</CardTitle>
          <CardDescription>
            Esta capa quedo preparada para job CRUD, filtros publicos, salary visibility, screening questions y fast apply.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {jobStates.map((state) => (
            <div key={state} className="rounded-2xl bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
              Estado soportado: <span className="font-semibold text-zinc-950">{state}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
