import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { parseLabelToMinutes } from "@/lib/slots"

function hhmmToMin(hhmm?: string | null) {
  if (!hhmm) return null
  const m = String(hhmm).match(/^(\d{2}):(\d{2})/)
  if (!m) return null
  const h = parseInt(m[1], 10)
  const min = parseInt(m[2], 10)
  return h * 60 + min
}

function istDateTimeToUTC(dateISO: string, minOfDay: number) {
  // midnight IST for dateISO is previous day 18:30 UTC
  const baseUTC = Date.parse(`${dateISO}T00:00:00Z`)
  const istMidnightUTC = baseUTC - 330 * 60 * 1000
  return istMidnightUTC + minOfDay * 60 * 1000
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null as any)
  const orderId = body?.order_id as string | undefined
  if (!orderId || typeof orderId !== 'string') {
    return NextResponse.json({ error: 'Invalid order_id' }, { status: 400 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !serviceKey || !anon) {
    return NextResponse.json({ error: 'Server configuration missing' }, { status: 500 })
  }

  // Resolve current user from cookies via SSR client
  const cookieStore = cookies()
  const ssr = createServerClient(url, anon, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value
      },
      set() {},
      remove() {},
    },
  })
  const { data: { user } } = await ssr.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const service = createClient(url, serviceKey)

  // Load order for this user
  const { data: order, error } = await service
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message || 'Failed to load order' }, { status: 500 })
  }
  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }
  if (order.user_id && order.user_id !== user.id) {
    return NextResponse.json({ error: 'You do not have permission to cancel this order' }, { status: 403 })
  }

  // Determine pickup start time in minutes
  const fromLabel = parseLabelToMinutes(order.pickup_slot_display_time || '')
  const startMin = fromLabel?.startMin ?? hhmmToMin(order.pickup_slot_start_time) ?? null
  const pickupDate: string | null = order.pickup_date || null
  const serviceType: string = order.delivery_type || order.service_type || 'standard'

  if (!pickupDate || startMin == null) {
    return NextResponse.json({ error: 'Unable to determine pickup schedule for cancellation' }, { status: 400 })
  }

  const pickupStartUTC = istDateTimeToUTC(pickupDate, startMin)
  const cancellableUntilUTC = serviceType === 'express' ? pickupStartUTC : (pickupStartUTC - 60 * 60 * 1000)

  const now = Date.now()
  if (now > cancellableUntilUTC) {
    return NextResponse.json({ error: 'Cancellation window has passed' }, { status: 400 })
  }

  // Update status to Cancelled
  const { error: upErr } = await service
    .from('orders')
    .update({ order_status: 'Cancelled', status: 'Cancelled' })
    .eq('id', orderId)
    .eq('user_id', user.id)

  if (upErr) {
    return NextResponse.json({ error: upErr.message || 'Failed to cancel order' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

