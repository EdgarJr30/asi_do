/* eslint-disable react-refresh/only-export-components */

import { createContext, type PropsWithChildren, useContext, useEffect, useRef, useState } from 'react'
import type { Session, SupabaseClient, User } from '@supabase/supabase-js'

import type { AppMembership } from '@/features/auth/lib/auth-api'
import { hasActiveAsiAccess } from '@/lib/auth/asi-access'
import { getSupabaseConfig } from '@/shared/config/env'
import type { PermissionCode } from '@/shared/constants/permissions'
import type { Database, Tables } from '@/shared/types/database'

// `import()` dinámico del cliente Supabase: lo saca del bundle eager (landing)
// y lo carga (chunk `vendor-supabase`) solo tras el montaje. Se determina la
// configuración con el env (síncrono), sin cargar el SDK.
const isSupabaseConfigured = getSupabaseConfig() !== null

let supabaseClientPromise: Promise<SupabaseClient<Database> | null> | null = null
function loadSupabaseClient() {
  if (!supabaseClientPromise) {
    supabaseClientPromise = import('@/lib/supabase/client').then((mod) => mod.supabase)
  }
  return supabaseClientPromise
}

interface AppSessionContextValue {
  isSupabaseConfigured: boolean
  isLoading: boolean
  isAuthenticated: boolean
  session: Session | null
  authUser: User | null
  profile: Tables<'users'> | null
  memberships: AppMembership[]
  permissions: PermissionCode[]
  platformPermissions: PermissionCode[]
  activeTenantId: string | null
  activeMembership: AppMembership | null
  hasMultipleWorkspaceMemberships: boolean
  isPlatformAdmin: boolean
  isInternalDeveloper: boolean
  hasActiveAsiAccess: boolean
  canAccessAdminConsole: boolean
  canReviewRecruiterRequests: boolean
  canReviewAppErrors: boolean
  /** El usuario tiene autoridad pastoral activa ⇒ ve la cola de solicitudes de su iglesia. */
  isMembershipReviewerPastor: boolean
  refresh: () => Promise<void>
}

const AppSessionContext = createContext<AppSessionContextValue | null>(null)

export function resolveActiveMembership(memberships: AppMembership[]) {
  return memberships[0] ?? null
}

function emptyState(session: Session | null): AppSessionContextValue {
  const activeMembership = resolveActiveMembership([])
  return {
    isSupabaseConfigured,
    isLoading: false,
    isAuthenticated: session !== null,
    session,
    authUser: session?.user ?? null,
    profile: null,
    memberships: [],
    permissions: [],
    platformPermissions: [],
    activeTenantId: activeMembership?.tenantId ?? null,
    activeMembership,
    hasMultipleWorkspaceMemberships: false,
    isPlatformAdmin: false,
    isInternalDeveloper: false,
    hasActiveAsiAccess: false,
    canAccessAdminConsole: false,
    canReviewRecruiterRequests: false,
    canReviewAppErrors: false,
    isMembershipReviewerPastor: false,
    refresh: () => Promise.resolve()
  }
}

