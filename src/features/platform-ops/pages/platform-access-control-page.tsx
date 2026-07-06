import { useEffect, useMemo, useState } from 'react'

import { keepPreviousData, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  Check,
  Eye,
  FileClock,
  KeyRound,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UserPlus,
  X
} from 'lucide-react'
import { toast } from 'sonner'

import { useAppSession } from '@/app/providers/app-session-provider'
import { surfacePaths } from '@/app/router/surface-paths'
import { toErrorMessage } from '@/features/auth/lib/auth-api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/loader'
import { SideSheet } from '@/components/ui/side-sheet'
import { Textarea } from '@/components/ui/textarea'
import {
  AdminCard,
  AdminEmpty,
  AdminPage,
  AdminSectionLabel,
  AdminTabs
} from '@/features/internal/components/admin-redesign'
import {
  assignPlatformRole,
  createPlatformRole,
  deletePlatformRole,
  fetchPlatformAccessControlSnapshot,
  revokePlatformRole,
  updatePlatformRole,
  type PlatformAccessAuditEvent,
  type PlatformAccessPermission,
  type PlatformAccessRole,
  type PlatformAccessSnapshot,
  type PlatformAccessUser,
  type PlatformAccessUserRole
} from '@/features/platform-ops/lib/platform-access-control-api'
import { reportErrorWithToast } from '@/lib/errors/error-reporting'
import { cn } from '@/lib/utils/cn'
import { useInfiniteScroll } from '@/shared/ui/use-infinite-scroll'

type AccessTab = 'users' | 'roles' | 'audit' | 'risks'
type RoleSheetState = { mode: 'create' | 'edit' | 'view'; role?: PlatformAccessRole } | null

const queryKey = ['platform-access-control'] as const
const USERS_PAGE_SIZE = 12
// Búsqueda: no dispara por cada tecla ni por 1 sola letra. Espera a que el usuario
// deje de escribir (debounce) y a un mínimo de caracteres; por debajo, lista completa.
const SEARCH_DEBOUNCE_MS = 350
const MIN_SEARCH_LENGTH = 2

const resourceLabels: Record<string, string> = {
  app_error_log: 'Errores',
  audit_log: 'Auditoría',
  billing: 'Facturación',
  email: 'Correo',
  feature_flag: 'Banderas',
  license: 'Licencias',
  membership_application: 'Solicitudes de membresía',
  membership_payment: 'Pagos de membresía',
  moderation: 'Moderación',
  pastor_authority_request: 'Autoridad pastoral',
  plan: 'Planes',
  platform_dashboard: 'Dashboard',
  recruiter_request: 'Operadores',
  regional_authority_request: 'Autoridad regional',
  scoped_user_authorization: 'Autorizaciones',
  support_ticket: 'Soporte',
  tenant: 'Tenants',
  user: 'Usuarios'
}

const userStatusLabels: Record<string, string> = {
  active: 'Activo',
  approved: 'Aprobado',
  pending: 'Pendiente',
  suspended: 'Suspendido',
  rejected: 'Rechazado',
  inactive: 'Inactivo'
}

const actionLabels: Record<string, string> = {
  act: 'actuar',
  activate: 'activar',
  assign: 'asignar',
  create: 'crear',
  delete: 'eliminar',
  export: 'exportar',
  inspect: 'inspeccionar',
  manage: 'administrar',
  read: 'leer',
  resend: 'reenviar',
  restore: 'restaurar',
  review: 'revisar',
  suspend: 'suspender',
  update: 'actualizar',
  verify: 'verificar'
}

const auditEventLabels: Record<string, string> = {
  'platform_role.assigned': 'Rol asignado',
  'platform_role.created': 'Rol creado',
  'platform_role.deleted': 'Rol eliminado',
  'platform_role.revoked': 'Rol revocado',
  'platform_role.updated': 'Rol actualizado',
  'platform_rbac.snapshot': 'Reporte de permisos revisado'
}

const highRiskActions = new Set(['act', 'activate', 'create', 'delete', 'restore', 'review', 'resend', 'suspend', 'update'])
const mediumRiskResources = new Set(['audit_log', 'billing', 'membership_payment', 'plan'])

