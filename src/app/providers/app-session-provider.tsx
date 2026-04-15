/* eslint-disable react-refresh/only-export-components */

import { createContext, type PropsWithChildren, useContext, useEffect, useRef, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'

import { fetchSessionSnapshot, type AppMembership } from '@/features/auth/lib/auth-api'
import { supabase } from '@/lib/supabase/client'
import type { PermissionCode } from '@/shared/constants/permissions'
import type { Tables } from '@/shared/types/database'

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
  canAccessAdminConsole: boolean
  canReviewRecruiterRequests: boolean
  canReviewAppErrors: boolean
  refresh: () => Promise<void>
}

const AppSessionContext = createContext<AppSessionContextValue | null>(null)

export function resolveActiveMembership(memberships: AppMembership[]) {
  return memberships[0] ?? null
}

function emptyState(session: Session | null): AppSessionContextValue {
  const activeMembership = resolveActiveMembership([])
  return {
    isSupabaseConfigured: supabase !== null,
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
    canAccessAdminConsole: false,
    canReviewRecruiterRequests: false,
    canReviewAppErrors: false,
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
  const [isLoading, setIsLoading] = useState(true)
  const hydratedUserIdRef = useRef<string | null>(null)

  async function hydrateSession(user: User | null, options: { showLoading?: boolean } = {}) {
    const { showLoading = true } = options

    if (!user || !supabase) {
      hydratedUserIdRef.current = null
      setProfile(null)
      setMemberships([])
      setPermissions([])
      setPlatformPermissions([])
      setIsPlatformAdmin(false)
      setIsInternalDeveloper(false)
      setIsLoading(false)
      return
    }

    if (showLoading) {
      setIsLoading(true)
    }

    try {
      const snapshot = await fetchSessionSnapshot(user)

      hydratedUserIdRef.current = user.id
      setProfile(snapshot.profile)
      setMemberships(snapshot.memberships)
      setPermissions(snapshot.permissions)
      setPlatformPermissions(snapshot.platformPermissions)
      setIsPlatformAdmin(snapshot.isPlatformAdmin)
      setIsInternalDeveloper(Boolean(snapshot.profile?.is_internal_developer))
    } finally {
      setIsLoading(false)
    }
  }

  function refresh() {
    return hydrateSession(session?.user ?? null)
  }

  useEffect(() => {
    const client = supabase

    if (!client) {
      setIsLoading(false)
      return
    }

    const supabaseClient = client

    let isActive = true

    async function initialize() {
      const currentSessionResponse = await supabaseClient.auth.getSession()
      const currentSession = currentSessionResponse.data.session

      if (!isActive) {
        return
      }

      setSession(currentSession)
      await hydrateSession(currentSession?.user ?? null)
    }

    void initialize()

    const authListener = supabaseClient.auth.onAuthStateChange((_event, nextSession) => {
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

    return () => {
      isActive = false
      authListener.data.subscription.unsubscribe()
    }
  }, [])

  const activeMembership = resolveActiveMembership(memberships)

  const contextValue: AppSessionContextValue = {
    activeMembership,
    activeTenantId: activeMembership?.tenantId ?? null,
    hasMultipleWorkspaceMemberships: memberships.length > 1,
    isSupabaseConfigured: supabase !== null,
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
    canAccessAdminConsole: isPlatformAdmin || isInternalDeveloper,
    canReviewRecruiterRequests: permissions.includes('recruiter_request:review'),
    canReviewAppErrors: permissions.includes('audit_log:read'),
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
