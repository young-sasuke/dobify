import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(req: NextRequest) {
  const url = req.nextUrl
  const pathname = url.pathname

  const res = NextResponse.next()

  // Create a Supabase client using request/response cookies
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          res.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: any) {
          res.cookies.set({ name, value: '', expires: new Date(0), ...options })
        },
      },
    }
  )

  // Check for an authenticated user
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    const login = new URL('/login', req.url)
    // Preserve original path and query
    const next = pathname + (url.search || '')
    login.searchParams.set('next', next)
    return NextResponse.redirect(login)
  }

  return res
}

export const config = {
  matcher: [
    '/(review-cart|slot-selection|payment|order-history|profile)(.*)'
  ],
}
