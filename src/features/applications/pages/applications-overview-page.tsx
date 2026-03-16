import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { StatCard } from '@/components/ui/stat-card'
import { useAppSession } from '@/app/providers/app-session-provider'
import { toErrorMessage } from '@/features/auth/lib/auth-api'
import { listMyApplications } from '@/features/applications/lib/applications-api'

export function ApplicationsOverviewPage() {
  const navigate = useNavigate()
  const session = useAppSession()

  const myApplicationsQuery = useQuery({
    queryKey: ['applications', 'mine', session.authUser?.id ?? null],
    enabled: session.isAuthenticated,
    queryFn: async () => listMyApplications(session.authUser!.id)
  })

  const applications = myApplicationsQuery.data ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Applications"
        title="Revisa tu avance y vuelve a cada oportunidad con contexto"
        description="Sigue cada proceso en un solo lugar y vuelve a tus oportunidades favoritas cuando quieras."
      >
        <StatCard helper="Postulaciones enviadas con tu perfil actual." label="Enviadas" value={applications.length} />
        <StatCard
          helper="Estados visibles para que sepas dónde va cada proceso."
          label="Tracking"
          value={applications.length > 0 ? 'Activo' : 'Pendiente'}
        />
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle>Mi historial</CardTitle>
          <CardDescription>Encuentra cada vacante, su compañía y el estado público más reciente.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {myApplicationsQuery.isLoading ? (
            <p className="text-sm text-[var(--app-text-muted)]">Cargando historial...</p>
          ) : myApplicationsQuery.error ? (
            <p className="text-sm text-rose-600">{toErrorMessage(myApplicationsQuery.error)}</p>
          ) : applications.length ? (
            applications.map((application) => (
              <div key={application.id} className="rounded-[24px] border bg-[var(--app-surface-muted)] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <p className="text-base font-semibold text-[var(--app-text)]">
                      {application.job_posting?.title || 'Vacante'}
                    </p>
                    <p className="text-sm text-[var(--app-text-muted)]">
                      {application.job_posting?.company_profile?.display_name || 'Company'}
                    </p>
                  </div>
                  <Badge variant="outline">{application.status_public}</Badge>
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <Link to={`/jobs/${application.job_posting?.slug}`}>
                    <Button variant="outline">Ver vacante</Button>
                  </Link>
                </div>
              </div>
            ))
          ) : (
            <EmptyState
              actionLabel="Explorar jobs"
              description="Todavía no has enviado postulaciones. Explora oportunidades y aplica cuando tu perfil esté listo."
              title="Aún no tienes aplicaciones"
              onAction={() => void navigate('/jobs')}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