// Reglas de segregación de funciones (SOD): combinaciones de permisos que, juntas,
// concentran demasiado poder. Se usan tanto para el reporte pasivo (tab Riesgos)
// como para alertar EN VIVO cuando el owner hace un cambio que las dispara.
type SodLevel = 'Alto' | 'Medio'
const SOD_RULES: Array<{ id: string; needs: string[]; level: SodLevel; phrase: string; description: string }> = [
  {
    id: 'flags-audit',
    needs: ['feature_flag:update', 'audit_log:read'],
    level: 'Alto',
    phrase: 'cambia configuración y lee auditoría',
    description: 'Revisar segregación de funciones en cambios sensibles y evidencia posterior.'
  },
  {
    id: 'billing',
    needs: ['plan:update', 'billing:read'],
    level: 'Medio',
    phrase: 'combina planes y facturación',
    description: 'Puede estar correcto para Finanzas, pero debe ser intencional.'
  }
]

function sodRulesTriggeredBy(permissionCodes: Iterable<string>) {
  const set = permissionCodes instanceof Set ? permissionCodes : new Set(permissionCodes)
  return SOD_RULES.filter((rule) => rule.needs.every((code) => set.has(code)))
}

// El RPC lanza "Only platform_owner can inspect platform RBAC" cuando la sesión no
// es owner. Cualquier otro error (p. ej. red o firma de función) NO debe mostrarse
// como si el problema fuera el rol del usuario.
function isOwnerAccessError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return /platform_owner/i.test(message)
}

function normalizeRoleCode(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '')
}

function formatDateTime(value: string | null) {
  if (!value) return 'Sin fecha'
  return new Date(value).toLocaleString('es-DO', {
    dateStyle: 'medium',
    timeStyle: 'short'
  })
}

function displayUserName(user: Pick<PlatformAccessUser, 'display_name' | 'full_name' | 'email'>) {
  return user.display_name || user.full_name || user.email || 'Usuario'
}

function userStatusLabel(status: string) {
  return userStatusLabels[status] ?? status
}

function actionLabel(action: string) {
  return actionLabels[action] ?? action
}

function auditEventLabel(eventType: string) {
  return auditEventLabels[eventType] ?? eventType
}

function permissionRisk(permission: PlatformAccessPermission) {
  if (highRiskActions.has(permission.action) || permission.resource === 'feature_flag' || permission.resource === 'license') {
    return {
      label: 'Alto',
      className: 'border-rose-100 bg-rose-50 text-rose-700 dark:border-rose-500/25 dark:bg-rose-500/12 dark:text-rose-200'
    }
  }

  if (mediumRiskResources.has(permission.resource)) {
    return {
      label: 'Medio',
      className: 'border-amber-100 bg-amber-50 text-amber-700 dark:border-amber-500/25 dark:bg-amber-500/12 dark:text-amber-200'
    }
  }

  return {
    label: 'Bajo',
    className: 'border-zinc-100 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
  }
}

function groupPermissions(permissions: PlatformAccessPermission[]) {
  const groups = new Map<string, PlatformAccessPermission[]>()

  permissions.forEach((permission) => {
    const current = groups.get(permission.resource) ?? []
    current.push(permission)
    groups.set(permission.resource, current)
  })

  return [...groups.entries()]
    .map(([resource, items]) => ({
      resource,
      label: resourceLabels[resource] ?? resource,
      permissions: [...items].sort((left, right) => left.code.localeCompare(right.code))
    }))
    .sort((left, right) => left.label.localeCompare(right.label, 'es'))
}

function rolePermissionCodes(role?: PlatformAccessRole) {
  return role?.permissions.map((permission) => permission.code) ?? []
}

function deriveRiskFindings(snapshot: PlatformAccessSnapshot | undefined) {
  if (!snapshot) return []

  const findings: Array<{ id: string; level: 'Alto' | 'Medio' | 'Bajo'; title: string; description: string }> = []

  if (snapshot.stats.platform_owner_count === 1) {
    findings.push({
      id: 'single-owner',
      level: 'Medio',
      title: 'Un solo platform_owner activo',
      description: 'Hay continuidad operativa limitada si esa cuenta queda inaccesible.'
    })
  }

  snapshot.roles
    .filter((role) => !role.is_system && role.permissions.length === 0)
    .forEach((role) => {
      findings.push({
        id: `empty-role-${role.id}`,
        level: 'Medio',
        title: `Rol sin permisos: ${role.name}`,
        description: 'Puede generar asignaciones confusas y reportes poco claros.'
      })
    })

  snapshot.users.forEach((user) => {
    sodRulesTriggeredBy(user.permissions).forEach((rule) => {
      findings.push({
        id: `sod-${rule.id}-${user.id}`,
        level: rule.level,
        title: `${displayUserName(user)} ${rule.phrase}`,
        description: rule.description
      })
    })
  })

  return findings.length
    ? findings
    : [
        {
          id: 'clean',
          level: 'Bajo' as const,
          title: 'Sin alertas críticas en el reporte',
          description: 'Las asignaciones actuales no disparan las reglas básicas de segregación de funciones.'
        }
      ]
}

