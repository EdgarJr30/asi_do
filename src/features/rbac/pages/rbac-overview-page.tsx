import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { ArrowLeft, Search, ShieldCheck } from 'lucide-react'

import { surfacePaths } from '@/app/router/surface-paths'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils/cn'
import { permissionCatalog } from '@/shared/constants/permissions'

type DomainKey = 'all' | 'platform' | 'requests' | 'membership' | 'workspace' | 'recruiting' | 'team'

interface DomainConfig {
  key: Exclude<DomainKey, 'all'>
  label: string
  resources: string[]
}

const domainConfig: DomainConfig[] = [
  {
    key: 'platform',
    label: 'Plataforma',
    resources: ['platform_dashboard', 'user', 'license', 'tenant', 'feature_flag', 'app_error_log', 'audit_log'],
  },
  {
    key: 'requests',
    label: 'Usuarios y solicitudes',
    resources: ['recruiter_request', 'pastor_authority_request', 'regional_authority_request', 'scoped_user_authorization', 'moderation', 'support_ticket'],
  },
  {
    key: 'membership',
    label: 'Membresía y facturación',
    resources: ['membership_application', 'membership_payment', 'plan', 'billing'],
  },
  {
    key: 'workspace',
    label: 'Workspace y empresa',
    resources: ['workspace', 'company_profile', 'notification', 'analytics'],
  },
  {
    key: 'recruiting',
    label: 'Reclutamiento',
    resources: ['job', 'application', 'candidate_directory', 'candidate_profile', 'candidate_resume'],
  },
  {
    key: 'team',
    label: 'Equipo y roles',
    resources: ['member', 'role', 'email'],
  },
]

const resourceLabels: Record<string, string> = {
  analytics: 'Analítica',
  app_error_log: 'Errores de app',
  application: 'Postulaciones',
  audit_log: 'Auditoría',
  billing: 'Facturación',
  candidate_directory: 'Directorio de talento',
  candidate_profile: 'Perfil candidato',
  candidate_resume: 'CV candidato',
  company_profile: 'Perfil de empresa',
  email: 'Correos transaccionales',
  feature_flag: 'Feature flags',
  job: 'Vacantes',
  license: 'Licencias',
  member: 'Miembros',
  membership_application: 'Solicitudes de membresía',
  membership_payment: 'Pagos de membresía',
  moderation: 'Moderación',
  notification: 'Notificaciones',
  pastor_authority_request: 'Solicitudes pastorales',
  plan: 'Planes',
  platform_dashboard: 'Dashboard de plataforma',
  recruiter_request: 'Solicitudes de reclutador',
  regional_authority_request: 'Solicitudes regionales',
  role: 'Roles',
  scoped_user_authorization: 'Autorizaciones delegadas',
  support_ticket: 'Tickets de soporte',
  tenant: 'Tenants',
  user: 'Usuarios',
  workspace: 'Workspace',
}

const chipOptions: { key: DomainKey; label: string }[] = [
  { key: 'all', label: 'Todos' },
  ...domainConfig.map((domain) => ({ key: domain.key, label: domain.label })),
]

function getDomain(resource: string) {
  return domainConfig.find((domain) => domain.resources.includes(resource)) ?? domainConfig[0]
}

function getActionBadgeClassName(action: string) {
  if (action.startsWith('read')) {
    return 'border-primary-100 bg-primary-50 text-primary-700 dark:border-primary-500/20 dark:bg-primary-500/12 dark:text-primary-200'
  }

  if (['create', 'invite', 'activate', 'publish', 'restore', 'resend', 'assign', 'approve'].includes(action)) {
    return 'border-emerald-100 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/12 dark:text-emerald-200'
  }

  if (['delete', 'remove', 'suspend', 'close', 'archive'].includes(action)) {
    return 'border-rose-100 bg-rose-50 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/12 dark:text-rose-200'
  }

  return 'border-amber-100 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/12 dark:text-amber-200'
}

