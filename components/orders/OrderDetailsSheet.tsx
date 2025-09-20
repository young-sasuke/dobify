"use client"

import * as React from "react"
import { supabase } from "@/lib/supabase"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Calendar, MapPin, Package, IndianRupee } from "lucide-react"

type OrderRow = Record<string, any>

type OrderItem = {
  id?: string | number
  name: string
  subtitle?: string | null
  qty: number
  unitPrice: number
  lineTotal: number
  image?: string | null
}

function toNumber(n: any, fallback = 0): number {
  if (n === null || n === undefined || n === "") return fallback
  const v = Number(typeof n === "string" ? n.replace(/[^\d.-]/g, "") : n)
  return Number.isFinite(v) ? v : fallback
}

function pickFirstNumber(obj: any, keys: string[], fallback = 0) {
  for (const k of keys) {
    if (k in (obj || {})) return toNumber(obj[k], fallback)
  }
  return fallback
}

function inr(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(n)
}

function statusBadgeColor(status: string) {
  const s = status?.toLowerCase?.() || ""
  if (s === "delivered") return "bg-green-100 text-green-800"
  if (s === "cancelled") return "bg-red-100 text-red-800"
  if (s === "confirmed" || s === "picked_up") return "bg-blue-100 text-blue-800"
  if (s === "processing") return "bg-yellow-100 text-yellow-800"
  return "bg-gray-100 text-gray-800"
}

function formatDate(d?: string | null) {
  if (!d) return "-"
  try {
    return new Date(d).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
  } catch {
    return d
  }
}

// Normalize items from JSON/localStorage payloads
function normalizeFromJson(items: any[] | null | undefined): OrderItem[] {
  if (!Array.isArray(items)) return []
  return items.map((it, idx) => {
    const name = it?.name || it?.title || it?.product_name || "Item"
    const subtitle =
      it?.serviceName || it?.service || it?.variant || it?.note || it?.description || null
    const qty = toNumber(it?.quantity ?? it?.qty ?? 1, 1)
    const unit = toNumber(it?.price, 0) + toNumber(it?.servicePrice ?? it?.service_price, 0)
    const lineTotal = unit * qty
    return {
      id: it?.id ?? `json-${idx}`,
      name,
      subtitle,
      qty,
      unitPrice: unit,
      lineTotal,
      image: it?.image || it?.image_url || null,
    }
  })
}

// Normalize items from order_items table
function normalizeFromTable(rows: any[]): OrderItem[] {
  return rows.map((r: any) => {
    const qty = toNumber(r?.quantity ?? 1, 1)
    const unit = toNumber(r?.price, 0) + toNumber(r?.service_price, 0)
    return {
      id: r?.id,
      name: r?.name || r?.title || "Item",
      subtitle: r?.subtitle || r?.variant || r?.notes || null,
      qty,
      unitPrice: unit,
      lineTotal: unit * qty,
      image: r?.image_url || null,
    }
  })
}

// Read a saved order payload from localStorage for fallback
function getLSOrder(orderId: string) {
  try {
    const mapRaw = typeof window !== "undefined" ? localStorage.getItem("orderPayloadById") : null
    const map = mapRaw ? JSON.parse(mapRaw) : null
    if (map?.[orderId]) return map[orderId]
    const lastRaw = typeof window !== "undefined" ? localStorage.getItem("lastOrderPayload") : null
    const last = lastRaw ? JSON.parse(lastRaw) : null
    if (last?.orderId === orderId) return last
  } catch {}
  return null
}

