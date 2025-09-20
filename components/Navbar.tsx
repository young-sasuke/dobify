'use client';

import { useEffect, useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { User, Bell, ShoppingCart, Menu, X } from "lucide-react"

interface NavbarProps {
  cartCount: number
}

export default function Navbar({ cartCount }: NavbarProps) {
  const router = useRouter()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [notificationCount, setNotificationCount] = useState(0)

  useEffect(() => {
    const fetchNotificationCount = async () => {
      try {
        const { data, error } = await supabase
          .from("notifications")
          .select("id", { count: "exact" })
          .eq("is_read", false)

        if (error) console.error("Error fetching notifications:", error)
        setNotificationCount((data?.length as number) || 0)
      } catch (e) {
        console.error("Error fetching notifications:", e)
        setNotificationCount(0)
      }
    }

    void fetchNotificationCount()

    const channel = supabase
      .channel("notifications")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications" },
        () => void fetchNotificationCount()
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [])

  const navItems = [
    { icon: User, label: "Profile", path: "/profile" },
    { icon: Bell, label: "Notifications", path: "/notifications", badge: notificationCount },
    { icon: ShoppingCart, label: "Cart", path: "/cart", badge: cartCount },
  ]

  return (
    <nav className="row-start-1 sticky top-0 z-50 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 border-b border-gray-100">
      <div className="container mx-auto px-3 sm:px-4 lg:px-6">
        <div className="flex items-center justify-between py-3 sm:py-4">
          {/* Logo */}
          <button
            onClick={() => router.push("/")}
            aria-label="Go to home"
            className="flex items-center gap-2 sm:gap-3 group"
          >
            {/* Make sure this file exists: /public/brand/dobify-logo.jpg */}
            <Image
              src="/brand/dobify-logo.jpg"
              alt="Dobify"
              width={240}
              height={90}
              priority
              className="h-auto max-h-12 sm:max-h-14 lg:max-h-16 w-auto object-contain"
            />
          </button>

          {/* Desktop Nav */}
          <div className="hidden sm:flex items-center gap-2 lg:gap-4">
            {navItems.map((item) => (
              <button
                key={item.label}
                onClick={() => router.push(item.path)}
                className="relative flex items-center gap-2 px-3 lg:px-4 py-2 rounded-lg hover:bg-gray-100 transition-all group focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                <item.icon className="w-5 h-5 sm:w-6 sm:h-6 text-gray-600 group-hover:text-blue-600" />
                <span className="hidden lg:block text-sm font-medium text-gray-700 group-hover:text-blue-600">
                  {item.label}
                </span>
                {!!item.badge && item.badge > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium group-hover:scale-110 transition-transform">
                    {item.badge > 9 ? "9+" : item.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Mobile Toggle */}
          <button
            onClick={() => setIsMobileMenuOpen((v) => !v)}
            aria-controls="mobile-menu"
            aria-expanded={isMobileMenuOpen}
            aria-label="Toggle navigation menu"
            className="sm:hidden p-2 rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            {isMobileMenuOpen ? <X className="w-6 h-6 text-gray-600" /> : <Menu className="w-6 h-6 text-gray-600" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div id="mobile-menu" className="sm:hidden border-t border-gray-100 py-3">
            <div className="space-y-2">
              {navItems.map((item) => (
                <button
                  key={item.label}
                  onClick={() => {
                    router.push(item.path)
                    setIsMobileMenuOpen(false)
                  }}
                  className="relative flex items-center gap-3 w-full px-3 py-3 rounded-lg hover:bg-gray-100 group focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  <item.icon className="w-5 h-5 sm:w-6 sm:h-6 text-gray-600 group-hover:text-blue-600" />
                  <span className="text-sm font-medium text-gray-700 group-hover:text-blue-600">
                    {item.label}
                  </span>
                  {!!item.badge && item.badge > 0 && (
                    <span className="ml-auto bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">
                      {item.badge > 9 ? "9+" : item.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
