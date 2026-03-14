export const permissionCatalog = [
  'workspace:read',
  'job:read',
  'application:read',
  'role:read',
  'notification:read',
  'moderation:read'
] as const

export type PermissionCode = (typeof permissionCatalog)[number]