async function fetchOrder(orderId: string) {
  // 1) Load the order (no column assumptions).
  const { data: order, error } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle()

  if (error) throw error

  // 2) Prefer a dedicated order_items table if present.
  let items: OrderItem[] = []
  const { data: tableItems, error: tableErr } = await supabase
    .from("order_items")
    .select("id, name, quantity, price, service_price, image_url, notes, variant, subtitle, order_id")
    .eq("order_id", orderId)

  if (!tableErr && tableItems && tableItems.length > 0) {
    items = normalizeFromTable(tableItems)
  } else {
    // 3) Otherwise read from the JSON you sent while placing the order.
    //    We try multiple common spots: items, cart, payload.items
    let jsonItems: any[] | null = null
    if (Array.isArray(order?.items)) jsonItems = order.items
    else if (Array.isArray(order?.cart)) jsonItems = order.cart
    else if (order?.payload) {
      try {
        const parsed =
          typeof order.payload === "string" ? JSON.parse(order.payload) : order.payload
        if (Array.isArray(parsed?.items)) jsonItems = parsed.items
      } catch {}
    }
    items = normalizeFromJson(jsonItems || [])
  }

  // 3b) Fallback to localStorage if still empty
  if (!items || items.length === 0) {
    const ls = getLSOrder(orderId)
    if (Array.isArray(ls?.items)) {
      items = normalizeFromJson(ls.items)
    }
  }

  // 4) Totals — support DB first, else localStorage, else compute.
  const computedSubtotal = items.reduce((s, it) => s + it.lineTotal, 0)

  const ls = getLSOrder(orderId)
  const deliveryFeeLS = toNumber(ls?.deliveryFee, NaN)
  const discountLS = toNumber(ls?.discount ?? ls?.discount_amount, NaN)
  const taxLS = toNumber(ls?.tax, NaN)
  const totalLS = toNumber(ls?.total, NaN)

  // Keep subtotal derived from items
  const subtotal = computedSubtotal

  const deliveryFeeFromDb = pickFirstNumber(order, ["delivery_fee", "delivery", "shipping_fee"], NaN)
  const deliveryFee = Number.isFinite(deliveryFeeFromDb)
    ? deliveryFeeFromDb
    : (Number.isFinite(deliveryFeeLS) ? deliveryFeeLS : 0)

  const discountFromDb = pickFirstNumber(order, ["discount", "discount_amount", "coupon_discount"], NaN)
  const discount = Number.isFinite(discountFromDb)
    ? discountFromDb
    : (Number.isFinite(discountLS) ? discountLS : 0)

  const taxFromDb = pickFirstNumber(order, ["tax", "gst"], NaN)
  const tax = Number.isFinite(taxFromDb)
    ? taxFromDb
    : (Number.isFinite(taxLS) ? taxLS : 0)

  const totalFromDb = pickFirstNumber(order, ["total_amount", "total"], NaN)
  const total = Number.isFinite(totalFromDb)
    ? totalFromDb
    : (Number.isFinite(totalLS) ? totalLS : Math.max(0, subtotal + deliveryFee + tax - discount))

  return { order, items, summary: { subtotal, deliveryFee, discount, tax, total } }
}

