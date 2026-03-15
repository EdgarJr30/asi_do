/* eslint-disable react-refresh/only-export-components */

import { createContext, type PropsWithChildren, useContext, useEffect, useState } from 'react'
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
  primaryMembership: AppMembership | null
  isPlatformAdmin: boolean
  canReviewRecruiterRequests: boolean
  refresh: () => Promise<void>
}

const AppSessionContext = createContext<AppSessionContextValue | null>(null)

function emptyState(session: Session | null): AppSessionContextValue {
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
    primaryMembership: null,
    isPlatformAdmin: false,
    canReviewRecruiterRequests: false,
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
  const [isLoading, setIsLoading] = useState(true)

  async function hydrateSession(user: User | null) {
    if (!user || !supabase) {
      setProfile(null)
      setMemberships([])
      setPermissions([])
      setPlatformPermissions([])
      setIsPlatformAdmin(false)
      setIsLoading(false)
      return
    }

    setIsLoading(true)

    try {
      const snapshot = await fetchSessionSnapshot(user)

      setProfile(snapshot.profile)
      setMemberships(snapshot.memberships)
      setPermissions(snapshot.permissions)
      setPlatformPermissions(snapshot.platformPermissions)
      setIsPlatformAdmin(snapshot.isPlatformAdmin)
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

      setSession(nextSession)
      void hydrateSession(nextSession?.user ?? null)
    })

    return () => {
      isActive = false
      authListener.data.subscription.unsubscribe()
    }
  }, [])

  const contextValue: AppSessionContextValue = {
    isSupabaseConfigured: supabase !== null,
    isLoading,
    isAuthenticated: session !== null,
    session,
    authUser: session?.user ?? null,
    profile,
    memberships,
    permissions,
    platformPermissions,
    primaryMembership: memberships[0] ?? null,
    isPlatformAdmin,
    canReviewRecruiterRequests: permissions.includes('recruiter_request:review'),
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
