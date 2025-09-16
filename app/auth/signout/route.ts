import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"

export async function POST() {
  const supabase = createRouteHandlerClient({ cookies })
  await supabase.auth.signOut({ scope: "local" })

  const origin = process.env.NEXT_PUBLIC_SITE_ORIGIN || "http://localhost:3000"
  const res = NextResponse.redirect(new URL("/login", origin), { status: 303 })
  res.cookies.set("return_to", "", { path: "/", maxAge: 0, sameSite: "lax" })
  res.headers.set("Cache-Control", "no-store")
  return res
}