type Props = {
  orderId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function OrderDetailsSheet({ orderId, open, onOpenChange }: Props) {
  const [data, setData] = React.useState<{
    order: OrderRow | null
    items: OrderItem[]
    summary: { subtotal: number; deliveryFee: number; discount: number; tax: number; total: number }
  }>({
    order: null,
    items: [],
    summary: { subtotal: 0, deliveryFee: 0, discount: 0, tax: 0, total: 0 },
  })
  const [loading, setLoading] = React.useState(false)

  // Initial load
  React.useEffect(() => {
    if (!open || !orderId) return
    setLoading(true)
    fetchOrder(orderId)
      .then((res) => setData(res as any))
      .finally(() => setLoading(false))
  }, [open, orderId])

  // Realtime updates (orders + order_items)
  React.useEffect(() => {
    if (!open || !orderId) return

    const ch = supabase
      .channel(`order-${orderId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `id=eq.${orderId}` },
        async () => {
          const latest = await fetchOrder(orderId)
          setData(latest as any)
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "order_items", filter: `order_id=eq.${orderId}` },
        async () => {
          const latest = await fetchOrder(orderId)
          setData(latest as any)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(ch)
    }
  }, [open, orderId])

  const o = data.order
  const items = data.items
  const s = data.summary

  const status = (o?.order_status as string) || ""

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md bg-white border-l shadow-xl">
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-500">Order</span>
            {status ? (
              <Badge className={`${statusBadgeColor(status)} capitalize`}>{status}</Badge>
            ) : null}
          </SheetTitle>
          <div className="text-lg font-semibold font-mono tracking-tight">#{String(orderId)}</div>
        </SheetHeader>

        <div className="mt-4 space-y-6 overflow-y-auto h-[calc(100svh-7.5rem)] md:h-[calc(100vh-7.5rem)] pr-1">
          {/* Schedule */}
          <section className="space-y-3">
            <div className="flex items-start gap-3">
              <Calendar className="w-4 h-4 text-blue-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-900">Pickup</p>
                <p className="text-xs text-gray-600">
                  {formatDate(o?.pickup_date)}
                  {o?.pickup_slot_display_time ? (
                    <span className="ml-2">{o.pickup_slot_display_time}</span>
                  ) : null}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Calendar className="w-4 h-4 text-green-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-900">Delivery</p>
                <p className="text-xs text-gray-600">
                  {formatDate(o?.delivery_date)}
                  {o?.delivery_slot_display_time ? (
                    <span className="ml-2">{o.delivery_slot_display_time}</span>
                  ) : null}
                </p>
              </div>
            </div>

            {!!o?.delivery_address && (
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-gray-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Delivery Address</p>
                  <p className="text-xs text-gray-600">{o.delivery_address}</p>
                </div>
              </div>
            )}
          </section>

          <Separator />

          {/* Items */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <Package className="w-4 h-4" />
                Items ({items.length})
              </p>
            </div>

            {loading ? (
              <p className="text-sm text-gray-500">Loading items…</p>
            ) : items.length === 0 ? (
              <p className="text-sm text-gray-500">No item details found.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {items.map((it) => (
                  <li key={String(it.id)} className="py-3 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-md bg-gray-100 flex items-center justify-center text-gray-500 text-xs shrink-0">
                      {it.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={it.image} alt={it.name} className="h-10 w-10 rounded-md object-cover" loading="lazy" decoding="async" onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg' }} />
                      ) : (
                        it.name?.slice(0, 2)?.toUpperCase() || "IT"
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{it.name}</p>
                      {it.subtitle ? (
                        <p className="text-xs text-gray-500 truncate">{it.subtitle}</p>
                      ) : null}
                      <p className="text-xs text-gray-600 mt-0.5">
                        Qty {it.qty} × {inr(it.unitPrice)}
                      </p>
                    </div>

                    <div className="text-sm font-semibold text-gray-900">{inr(it.lineTotal)}</div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <Separator />

          {/* Bill Summary */}
          <section className="space-y-2">
            <p className="text-sm font-semibold text-gray-900">Bill Summary</p>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-gray-700">
                <span>Subtotal</span>
                <span>{inr(s.subtotal)}</span>
              </div>
              {s.deliveryFee ? (
                <div className="flex justify-between text-gray-700">
                  <span>Delivery Fee</span>
                  <span>{inr(s.deliveryFee)}</span>
                </div>
              ) : null}
              {s.discount ? (
                <div className="flex justify-between text-green-700">
                  <span>Discount</span>
                  <span>-{inr(s.discount)}</span>
                </div>
              ) : null}
              {s.tax ? (
                <div className="flex justify-between text-gray-700">
                  <span>Tax</span>
                  <span>{inr(s.tax)}</span>
                </div>
              ) : null}
            </div>
            <Separator />
            <div className="flex justify-between items-center text-base font-semibold">
              <span className="flex items-center gap-1">
                <IndianRupee className="w-4 h-4" />
                Total
              </span>
              <span>{inr(s.total)}</span>
            </div>
          </section>

          {/* Payment */}
          {(o?.payment_method || o?.payment_status) && (
            <>
              <Separator />
              <section>
                <p className="text-sm font-semibold text-gray-900 mb-1">Payment</p>
                <p className="text-xs text-gray-600">
                  {(o?.payment_method || "-") + (o?.payment_status ? ` • ${o.payment_status}` : "")}
                </p>
              </section>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
