"use client"

import { Suspense, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabase"

function AuthCallbackPageInner() {
  const router = useRouter()
  const params = useSearchParams()

  useEffect(() => {
    const run = async () => {
      const code = params.get('code')
      const next = params.get('next') || '/review-cart'
      console.log('code', code)
      console.log('next', next)
      try {
        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) throw error
          const at = data.session?.access_token
          const rt = data.session?.refresh_token
          if (at && rt) {
            await fetch('/api/auth/sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ access_token: at, refresh_token: rt })
            })
          }
        }
      } catch {}
      router.replace(next)
    }
    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<div className="p-6 text-center">Loading…</div>}>
      <AuthCallbackPageInner />
    </Suspense>
  )
}
