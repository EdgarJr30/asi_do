import { toControlledError } from '@/lib/errors/error-utils'
import { supabase } from '@/lib/supabase/client'

export interface PlatformAccessPermission {
  id: string
  code: string
  resource: string
  action: string
  scope: 'platform' | 'tenant' | 'self'
  description: string
}

export interface PlatformAccessRole {
  id: string
  code: string
  name: string
  description: string
  is_system: boolean
  is_locked: boolean
  created_at: string
  updated_at: string
  active_assignment_count: number
  permissions: PlatformAccessPermission[]
}

export interface PlatformAccessUserRole {
  assignment_id: string
  role_id: string
  role_code: string
  role_name: string
  is_system: boolean
  assigned_at: string
  assigned_by_user_id: string | null
}

export interface PlatformAccessUser {
  id: string
  email: string | null
  full_name: string
  display_name: string
  status: string
  created_at: string
  last_sign_in_at: string | null
  roles: PlatformAccessUserRole[]
  permissions: string[]
}

export interface PlatformAccessAuditEvent {
  id: string
  actor_user_id: string | null
  actor_email: string | null
  actor_name: string | null
  event_type: string
  entity_type: string
  entity_id: string
  payload: Record<string, unknown>
  created_at: string
}

export interface PlatformAccessStats {
  role_count: number
  custom_role_count: number
  active_assignment_count: number
  platform_owner_count: number
  users_with_platform_roles_count: number
  audit_event_count: number
}

export interface PlatformAccessUsersPage {
  limit: number
  offset: number
  total_count: number
  loaded_count: number
  next_offset: number | null
}

export interface PlatformAccessSnapshot {
  stats: PlatformAccessStats
  users_page: PlatformAccessUsersPage
  roles: PlatformAccessRole[]
  permissions: PlatformAccessPermission[]
  users: PlatformAccessUser[]
  audit_events: PlatformAccessAuditEvent[]
}

export interface SavePlatformRoleInput {
  name: string
  description: string
  permissionCodes: string[]
}

function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase no esta configurado. Completa VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.')
  }

  return supabase
}

export async function fetchPlatformAccessControlSnapshot(
  input: { userQuery?: string; userLimit?: number; userOffset?: number } = {}
) {
  const client = requireSupabase()
  const response = await client.rpc('admin_platform_rbac_snapshot' as never, {
    p_user_query: input.userQuery?.trim() || null,
    p_user_limit: input.userLimit ?? 50,
    p_user_offset: input.userOffset ?? 0
  } as never)

  if (response.error) {
    throw toControlledError(response.error)
  }

  return response.data as unknown as PlatformAccessSnapshot
}

export async function createPlatformRole(input: SavePlatformRoleInput & { code: string }) {
  const client = requireSupabase()
  const response = await client.rpc('admin_create_platform_role' as never, {
    p_code: input.code,
    p_name: input.name,
    p_description: input.description,
    p_permission_codes: input.permissionCodes
  } as never)

  if (response.error) {
    throw toControlledError(response.error)
  }

  return response.data as unknown as PlatformAccessRole
}

export async function updatePlatformRole(input: SavePlatformRoleInput & { roleId: string }) {
  const client = requireSupabase()
  const response = await client.rpc('admin_update_platform_role' as never, {
    p_role_id: input.roleId,
    p_name: input.name,
    p_description: input.description,
    p_permission_codes: input.permissionCodes
  } as never)

  if (response.error) {
    throw toControlledError(response.error)
  }

  return response.data as unknown as PlatformAccessRole
}

export async function deletePlatformRole(roleId: string) {
  const client = requireSupabase()
  const response = await client.rpc('admin_delete_platform_role' as never, {
    p_role_id: roleId
  } as never)

  if (response.error) {
    throw toControlledError(response.error)
  }

  return response.data as unknown as string
}

export async function assignPlatformRole(input: { userId: string; roleId: string; notes?: string }) {
  const client = requireSupabase()
  const response = await client.rpc('admin_assign_platform_role' as never, {
    p_user_id: input.userId,
    p_role_id: input.roleId,
    p_notes: input.notes ?? null
  } as never)

  if (response.error) {
    throw toControlledError(response.error)
  }

  return response.data as unknown as PlatformAccessUserRole
}

export async function revokePlatformRole(input: { assignmentId: string; notes?: string }) {
  const client = requireSupabase()
  const response = await client.rpc('admin_revoke_platform_role' as never, {
    p_assignment_id: input.assignmentId,
    p_notes: input.notes ?? null
  } as never)

  if (response.error) {
    throw toControlledError(response.error)
  }

  return response.data as unknown as PlatformAccessUserRole
}
