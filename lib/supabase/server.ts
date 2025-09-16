import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export function getServerSupabase() {
  const cookieStore = cookies()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) {
    throw new Error("Missing Supabase environment variables")
  }
  const supabase = createServerClient(url, anon, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value
      },
      set() {
        /* noop in RSC */
      },
      remove() {
        /* noop in RSC */
      },
    },
  })
  return supabase
}

