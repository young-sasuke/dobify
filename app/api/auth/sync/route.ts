import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export async function POST(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnon) {
    return NextResponse.json({ error: 'Missing env' }, { status: 500 })
  }

  const cookieStore = cookies()
  const supabase = createServerClient(supabaseUrl, supabaseAnon, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value
      },
      set(name: string, value: string, options: any) {
        cookieStore.set({ name, value, ...options })
      },
      remove(name: string, options: any) {
        cookieStore.set({ name, value: '', expires: new Date(0), ...options })
      },
    },
  })

  let payload: any
  try {
    payload = await req.json()
  } catch {
    payload = {}
  }

  const action = payload?.action
  if (action === 'signout') {
    await supabase.auth.signOut()
    return NextResponse.json({ ok: true })
  }

  const access_token = payload?.access_token
  const refresh_token = payload?.refresh_token
  if (!access_token || !refresh_token) {
    return NextResponse.json({ error: 'Missing tokens' }, { status: 400 })
  }

  await supabase.auth.setSession({ access_token, refresh_token })
  return NextResponse.json({ ok: true })
}

