export const permissionCatalog = [
  'platform_dashboard:read',
  'user:read',
  'user:update',
  'tenant:read',
  'tenant:create',
  'tenant:suspend',
  'tenant:restore',
  'recruiter_request:read',
  'recruiter_request:review',
  'moderation:read',
  'moderation:act',
  'plan:read',
  'plan:update',
  'billing:read',
  'feature_flag:read',
  'feature_flag:update',
  'audit_log:read',
  'workspace:read',
  'workspace:update',
  'company_profile:read',
  'company_profile:update',
  'job:create',
  'job:read',
  'job:update',
  'job:publish',
  'job:archive',
  'job:close',
  'application:read',
  'application:move_stage',
  'application:add_note',
  'application:rate',
  'application:export',
  'candidate_profile:read_limited',
  'candidate_resume:read',
  'member:invite',
  'member:read',
  'member:update',
  'member:remove',
  'role:read',
  'role:create',
  'role:update',
  'role:delete',
  'role:assign',
  'notification:read',
  'notification:manage',
  'analytics:read'
] as const

export type PermissionCode = (typeof permissionCatalog)[number]

const permissionCatalogSet = new Set<string>(permissionCatalog)

export function isPermissionCode(value: string): value is PermissionCode {
  return permissionCatalogSet.has(value)
}
