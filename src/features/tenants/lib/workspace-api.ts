import { supabase } from '@/lib/supabase/client'
import { prepareUploadFile, RECRUITER_LOGO_MIME_TYPES } from '@/lib/uploads/media'
import type { Tables, TablesUpdate } from '@/shared/types/database'

export { createCompanyAssetUrl as createWorkspaceAssetUrl } from '@/features/tenants/lib/company-assets-api'

interface WorkspaceMembershipRow extends Tables<'memberships'> {
  user: Pick<
    Tables<'users'>,
    'id' | 'full_name' | 'display_name' | 'email' | 'country_code' | 'avatar_path'
  > | null
  membership_roles:
    | {
        role: Pick<Tables<'tenant_roles'>, 'id' | 'code' | 'name'> | null
      }[]
    | null
}

export interface WorkspaceBundle {
  tenant: Tables<'tenants'>
  companyProfile: Tables<'company_profiles'> | null
  memberships: WorkspaceMembershipRow[]
  roles: Tables<'tenant_roles'>[]
}

function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase no esta configurado. Completa VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.')
  }

  return supabase
}

function normalizePath(filePath: string) {
  return filePath.replace(/^\/+/, '')
}

function getFileExtension(file: File) {
  return file.name.split('.').pop()?.trim().toLowerCase() || 'bin'
}

export async function fetchWorkspaceBundle(tenantId: string): Promise<WorkspaceBundle> {
  const client = requireSupabase()
  const [tenantResponse, companyProfileResponse, membershipsResponse, rolesResponse] = await Promise.all([
    client.from('tenants').select('*').eq('id', tenantId).single(),
    client.from('company_profiles').select('*').eq('tenant_id', tenantId).maybeSingle(),
    client
      .from('memberships')
      .select(
        `
        *,
        user:users!memberships_user_id_fkey (
          id,
          full_name,
          display_name,
          email,
          country_code,
          avatar_path
        ),
        membership_roles (
          role:tenant_roles (
            id,
            code,
            name
          )
        )
      `
      )
      .eq('tenant_id', tenantId)
      .order('joined_at', { ascending: true }),
    client
      .from('tenant_roles')
      .select('*')
      .or(`tenant_id.is.null,tenant_id.eq.${tenantId}`)
      .order('is_system', { ascending: false })
      .order('name', { ascending: true })
  ])

  if (tenantResponse.error) {
    throw tenantResponse.error
  }

  if (companyProfileResponse.error) {
    throw companyProfileResponse.error
  }

  if (membershipsResponse.error) {
    throw membershipsResponse.error
  }

  if (rolesResponse.error) {
    throw rolesResponse.error
  }

  return {
    tenant: tenantResponse.data,
    companyProfile: companyProfileResponse.data,
    memberships: (membershipsResponse.data ?? []) as unknown as WorkspaceMembershipRow[],
    roles: rolesResponse.data ?? []
  }
}

export type WorkspaceMemberFilter = 'all' | 'active' | 'invited'

export interface WorkspaceMembersPage {
  members: WorkspaceMembershipRow[]
  totalCount: number
  nextOffset: number | null
}

export interface WorkspaceMemberCounts {
  all: number
  active: number
  invited: number
}

const WORKSPACE_MEMBER_PAGE_SELECT = `
  *,
  user:users!memberships_user_id_fkey!inner (
    id,
    full_name,
    display_name,
    email,
    country_code,
    avatar_path
  ),
  membership_roles (
    role:tenant_roles (
      id,
      code,
      name
    )
  )
`

/**
 * Miembros del workspace paginados en el servidor (range + count exacto),
 * pensado para scroll infinito. El filtro por estado y la búsqueda por nombre o
 * correo se resuelven en Postgres; la búsqueda usa un inner join sobre `users`
 * para que el conteo refleje solo las filas que realmente coinciden.
 */
export async function listWorkspaceMembersPage(input: {
  tenantId: string
  limit: number
  offset: number
  filter?: WorkspaceMemberFilter
  query?: string
}): Promise<WorkspaceMembersPage> {
  const client = requireSupabase()
  const limit = Math.max(1, input.limit)
  const offset = Math.max(0, input.offset)

  let query = client
    .from('memberships')
    .select(WORKSPACE_MEMBER_PAGE_SELECT, { count: 'exact' })
    .eq('tenant_id', input.tenantId)

  if (input.filter === 'active' || input.filter === 'invited') {
    query = query.eq('status', input.filter)
  }

  const search = input.query?.trim()
  if (search) {
    query = query.or(
      `display_name.ilike.%${search}%,full_name.ilike.%${search}%,email.ilike.%${search}%`,
      { referencedTable: 'user' }
    )
  }

  // joined_at asc como orden principal + id como desempate determinista para
  // que los rangos entre páginas sean estables.
  query = query.order('joined_at', { ascending: true }).order('id', { ascending: true })

  const response = await query.range(offset, offset + limit - 1)

  if (response.error) {
    throw response.error
  }

  const members = (response.data ?? []) as unknown as WorkspaceMembershipRow[]
  const totalCount = response.count ?? members.length
  const nextOffset = offset + limit < totalCount ? offset + limit : null

  return { members, totalCount, nextOffset }
}

