import type { EmailOtpType, User } from '@supabase/supabase-js'

import { surfacePaths } from '@/app/router/surface-paths'
import { MAX_UPLOAD_SIZE_BYTES, formatFileSize } from '@/lib/uploads/media'
import { toErrorMessage } from '@/lib/errors/error-utils'
import { supabase } from '@/lib/supabase/client'
import { env } from '@/shared/config/env'
import { isPermissionCode, type PermissionCode } from '@/shared/constants/permissions'
import type { Tables } from '@/shared/types/database'

export type PrivateStorageBucket = 'candidate-resumes' | 'user-media' | 'verification-documents'

export interface AppMembership {
  id: string
  tenantId: string
  tenantName: string
  tenantSlug: string
  roleCodes: string[]
  roleNames: string[]
  permissions: PermissionCode[]
}

export interface SessionSnapshot {
  profile: Tables<'users'> | null
  memberships: AppMembership[]
  permissions: PermissionCode[]
  platformPermissions: PermissionCode[]
  isPlatformAdmin: boolean
}

interface MembershipQueryRow {
  id: string
  tenant_id: string
  tenant: {
    id: string
    name: string
    slug: string
  } | null
  membership_roles:
    | {
        role:
          | {
              code: string
              name: string
              tenant_role_permissions:
                | {
                    permission: {
                      code: string
                    } | null
                  }[]
                | null
            }
          | null
      }[]
    | null
}

const platformPermissionChecks = [
  'platform_dashboard:read',
  'tenant:read',
  'user:read',
  'recruiter_request:read',
  'recruiter_request:review',
  'moderation:read',
  'moderation:act',
  'plan:read',
  'plan:update',
  'billing:read',
  'feature_flag:read',
  'feature_flag:update',
  'audit_log:read'
] as const satisfies readonly PermissionCode[]

function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase no esta configurado. Completa VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.')
  }

  return supabase
}

function uniquePermissions(values: PermissionCode[]) {
  return [...new Set(values)]
}

function normalizeStoragePath(filePath: string) {
  return filePath.replace(/^\/+/, '')
}

function getFileExtension(file: File) {
  const extension = file.name.split('.').pop()?.trim().toLowerCase()

  return extension && extension.length > 0 ? extension : 'bin'
}

function normalizeStorageUploadErrorMessage(file: File, errorMessage: string) {
  const unsupportedMimeMatch = /mime type\s+(.+?)\s+is not supported/i.exec(errorMessage)

  if (unsupportedMimeMatch) {
    const mimeType = (unsupportedMimeMatch[1] ?? file.type) || 'desconocido'

    return `El almacenamiento rechazo el formato ${mimeType}. Intenta con un archivo permitido para este flujo o vuelve a subirlo cuando el bucket este actualizado.`
  }

  return errorMessage
}

export function getAuthRedirectUrl(nextPath = surfacePaths.candidate.onboarding) {
  const originCandidate = env.authSiteUrl || (typeof window !== 'undefined' ? window.location.origin : null)

  if (!originCandidate) {
    return undefined
  }

  const redirectUrl = new URL(surfacePaths.auth.confirm, originCandidate)

  if (nextPath !== surfacePaths.candidate.onboarding) {
    redirectUrl.searchParams.set('next', nextPath)
  }

  return redirectUrl.toString()
}

async function retryProfileLookup(userId: string) {
  const client = requireSupabase()
  const firstAttempt = await client.from('users').select('*').eq('id', userId).maybeSingle()

  if (firstAttempt.error) {
    throw firstAttempt.error
  }

  if (firstAttempt.data) {
    return firstAttempt.data
  }

  await new Promise((resolve) => {
    window.setTimeout(resolve, 250)
  })

  const secondAttempt = await client.from('users').select('*').eq('id', userId).maybeSingle()

  if (secondAttempt.error) {
    throw secondAttempt.error
  }

  return secondAttempt.data
}

export async function signUpWithPassword(values: {
  email: string
  password: string
  fullName: string
}) {
  const client = requireSupabase()

  const response = await client.auth.signUp({
    email: values.email,
    password: values.password,
    options: {
      emailRedirectTo: getAuthRedirectUrl(),
      data: {
        full_name: values.fullName
      }
    }
  })

  if (response.error) {
    throw response.error
  }

  return response.data
}

export async function signInWithPassword(values: { email: string; password: string }) {
  const client = requireSupabase()
  const response = await client.auth.signInWithPassword(values)

  if (response.error) {
    throw response.error
  }

  return response.data
}

