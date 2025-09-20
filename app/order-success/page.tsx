"use client"

import React, { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Navbar from "@/components/Navbar"
import Footer from "@/components/Footer"
import { CheckCircle2, Calendar, Truck, MapPin } from "lucide-react"
import { parseLabelToMinutes } from "@/lib/slots"
import { toast } from "sonner"

function formatINR(n: number) {
  try { return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n) } catch { return `₹${n.toFixed(2)}` }
}

function formatDateTime(dateStr?: string, label?: string) {
  if (!dateStr) return label || "-"
  const d = new Date(dateStr)
  const today = new Date()
  const tomorrow = new Date(); tomorrow.setDate(today.getDate() + 1)
  const same = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  let prefix = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  if (same(d, today)) prefix = 'Today'
  else if (same(d, tomorrow)) prefix = 'Tomorrow'
  return label ? `${prefix} at ${label}` : prefix
}

function OrderSuccessPageInner() {
  const router = useRouter()
  const params = useSearchParams()
  const orderIdFromUrl = params.get('orderId') || ''
  const [payload, setPayload] = useState<any | null>(null)
  const [canCancel, setCanCancel] = useState<boolean>(false)
  const [isCancelling, setIsCancelling] = useState<boolean>(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem('lastOrderPayload')
      setPayload(raw ? JSON.parse(raw) : null)
    } catch {}
  }, [])

  const total = payload?.total || 0

  // Compute cancellable window (client-side visibility only; server enforces policy)
  useEffect(() => {
    if (!payload?.pickup?.date || !payload?.pickup?.label) {
      setCanCancel(false)
      return
    }
    const mins = parseLabelToMinutes(payload.pickup.label)
    if (!mins) {
      setCanCancel(false)
      return
    }
    const serviceType = payload?.serviceType === 'express' ? 'express' : 'standard'
    const pickupDate: string = payload.pickup.date
    const pickupStartUTC = (() => {
      const baseUTC = Date.parse(`${pickupDate}T00:00:00Z`)
      const istMidnightUTC = baseUTC - 330 * 60 * 1000
      return istMidnightUTC + mins.startMin * 60 * 1000
    })()
    const cancellableUntilUTC = serviceType === 'express' ? pickupStartUTC : (pickupStartUTC - 60 * 60 * 1000)

    const update = () => setCanCancel(Date.now() < cancellableUntilUTC)
    update()
    const t = setInterval(update, 30 * 1000)
    return () => clearInterval(t)
  }, [payload])

  const onCancelOrder = async () => {
    if (!orderIdFromUrl) return
    const confirmed = window.confirm("Cancel this order?")
    if (!confirmed) return
    setIsCancelling(true)
    try {
      const res = await fetch('/api/orders/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderIdFromUrl }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(json?.error || 'Cancellation failed')
      } else {
        toast.success('Order cancelled successfully')
        setCanCancel(false)
      }
    } catch (e: any) {
      toast.error('Network error while cancelling order')
    } finally {
      setIsCancelling(false)
    }
  }

  return (
    <div className="min-h-[100svh] md:min-h-screen grid grid-rows-[auto_1fr_auto] bg-gray-50">
      <Navbar cartCount={0} />

      <main className="row-start-2 container mx-auto px-3 sm:px-4 lg:px-6 py-6 sm:py-8">
        <div className="max-w-2xl mx-auto">
          {/* Success Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-10 text-center">
            <div className="mx-auto mb-4 sm:mb-6 w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-blue-600" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Order Placed Successfully!</h1>
            <p className="text-sm sm:text-base text-gray-600">Your order has been placed and is being processed.</p>

            {/* Order ID */}
            <div className="mt-4 sm:mt-6">
              <p className="text-sm text-gray-600">Order ID</p>
              <p className="text-lg sm:text-xl font-semibold text-blue-600 break-all">{orderIdFromUrl || payload?.orderId || '-'}</p>
            </div>

            {/* Schedule */}
            <div className="mt-6 sm:mt-8 text-left bg-gray-50 border border-gray-100 rounded-xl p-4 sm:p-6">
              <h2 className="font-semibold text-gray-900 mb-3">Schedule</h2>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Calendar className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Pickup</p>
                    <p className="text-xs text-gray-600">{formatDateTime(payload?.pickup?.date, payload?.pickup?.label)}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Calendar className="w-5 h-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Delivery</p>
                    <p className="text-xs text-gray-600">{formatDateTime(payload?.delivery?.date, payload?.delivery?.label)}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Truck className="w-5 h-5 text-gray-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Delivery Type</p>
                    <p className="text-xs text-gray-600">{payload?.serviceType === 'express' ? 'Express Delivery' : 'Standard Delivery'}</p>
                  </div>
                </div>
                {payload?.delivery_address && (
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-gray-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Address</p>
                      <p className="text-xs text-gray-600">{payload?.delivery_address}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Bill Summary */}
            <div className="mt-4 sm:mt-6 text-left bg-white">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Total</span>
                <span className="text-lg font-semibold text-blue-600">{formatINR(total)}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row gap-3 sm:justify-center">
              {canCancel && (
                <button
                  onClick={onCancelOrder}
                  disabled={isCancelling}
                  className={`px-5 py-3 rounded-lg border ${isCancelling ? 'bg-gray-100 text-gray-500' : 'border-red-200 text-red-700 hover:bg-red-50'} font-medium`}
                >
                  {isCancelling ? 'Cancelling…' : 'Cancel Order'}
                </button>
              )}
              <button
                onClick={() => router.push('/order-history')}
                className="px-5 py-3 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-800 font-medium"
              >
                View Orders
              </button>
              <button
                onClick={() => router.push('/')}
                className="px-5 py-3 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-semibold"
              >
                Continue Shopping
              </button>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}

export default function OrderSuccessPage() {
  return (
    <Suspense fallback={<div className="p-6 text-center">Loading…</div>}>
      <OrderSuccessPageInner />
    </Suspense>
  )
}

