// lib/useClientUser.ts
"use client"

import { useEffect, useState } from "react"
import type { User } from "@supabase/supabase-js"
import { supabase } from "./supabase"

/**
 * Client-only hook to get the current Supabase user.
 * - Returns { user, loading }
 * - Subscribes to auth changes so it stays fresh.
 */
export default function useClientUser() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    // Initial fetch
    supabase.auth
      .getUser()
      .then(({ data, error }) => {
        if (!mounted) return
        if (error) {
          console.error("supabase.auth.getUser error:", error.message)
          setUser(null)
        } else {
          setUser(data.user ?? null)
        }
        setLoading(false)
      })
      .catch((e) => {
        if (!mounted) return
        console.error("getUser threw:", e)
        setUser(null)
        setLoading(false)
      })

    // Realtime updates
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return
      setUser(session?.user ?? null)
    })

    return () => {
      mounted = false
      sub?.subscription?.unsubscribe?.()
    }
  }, [])

  return { user, loading }
}