export function RbacOverviewPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [activeDomain, setActiveDomain] = useState<DomainKey>('all')

  const resources = useMemo(() => {
    const grouped = new Map<string, { resource: string; label: string; domain: DomainConfig; actions: string[]; permissions: string[] }>()

    permissionCatalog.forEach((permission) => {
      const [resource, action] = permission.split(':')
      if (!resource || !action) {
        return
      }

      const existing = grouped.get(resource)
      const domain = getDomain(resource)
      const next = existing ?? {
        resource,
        label: resourceLabels[resource] ?? resource,
        domain,
        actions: [],
        permissions: [],
      }

      next.actions.push(action)
      next.permissions.push(permission)
      grouped.set(resource, next)
    })

    return [...grouped.values()].sort((left, right) => left.label.localeCompare(right.label, 'es'))
  }, [])

  const visibleDomains = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()

    return domainConfig
      .map((domain) => {
        const filteredResources = resources.filter((resource) => {
          if (activeDomain !== 'all' && resource.domain.key !== activeDomain) {
            return false
          }

          if (!normalizedSearch) {
            return resource.domain.key === domain.key
          }

          const searchable = [
            resource.resource,
            resource.label,
            resource.domain.label,
            ...resource.actions,
            ...resource.permissions,
          ].join(' ').toLowerCase()

          return resource.domain.key === domain.key && searchable.includes(normalizedSearch)
        })

        return { ...domain, resources: filteredResources }
      })
      .filter((domain) => domain.resources.length > 0)
  }, [activeDomain, resources, searchTerm])

  return (
    <div className="w-full space-y-6">
      <Link
        to={surfacePaths.workspace.settings}
        className="inline-flex items-center gap-2 text-sm font-semibold text-(--app-text-subtle) transition-colors hover:text-primary-600 dark:hover:text-primary-300"
      >
        <ArrowLeft className="size-4" /> Configuración
      </Link>

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <h1 className="text-xl font-semibold tracking-tight text-(--app-text) sm:text-[1.6rem]">Permisos y roles del workspace</h1>
          <p className="mt-2 text-sm leading-6 text-(--app-text-muted)">
            Revisa el catálogo de capacidades que gobierna roles, navegación y acciones del equipo.
          </p>
        </div>
        <div className="grid w-full gap-3 sm:w-auto sm:grid-cols-2">
          <Card className="min-w-[180px] p-4">
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.08em] text-(--app-text-subtle)">Permisos</p>
            <p className="mt-1 text-[1.7rem] font-bold tracking-[-0.02em] text-(--app-text)">{permissionCatalog.length}</p>
            <p className="text-xs text-(--app-text-subtle)">capacidades documentadas</p>
          </Card>
          <Card className="min-w-[180px] p-4">
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.08em] text-(--app-text-subtle)">Modelo</p>
            <p className="mt-1 text-[1.7rem] font-bold tracking-[-0.02em] text-(--app-text)">RBAC</p>
            <p className="text-xs text-(--app-text-subtle)">acceso verificable</p>
          </Card>
        </div>
      </header>

      <Card className="p-4">
        <CardContent className="mt-0 space-y-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(280px,380px)_1fr] lg:items-center">
            <label className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-(--app-text-subtle)" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Buscar permiso, recurso o acción..."
                className="h-11 pl-10"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              {chipOptions.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => setActiveDomain(chip.key)}
                  className={cn(
                    'h-9 rounded-full border px-3 text-xs font-bold transition-colors',
                    activeDomain === chip.key
                      ? 'border-(--app-text) bg-(--app-text) text-(--app-surface)'
                      : 'border-(--app-border) bg-(--app-surface) text-(--app-text-muted) hover:border-primary-200 hover:bg-primary-50 hover:text-primary-700 dark:hover:border-primary-500/30 dark:hover:bg-primary-500/12 dark:hover:text-primary-200'
                  )}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {visibleDomains.length > 0 ? (
        <div className="space-y-6">
          {visibleDomains.map((domain) => (
            <section key={domain.key} className="space-y-3">
              <div className="flex items-center gap-3">
                <h2 className="text-base font-bold tracking-tight text-(--app-text)">{domain.label}</h2>
                <Badge variant="outline">{domain.resources.reduce((total, resource) => total + resource.actions.length, 0)} permisos</Badge>
              </div>
              <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(288px,1fr))]">
                {domain.resources.map((resource) => (
                  <div
                    key={resource.resource}
                    className="rounded-[14px] border border-(--app-border) bg-(--app-surface-elevated) p-4 shadow-[0_1px_2px_rgba(20,40,90,0.04),0_4px_16px_rgba(20,40,90,0.05)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-[11px] bg-primary-50 text-primary-700 dark:bg-primary-500/12 dark:text-primary-200">
                          <ShieldCheck className="size-4" />
                        </span>
                        <h3 className="truncate text-sm font-bold text-(--app-text)">{resource.label}</h3>
                      </div>
                      <span className="rounded-full border border-(--app-border) bg-(--app-surface-muted) px-2 py-1 font-mono text-[0.68rem] font-semibold text-(--app-text-muted)">
                        {resource.resource}
                      </span>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {resource.actions.map((action) => (
                        <span
                          key={action}
                          className={cn('rounded-full border px-2.5 py-1 font-mono text-[0.68rem] font-semibold', getActionBadgeClassName(action))}
                        >
                          {action}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="rounded-[14px] border border-dashed border-(--app-border) bg-(--app-surface-elevated) px-6 py-10 text-center">
          <p className="text-sm font-semibold text-(--app-text)">No se encontraron permisos para "{searchTerm}".</p>
          <p className="mt-1 text-sm text-(--app-text-muted)">Prueba con otro recurso, acción o dominio.</p>
        </div>
      )}
    </div>
  )
}
