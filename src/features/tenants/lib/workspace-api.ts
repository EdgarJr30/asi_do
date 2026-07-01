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
