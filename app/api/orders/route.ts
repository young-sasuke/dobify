import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"

function isUUID(v?: any) {
  if (typeof v !== 'string') return false
  const s = v.trim()
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)
}

function parseTime12hTo24hHHmm(time12?: string | null): string | null {
  if (!time12 || typeof time12 !== 'string') return null
  let s = time12.trim().toUpperCase()
  s = s.replace(/\s+/g, ' ')
  // Accept formats like "06:00PM", "06:00 PM", "6:00 PM"
  const m = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/)
  if (!m) return null
  let h = parseInt(m[1], 10)
  const min = parseInt(m[2], 10)
  const ampm = m[3]
  if (ampm === 'AM') {
    if (h === 12) h = 0
  } else {
    if (h !== 12) h += 12
  }
  const hh = String(h).padStart(2, '0')
  const mm = String(min).padStart(2, '0')
  return `${hh}:${mm}:00`
}

function parseSlotLabelToTimes(label?: string | null): { start: string | null; end: string | null } {
  if (!label || typeof label !== 'string') return { start: null, end: null }
  // Normalize separators: "08:00 AM - 10:00 AM" or "06:00PM - 08:00PM"
  const norm = label.replace(/\u2013|\u2014/g, '-') // en-dash/em-dash -> hyphen
  const parts = norm.split('-')
  if (parts.length < 2) return { start: null, end: null }
  const left = parts[0].trim().toUpperCase().replace(/\s+/g, ' ')
  const right = parts[1].trim().toUpperCase().replace(/\s+/g, ' ')

  // Ensure AM/PM separated
  const normalizePart = (p: string) => p.replace(/(AM|PM)$/,' $1').trim()

  const s = parseTime12hTo24hHHmm(normalizePart(left))
  const e = parseTime12hTo24hHHmm(normalizePart(right))
  return { start: s, end: e }
}

export async function POST(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    console.error('[orders:error] Missing Supabase service role key or URL')
    return NextResponse.json({ error: 'Server is missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE URL' }, { status: 500 })
  }
  // Use service role on the server to guarantee writes (bypass RLS)
  const service = createClient(url, serviceKey)
  try {
    const body = await req.json()

    // Resolve user id (best-effort): prefer auth cookie, else optional body.user_id
    let userId: string | null = null
    try {
      const cookieStore = cookies()
      const supaSSR = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            get(name: string) {
              return cookieStore.get(name)?.value
            },
            set() {},
            remove() {},
          },
        }
      )
      const { data: { user } } = await supaSSR.auth.getUser()
      userId = user?.id || null
    } catch {}
    if (!userId && body?.user_id) userId = String(body.user_id)

    // Enforce auth if your schema requires user_id NOT NULL
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required: user_id is required to place an order' }, { status: 401 })
    }

    const payload = body || {}

    const orderId = typeof payload?.orderId === 'string' && payload.orderId.trim().length > 0
      ? payload.orderId
      : `ORD${Date.now()}`

    // Derive slot IDs and times
    const pickTimes = parseSlotLabelToTimes(payload?.pickup?.label)
    const delvTimes = parseSlotLabelToTimes(payload?.delivery?.label)

    const insertPayload: any = {
      id: orderId,
      user_id: userId,
      total_amount: Number(payload.total ?? 0),
      order_status: payload.order_status || "confirmed",
      status: body?.status || payload.order_status || "confirmed",
      pickup_date: payload?.pickup?.date || null,
      delivery_date: payload?.delivery?.date || null,
      payment_method: payload?.paymentMethod || "cod",
      payment_status: payload?.paymentMethod === "cod" ? "pending" : "paid",
      payment_id: payload?.payment_id || null,
      delivery_address: payload?.delivery_address || null,
      address_details: payload?.address_details || null,
      applied_coupon_code: payload?.applied_coupon_code || null,
      discount_amount: Number(payload?.discount ?? 0),
      delivery_type: payload?.serviceType || 'standard',

      // Slot IDs (store only if they look like UUIDs to avoid type conflicts)
      pickup_slot_id: isUUID(payload?.pickup?.slotId) ? String(payload.pickup.slotId) : null,
      delivery_slot_id: isUUID(payload?.delivery?.slotId) ? String(payload.delivery.slotId) : null,

      // Human-readable labels
      pickup_slot_display_time: payload?.pickup?.label || null,
      delivery_slot_display_time: payload?.delivery?.label || null,

      // Start/End times derived from labels
      pickup_slot_start_time: pickTimes.start,
      pickup_slot_end_time: pickTimes.end,
      delivery_slot_start_time: delvTimes.start,
      delivery_slot_end_time: delvTimes.end,
    }

    const { error } = await service.from("orders").insert(insertPayload)
    if (error) {
      console.error("[orders:insert:error]", error)
      return NextResponse.json({ error: error.message || "Failed to create order" }, { status: 500 })
    }

    return NextResponse.json({ id: orderId })
  } catch (e: any) {
    console.error("[orders:error]", e?.message)
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }
}

