import type { ReactNode } from 'react'

import { useQuery } from '@tanstack/react-query'
import { Banknote, Bell, Building2, FileText, Gauge, KeyRound, Shield, Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { useAppSession } from '@/app/providers/app-session-provider'
import { surfacePaths } from '@/app/router/surface-paths'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  AdminCard,
  AdminInfoGrid,
  AdminModuleCard,
  AdminPage,
  AdminSectionLabel,
  AdminStat,
  AdminStatBar
} from '@/features/internal/components/admin-redesign'
import { fetchPlatformOpsSnapshot } from '@/features/platform-ops/lib/platform-ops-api'
import { approvalReviewPermissions } from '@/shared/constants/navigation'
import type { PermissionCode } from '@/shared/constants/permissions'

const adminModules: Array<{
  href: string
  title: string
  description: string
  permission?: PermissionCode
  anyPermission?: PermissionCode[]
  ownerOnly?: boolean
  icon: ReactNode
  tone: 'blue' | 'green' | 'amber' | 'rose' | 'violet' | 'teal'
  count?: (stats: Awaited<ReturnType<typeof fetchPlatformOpsSnapshot>> | undefined) => string
}> = [
  {
    href: surfacePaths.admin.approvals,
    title: 'Aprobaciones',
    description: 'Cola unificada de operador, pastoral, regional e invitaciones de autoridad territorial.',
    anyPermission: approvalReviewPermissions,
    icon: <Shield className="size-5" />,
    tone: 'blue',
    count: (stats) => `${stats?.pendingRecruiterRequests ?? 0} pend.`
  },
  {
    href: surfacePaths.admin.membership,
    title: 'Administrar membresías',
    description: 'Revisa solicitudes, valida pagos, activa membresías e inactiva accesos activos cuando aplique.',
    permission: 'membership_payment:verify',
    icon: <Sparkles className="size-5" />,
    tone: 'green'
  },
  {
    href: surfacePaths.admin.platform,
    title: 'Plataforma',
    description: 'Salud operativa, planes, suscripciones y feature flags para gobernar el producto.',
    permission: 'platform_dashboard:read',
    icon: <Building2 className="size-5" />,
    tone: 'blue'
  },
  {
    href: surfacePaths.admin.accessControl,
    title: 'Usuarios y roles',
    description: 'Control owner-only de roles de plataforma, asignaciones, auditoría y riesgos SoD.',
    permission: 'platform_dashboard:read',
    ownerOnly: true,
    icon: <KeyRound className="size-5" />,
    tone: 'violet'
  },
  {
    href: surfacePaths.admin.moderation,
    title: 'Moderación',
    description: 'Trust & safety: abre casos, ejecuta acciones seguras y deja todo en auditoría.',
    permission: 'moderation:read',
    icon: <Gauge className="size-5" />,
    tone: 'violet',
    count: (stats) => `${stats?.openModerationCases ?? 0} casos`
  },
  {
    href: surfacePaths.admin.errors,
    title: 'Errores',
    description: 'Bandeja de errores de producto: revisa, marca como corregido o reabre incidencias.',
    permission: 'audit_log:read',
    icon: <FileText className="size-5" />,
    tone: 'rose'
  },
  {
    href: surfacePaths.admin.finances,
    title: 'Finanzas',
    description: 'Datos de pago, cuotas por categoría y montos de donación visibles al público.',
    permission: 'platform_dashboard:read',
    icon: <Banknote className="size-5" />,
    tone: 'amber'
  },
  {
    href: surfacePaths.admin.communications,
    title: 'Comunicaciones',
    description: 'Pipeline de correos y centro de notificaciones in-app, push y preferencias de UI.',
    permission: 'email:read',
    icon: <Bell className="size-5" />,
    tone: 'teal',
    count: (stats) => `${stats?.pendingEmailHooks ?? 0} pend.`
  }
]

