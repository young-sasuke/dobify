"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Navbar from "@/components/Navbar"
import Footer from "@/components/Footer"
import { supabase } from "@/lib/supabase"
import {
  Plus,
  Minus,
  ShoppingBag,
  Tag,
  ChevronDown,
  ChevronUp,
  MapPin,
  CheckCircle,
  AlertCircle,
} from "lucide-react"

// ---------- Types ----------
type CartItem = {
  id: number | string
  name: string
  price: number
  service?: string
  servicePrice?: number
  quantity?: number
  image?: string
}

type Coupon = {
  code: string
  description?: string
  discount_type: "percentage" | "flat"
  discount_value: number
  max_discount_amount?: number | null
  minimum_order_value?: number | null
}

// ---------- Component ----------
export default function CartPage() {
  const router = useRouter()

  // Cart & UI state (typed)
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [isClient, setIsClient] = useState(false)
  const [toastMessage, setToastMessage] = useState("")
  const [showToast, setShowToast] = useState(false)

  // Auth session (same pattern as profile)
  const [authLoading, setAuthLoading] = useState(true)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    let isMounted = true

    ;(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (isMounted) setUser(user ?? null)
      setAuthLoading(false)
    })()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return
      setUser(session?.user ?? null)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  const isLoggedIn = !!user

  // Coupons & serviceability (typed)
  const [showCoupons, setShowCoupons] = useState(false)
  const [availableCoupons, setAvailableCoupons] = useState<Coupon[]>([])
  const [serviceablePincodes, setServiceablePincodes] = useState<string[]>([])
  const [selectedCoupon, setSelectedCoupon] = useState<string | null>(null)

  // Availability check states
  const [pincode, setPincode] = useState("")
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false)
  const [availabilityStatus, setAvailabilityStatus] = useState<{
    checked: boolean
    available: boolean
    message: string
  }>({
    checked: false,
    available: false,
    message: "",
  })

  useEffect(() => {
    setIsClient(true)

    // Prefill pincode if saved
    try {
      const savedPincode = localStorage.getItem("pincode")
      if (savedPincode) setPincode(savedPincode)
    } catch {}

    // Load cart from localStorage
    try {
      const savedCart = localStorage.getItem("cart")
      if (savedCart) {
        const parsed = JSON.parse(savedCart) as Partial<CartItem>[]
        // Minimal normalization to avoid undefineds
        const normalized: CartItem[] = (parsed || []).map((it) => ({
          id: it.id as number | string,
          name: String(it.name ?? ""),
          price: Number(it.price ?? 0),
          service: it.service,
          servicePrice: Number(it.servicePrice ?? 0),
          quantity: Number(it.quantity ?? 1),
          image: it.image,
        }))
        setCartItems(normalized)
      }
    } catch {}

    // Restore selected coupon (support both keys for compatibility)
    try {
      const savedCoupon = localStorage.getItem("selectedCoupon") || localStorage.getItem("appliedCoupon")
      if (savedCoupon) setSelectedCoupon(savedCoupon)
    } catch {}

    // Fetch available coupons
    const fetchCoupons = async () => {
      const { data, error } = await supabase.from("coupons").select("*")
      if (error) {
        console.error("Error fetching coupons:", error)
      } else {
        setAvailableCoupons((data || []) as Coupon[])
      }
    }

    // Fetch serviceable pincodes
    const fetchPincodes = async () => {
      const { data, error } = await supabase.from("service_areas").select("pincode").eq("is_active", true)
      if (error) {
        console.error("Error fetching pincodes:", error)
      } else {
        // normalize to string to avoid includes mismatch
        setServiceablePincodes((data || []).map((row: any) => String(row.pincode)))
      }
    }

    fetchCoupons()
    fetchPincodes()
  }, [])

  const updateQuantity = (id: number | string, action: "increment" | "decrement") => {
    setCartItems((prev) => {
      const updated = prev.map<CartItem | null>((item) => {
        if (item.id === id) {
          const currentQuantity = item.quantity ?? 1
          const newQuantity = action === "increment" ? currentQuantity + 1 : currentQuantity - 1
          if (newQuantity > 0) {
            return {
              ...item,
              quantity: newQuantity,
              totalPrice: (item.price + (item.servicePrice ?? 0)) * newQuantity,
            } as any
          } else {
            return null // mark for removal
          }
        }
        return item
      })

      const filtered = updated.filter(Boolean) as CartItem[]

      // If removal happened, show toast for the removed item
      if (filtered.length < prev.length) {
        const removed = prev.find((p) => !filtered.some((f) => f.id === p.id))
        if (removed) showToastMessage(`"${removed.name}" has been removed from cart`)
      }

      localStorage.setItem("cart", JSON.stringify(filtered))
      window.dispatchEvent(new Event("cartUpdated"))
      return filtered
    })
  }

  const removeItem = (id: number | string) => {
    setCartItems((prev) => {
      const itemToRemove = prev.find((i) => i.id === id)
      const updated = prev.filter((i) => i.id !== id)
      if (itemToRemove) showToastMessage(`"${itemToRemove.name}" has been removed from cart`)
      localStorage.setItem("cart", JSON.stringify(updated))
      window.dispatchEvent(new Event("cartUpdated"))
      return updated
    })
  }

  const showToastMessage = (message: string) => {
    setToastMessage(message)
    setShowToast(true)
    setTimeout(() => setShowToast(false), 3000)
  }

  // ---------- Coupon eligibility helpers (hoisted-safe as functions) ----------
  function eligibilitySubtotal() {
    // same calc as calculateSubtotal(), but declared earlier for use in applyCoupon
    return cartItems.reduce((total, item) => {
      const qty = item.quantity ?? 1
      const itemTotal = (item.price + (item.servicePrice ?? 0)) * qty
      return total + itemTotal
    }, 0)
  }
  function isCouponEligible(coupon: Coupon) {
    const min = Number(coupon.minimum_order_value ?? 0)
    return eligibilitySubtotal() >= min
  }
  function amountToUnlock(coupon: Coupon) {
    const min = Number(coupon.minimum_order_value ?? 0)
    return Math.max(0, min - eligibilitySubtotal())
  }

  // --- Apply coupon with min-order guard + persist to storage ---
  const applyCoupon = (couponCode: string) => {
    const coupon = availableCoupons.find((c) => c.code === couponCode)
    if (!coupon) return

    if (!isCouponEligible(coupon)) {
      const need = Math.ceil(amountToUnlock(coupon))
      showToastMessage(`Add ₹${need} more to use ${coupon.code}`)
      return
    }

    setSelectedCoupon(couponCode)
    try {
      localStorage.setItem("selectedCoupon", couponCode)
      // keep compatibility with review page key
      localStorage.setItem("appliedCoupon", couponCode)
    } catch {}
    setShowCoupons(false)
  }

  const checkAvailability = async () => {
    if (!pincode || pincode.length !== 6) {
      setAvailabilityStatus({
        checked: true,
        available: false,
        message: "Please enter a valid 6-digit pincode",
      })
      return
    }

    setIsCheckingAvailability(true)

    const isAvailable = serviceablePincodes.includes(pincode)

    if (isAvailable) {
      try {
        localStorage.setItem("pincode", pincode)
      } catch {}
    }

    setAvailabilityStatus({
      checked: true,
      available: isAvailable,
      message: isAvailable ? "Great! We deliver to your location" : "Sorry, this location is currently not serviceable",
    })
    setIsCheckingAvailability(false)
  }

  // Subtotal for totals block (kept as-is for existing flow)
  const calculateSubtotal = () => {
    return cartItems.reduce((total, item) => {
      const qty = item.quantity ?? 1
      const itemTotal = (item.price + (item.servicePrice ?? 0)) * qty
      return total + itemTotal
    }, 0)
  }

  const calculateDiscount = () => {
    const applied = availableCoupons.find((c) => c.code === selectedCoupon)
    if (!applied) return 0

    const subtotal = calculateSubtotal()
    const minOrder = Number(applied.minimum_order_value ?? 0)
    if (subtotal < minOrder) return 0

    if (applied.discount_type === "percentage") {
      const discount = (subtotal * applied.discount_value) / 100
      const maxCap = applied.max_discount_amount ?? null
      return maxCap ? Math.min(discount, maxCap) : discount
    }

    // flat (cap to subtotal to avoid negative totals)
    return Math.min(subtotal, applied.discount_value)
  }

  const calculateTotal = () => {
    const subtotal = calculateSubtotal()
    const discount = calculateDiscount()
    const deliveryFee = 30 // Fixed delivery fee
    return subtotal + deliveryFee - discount
  }

  // Auto-unapply: if selected coupon becomes ineligible after cart changes
  useEffect(() => {
    if (!selectedCoupon) return
    const coupon = availableCoupons.find((c) => c.code === selectedCoupon)
    if (coupon && !isCouponEligible(coupon)) {
      setSelectedCoupon(null)
      try {
        localStorage.removeItem("selectedCoupon")
        localStorage.removeItem("appliedCoupon")
      } catch {}
      showToastMessage("Coupon removed: order no longer meets minimum.")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartItems])

  const canProceed = availabilityStatus.checked && availabilityStatus.available

  return (
    <div className="min-h-[100svh] md:min-h-screen grid grid-rows-[auto_1fr_auto] bg-gray-50">
      <Navbar cartCount={cartItems.length} />
      <main className="row-start-2 container mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 lg:py-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-4 sm:mb-6 lg:mb-8 flex items-center gap-2 sm:gap-3">
            <ShoppingBag className="text-blue-600 w-5 h-5 sm:w-6 sm:h-6" />
            Your Cart
          </h1>

          {cartItems.length === 0 ? (
            <div className="text-center py-12 sm:py-16 lg:py-20">
              <ShoppingBag className="mx-auto h-12 w-12 sm:h-16 sm:w-16 text-gray-400 mb-4" />
              <h2 className="text-lg sm:text-xl font-semibold text-gray-600 mb-2">Your cart is empty</h2>
              <p className="text-sm sm:text-base text-gray-500 mb-6">Add some items to get started</p>
              <button
                onClick={() => router.push("/")}
                className="bg-blue-600 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg hover:bg-blue-700 transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 text-sm sm:text-base font-medium"
              >
                Continue Shopping
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
              {/* Cart Items */}
              <div className="lg:col-span-2 space-y-3 sm:space-y-4">
                {cartItems.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4 lg:p-6 hover:shadow-md transition-all duration-200"
                  >
                    <div className="flex items-center gap-3 sm:gap-4">
                      <img
                        src={item.image || "/placeholder.svg"}
                        alt={item.name}
                        className="w-14 h-14 sm:w-16 sm:h-16 lg:w-20 lg:h-20 object-cover rounded-lg flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate text-sm sm:text-base lg:text-lg">
                          {item.name}
                        </h3>
                        <p className="text-xs sm:text-sm text-blue-600 mt-1">
                          {item.service} {item.servicePrice ? `( +₹${item.servicePrice} )` : ""}
                        </p>
                        <p className="text-sm font-semibold text-gray-900 mt-1">
                          ₹{((item.price || 0) + (item.servicePrice || 0)).toFixed(1)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 bg-blue-100 rounded-full px-2 py-1">
                        <button
                          onClick={() => updateQuantity(item.id, "decrement")}
                          className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="w-8 text-center text-gray-900 font-medium">{item.quantity || 1}</span>
                        <button
                          onClick={() => updateQuantity(item.id, "increment")}
                          className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Coupon Section */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4 lg:p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Tag className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
                      <h3 className="font-semibold text-gray-900 text-sm sm:text-base">Apply Coupon</h3>
                    </div>
                    <button
                      onClick={() => setShowCoupons(!showCoupons)}
                      className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 text-sm sm:text-base transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded px-2 py-1"
                    >
                      View Coupons {showCoupons ? <ChevronUp className="h-3 w-3 sm:h-4 sm:w-4" /> : <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4" />}
                    </button>
                  </div>

                  {selectedCoupon && (
                    <div className="mb-4 p-3 sm:p-4 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-green-800 text-sm sm:text-base">Coupon Applied: {selectedCoupon}</p>
                          <p className="text-xs sm:text-sm text-green-600">You'll save money on this order!</p>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedCoupon(null)
                            try {
                              localStorage.removeItem("selectedCoupon")
                              localStorage.removeItem("appliedCoupon")
                            } catch {}
                          }}
                          className="text-green-600 hover:text-green-700 text-xs sm:text-sm font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 rounded px-2 py-1"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  )}

                  {showCoupons && (
                    <div className="space-y-3">
                      {availableCoupons.map((coupon: Coupon) => {
                        const eligible = isCouponEligible(coupon)
                        const remaining = Math.ceil(amountToUnlock(coupon))
                        const isApplied = selectedCoupon === coupon.code

                        return (
                          <div
                            key={coupon.code}
                            className="border border-gray-200 rounded-lg p-3 sm:p-4 hover:bg-gray-50 transition-all duration-200 hover:border-blue-300"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <div
                                  className={`px-2 py-1 rounded text-xs sm:text-sm font-bold ${
                                    eligible ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"
                                  }`}
                                >
                                  {coupon.discount_type === "percentage"
                                    ? `${coupon.discount_value}% OFF`
                                    : `₹${coupon.discount_value} OFF`}
                                </div>
                                <span className="font-semibold text-gray-900 text-xs sm:text-sm">{coupon.code}</span>
                              </div>
                              <button
                                onClick={() => applyCoupon(coupon.code)}
                                disabled={!eligible || isApplied}
                                className={`px-3 sm:px-4 py-1 sm:py-2 rounded text-xs sm:text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2
                                  ${
                                    isApplied
                                      ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                                      : eligible
                                        ? "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 transform hover:scale-105"
                                        : "bg-gray-200 text-gray-500 cursor-not-allowed"
                                  }`}
                              >
                                {isApplied ? "Applied" : eligible ? "Apply" : "Not eligible"}
                              </button>
                            </div>

                            <p className="text-xs sm:text-sm font-medium text-gray-900">{coupon.code}</p>
                            <p className="text-xs text-gray-600">{coupon.description}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              Min order: ₹{Number(coupon.minimum_order_value ?? 0)}
                            </p>

                            {!eligible && (
                              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 inline-block mt-2 px-2 py-1 rounded">
                                Add ₹{remaining} more to unlock this coupon
                              </p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Order Summary */}
              <div className="lg:col-span-1">
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6 sticky top-4">
                  <h2 className="text-lg sm:text-xl font-semibold mb-4 sm:mb-6">Order Summary</h2>
                  <div className="space-y-3 sm:space-y-4 mb-6">
                    <div className="flex justify-between text-sm sm:text-base">
                      <span>Subtotal</span>
                      <span>₹{calculateSubtotal().toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm sm:text-base">
                      <span>Delivery Fee</span>
                      <span>₹30.00</span>
                    </div>
                    {selectedCoupon && (
                      <div className="flex justify-between text-green-600 text-sm sm:text-base">
                        <span>Coupon Discount</span>
                        <span>-₹{calculateDiscount().toFixed(2)}</span>
                      </div>
                    )}
                    <div className="border-t pt-3">
                      <div className="flex justify-between font-semibold text-base sm:text-lg">
                        <span>Total</span>
                        <span>₹{calculateTotal().toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Check Availability */}
                  <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-3">
                      <MapPin className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                      <h3 className="font-semibold text-gray-900 text-sm sm:text-base">Check Availability</h3>
                    </div>
                    <div className="flex gap-2 mb-3">
                      <input
                        type="text"
                        placeholder="Enter pincode"
                        value={pincode}
                        onChange={(e) => {
                          setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))
                          if (availabilityStatus.checked) {
                            setAvailabilityStatus({ checked: false, available: false, message: "" })
                          }
                        }}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-sm"
                        maxLength={6}
                      />
                      <button
                        onClick={checkAvailability}
                        disabled={isCheckingAvailability || pincode.length !== 6}
                        className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                          isCheckingAvailability || pincode.length !== 6
                            ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                            : "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 transform hover:scale-105"
                        }`}
                      >
                        {isCheckingAvailability ? "Checking..." : "Check"}
                      </button>
                    </div>

                    {availabilityStatus.checked && (
                      <div
                        className={`flex items-center gap-2 p-3 rounded-lg ${
                          availabilityStatus.available ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"
                        }`}
                      >
                        {availabilityStatus.available ? (
                          <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                        )}
                        <p className={`text-sm font-medium ${availabilityStatus.available ? "text-green-800" : "text-red-800"}`}>
                          {availabilityStatus.message}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Proceed / Review */}
                  <button
                    onClick={() => {
                      if (!canProceed) return
                      if (isLoggedIn) router.push("/review-cart")
                      else router.push("/login?next=/review-cart")
                    }}
                    disabled={!canProceed}
                    className={`w-full py-3 sm:py-4 rounded-lg font-semibold text-sm sm:text-base transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                      canProceed
                        ? "bg-blue-600 text-white hover:bg-blue-700 transform hover:scale-105 focus:ring-blue-500"
                        : "bg-gray-300 text-gray-500 cursor-not-allowed"
                    }`}
                  >
                    {!availabilityStatus.checked
                      ? "Check Availability to Continue"
                      : canProceed
                      ? isLoggedIn
                        ? "Review Cart"
                        : "Proceed to Login"
                      : "Location Not Serviceable"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />

      {/* Toast */}
      {showToast && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-6 py-3 rounded-full shadow-lg z-50 transition-all duration-300 ease-in-out">
          <p className="text-sm font-medium">{toastMessage}</p>
        </div>
      )}
    </div>
  )
}
