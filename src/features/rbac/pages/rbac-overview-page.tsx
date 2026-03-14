import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { permissionCatalog } from '@/shared/constants/permissions'

export function RbacOverviewPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>RBAC-first scaffold</CardTitle>
        <CardDescription>
          La app ya trae navegacion filtrada por permisos y helpers reutilizables para seguir conectando guards de UI y backend.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        {permissionCatalog.map((permission) => (
          <div key={permission} className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
            {permission}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