function canSeeModule(module: (typeof adminModules)[number], permissions: PermissionCode[], isPlatformOwner: boolean) {
  if (module.ownerOnly && !isPlatformOwner) return false
  if (module.permission && !permissions.includes(module.permission)) return false
  if (module.anyPermission && !module.anyPermission.some((permission) => permissions.includes(permission))) return false
  return true
}

export function AdminConsolePage() {
  const navigate = useNavigate()
  const session = useAppSession()
  const snapshotQuery = useQuery({
    queryKey: ['platform-ops-snapshot'],
    queryFn: fetchPlatformOpsSnapshot,
    enabled: session.permissions.includes('platform_dashboard:read')
  })

  const stats = snapshotQuery.data
  const visibleModules = adminModules.filter((module) => canSeeModule(module, session.permissions, session.isPlatformOwner))

  return (
    <AdminPage
      eyebrow="Admin · Plataforma"
      title="Centro operativo"
      description="Zona interna para operaciones, observabilidad y gobierno de plataforma. No forma parte de la experiencia del cliente."
      actions={<Badge variant="default" className="h-8 px-3">Platform admin</Badge>}
    >
      <div className="space-y-6">
        <AdminInfoGrid
          items={[
            {
              label: 'Acceso actual',
              value: session.isPlatformAdmin ? 'Platform admin' : 'Internal developer',
              helper: 'El flag interno no concede permisos de tenant por sí solo.'
            },
            {
              label: 'Uso esperado',
              value: 'Validación interna',
              helper: 'Revisa notificaciones, idioma, tema, errores y accesos antes de exponer cambios.'
            },
            {
              label: 'Aislamiento',
              value: 'Separado del core',
              helper: 'Landing comercial y flujos de miembros quedan aparte del tooling interno.'
            }
          ]}
        />

        <div className="space-y-3">
          <AdminSectionLabel title="Salud de plataforma" />
          <AdminStatBar columns={6}>
            <AdminStat label="Tenants activos" value={stats?.activeTenants ?? '—'} />
            <AdminStat label="Subscripciones" value={stats?.activeSubscriptions ?? '—'} tone="green" />
            <AdminStat label="Casos moderación" value={stats?.openModerationCases ?? '—'} tone="violet" />
            <AdminStat label="Errores abiertos" value="—" tone="rose" helper="Ver módulo Errores" />
            <AdminStat label="Emails pendientes" value={stats?.pendingEmailHooks ?? '—'} tone="amber" />
            <AdminStat label="Feature flags" value={stats?.featureFlagsEnabled ?? '—'} tone="teal" />
          </AdminStatBar>
        </div>

        <div className="space-y-3">
          <AdminSectionLabel title="Módulos" count={visibleModules.length} />
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {visibleModules.map((module) => (
              <AdminModuleCard
                key={module.href}
                href={module.href}
                title={module.title}
                description={module.description}
                icon={module.icon}
                tone={module.tone}
                count={module.count?.(stats)}
              />
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <AdminSectionLabel title="Acceso avanzado" />
          <div className="grid gap-3 lg:grid-cols-2">
            <AdminCard
              title="Bootstrap de plataforma"
              description="La inicialización del primer admin sale del flujo público de auth y queda disponible solo como acceso controlado."
              tag={<Badge variant="outline">Controlado</Badge>}
            >
              <Button variant="outline" className="h-9 rounded-control" onClick={() => void navigate(surfacePaths.admin.bootstrapOwner)}>
                Abrir bootstrap owner
              </Button>
            </AdminCard>
            {session.isPlatformAdmin ? (
              <AdminCard
                title="Arnés de estrés"
                description="Genera datos sintéticos masivos y mide el comportamiento de la base. Solo entornos no productivos."
                tag={<Badge variant="outline" className="border-violet-200 bg-violet-50 text-violet-700">Super admin</Badge>}
              >
                <Button variant="outline" className="h-9 rounded-control" onClick={() => void navigate(surfacePaths.admin.stressHarness)}>
                  Abrir arnés de estrés
                </Button>
              </AdminCard>
            ) : null}
          </div>
        </div>
      </div>
    </AdminPage>
  )
}
