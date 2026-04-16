import { useNavigate } from 'react-router-dom'

import { useAppSession } from '@/app/providers/app-session-provider'
import { surfacePaths } from '@/app/router/surface-paths'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FoundationSettingsForm } from '@/features/foundations/components/foundation-settings-form'
import { NotificationCenter } from '@/features/notifications/components/notification-center'

const adminTools = [
  {
    href: surfacePaths.admin.approvals,
    title: 'Solicitudes de operador',
    description: 'Revisa solicitudes de operador y provisiona acceso al workspace.',
    permission: 'recruiter_request:review'
  },
  {
    href: surfacePaths.admin.platform,
    title: 'Platform ops',
    description: 'Observa planes, flags, colas y counters operativos.',
    permission: 'platform_dashboard:read'
  },
  {
    href: surfacePaths.admin.moderation,
    title: 'Moderation',
    description: 'Opera trust and safety, suspensiones y acciones de control.',
    permission: 'moderation:read'
  },
  {
    href: surfacePaths.admin.errors,
    title: 'Error review',
    description: 'Inspecciona errores de producto y su estado de remediacion.',
    permission: 'audit_log:read'
  }
] as const

export function AdminConsolePage() {
  const navigate = useNavigate()
  const session = useAppSession()
  const visibleAdminTools = adminTools.filter((tool) => session.permissions.includes(tool.permission))

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden bg-(--app-surface-muted)">
        <CardHeader className="space-y-3">
          <Badge variant="soft">Admin only</Badge>
          <CardTitle className="max-w-3xl text-2xl sm:text-3xl">
            Centro interno para operaciones, observabilidad y gobierno de plataforma
          </CardTitle>
          <CardDescription className="max-w-2xl">
            Esta zona no forma parte de la experiencia cliente. Solo la usan admins de plataforma y developers internos
            para revisar incidencias, validar flujos sensibles y operar tareas restringidas.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="rounded-[24px] border border-white/70 bg-white/85 p-4 dark:border-zinc-800 dark:bg-zinc-950/75">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Acceso actual</p>
            <p className="mt-2 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
              {session.isPlatformAdmin ? 'Platform admin' : 'Internal developer'}
            </p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              El flag interno no concede permisos tenant o plataforma por si solo.
            </p>
          </div>
          <div className="rounded-[24px] border border-white/70 bg-white/85 p-4 dark:border-zinc-800 dark:bg-zinc-950/75">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Uso esperado</p>
            <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
              Valida notificaciones, idioma, tema, errores operativos y accesos internos antes de exponer cambios al
              cliente final.
            </p>
          </div>
          <div className="rounded-[24px] border border-white/70 bg-white/85 p-4 dark:border-zinc-800 dark:bg-zinc-950/75">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Aislamiento</p>
            <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
              La landing comercial, oportunidades para miembros y flujos core ya quedan separados del tooling interno.
            </p>
          </div>
        </CardContent>
      </Card>

      {visibleAdminTools.length > 0 ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {visibleAdminTools.map((tool) => (
            <Card key={tool.href}>
              <CardHeader>
                <CardTitle className="text-lg">{tool.title}</CardTitle>
                <CardDescription>{tool.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" variant="outline" onClick={() => void navigate(tool.href)}>
                  Abrir modulo
                </Button>
              </CardContent>
            </Card>
          ))}
        </section>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Bootstrap de plataforma</CardTitle>
          <CardDescription>
            La inicializacion del primer admin sale del flujo publico de auth y queda disponible solo como acceso controlado.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => void navigate(surfacePaths.admin.bootstrapOwner)}>
            Abrir bootstrap owner
          </Button>
        </CardContent>
      </Card>

      <FoundationSettingsForm />

      <NotificationCenter />
    </div>
  )
}