export async function completeAuthConfirmation(values: {
  code?: string | null
  tokenHash?: string | null
  type?: EmailOtpType | null
}) {
  const client = requireSupabase()

  if (values.code) {
    const response = await client.auth.exchangeCodeForSession(values.code)

    if (response.error) {
      throw response.error
    }

    return response.data
  }

  if (values.tokenHash && values.type) {
    const response = await client.auth.verifyOtp({
      token_hash: values.tokenHash,
      type: values.type
    })

    if (response.error) {
      throw response.error
    }

    return response.data
  }

  const sessionResponse = await client.auth.getSession()

  if (sessionResponse.error) {
    throw sessionResponse.error
  }

  return sessionResponse.data
}

export async function signOutCurrentUser() {
  const client = requireSupabase()
  const response = await client.auth.signOut()

  if (response.error) {
    throw response.error
  }
}

export async function fetchSessionSnapshot(authUser: User): Promise<SessionSnapshot> {
  const client = requireSupabase()
  const profile = await retryProfileLookup(authUser.id)

  const membershipResponse = await client
    .from('memberships')
    .select(
      `
        id,
        tenant_id,
        tenant:tenants (
          id,
          name,
          slug
        ),
        membership_roles (
          role:tenant_roles (
            code,
            name,
            tenant_role_permissions (
              permission:permissions (
                code
              )
            )
          )
        )
      `
    )
    .eq('user_id', authUser.id)
    .eq('status', 'active')

  if (membershipResponse.error) {
    throw membershipResponse.error
  }

  const memberships = ((membershipResponse.data ?? []) as MembershipQueryRow[]).map((row) => {
    const roleCodes = row.membership_roles?.flatMap((membershipRole) =>
      membershipRole.role?.code ? [membershipRole.role.code] : []
    ) ?? []
    const roleNames = row.membership_roles?.flatMap((membershipRole) =>
      membershipRole.role?.name ? [membershipRole.role.name] : []
    ) ?? []

    const permissions = uniquePermissions(
      row.membership_roles?.flatMap((membershipRole) => {
        return (
          membershipRole.role?.tenant_role_permissions?.flatMap((tenantRolePermission) => {
            const code = tenantRolePermission.permission?.code

            return code && isPermissionCode(code) ? [code] : []
          }) ?? []
        )
      }) ?? []
    )

    return {
      id: row.id,
      tenantId: row.tenant_id,
      tenantName: row.tenant?.name ?? 'Tenant',
      tenantSlug: row.tenant?.slug ?? row.tenant_id,
      roleCodes,
      roleNames,
      permissions
    } satisfies AppMembership
  })

  const platformPermissionResults = await Promise.all(
    platformPermissionChecks.map(async (permissionCode) => {
      const permissionResponse = await client.rpc('has_platform_permission', {
        permission_code: permissionCode
      })

      if (permissionResponse.error) {
        throw permissionResponse.error
      }

      return permissionResponse.data ? permissionCode : null
    })
  )

  const platformAdminResponse = await client.rpc('is_platform_admin')

  if (platformAdminResponse.error) {
    throw platformAdminResponse.error
  }

  const platformPermissions = platformPermissionResults.flatMap((permissionCode) =>
    permissionCode ? [permissionCode] : []
  )
  const permissions = uniquePermissions([...platformPermissions, ...memberships.flatMap((membership) => membership.permissions)])

  return {
    profile,
    memberships,
    permissions,
    platformPermissions,
    isPlatformAdmin: platformAdminResponse.data === true
  }
}

export async function updateUserProfile(values: {
  userId: string
  fullName: string
  displayName: string
  locale: string
  countryCode: string
  avatarPath?: string | null
}) {
  const client = requireSupabase()
  const response = await client
    .from('users')
    .update({
      full_name: values.fullName,
      display_name: values.displayName,
      locale: values.locale,
      country_code: values.countryCode.toUpperCase(),
      avatar_path: values.avatarPath ?? null
    })
    .eq('id', values.userId)
    .select('*')
    .single()

  if (response.error) {
    throw response.error
  }

  return response.data
}

