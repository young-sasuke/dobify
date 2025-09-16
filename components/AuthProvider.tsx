"use client"

import React, { createContext, useContext, useEffect, useMemo, useState } from "react"
import type { Session, User } from "@supabase/supabase-js"
import { getBrowserSupabase } from "@/lib/supabase/browser"

interface AuthContextValue {
  user: User | null
  session: Session | null
  loading: boolean
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = getBrowserSupabase()
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    const syncCookies = async (sess: Session | null) => {
      try {
        if (sess?.access_token && sess?.refresh_token) {
          await fetch('/api/auth/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ access_token: sess.access_token, refresh_token: sess.refresh_token }),
          })
        }
      } catch {}
    }

    const init = async () => {
      try {
        const { data } = await supabase.auth.getSession()
        if (!isMounted) return
        setSession(data.session)
        setUser(data.session?.user ?? null)
        // Ensure SSR cookies are synced on initial load if a session exists
        await syncCookies(data.session)
      } finally {
        if (isMounted) setLoading(false)
      }
    }
    init()

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      setSession(newSession)
      setUser(newSession?.user ?? null)
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        await syncCookies(newSession)
      }
      if (event === 'SIGNED_OUT') {
        try {
          await fetch('/api/auth/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'signout' }),
          })
        } catch {}
      }
    })

    return () => {
      isMounted = false
      sub.subscription.unsubscribe()
    }
  }, [supabase])

  const value = useMemo(() => ({ user, session, loading }), [user, session, loading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}