export function AppSessionProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Tables<'users'> | null>(null)
  const [memberships, setMemberships] = useState<AppMembership[]>([])
  const [permissions, setPermissions] = useState<PermissionCode[]>([])
  const [platformPermissions, setPlatformPermissions] = useState<PermissionCode[]>([])
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false)
  const [isInternalDeveloper, setIsInternalDeveloper] = useState(false)
  const [activePastorScopeCount, setActivePastorScopeCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const hydratedUserIdRef = useRef<string | null>(null)
  const clientRef = useRef<SupabaseClient<Database> | null>(null)

  async function hydrateSession(user: User | null, options: { showLoading?: boolean } = {}) {
    const { showLoading = true } = options

    if (!user) {
      hydratedUserIdRef.current = null
      setProfile(null)
      setMemberships([])
      setPermissions([])
      setPlatformPermissions([])
      setIsPlatformAdmin(false)
      setIsInternalDeveloper(false)
      setActivePastorScopeCount(0)
      setIsLoading(false)
      return
    }

    if (showLoading) {
      setIsLoading(true)
    }

    try {
      const { fetchSessionSnapshot } = await import('@/features/auth/lib/auth-api')
      const snapshot = await fetchSessionSnapshot(user)

      hydratedUserIdRef.current = user.id
      setProfile(snapshot.profile)
      setMemberships(snapshot.memberships)
      setPermissions(snapshot.permissions)
      setPlatformPermissions(snapshot.platformPermissions)
      setIsPlatformAdmin(snapshot.isPlatformAdmin)
      setIsInternalDeveloper(Boolean(snapshot.profile?.is_internal_developer))
      setActivePastorScopeCount(snapshot.activePastorScopeCount)
    } finally {
      setIsLoading(false)
    }
  }

  async function refresh() {
    // Leemos la sesión viva del SDK en lugar del estado del closure (que puede
    // estar desfasado justo después de iniciar sesión). Así evitamos hidratar con
    // un usuario nulo y dejar `isLoading=false` con `profile=null`, lo que causaba
    // un redirect prematuro a /account/profile antes de cargar el perfil real.
    const client = clientRef.current ?? (await loadSupabaseClient())
    clientRef.current = client

    if (!client) {
      await hydrateSession(null)
      return
    }

    const { data } = await client.auth.getSession()
    setSession(data.session)
    await hydrateSession(data.session?.user ?? null)
  }

  useEffect(() => {
    let isActive = true
    let unsubscribe: (() => void) | undefined

    void (async () => {
      const client = await loadSupabaseClient()

      if (!isActive) {
        return
      }

      clientRef.current = client

      if (!client) {
        setIsLoading(false)
        return
      }

      const currentSessionResponse = await client.auth.getSession()

      if (!isActive) {
        return
      }

      const currentSession = currentSessionResponse.data.session
      setSession(currentSession)
      await hydrateSession(currentSession?.user ?? null)

      const authListener = client.auth.onAuthStateChange((_event, nextSession) => {
        if (!isActive) {
          return
        }

        const nextUserId = nextSession?.user.id ?? null

        setSession(nextSession)

        if (nextUserId !== null && nextUserId === hydratedUserIdRef.current) {
          return
        }

        void hydrateSession(nextSession?.user ?? null, { showLoading: hydratedUserIdRef.current === null })
      })

      unsubscribe = () => authListener.data.subscription.unsubscribe()
    })()

    return () => {
      isActive = false
      unsubscribe?.()
    }
  }, [])

  const activeMembership = resolveActiveMembership(memberships)
  const hasAdminConsolePermission = permissions.some((permission) =>
    [
      'platform_dashboard:read',
      'recruiter_request:review',
      'user:approve',
      'pastor_authority_request:review',
      'regional_authority_request:review',
      'scoped_user_authorization:review',
      'support_ticket:read',
      'moderation:read',
      'app_error_log:read',
      'audit_log:read'
    ].includes(permission)
  )

  const contextValue: AppSessionContextValue = {
    activeMembership,
    activeTenantId: activeMembership?.tenantId ?? null,
    hasMultipleWorkspaceMemberships: memberships.length > 1,
    isSupabaseConfigured,
    isLoading,
    isAuthenticated: session !== null,
    session,
    authUser: session?.user ?? null,
    profile,
    memberships,
    permissions,
    platformPermissions,
    isPlatformAdmin,
    isInternalDeveloper,
    hasActiveAsiAccess: hasActiveAsiAccess(profile),
    canAccessAdminConsole: isPlatformAdmin || isInternalDeveloper || hasAdminConsolePermission,
    canReviewRecruiterRequests: permissions.includes('recruiter_request:review'),
    canReviewAppErrors: permissions.includes('audit_log:read'),
    isMembershipReviewerPastor: activePastorScopeCount > 0,
    refresh
  }

  return <AppSessionContext.Provider value={contextValue}>{children}</AppSessionContext.Provider>
}

export function useAppSession() {
  const context = useContext(AppSessionContext)

  if (context) {
    return context
  }

  return emptyState(null)
}