/** Conteo por estado (total / activos / invitados) respetando la búsqueda activa. */
export async function countWorkspaceMembers(input: {
  tenantId: string
  query?: string
}): Promise<WorkspaceMemberCounts> {
  const client = requireSupabase()
  const search = input.query?.trim()

  function buildBaseCount() {
    const select = search ? 'id, user:users!memberships_user_id_fkey!inner (id)' : 'id'
    let query = client
      .from('memberships')
      .select(select, { count: 'exact', head: true })
      .eq('tenant_id', input.tenantId)

    if (search) {
      query = query.or(
        `display_name.ilike.%${search}%,full_name.ilike.%${search}%,email.ilike.%${search}%`,
        { referencedTable: 'user' }
      )
    }

    return query
  }

  const [allResponse, activeResponse, invitedResponse] = await Promise.all([
    buildBaseCount(),
    buildBaseCount().eq('status', 'active'),
    buildBaseCount().eq('status', 'invited')
  ])

  if (allResponse.error) {
    throw allResponse.error
  }
  if (activeResponse.error) {
    throw activeResponse.error
  }
  if (invitedResponse.error) {
    throw invitedResponse.error
  }

  return {
    all: allResponse.count ?? 0,
    active: activeResponse.count ?? 0,
    invited: invitedResponse.count ?? 0
  }
}

export async function updateWorkspaceProfile(input: {
  tenantId: string
  displayName: string
  legalName: string
  websiteUrl?: string
  companyEmail?: string
  companyPhone?: string
  countryCode?: string
  industry?: string
  sizeRange?: string
  description?: string
  isPublic: boolean
  logoPath?: string | null
}) {
  const client = requireSupabase()
  const payload: TablesUpdate<'company_profiles'> = {
    display_name: input.displayName.trim(),
    legal_name: input.legalName.trim(),
    website_url: input.websiteUrl?.trim() || null,
    company_email: input.companyEmail?.trim() || null,
    company_phone: input.companyPhone?.trim() || null,
    country_code: input.countryCode?.trim().toUpperCase() || null,
    industry: input.industry?.trim() || null,
    size_range: input.sizeRange?.trim() || null,
    description: input.description?.trim() || null,
    is_public: input.isPublic
  }

  if ('logoPath' in input) {
    payload.logo_path = input.logoPath
  }

  const response = await client
    .from('company_profiles')
    .update(payload)
    .eq('tenant_id', input.tenantId)
    .select('*')
    .single()

  if (response.error) {
    throw response.error
  }

  return response.data
}

export async function uploadWorkspaceLogo(input: {
  tenantId: string
  userId: string
  file: File
}) {
  const client = requireSupabase()
  const preparedFile = await prepareUploadFile(input.file, {
    acceptedMimeTypes: RECRUITER_LOGO_MIME_TYPES,
    acceptedFormatsLabel: 'PNG, JPG, WEBP o SVG',
    fieldLabel: 'El logo de empresa'
  })

  const extension = getFileExtension(preparedFile)
  const storagePath = `${input.tenantId}/logo-${crypto.randomUUID()}.${extension}`
  const uploadResponse = await client.storage.from('company-assets').upload(normalizePath(storagePath), preparedFile, {
    upsert: false,
    cacheControl: '3600'
  })

  if (uploadResponse.error) {
    throw uploadResponse.error
  }

  return uploadResponse.data.path
}

export async function replaceMembershipPrimaryRole(input: {
  membershipId: string
  tenantId: string
  nextRoleId: string
  actorUserId: string
}) {
  const client = requireSupabase()

  const existingRolesResponse = await client
    .from('membership_roles')
    .select('id, role_id')
    .eq('membership_id', input.membershipId)
    .is('revoked_at', null)

  if (existingRolesResponse.error) {
    throw existingRolesResponse.error
  }

  const rolesToRevoke = (existingRolesResponse.data ?? [])
    .filter((row) => row.role_id !== input.nextRoleId)
    .map((row) => row.id)

  if (rolesToRevoke.length > 0) {
    const revokeResponse = await client
      .from('membership_roles')
      .update({
        revoked_at: new Date().toISOString(),
        revoked_by_user_id: input.actorUserId
      })
      .in('id', rolesToRevoke)

    if (revokeResponse.error) {
      throw revokeResponse.error
    }
  }

  const upsertResponse = await client.from('membership_roles').upsert(
    {
      membership_id: input.membershipId,
      role_id: input.nextRoleId,
      assigned_by_user_id: input.actorUserId,
      revoked_at: null,
      revoked_by_user_id: null
    },
    {
      onConflict: 'membership_id,role_id'
    }
  )

  if (upsertResponse.error) {
    throw upsertResponse.error
  }

  return fetchWorkspaceBundle(input.tenantId)
}

export async function inviteWorkspaceMember(input: {
  tenantId: string
  email: string
  roleId?: string | null
}) {
  const client = requireSupabase()
  const response = await (client as typeof client & {
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: Error | null }>
  }).rpc('invite_tenant_member', {
    p_tenant_id: input.tenantId,
    p_email: input.email.trim().toLowerCase(),
    p_role_id: input.roleId ?? null
  })

  if (response.error) {
    throw response.error
  }

  return response.data as Tables<'memberships'>
}

export async function revokeWorkspaceInvite(input: {
  membershipId: string
  tenantId: string
}) {
  const client = requireSupabase()
  const response = await (client as typeof client & {
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: Error | null }>
  }).rpc('revoke_membership_invite', {
    p_membership_id: input.membershipId
  })

  if (response.error) {
    throw response.error
  }

  return response.data as Tables<'memberships'>
}
