"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import  useClientUser  from "@/lib/useClientUser"

export default function PaymentPage() {
  const { user, loading } = useClientUser()
  const pathname = usePathname()

  if (loading) return null

  if (!user) {
    const next = encodeURIComponent(pathname || "/payment")
    return (
      <div className="min-h-[100svh] md:min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-3">You need to be signed in to proceed to payment.</p>
          <Link href={`/login?next=${next}`} className="text-blue-600 hover:underline font-medium">
            Log in
          </Link>
        </div>
      </div>
    )
  }

  // If needed, render payment UI here later.
  return null
}