function riskClassName(level: 'Alto' | 'Medio' | 'Bajo') {
  if (level === 'Alto') return 'border-rose-100 bg-rose-50 text-rose-700 dark:border-rose-500/25 dark:bg-rose-500/12 dark:text-rose-200'
  if (level === 'Medio') return 'border-amber-100 bg-amber-50 text-amber-700 dark:border-amber-500/25 dark:bg-amber-500/12 dark:text-amber-200'
  return 'border-zinc-100 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
}

function auditSummary(event: PlatformAccessAuditEvent) {
  const payload = event.payload ?? {}
  const roleCode = typeof payload.role_code === 'string' ? payload.role_code : null
  const targetEmail = typeof payload.target_user_email === 'string' ? payload.target_user_email : null

  return [roleCode, targetEmail].filter(Boolean).join(' · ') || event.entity_id
}

function RoleBadge({ role }: { role: Pick<PlatformAccessRole, 'is_system' | 'is_locked'> }) {
  if (role.is_system || role.is_locked) {
    return <Badge variant="outline" className="border-amber-100 bg-amber-50 text-amber-700">Sistema</Badge>
  }

  return <Badge variant="outline">Personalizado</Badge>
}

function PermissionChecklist({
  permissions,
  selectedCodes,
  disabled,
  onToggle
}: {
  permissions: PlatformAccessPermission[]
  selectedCodes: string[]
  disabled?: boolean
  onToggle: (code: string) => void
}) {
  const groups = useMemo(() => groupPermissions(permissions), [permissions])

  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <section key={group.resource} className="overflow-hidden rounded-card border border-(--app-border) bg-(--app-surface-elevated)">
          <div className="border-b border-(--app-border)/70 px-3 py-2">
            <p className="text-[0.72rem] font-bold uppercase tracking-[0.08em] text-(--app-text-subtle)">{group.label}</p>
          </div>
          <div className="divide-y divide-(--app-border)/60">
            {group.permissions.map((permission) => {
              const risk = permissionRisk(permission)
              const checked = selectedCodes.includes(permission.code)

              return (
                <label key={permission.id} className="flex items-start gap-3 px-3 py-2.5">
                  <input
                    type="checkbox"
                    className="mt-1 size-4 rounded border-(--app-border) accent-primary-600"
                    checked={checked}
                    disabled={disabled}
                    onChange={() => onToggle(permission.code)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-[0.82rem] font-bold text-(--app-text)">{permission.description}</span>
                      <code className="rounded bg-(--app-surface-muted) px-1.5 py-0.5 text-[0.68rem] font-bold text-(--app-text-muted)">
                        {permission.code}
                      </code>
                    </span>
                    <span className="mt-1 block text-[0.72rem] text-(--app-text-subtle)">
                      {resourceLabels[permission.resource] ?? permission.resource} · {actionLabel(permission.action)}
                    </span>
                  </span>
                  <Badge variant="outline" className={cn('shrink-0 text-[0.68rem]', risk.className)}>
                    {risk.label}
                  </Badge>
                </label>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}

export function PlatformAccessControlPage() {
  const session = useAppSession()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<AccessTab>('users')
  const [searchInput, setSearchInput] = useState('')
  const [userSearch, setUserSearch] = useState('')

  // Debounce + umbral mínimo: el input se actualiza al instante (no bloquea la
  // escritura), pero la consulta al servidor solo cambia cuando dejas de escribir
  // y hay suficientes letras. Con menos del mínimo, se limpia el filtro.
  useEffect(() => {
    const trimmed = searchInput.trim()
    const nextSearch = trimmed.length >= MIN_SEARCH_LENGTH ? trimmed : ''
    const handle = window.setTimeout(() => setUserSearch(nextSearch), SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(handle)
  }, [searchInput])
  const [selectedRolesByUser, setSelectedRolesByUser] = useState<Record<string, string[]>>({})
  const [roleSheet, setRoleSheet] = useState<RoleSheetState>(null)
  const [roleCode, setRoleCode] = useState('')
  const [roleName, setRoleName] = useState('')
  const [roleDescription, setRoleDescription] = useState('')
  const [selectedPermissionCodes, setSelectedPermissionCodes] = useState<string[]>([])
  const [pendingRevoke, setPendingRevoke] = useState<{ user: PlatformAccessUser; role: PlatformAccessUserRole } | null>(null)
  const [pendingDelete, setPendingDelete] = useState<PlatformAccessRole | null>(null)

  const snapshotQuery = useInfiniteQuery({
    queryKey: [...queryKey, userSearch],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      fetchPlatformAccessControlSnapshot({
        userQuery: userSearch,
        userLimit: USERS_PAGE_SIZE,
        userOffset: pageParam
      }),
    getNextPageParam: (lastPage) => lastPage.users_page.next_offset,
    // Mantiene los datos previos visibles mientras cambia la búsqueda: la sección
    // (y el input) no se desmontan, así no se pierde el foco al escribir.
    placeholderData: keepPreviousData
  })

  const snapshotPages = useMemo(() => snapshotQuery.data?.pages ?? [], [snapshotQuery.data])
  const baseSnapshot = snapshotPages[0]
  const users = useMemo(() => snapshotPages.flatMap((page) => page.users), [snapshotPages])
  const latestUsersPage = snapshotPages.at(-1)?.users_page
  const totalUsers = baseSnapshot?.users_page.total_count ?? 0
  const snapshot = useMemo(() => (baseSnapshot ? { ...baseSnapshot, users } : undefined), [baseSnapshot, users])
  const roles = snapshot?.roles ?? []
  const permissions = snapshot?.permissions ?? []
  const auditEvents = snapshot?.audit_events ?? []
  const riskFindings = useMemo(() => deriveRiskFindings(snapshot), [snapshot])
  const accessStats = [
    { label: 'Roles', value: snapshot?.stats.role_count ?? '—', dot: 'bg-primary-500' },
    { label: 'Personalizados', value: snapshot?.stats.custom_role_count ?? '—', dot: 'bg-teal-500' },
    { label: 'Dueños', value: snapshot?.stats.platform_owner_count ?? '—', dot: 'bg-violet-500' },
    { label: 'Asignaciones', value: snapshot?.stats.active_assignment_count ?? '—', dot: 'bg-emerald-500' },
    { label: 'Usuarios', value: snapshot?.stats.users_with_platform_roles_count ?? '—', dot: 'bg-amber-500' }
  ]
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = snapshotQuery
  const sentinelRef = useInfiniteScroll({
    hasNextPage: Boolean(hasNextPage),
    isFetchingNextPage,
    onLoadMore: () => void fetchNextPage(),
    deps: [users.length, userSearch]
  })

  const mutationMeta = {
    route: surfacePaths.admin.accessControl,
    userId: session.authUser?.id ?? null
  }

  const invalidateSnapshot = async () => {
    await queryClient.invalidateQueries({ queryKey })
  }

  const assignMutation = useMutation({
    mutationFn: async ({ userId, roleIds }: { userId: string; roleIds: string[] }) => {
      // Asigna en lote los roles seleccionados (uno por RPC; cada uno queda auditado).
      for (const roleId of roleIds) {
        await assignPlatformRole({ userId, roleId })
      }
    },
    onSuccess: async (_data, variables) => {
      setSelectedRolesByUser((current) => {
        const next = { ...current }
        delete next[variables.userId]
        return next
      })
      await invalidateSnapshot()
      toast.success(variables.roleIds.length > 1 ? `${variables.roleIds.length} roles asignados` : 'Rol asignado')
      warnOnSodForAssignment(variables.userId, variables.roleIds)
    },
    onError: async (error) => {
      await reportErrorWithToast({
        title: 'No pudimos asignar el rol',
        source: 'platform-access.assign-role',
        error,
        ...mutationMeta
      })
    }
  })

  const revokeMutation = useMutation({
    mutationFn: revokePlatformRole,
    onSuccess: async () => {
      setPendingRevoke(null)
      await invalidateSnapshot()
      toast.success('Rol revocado')
    },
    onError: async (error) => {
      await reportErrorWithToast({
        title: 'No pudimos revocar el rol',
        source: 'platform-access.revoke-role',
        error,
        ...mutationMeta
      })
    }
  })

  const deleteMutation = useMutation({
    mutationFn: deletePlatformRole,
    onSuccess: async () => {
      setPendingDelete(null)
      await invalidateSnapshot()
      toast.success('Rol eliminado')
    },
    onError: async (error) => {
      await reportErrorWithToast({
        title: 'No pudimos eliminar el rol',
        source: 'platform-access.delete-role',
        error,
        ...mutationMeta
      })
    }
  })

  const saveRoleMutation = useMutation({
    mutationFn: async () => {
      if (!roleSheet) {
        throw new Error('No hay rol activo para guardar.')
      }

      if (roleSheet.mode === 'create') {
        return createPlatformRole({
          code: roleCode,
          name: roleName,
          description: roleDescription,
          permissionCodes: selectedPermissionCodes
        })
      }

      if (!roleSheet.role) {
        throw new Error('No encontramos el rol a editar.')
      }

      return updatePlatformRole({
        roleId: roleSheet.role.id,
        name: roleName,
        description: roleDescription,
        permissionCodes: selectedPermissionCodes
      })
    },
    onSuccess: async () => {
      // Capturamos los permisos guardados antes de limpiar el formulario para la
      // verificación SOD del rol.
      const savedPermissionCodes = selectedPermissionCodes
      setRoleSheet(null)
      await invalidateSnapshot()
      toast.success('Rol guardado')

      sodRulesTriggeredBy(savedPermissionCodes).forEach((rule) => {
        toast.warning(`Alerta SOD · Riesgo ${rule.level.toLowerCase()}`, {
          description: `Este rol reúne permisos que ${rule.phrase}. ${rule.description}`
        })
      })
    },
    onError: async (error) => {
      await reportErrorWithToast({
        title: 'No pudimos guardar el rol',
        source: 'platform-access.save-role',
        error,
        ...mutationMeta
      })
    }
  })

  function openRoleSheet(next: RoleSheetState) {
    setRoleSheet(next)
    setRoleCode(next?.role?.code ?? '')
    setRoleName(next?.role?.name ?? '')
    setRoleDescription(next?.role?.description ?? '')
    setSelectedPermissionCodes(rolePermissionCodes(next?.role))
  }

  function togglePermission(code: string) {
    setSelectedPermissionCodes((current) =>
      current.includes(code) ? current.filter((item) => item !== code) : [...current, code].sort()
    )
  }

  function toggleRoleForUser(userId: string, roleId: string) {
    setSelectedRolesByUser((current) => {
      const currentIds = current[userId] ?? []
      const nextIds = currentIds.includes(roleId)
        ? currentIds.filter((id) => id !== roleId)
        : [...currentIds, roleId]
      return { ...current, [userId]: nextIds }
    })
  }

  function handleAssignRoles(user: PlatformAccessUser) {
    const roleIds = selectedRolesByUser[user.id] ?? []

    if (!roleIds.length) return

    assignMutation.mutate({ userId: user.id, roleIds })
  }

  // Alerta EN VIVO de SOD: proyecta los permisos que tendrá el usuario tras sumar
  // los roles recién asignados y avisa si esa combinación dispara una regla.
  function warnOnSodForAssignment(userId: string, addedRoleIds: string[]) {
    const user = users.find((item) => item.id === userId)
    if (!user) return

    const projected = new Set(user.permissions)
    addedRoleIds.forEach((roleId) => {
      roles.find((role) => role.id === roleId)?.permissions.forEach((permission) => projected.add(permission.code))
    })

    sodRulesTriggeredBy(projected).forEach((rule) => {
      toast.warning(`Alerta SOD · Riesgo ${rule.level.toLowerCase()}`, {
        description: `${displayUserName(user)} ahora ${rule.phrase}. ${rule.description}`
      })
    })
  }

  const roleSheetTitle =
    roleSheet?.mode === 'create'
      ? 'Crear rol'
      : roleSheet?.mode === 'edit'
        ? roleSheet.role?.is_locked
          ? 'Editar permisos'
          : 'Editar rol'
        : 'Permisos del rol'
  const roleSheetMetadataLocked = roleSheet?.mode === 'edit' && Boolean(roleSheet.role?.is_locked)

  return (
    <AdminPage
      eyebrow="Admin · Seguridad"
      title="Usuarios y roles de plataforma"
      description="Gobierno exclusivo para dueños de plataforma: roles, permisos, asignaciones y evidencia de auditoría."
      superAdmin
      actions={
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Button
            variant="outline"
            className="h-9 px-3 text-xs"
            onClick={() => void snapshotQuery.refetch()}
            disabled={snapshotQuery.isFetching}
          >
            <RefreshCw className="size-4" /> Actualizar
          </Button>
          <Button className="h-9 px-3 text-xs" onClick={() => openRoleSheet({ mode: 'create' })}>
            <Plus className="size-4" /> Crear rol
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-5 sm:gap-2">
          {accessStats.map((stat) => (
            <div
              key={stat.label}
              className="flex flex-col items-center justify-center gap-0.5 rounded-control border border-(--app-border) bg-(--app-surface-elevated) px-1 py-2 text-center sm:px-2 sm:py-2.5"
            >
              <span className="text-base font-bold leading-none tabular-nums text-(--app-text) sm:text-xl">{stat.value}</span>
              <span className="flex items-center gap-1 text-[0.6rem] leading-tight text-(--app-text-subtle) sm:text-[0.7rem]">
                <span className={cn('size-1.5 shrink-0 rounded-full', stat.dot)} />
                {stat.label}
              </span>
            </div>
          ))}
        </div>

        <AdminTabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'users', label: 'Usuarios', count: totalUsers || users.length },
            { value: 'roles', label: 'Roles', count: roles.length },
            { value: 'audit', label: 'Auditoría', count: auditEvents.length },
            { value: 'risks', label: 'Riesgos', count: riskFindings.length }
          ]}
        />

        {snapshotQuery.isLoading ? (
          <AdminEmpty title="Cargando control de acceso" description="Recuperando roles, usuarios y auditoría." />
        ) : null}

        {snapshotQuery.error ? (
          <AdminEmpty
            title="No pudimos cargar el módulo"
            description={
              isOwnerAccessError(snapshotQuery.error)
                ? 'Tu sesión no tiene rol platform_owner activo. Verifícalo y vuelve a intentar.'
                : `Ocurrió un error al cargar el control de acceso: ${toErrorMessage(snapshotQuery.error)}`
            }
          />
        ) : null}

        {snapshot && tab === 'users' ? (
          <section className="space-y-3">
            <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
              <AdminSectionLabel title="Usuarios de plataforma" count={`${users.length} de ${totalUsers || users.length}`} />
              <label className="relative lg:max-w-sm lg:flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-(--app-text-subtle)" />
                <Input
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Buscar por nombre o correo..."
                  className="h-9 rounded-control pl-9 text-[0.82rem]"
                />
              </label>
            </div>

            <div className="grid gap-2.5">
              {users.map((user) => {
                const assignedRoleIds = new Set(user.roles.map((role) => role.role_id))
                const assignableRoles = roles.filter((role) => !assignedRoleIds.has(role.id))
                const selectedRoleIds = selectedRolesByUser[user.id] ?? []

                return (
                  <AdminCard key={user.id} className="overflow-hidden">
                    <div className="grid gap-2.5 lg:grid-cols-[minmax(0,1.35fr)_minmax(250px,0.65fr)] lg:items-start">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-[0.88rem] font-bold text-(--app-text)">{displayUserName(user)}</p>
                            <p className="mt-0.5 truncate text-[0.78rem] text-(--app-text-muted)">{user.email ?? 'Sin correo'}</p>
                          </div>
                          <Badge variant="outline" className="px-1.5 py-0.5 text-[0.68rem]">{userStatusLabel(user.status)}</Badge>
                        </div>

                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {user.roles.length ? (
                            user.roles.map((role) => (
                              <span
                                key={role.assignment_id}
                                className="inline-flex items-center gap-1.5 rounded-full border border-primary-100 bg-primary-50 px-2 py-0.5 text-[0.68rem] font-bold text-primary-700 dark:border-primary-500/20 dark:bg-primary-500/12 dark:text-primary-200"
                              >
                                <ShieldCheck className="size-3.5" />
                                {role.role_name}
                                <button
                                  type="button"
                                  className="rounded-full p-0.5 hover:bg-primary-100 dark:hover:bg-primary-500/20"
                                  aria-label={`Revocar ${role.role_name}`}
                                  title={`Revocar ${role.role_name}`}
                                  onClick={() => setPendingRevoke({ user, role })}
                                >
                                  <X className="size-3.5" />
                                </button>
                              </span>
                            ))
                          ) : (
                            <span className="text-[0.78rem] text-(--app-text-subtle)">Sin roles de plataforma</span>
                          )}
                        </div>

                        <p className="mt-1.5 text-[0.72rem] text-(--app-text-subtle)">
                          {user.permissions.length} permiso{user.permissions.length === 1 ? '' : 's'} efectivo{user.permissions.length === 1 ? '' : 's'} · Último acceso: {formatDateTime(user.last_sign_in_at)}
                        </p>
                      </div>

                      <div className="grid gap-2 rounded-card border border-(--app-border) bg-(--app-surface-muted)/55 p-2">
                        {assignableRoles.length ? (
                          <>
                            <p className="text-[0.68rem] font-bold uppercase tracking-[0.06em] text-(--app-text-subtle)">
                              Añadir roles {selectedRoleIds.length ? `· ${selectedRoleIds.length}` : ''}
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {assignableRoles.map((role) => {
                                const selected = selectedRoleIds.includes(role.id)
                                return (
                                  <button
                                    key={role.id}
                                    type="button"
                                    aria-pressed={selected}
                                    onClick={() => toggleRoleForUser(user.id, role.id)}
                                    className={cn(
                                      'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.7rem] font-bold transition-colors',
                                      selected
                                        ? 'border-primary-300 bg-primary-100 text-primary-800 dark:border-primary-500/40 dark:bg-primary-500/20 dark:text-primary-100'
                                        : 'border-(--app-border) bg-(--app-surface) text-(--app-text-muted) hover:border-primary-200 hover:text-(--app-text)'
                                    )}
                                  >
                                    {selected ? <Check className="size-3" /> : <Plus className="size-3" />}
                                    {role.name}
                                  </button>
                                )
                              })}
                            </div>
                            <Button
                              className="h-8 px-2.5 text-xs"
                              disabled={!selectedRoleIds.length || assignMutation.isPending}
                              onClick={() => handleAssignRoles(user)}
                            >
                              <UserPlus className="size-4" /> Asignar {selectedRoleIds.length ? `(${selectedRoleIds.length})` : 'roles'}
                            </Button>
                          </>
                        ) : (
                          <p className="px-1 py-2 text-center text-[0.72rem] text-(--app-text-subtle)">Ya tiene todos los roles disponibles.</p>
                        )}
                      </div>
                    </div>
                  </AdminCard>
                )
              })}
              {!snapshotQuery.isLoading && users.length === 0 ? (
                <AdminEmpty
                  title={userSearch ? 'Sin usuarios para esa búsqueda' : 'Sin usuarios'}
                  description={userSearch ? 'Prueba con otro nombre o correo.' : 'Aún no hay usuarios disponibles para asignar roles.'}
                />
              ) : null}
              <div ref={sentinelRef} aria-hidden className="h-px w-full" />
              {isFetchingNextPage ? (
                <div className="flex items-center justify-center gap-2 py-3 text-[0.78rem] text-(--app-text-subtle)">
                  <Spinner size="sm" /> Cargando más usuarios...
                </div>
              ) : users.length > 0 && !hasNextPage ? (
                <p className="py-3 text-center text-[0.74rem] text-(--app-text-subtle)">
                  {latestUsersPage?.total_count ?? users.length} usuario{(latestUsersPage?.total_count ?? users.length) === 1 ? '' : 's'} · no hay más
                </p>
              ) : null}
            </div>
          </section>
        ) : null}

        {snapshot && tab === 'roles' ? (
          <section className="space-y-3">
            <AdminSectionLabel title="Roles de plataforma" count={roles.length} />
            <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
              {roles.map((role) => (
                <AdminCard key={role.id} className="p-3 sm:p-3">
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-[0.88rem] font-bold text-(--app-text)">{role.name}</p>
                        <code className="mt-1 block truncate text-[0.72rem] font-bold text-(--app-text-subtle)">{role.code}</code>
                      </div>
                      <RoleBadge role={role} />
                    </div>
                    <p className="line-clamp-2 text-[0.78rem] leading-5 text-(--app-text-muted)">{role.description}</p>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="outline" className="px-1.5 py-0.5 text-[0.68rem]">{role.permissions.length} permisos</Badge>
                      <Badge variant="outline" className="px-1.5 py-0.5 text-[0.68rem]">{role.active_assignment_count} asignaciones</Badge>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Button variant="outline" className="h-8 px-2.5 text-xs" onClick={() => openRoleSheet({ mode: 'view', role })}>
                        <Eye className="size-3.5" /> Permisos
                      </Button>
                      <Button variant="outline" className="h-8 px-2.5 text-xs" onClick={() => openRoleSheet({ mode: 'edit', role })}>
                        <Pencil className="size-3.5" /> {role.is_locked ? 'Editar permisos' : 'Editar'}
                      </Button>
                      {!role.is_locked && !role.is_system ? (
                        <Button variant="ghost" className="h-8 px-2.5 text-xs text-rose-600 hover:text-rose-700" onClick={() => setPendingDelete(role)}>
                          <Trash2 className="size-3.5" /> Eliminar
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </AdminCard>
              ))}
            </div>
          </section>
        ) : null}

        {snapshot && tab === 'audit' ? (
          <section className="space-y-3">
            <AdminSectionLabel title="Eventos recientes" count={auditEvents.length} />
            <AdminCard>
              <div className="divide-y divide-(--app-border)/70">
                {auditEvents.map((event) => (
                  <div key={event.id} className="grid gap-2 py-2.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                    <div className="min-w-0">
                      <p className="truncate text-[0.84rem] font-bold text-(--app-text)">{auditEventLabel(event.event_type)}</p>
                      <p className="mt-0.5 truncate text-[0.76rem] text-(--app-text-muted)">
                        {auditSummary(event)} · {event.actor_email ?? event.actor_name ?? 'Sistema'}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 text-[0.72rem] font-semibold text-(--app-text-subtle)">
                      <FileClock className="size-3.5" /> {formatDateTime(event.created_at)}
                    </span>
                  </div>
                ))}
                {!auditEvents.length ? (
                  <div className="py-6 text-center">
                    <p className="text-sm font-bold text-(--app-text)">Sin eventos</p>
                    <p className="mt-1 text-sm text-(--app-text-muted)">Aún no hay cambios de RBAC de plataforma.</p>
                  </div>
                ) : null}
              </div>
            </AdminCard>
          </section>
        ) : null}

        {snapshot && tab === 'risks' ? (
          <section className="space-y-3">
            <AdminSectionLabel title="Riesgos y segregación" count={riskFindings.length} />
            <div className="grid gap-2.5 lg:grid-cols-2">
              {riskFindings.map((finding) => (
                <div key={finding.id} className="rounded-card border border-(--app-border) bg-(--app-surface-elevated) p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 gap-2.5">
                      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-control border border-amber-100 bg-amber-50 text-amber-700">
                        <AlertTriangle className="size-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[0.88rem] font-bold text-(--app-text)">{finding.title}</p>
                        <p className="mt-1 text-[0.78rem] leading-5 text-(--app-text-muted)">{finding.description}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className={riskClassName(finding.level)}>{finding.level}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>

      <SideSheet
        open={Boolean(roleSheet)}
        onClose={() => setRoleSheet(null)}
        title={
          <span className="inline-flex items-center gap-2">
            <KeyRound className="size-5 text-primary-600" /> {roleSheetTitle}
          </span>
        }
        widthClassName="max-w-xl"
        footer={
          roleSheet?.mode === 'view' ? (
            <Button variant="outline" className="h-9" onClick={() => setRoleSheet(null)}>Cerrar</Button>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Button variant="ghost" className="h-9" onClick={() => setRoleSheet(null)}>Cancelar</Button>
              <Button className="h-9" onClick={() => saveRoleMutation.mutate()} disabled={saveRoleMutation.isPending}>
                {saveRoleMutation.isPending ? 'Guardando...' : 'Guardar rol'}
              </Button>
            </div>
          )
        }
      >
        <div className="space-y-4">
          <div className="grid gap-3 rounded-card border border-(--app-border) bg-(--app-surface-muted)/55 p-3">
            <label className="grid gap-1.5">
              <span className="text-[0.72rem] font-bold uppercase tracking-[0.08em] text-(--app-text-subtle)">Código</span>
              <Input
                value={roleCode}
                onChange={(event) => setRoleCode(normalizeRoleCode(event.target.value))}
                disabled={roleSheet?.mode !== 'create'}
                className="h-10 font-mono text-[0.82rem]"
                placeholder="soporte_operativo"
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-[0.72rem] font-bold uppercase tracking-[0.08em] text-(--app-text-subtle)">Nombre</span>
              <Input
                value={roleName}
                onChange={(event) => setRoleName(event.target.value)}
                disabled={roleSheet?.mode === 'view' || roleSheetMetadataLocked}
                className="h-10 text-[0.84rem]"
                placeholder="Soporte operativo"
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-[0.72rem] font-bold uppercase tracking-[0.08em] text-(--app-text-subtle)">Descripción</span>
              <Textarea
                value={roleDescription}
                onChange={(event) => setRoleDescription(event.target.value)}
                disabled={roleSheet?.mode === 'view' || roleSheetMetadataLocked}
                className="min-h-24 text-[0.84rem]"
                placeholder="Alcance operacional del rol"
              />
            </label>
          </div>

          <PermissionChecklist
            permissions={permissions}
            selectedCodes={selectedPermissionCodes}
            disabled={roleSheet?.mode === 'view'}
            onToggle={togglePermission}
          />
        </div>
      </SideSheet>

      <ConfirmDialog
        open={Boolean(pendingRevoke)}
        title="Revocar rol de plataforma"
        description={
          pendingRevoke
            ? `Vas a quitar ${pendingRevoke.role.role_name} de ${displayUserName(pendingRevoke.user)}.`
            : ''
        }
        confirmLabel="Revocar rol"
        variant="danger"
        loading={revokeMutation.isPending}
        onConfirm={() => {
          if (pendingRevoke) {
            revokeMutation.mutate({ assignmentId: pendingRevoke.role.assignment_id })
          }
        }}
        onCancel={() => setPendingRevoke(null)}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Eliminar rol personalizado"
        description={pendingDelete ? `El rol ${pendingDelete.name} se eliminará solo si nunca tuvo asignaciones.` : ''}
        confirmLabel="Eliminar rol"
        variant="danger"
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (pendingDelete) {
            deleteMutation.mutate(pendingDelete.id)
          }
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </AdminPage>
  )
}