export async function uploadPrivateFile(options: {
  bucket: PrivateStorageBucket
  ownerUserId: string
  file: File
  prefix: string
}) {
  const client = requireSupabase()

  if (options.file.size > MAX_UPLOAD_SIZE_BYTES) {
    throw new Error(
      `El archivo pesa ${formatFileSize(options.file.size)} y supera el maximo de ${formatFileSize(MAX_UPLOAD_SIZE_BYTES)}. Comprime el archivo o carga uno de ${formatFileSize(MAX_UPLOAD_SIZE_BYTES)} o menos.`
    )
  }

  const extension = getFileExtension(options.file)
  const storagePath = `${options.ownerUserId}/${options.prefix}-${crypto.randomUUID()}.${extension}`

  const uploadResponse = await client.storage
    .from(options.bucket)
    .upload(normalizeStoragePath(storagePath), options.file, {
      upsert: false,
      cacheControl: '3600'
    })

  if (uploadResponse.error) {
    throw new Error(normalizeStorageUploadErrorMessage(options.file, uploadResponse.error.message))
  }

  return uploadResponse.data.path
}

export async function removePrivateFile(options: {
  bucket: PrivateStorageBucket
  path: string
}) {
  const client = requireSupabase()
  const response = await client.storage.from(options.bucket).remove([normalizeStoragePath(options.path)])

  if (response.error) {
    throw response.error
  }
}

export async function createPrivateFileUrl(bucket: PrivateStorageBucket, path: string) {
  const client = requireSupabase()
  const response = await client.storage.from(bucket).createSignedUrl(path, 60 * 10)

  if (response.error) {
    throw response.error
  }

  return response.data.signedUrl
}

export async function submitRecruiterRequest(values: {
  requesterUserId: string
  requestedCompanyName: string
  requestedCompanyLegalName?: string
  requestedTenantSlug: string
  companyWebsiteUrl?: string
  companyEmail?: string
  companyPhone?: string
  companyCountryCode?: string
  companyDescription?: string
  companyLogoPath?: string | null
  verificationDocumentPath?: string | null
}) {
  const client = requireSupabase()
  const response = await client
    .from('recruiter_requests')
    .insert({
      requester_user_id: values.requesterUserId,
      requested_company_name: values.requestedCompanyName,
      requested_company_legal_name: values.requestedCompanyLegalName || null,
      requested_tenant_slug: values.requestedTenantSlug,
      company_website_url: values.companyWebsiteUrl || null,
      company_email: values.companyEmail || null,
      company_phone: values.companyPhone || null,
      company_country_code: values.companyCountryCode || null,
      company_description: values.companyDescription || null,
      company_logo_path: values.companyLogoPath || null,
      verification_document_path: values.verificationDocumentPath || null
    })
    .select('*')
    .single()

  if (response.error) {
    throw response.error
  }

  return response.data
}

export async function listMyRecruiterRequests(userId: string) {
  const client = requireSupabase()
  const response = await client
    .from('recruiter_requests')
    .select('*')
    .eq('requester_user_id', userId)
    .order('submitted_at', { ascending: false })

  if (response.error) {
    throw response.error
  }

  return response.data
}

export async function listPendingRecruiterRequests() {
  const client = requireSupabase()
  const response = await client
    .from('recruiter_requests')
    .select('*')
    .in('status', ['submitted', 'under_review'])
    .order('submitted_at', { ascending: true })

  if (response.error) {
    throw response.error
  }

  return response.data
}

export async function reviewRecruiterRequest(values: {
  requestId: string
  decision: 'approved' | 'rejected'
  reviewNotes?: string
}) {
  const client = requireSupabase()
  const response = await client.rpc('review_recruiter_request', {
    p_request_id: values.requestId,
    p_decision: values.decision,
    p_review_notes: values.reviewNotes?.trim() || undefined
  })

  if (response.error) {
    throw response.error
  }

  return response.data
}

export async function bootstrapFirstPlatformOwner() {
  const client = requireSupabase()
  const response = await client.rpc('bootstrap_first_platform_owner')

  if (response.error) {
    throw response.error
  }

  return response.data
}

export function toBootstrapFirstPlatformOwnerErrorMessage(error: unknown) {
  const message = toErrorMessage(error)

  if (/a platform owner already exists/i.test(message)) {
    return 'Ya existe un primer admin activo. Este boton solo funciona una vez por plataforma.'
  }

  if (/authentication required/i.test(message)) {
    return 'Debes iniciar sesion antes de reclamar el rol inicial.'
  }

  if (/platform owner role not found/i.test(message)) {
    return 'La configuracion del rol inicial no esta disponible. Revisa la configuracion de RBAC.'
  }

  return message
}

export { toErrorMessage }
