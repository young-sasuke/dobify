'use client';

import React, { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import Navbar from "@/components/Navbar"
import Footer from "@/components/Footer"
import { MapPin, Clock, Calendar, Truck, Zap, ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react"
import { getSevenDates, earliestDeliveryDateISO } from "@/lib/slots"
import type { MatrixRule } from "@/lib/slots"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/components/AuthProvider"
import SelectedSlotCard from "@/components/checkout/SelectedSlotCard"
import BillSummary from "@/components/checkout/BillSummary"
import PaymentMethods from "@/components/checkout/PaymentMethods"
import { mergeSelectedAddressIntoPayload } from "@/lib/order"

type SavedTotals = {
  subtotal: number
  deliveryFee: number
  discount: number
  total: number
  appliedCoupon?: { code?: string } | null
}

export default function SlotSelectionPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [selectedAddress, setSelectedAddress] = useState({
    name: "Home",
    address: "123 Main Street, Sector 15, Gurgaon, Haryana 122001",
    phone: "+91 98765 43210",
  })

  const [mounted, setMounted] = useState(false)

  // 2) Mount flag (prevents SSR/client divergence)
  useEffect(() => { setMounted(true) }, [])

  // Load saved structured address on mount/visibility
  useEffect(() => {
    if (!mounted) return
    const load = () => {
      try {
        const raw = localStorage.getItem("selectedAddress")
        if (!raw) return
        const saved = JSON.parse(raw)
        const full =
          saved.fullAddress ||
          [saved.line1, saved.line2, saved.city, saved.state, saved.postalCode, saved.country]
            .filter(Boolean)
            .join(", ")
        if (full && typeof full === "string") {
          setSelectedAddress((prev) => ({
            name: prev?.name || "Home",
            address: full,
            phone: prev?.phone || "",
          }))
        }
      } catch {}
    }
    load()
    const onShow = () => load()
    window.addEventListener("visibilitychange", onShow)
    return () => window.removeEventListener("visibilitychange", onShow)
  }, [mounted])

  const [deliveryType, setDeliveryType] = useState<"standard" | "express">("standard")
  const [selectedDate, setSelectedDate] = useState<string>("") // pickup date
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>("") // pickup slot id
  const [paymentMethod, setPaymentMethod] = useState<"online" | "cod">("online")

  // Cart & coupon (unchanged)
  const [cartItems, setCartItems] = useState<any[]>([])
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null)

  // >>> NEW: bill numbers coming from Review page <<<
  const [bill, setBill] = useState<SavedTotals>({
    subtotal: 0,
    deliveryFee: 30,
    discount: 0,
    total: 0,
    appliedCoupon: null,
  })

  // Generate next 7 days
  const [availableDates, setAvailableDates] = useState<
    Array<{ date: string; day: string; dayNum: string; month: string }>
  >([])

  // Pickup/Delivery slots
  const [pickupSlots, setPickupSlots] = useState<any[]>([])
  const [deliverySlots, setDeliverySlots] = useState<any[]>([])
  const [pickupLoading, setPickupLoading] = useState<boolean>(false)
  const [deliveryLoading, setDeliveryLoading] = useState<boolean>(false)

  const hhmmToMin = (t?: string) => {
    if (!t) return 0
    const [h, m] = t.split(":").map((x) => parseInt(x, 10))
    return (h || 0) * 60 + (m || 0)
  }

  const [deliveryDate, setDeliveryDate] = useState<string>("")
  const [minDeliveryDate, setMinDeliveryDate] = useState<string>("")
  const [pincode, setPincode] = useState<string | null>(null)
  const [matrixRule, setMatrixRule] = useState<MatrixRule | null>(null)

  const deliveryRef = useRef<HTMLDivElement | null>(null) as any
  const pickupDatesRef = useRef<HTMLDivElement | null>(null)
  const deliveryDatesRef = useRef<HTMLDivElement | null>(null)
  const pickupSelectedRef = useRef<HTMLButtonElement | null>(null)
  const deliverySelectedRef = useRef<HTMLButtonElement | null>(null)
  const [pickupCanLeft, setPickupCanLeft] = useState(false)
  const [pickupCanRight, setPickupCanRight] = useState(false)
  const [deliveryCanLeft, setDeliveryCanLeft] = useState(false)
  const [deliveryCanRight, setDeliveryCanRight] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login?next=/slot-selection')
    }
  }, [authLoading, user, router])

  // Load dates + pincode + cart + saved totals once
  useEffect(() => {
    if (!mounted) return
    const dates = getSevenDates()
    setAvailableDates(dates)
    setSelectedDate(dates[0].date)

    try {
      const rawAddr = localStorage.getItem("selectedAddress")
      if (rawAddr) {
        const addr = JSON.parse(rawAddr)
        if (addr?.postalCode) setPincode(String(addr.postalCode))
      }
      const savedPin = localStorage.getItem("pincode")
      if (!pincode && savedPin) setPincode(savedPin)
    } catch {}

    const savedCart = localStorage.getItem("cart")
    if (savedCart) setCartItems(JSON.parse(savedCart))

    // persisted coupon code (legacy)
    const savedCoupon = localStorage.getItem("appliedCoupon")
    if (savedCoupon) setAppliedCoupon(savedCoupon)

    // >>> read reviewTotals so we show the same discount/total here <<<
    try {
      const rawTotals = localStorage.getItem("reviewTotals")
      if (rawTotals) {
        const t = JSON.parse(rawTotals) as Partial<SavedTotals>
        const subtotal = Number(t.subtotal ?? 0)
        const deliveryFee = Number(t.deliveryFee ?? 30)
        const discount = Number(t.discount ?? 0)
        const total = Number(t.total ?? subtotal + deliveryFee - discount)
        setBill({
          subtotal,
          deliveryFee,
          discount,
          total,
          appliedCoupon: (t.appliedCoupon as any) ?? null,
        })
        if (t.appliedCoupon) setAppliedCoupon(t.appliedCoupon)
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted])

  // Load delivery_slot_matrix when type changes
  useEffect(() => {
    const loadMatrixRule = async (st: "standard" | "express") => {
      try {
        const { data, error } = await supabase
          .from("delivery_slot_matrix")
          .select("service_type,min_days_from_pickup,allowed_slots_by_day")
          .eq("service_type", st)
          .maybeSingle()
        if (!error) {
          setMatrixRule(
            (data as any) || {
              service_type: st,
              min_days_from_pickup: undefined,
              allowed_slots_by_day: null,
            }
          )
        } else {
          setMatrixRule(null)
        }
      } catch {
        setMatrixRule(null)
      }
    }
    loadMatrixRule(deliveryType)
  }, [deliveryType])

  // Fetch pickup availability
  useEffect(() => {
    const fetchPickup = async () => {
      if (!selectedDate) return
      setPickupLoading(true)
      try {
        const res = await fetch("/api/slots/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date: selectedDate, kind: "pickup", pincode, serviceType: deliveryType }),
        })
        const json = await res.json()
        if (json?.slots) {
          const mapped = json.slots.map((s: any) => ({
            id: s.id,
            label: s.display_time,
            startMin: hhmmToMin(s.start_time),
            endMin: hhmmToMin(s.end_time),
            available: !!s.is_available,
          }))
          setPickupSlots(mapped)
        } else {
          setPickupSlots([])
        }
      } catch {
        setPickupSlots([])
      } finally {
        setPickupLoading(false)
      }
    }
    fetchPickup()
  }, [selectedDate, pincode, deliveryType])

  // Compute min delivery date
  useEffect(() => {
    if (!selectedDate) return
    if (deliveryType === "standard" && selectedTimeSlot) {
      setMinDeliveryDate(selectedDate)
      return
    }
    const earliest = earliestDeliveryDateISO({
      pickupDate: selectedDate,
      serviceType: deliveryType as any,
      matrix: matrixRule || undefined,
    })
    setMinDeliveryDate(earliest)
  }, [selectedDate, deliveryType, matrixRule, selectedTimeSlot])

  // Clamp delivery date when pickup chosen or type changes
  useEffect(() => {
    if (!selectedDate || !selectedTimeSlot) return
    const minDate =
      deliveryType === "standard"
        ? selectedDate
        : earliestDeliveryDateISO({
            pickupDate: selectedDate,
            serviceType: deliveryType as any,
            matrix: matrixRule || undefined,
          })
    const inRange = deliveryDate && deliveryDate >= minDate
    if (!inRange) {
      const candidate =
        availableDates.find((d) => d.date >= minDate)?.date ||
        availableDates[availableDates.length - 1]?.date
      setDeliveryDate(candidate || minDate)
    }
    setTimeout(() => {
      try {
        (deliveryRef as any)?.current?.scrollIntoView({ behavior: "smooth", block: "start" })
      } catch {}
    }, 50)
  }, [selectedTimeSlot, deliveryType, matrixRule, selectedDate, availableDates, deliveryDate])

  // Helper: update scroll arrow visibility for carousels
  const updateScrollState = (
    el: HTMLElement | null,
    setLeft: (v: boolean) => void,
    setRight: (v: boolean) => void
  ) => {
    if (!el) {
      setLeft(false)
      setRight(false)
      return
    }
    const { scrollLeft, scrollWidth, clientWidth } = el
    setLeft(scrollLeft > 0)
    setRight(scrollLeft + clientWidth < scrollWidth - 1)
  }

  useEffect(() => {
    const el = pickupDatesRef.current
    if (!el) return
    const onScroll = () => updateScrollState(el, setPickupCanLeft, setPickupCanRight)
    onScroll()
    el.addEventListener("scroll", onScroll)
    const onResize = () => onScroll()
    window.addEventListener("resize", onResize)
    return () => {
      el.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onResize)
    }
  }, [availableDates])

  useEffect(() => {
    const el = deliveryDatesRef.current
    if (!el) return
    const onScroll = () => updateScrollState(el, setDeliveryCanLeft, setDeliveryCanRight)
    onScroll()
    el.addEventListener("scroll", onScroll)
    const onResize = () => onScroll()
    window.addEventListener("resize", onResize)
    return () => {
      el.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onResize)
    }
  }, [availableDates, selectedTimeSlot, deliveryDate])

  // Keep selected date centered
  useEffect(() => {
    try { pickupSelectedRef.current?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" }) } catch {}
  }, [selectedDate])
  useEffect(() => {
    try { deliverySelectedRef.current?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" }) } catch {}
  }, [deliveryDate])

  const scrollPickupDates = (delta: number) => {
    pickupDatesRef.current?.scrollBy({ left: delta, behavior: "smooth" })
  }
  const scrollDeliveryDates = (delta: number) => {
    deliveryDatesRef.current?.scrollBy({ left: delta, behavior: "smooth" })
  }

  // Helper to fetch delivery slots
  async function fetchDeliveryFor({
    targetDeliveryDate,
    pickupSlotEndMin,
  }: { targetDeliveryDate: string; pickupSlotEndMin: number }) {
    if (!targetDeliveryDate) return
    setDeliveryLoading(true)
    try {
      const payload = {
        date: targetDeliveryDate,
        kind: "delivery",
        serviceType: deliveryType,
        pincode,
        pickupDate: selectedDate,
        pickupEndMin: pickupSlotEndMin,
      }
      const res = await fetch("/api/slots/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const json = await res.json()

      if (json?.earliest_date && targetDeliveryDate < json.earliest_date) {
        setMinDeliveryDate(json.earliest_date)
        setDeliveryDate(json.earliest_date)
        toast({ title: "Delivery date adjusted", description: `Earliest allowed delivery is ${json.earliest_date}.` })
        setDeliverySlots([])
        return
      }

      if (json?.slots) {
        const mapped = json.slots.map((s: any) => ({
          id: s.id,
          label: s.display_time,
          startMin: hhmmToMin(s.start_time),
          endMin: hhmmToMin(s.end_time),
          available: !!s.is_available,
        }))
        setDeliverySlots(mapped)
      } else {
        setDeliverySlots([])
      }
    } catch (err: any) {
      setDeliverySlots([])
      toast({ title: "Failed to load delivery slots", description: err?.message || "Network error" })
    } finally {
      setDeliveryLoading(false)
    }
  }

  // Fetch delivery availability when deliveryDate changes
  useEffect(() => {
    if (!deliveryDate || !selectedTimeSlot) return
    const pickupSlot = pickupSlots.find((s) => String(s.id) === String(selectedTimeSlot))
    const pickupEndMin = pickupSlot?.endMin ?? 0
    fetchDeliveryFor({ targetDeliveryDate: deliveryDate, pickupSlotEndMin: pickupEndMin })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deliveryDate, deliveryType, selectedTimeSlot, pincode, selectedDate, pickupSlots])

  const handleSelectPickup = (slot: any) => {
    if (!slot || !slot.available) return
    setSelectedTimeSlot(String(slot.id))
    const earliestDate = selectedDate
    const candidate =
      availableDates.find((d) => d.date >= earliestDate)?.date || availableDates[availableDates.length - 1]?.date
    setDeliveryDate(candidate || earliestDate)
    const pickupEndMin = slot.endMin ?? 0
    setTimeout(() => {
      fetchDeliveryFor({ targetDeliveryDate: candidate || earliestDate, pickupSlotEndMin: pickupEndMin })
    }, 20)
  }

  // Reset when pickup date changes
  useEffect(() => {
    setSelectedTimeSlot("")
    setDeliverySlots([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate])

  // Adjust chosen delivery date if min shifts
  useEffect(() => {
    if (deliveryDate && minDeliveryDate && deliveryDate < minDeliveryDate) {
      setDeliveryDate(minDeliveryDate)
      toast({ title: "Adjusted delivery date", description: `Delivery moved to ${minDeliveryDate} to respect minimum gap.` })
    }
  }, [minDeliveryDate, deliveryDate, toast])

  // Persist selection
  useEffect(() => {
    if (!mounted) return
    if (selectedTimeSlot && deliveryDate) {
      const pickupSlot = pickupSlots.find((s) => String(s.id) === String(selectedTimeSlot))
      const deliverySelected = deliverySlots.find((s: any) => (s as any).__selected)
      const obj = {
        serviceType: deliveryType,
        pickup: { date: selectedDate, slotId: selectedTimeSlot, label: pickupSlot?.label, endMin: pickupSlot?.endMin },
        delivery: { date: deliveryDate, slotId: deliverySelected?.id, label: deliverySelected?.label },
      }
      try { localStorage.setItem("slotSelection", JSON.stringify(obj)) } catch {}
    }
  }, [mounted, selectedTimeSlot, deliveryDate, deliverySlots, deliveryType, pickupSlots, selectedDate])

  // ---------- Pricing (now sourced from `bill`) ----------
  const subtotal = bill.subtotal
  const deliveryFee = bill.deliveryFee
  const expressFee = 0
  const discount = bill.discount
  const tax = 0
  const totalAmount = bill.total || (subtotal + deliveryFee - discount + expressFee + tax)

  const isSlotSelected = selectedDate && selectedTimeSlot

  // ---------- Place Order ----------
  const handlePrimaryAction = async () => {
    if (paymentMethod === "online") {
      await handlePlaceOrder("online")
      return
    }
    await handlePlaceOrder("cod")
  }

  const handlePlaceOrder = async (method: "online" | "cod") => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      alert("Please sign in to place your order.")
      return
    }

    const pickupSlot = pickupSlots.find((s) => String(s.id) === String(selectedTimeSlot))
    const deliverySelected = deliverySlots.find((s: any) => (s as any).__selected)

    if (!pickupSlot?.label) {
      alert("Please select a pickup slot before continuing.")
      return
    }
    if (!deliverySelected?.id || !deliverySelected?.label || !deliveryDate) {
      alert("Please select a delivery slot before continuing.")
      return
    }

    const slotSelection = {
      serviceType: deliveryType,
      pickup: { date: selectedDate, slotId: selectedTimeSlot, label: pickupSlot.label },
      delivery: { date: deliveryDate, slotId: deliverySelected.id, label: deliverySelected.label },
    }

    const base = {
      items: cartItems,
      subtotal,
      deliveryFee,
      discount,                    // << use persisted discount
      total: totalAmount,          // << use persisted total
      paymentMethod: method,
      serviceType: slotSelection.serviceType,
      pickup: slotSelection.pickup,
      delivery: slotSelection.delivery,
      // pass coupon code if we have it
      applied_coupon_code:
        bill.appliedCoupon?.code ||
        (typeof window !== "undefined" && localStorage.getItem("appliedCoupon")) ||
        null,
    }
    const withAddress = mergeSelectedAddressIntoPayload(base)
    const payload = { ...withAddress, user_id: user.id }

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const msg = await res.text()
        alert(`Failed to place order: ${msg}`)
        return
      }
      const json = await res.json()
      const orderId = String(json?.id || "")
      if (!orderId) {
        alert("Unexpected response from server while placing order.")
        return
      }
      const finalPayload = { orderId, createdAt: new Date().toISOString(), tax, ...payload }
      try { localStorage.setItem("lastOrderPayload", JSON.stringify(finalPayload)) } catch {}
      // Index payload by orderId for Order History fallbacks
      try {
        const mapRaw = localStorage.getItem("orderPayloadById")
        const map = mapRaw ? JSON.parse(mapRaw) : {}
        map[orderId] = finalPayload
        localStorage.setItem("orderPayloadById", JSON.stringify(map))
      } catch {}
      // Clear cart and related state; notify UI & update local cart state
      try {
        localStorage.removeItem("cart")
        localStorage.removeItem("reviewTotals")
        localStorage.removeItem("appliedCoupon")
        window.dispatchEvent(new Event("cartUpdated"))
        window.dispatchEvent(new Event("cart:cleared"))
      } catch {}
      setCartItems([])
      router.push(`/order-success?orderId=${orderId}`)
    } catch {
      alert("Network error while placing order. Please try again.")
    }
  }

  if (!mounted) return null

  return (
    <div className="min-h-[100svh] md:min-h-screen grid grid-rows-[auto_1fr_auto] bg-gray-50">
      <Navbar cartCount={cartItems.length} />

      <main className="row-start-2 container mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 lg:py-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-6 lg:mb-8">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-gray-100 rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            >
              <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6 text-gray-600" />
            </button>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">Select Pickup Slot</h1>
          </div>

          <div className="grid lg:grid-cols-3 gap-4 sm:gap-6">
            {/* Left column */}
            <div className="lg:col-span-2 space-y-4 sm:space-y-6">
              {/* Delivery Address */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                      <h3 className="font-semibold text-gray-900 text-sm sm:text-base">Delivery Address</h3>
                    </div>
                    <div className="ml-6 sm:ml-7">
                      <p className="font-medium text-gray-900 text-sm sm:text-base">{selectedAddress.name}</p>
                      <p className="text-xs sm:text-sm text-gray-600 mt-1">{selectedAddress.address}</p>
                      <p className="text-xs sm:text-sm text-gray-600">{selectedAddress.phone}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => router.push("/address-book")}
                    className="text-blue-600 hover:text-blue-700 font-medium text-xs sm:text-sm transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded px-2 py-1"
                  >
                    Change Address
                  </button>
                </div>
              </div>

              {/* Delivery Type */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
                <h3 className="font-semibold text-gray-900 text-sm sm:text-base mb-3 sm:mb-4">Delivery Type</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <button
                    onClick={() => setDeliveryType("standard")}
                    className={`flex items-center gap-3 p-3 sm:p-4 border rounded-lg transition-all duration-200 ${
                      deliveryType === "standard"
                        ? "border-blue-500 bg-blue-50 ring-2 ring-blue-500 ring-opacity-20"
                        : "border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <Truck className={`w-5 h-5 ${deliveryType === "standard" ? "text-blue-600" : "text-gray-400"}`} />
                    <div className="text-left">
                      <p className={`font-medium text-sm sm:text-base ${deliveryType === "standard" ? "text-blue-900" : "text-gray-900"}`}>
                        Standard
                      </p>
                      <p className={`text-xs sm:text-sm ${deliveryType === "standard" ? "text-blue-700" : "text-gray-600"}`}>
                        24-48 hours
                      </p>
                    </div>
                  </button>
                  <button
                    onClick={() => setDeliveryType("express")}
                    className={`flex items-center gap-3 p-3 sm:p-4 border rounded-lg transition-all duration-200 ${
                      deliveryType === "express"
                        ? "border-blue-500 bg-blue-50 ring-2 ring-blue-500 ring-opacity-20"
                        : "border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <Zap className={`w-5 h-5 ${deliveryType === "express" ? "text-blue-600" : "text-gray-400"}`} />
                    <div className="text-left">
                      <p className={`font-medium text-sm sm:text-base ${deliveryType === "express" ? "text-blue-900" : "text-gray-900"}`}>
                        Express
                      </p>
                      <p className={`text-xs sm:text-sm ${deliveryType === "express" ? "text-blue-700" : "text-gray-600"}`}>
                        Same day
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Select Pickup Date */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
                <div className="flex items-center gap-2 mb-3 sm:mb-4">
                  <Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                  <h3 className="font-semibold text-gray-900 text-sm sm:text-base">Select Pickup Date</h3>
                </div>
                <div className="relative">
                  {/* Left gradient & control */}
                  <div className="pointer-events-none absolute left-0 top-0 h-full w-6 bg-gradient-to-r from-white to-transparent" />
                  <button
                    type="button"
                    onClick={() => scrollPickupDates(-220)}
                    disabled={!pickupCanLeft}
                    aria-label="Scroll dates left"
                    className={`hidden sm:flex items-center justify-center absolute left-0 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full shadow-md border bg-white z-10 ${
                      pickupCanLeft ? "opacity-100" : "opacity-50 cursor-not-allowed"
                    }`}
                  >
                    <ChevronLeft className="w-5 h-5 text-gray-700" />
                  </button>

                  {/* Scrollable dates */}
                  <div
                    ref={pickupDatesRef}
                    className="flex gap-2 sm:gap-3 overflow-x-auto pb-2 scrollbar-hide scroll-smooth snap-x snap-mandatory"
                  >
                    {availableDates.map((date) => (
                      <button
                        key={date.date}
                        ref={selectedDate === date.date ? pickupSelectedRef : undefined}
                        onClick={() => setSelectedDate(date.date)}
                        className={`flex-shrink-0 flex flex-col items-center p-3 sm:p-4 rounded-lg border transition-all duration-200 min-w-[70px] sm:min-w-[80px] snap-start ${
                          selectedDate === date.date
                            ? "border-blue-500 bg-blue-50 text-blue-600"
                            : "border-gray-200 hover:bg-gray-50 text-gray-700"
                        }`}
                      >
                        <span className="text-xs sm:text-sm font-medium">{date.day}</span>
                        <span className="text-lg sm:text-xl font-bold">{date.dayNum}</span>
                        <span className="text-xs text-gray-500">{date.month}</span>
                      </button>
                    ))}
                  </div>

                  {/* Right gradient & control */}
                  <div className="pointer-events-none absolute right-0 top-0 h-full w-6 bg-gradient-to-l from-white to-transparent" />
                  <button
                    type="button"
                    onClick={() => scrollPickupDates(220)}
                    disabled={!pickupCanRight}
                    aria-label="Scroll dates right"
                    className={`hidden sm:flex items-center justify-center absolute right-0 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full shadow-md border bg-white z-10 ${
                      pickupCanRight ? "opacity-100" : "opacity-50 cursor-not-allowed"
                    }`}
                  >
                    <ChevronRight className="w-5 h-5 text-gray-700" />
                  </button>
                </div>
              </div>

              {/* Schedule Pickup */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
                <div className="flex items-center gap-2 mb-3 sm:mb-4">
                  <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                  <h3 className="font-semibold text-gray-900 text-sm sm:text-base">Schedule Pickup</h3>
                </div>
                {pickupLoading ? (
<div className="grid grid-cols-2 gap-2 sm:gap-3" aria-live="polite" aria-busy="true">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div
                        key={i}
                        className="p-3 sm:p-4 rounded-lg border border-gray-200 skeleton h-12 sm:h-14"
                      />
                    ))}
                  </div>
                ) : (
<div className="grid grid-cols-2 gap-2 sm:gap-3">
                    {pickupSlots.map((slot) => (
                      <button
                        key={slot.id}
                        onClick={() => handleSelectPickup(slot)}
                        disabled={!slot.available}
                        className={`p-3 sm:p-4 rounded-lg border text-left transition-all duration-200 ${
                          !slot.available
                            ? "border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed"
                            : String(selectedTimeSlot) === String(slot.id)
                            ? "border-blue-500 bg-blue-50 text-blue-600"
                            : "border-gray-200 hover:bg-gray-50 text-gray-700"
                        }`}
                      >
                        <span className="text-sm sm:text-base font-medium">{slot.label}</span>
                        {!slot.available && <span className="block text-xs text-red-500 mt-1">Unavailable</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Select Delivery Date */}
              {selectedTimeSlot && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6" ref={deliveryRef}>
                  <div className="flex items-center gap-2 mb-3 sm:mb-4">
                    <Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                    <h3 className="font-semibold text-gray-900 text-sm sm:text-base">Select Delivery Date</h3>
                  </div>
                  <div className="relative">
                    <div className="pointer-events-none absolute left-0 top-0 h-full w-6 bg-gradient-to-r from-white to-transparent" />
                    <button
                      type="button"
                      onClick={() => scrollDeliveryDates(-220)}
                      disabled={!deliveryCanLeft}
                      aria-label="Scroll dates left"
                      className={`hidden sm:flex items-center justify-center absolute left-0 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full shadow-md border bg-white z-10 ${
                        deliveryCanLeft ? "opacity-100" : "opacity-50 cursor-not-allowed"
                      }`}
                    >
                      <ChevronLeft className="w-5 h-5 text-gray-700" />
                    </button>

                    <div
                      ref={deliveryDatesRef}
                      className="flex gap-2 sm:gap-3 overflow-x-auto pb-2 scrollbar-hide scroll-smooth snap-x snap-mandatory"
                    >
                      {availableDates.map((date) => {
                        const isBeforeMin = minDeliveryDate && date.date < minDeliveryDate
                        return (
                          <button
                            key={date.date}
                            ref={deliveryDate === date.date ? deliverySelectedRef : undefined}
                            onClick={() => {
                              if (isBeforeMin) {
                                setDeliveryDate(minDeliveryDate)
                                toast({ title: "Delivery date adjusted", description: `Earliest allowed delivery is ${minDeliveryDate}.` })
                                return
                              }
                              setDeliveryDate(date.date)
                            }}
                            disabled={!!isBeforeMin}
                            className={`flex-shrink-0 flex flex-col items-center p-3 sm:p-4 rounded-lg border transition-all duration-200 min-w-[70px] sm:min-w-[80px] snap-start ${
                              isBeforeMin
                                ? "border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed"
                                : deliveryDate === date.date
                                ? "border-blue-500 bg-blue-50 text-blue-600"
                                : "border-gray-200 hover:bg-gray-50 text-gray-700"
                            }`}
                          >
                            <span className="text-xs sm:text-sm font-medium">{date.day}</span>
                            <span className="text-lg sm:text-xl font-bold">{date.dayNum}</span>
                            <span className="text-xs text-gray-500">{date.month}</span>
                          </button>
                        )
                      })}
                    </div>

                    <div className="pointer-events-none absolute right-0 top-0 h-full w-6 bg-gradient-to-l from-white to-transparent" />
                    <button
                      type="button"
                      onClick={() => scrollDeliveryDates(220)}
                      disabled={!deliveryCanRight}
                      aria-label="Scroll dates right"
                      className={`hidden sm:flex items-center justify-center absolute right-0 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full shadow-md border bg-white z-10 ${
                        deliveryCanRight ? "opacity-100" : "opacity-50 cursor-not-allowed"
                      }`}
                    >
                      <ChevronRight className="w-5 h-5 text-gray-700" />
                    </button>
                  </div>
                </div>
              )}

              {/* Schedule Delivery */}
              {selectedTimeSlot && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
                  <div className="flex items-center gap-2 mb-3 sm:mb-4">
                    <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                    <h3 className="font-semibold text-gray-900 text-sm sm:text-base">
                      Schedule Delivery ({deliveryType === "express" ? "Express" : "Standard"})
                    </h3>
                  </div>
                  {deliveryLoading ? (
<div className="grid grid-cols-2 gap-2 sm:gap-3" aria-live="polite" aria-busy="true">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="p-3 sm:p-4 rounded-lg border border-gray-200 skeleton h-12 sm:h-14" />
                      ))}
                    </div>
                  ) : (
<div className="grid grid-cols-2 gap-2 sm:gap-3">
                      {deliverySlots.map((slot) => (
                        <button
                          key={slot.id}
                          onClick={() =>
                            slot.available &&
                            setDeliverySlots((prev) =>
                              prev.map((s) => ({ ...s, __selected: String(s.id) === String(slot.id) }))
                            )
                          }
                          disabled={!slot.available}
                          className={`p-3 sm:p-4 rounded-lg border text-left transition-all duration-200 ${
                            !slot.available
                              ? "border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed"
                              : (slot as any).__selected
                              ? "border-blue-500 bg-blue-50 text-blue-600"
                              : "border-gray-200 hover:bg-gray-50 text-gray-700"
                          }`}
                        >
                          <span className="text-sm sm:text-base font-medium">{slot.label}</span>
                          {!slot.available && <span className="block text-xs text-red-500 mt-1">Unavailable</span>}
                        </button>
                      ))}
                    </div>
                  )}
                  {!deliveryLoading && deliveryDate &&
                    (deliverySlots.length === 0 ? (
                      <p className="text-sm text-red-600 mt-2">No delivery slots available for the selected day.</p>
                    ) : (
                      !deliverySlots.some((s) => s.available) && (
                        <p className="text-sm text-red-600 mt-2">No delivery slots available for the selected day.</p>
                      )
                    ))}
                </div>
              )}
            </div>

            {/* Right column - summary */}
            {selectedTimeSlot && deliveryDate && (deliverySlots.find((s: any) => (s as any).__selected)) && (
              <div className="lg:col-span-1">
                <div className="sticky top-4 space-y-4">
                  <SelectedSlotCard
                    pickup={{ date: selectedDate, label: pickupSlots.find((s) => String(s.id) === String(selectedTimeSlot))?.label }}
                    delivery={{ date: deliveryDate, label: (deliverySlots.find((s: any) => (s as any).__selected) as any)?.label }}
                    serviceType={deliveryType}
                  />

                  <BillSummary
                    subtotal={subtotal}
                    deliveryFee={deliveryFee}
                    expressFee={expressFee}
                    discount={discount}
                    tax={tax}
                    total={totalAmount}
                  />

                  <PaymentMethods total={totalAmount} selectedMethod={paymentMethod} onSelect={setPaymentMethod} />

                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
                    <button
                      onClick={handlePrimaryAction}
                      disabled={!(selectedDate && selectedTimeSlot && (deliverySlots.find((s: any) => (s as any).__selected)))}
                      className={`w-full py-3 sm:py-4 rounded-lg font-semibold text-sm sm:text-base transition-all duration-200 ${
                        selectedDate && selectedTimeSlot && (deliverySlots.find((s: any) => (s as any).__selected))
                          ? "bg-blue-600 text-white hover:bg-blue-700 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                          : "bg-gray-300 text-gray-500 cursor-not-allowed"
                      }`}
                    >
                      {paymentMethod === "online" ? `Pay ₹${totalAmount.toFixed(2)}` : "Place Order"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
