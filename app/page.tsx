"use client"

import { useEffect, useState } from "react"
import Navbar from "@/components/Navbar"
import BannerCarousel from "@/components/BannerCarousel"
import CategoriesSection from "@/components/CategoriesSection"
import Footer from "@/components/Footer"

type CartItem = {
  quantity?: number
  // keep any other fields without complaining
  [key: string]: unknown
}

export default function HomePage() {
  const [cartCount, setCartCount] = useState<number>(0)

  useEffect(() => {
    const updateCartCount = () => {
      try {
        const savedCart = localStorage.getItem("cart")
        if (!savedCart) {
          setCartCount(0)
          return
        }

        const parsed: unknown = JSON.parse(savedCart)
        const cartItems: CartItem[] = Array.isArray(parsed) ? (parsed as CartItem[]) : []

        const totalQuantity = cartItems.reduce((acc: number, item: CartItem) => {
          const q = Number(item.quantity)
          return acc + (Number.isFinite(q) && q > 0 ? q : 1)
        }, 0)

        setCartCount(totalQuantity)
      } catch {
        // If JSON parse fails or anything odd happens, reset to 0
        setCartCount(0)
      }
    }

    // Initial cart count
    updateCartCount()

    // Cross-tab updates
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "cart") updateCartCount()
    }
    window.addEventListener("storage", handleStorageChange)

    // Same-tab custom events
    const handleCartUpdate = (_e: Event) => updateCartCount()
    window.addEventListener("cartUpdated", handleCartUpdate)
    // (Optional) also listen to a "cart:cleared" event if your code dispatches it
    window.addEventListener("cart:cleared", handleCartUpdate)

    return () => {
      window.removeEventListener("storage", handleStorageChange)
      window.removeEventListener("cartUpdated", handleCartUpdate)
      window.removeEventListener("cart:cleared", handleCartUpdate)
    }
  }, [])

  return (
    <div className="min-h-[100svh] md:min-h-screen grid grid-rows-[auto_1fr_auto] bg-gray-50">
      <Navbar cartCount={cartCount} />

      <main className="row-start-2 container mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 lg:py-8">
        <BannerCarousel />
        <CategoriesSection />
      </main>

      <Footer />
    </div>
  )
}
