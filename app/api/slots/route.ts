import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import {
  defaultBaseSlots,
  getISTNow,
  formatISODate,
  earliestDeliveryDateISO,
  computeDeliveryEarliest,
  SAME_DAY_PICKUP_BUFFER_MINUTES,
  EXCLUDED_ORDER_STATUSES,
  MatrixRule,
} from "@/lib/slots"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function toInt(x: any, def = 0) {
  const n = typeof x === "number" ? x : parseInt(String(x ?? ""), 10)
  return Number.isFinite(n) ? n : def
}

function minToHHmm(min: number) {
  const h = Math.floor(min / 60), m = min % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

/** weekday keys: 0..6 (Sun=0) and ISO 1..7 (Sun=7) */
function weekdayCandidates(dateISO: string) {
  const w0 = new Date(dateISO + "T00:00:00Z").getUTCDay()
  const iso = w0 === 0 ? 7 : w0
  return [w0, iso]
}

/** map DB rows -> normalized */
function mapRows(rows: any[]) {
  const toMin = (t?: string | null) => {
    if (!t) return 0
    const [h, m] = String(t).split(":").map((x) => parseInt(x, 10))
    return (h || 0) * 60 + (m || 0)
  }

  return rows
    .map((row: any, idx: number) => {
      const startMin = toMin(row.start_time)
      const endMin = toMin(row.end_time)
      if (!startMin || !endMin) return null

      const label = row.display_time || `${row.start_time || ""}-${row.end_time || ""}` || `Slot ${idx + 1}`
      const fallbackCapacity = toInt(row.slot_capacity ?? row.max_orders ?? row.capacity, 9999)

      return {
        id: String(row.id ?? idx + 1),
        label,
        startMin,
        endMin,
        is_active: row.is_active !== false,
        fallbackCapacity,
      }
    })
    .filter(Boolean) as Array<{ id: string; label: string; startMin: number; endMin: number; is_active: boolean; fallbackCapacity: number }>
}

async function querySlots(table: string, candidates: (number | string)[]) {
  try {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .in("day_of_week", candidates as any)
      .order("start_time", { ascending: true })
    if (error || !data) return []
    return data as any[]
  } catch {
    return []
  }
}

/** Base slots:
 *  - delivery: just delivery_slots (fallback to defaults if empty)
 *  - pickup:   MERGE pickup_slots + delivery_slots by time window (start-end)
 */
async function fetchBaseSlots(kind: "pickup" | "delivery", dateISO: string) {
  const candidates = weekdayCandidates(dateISO)

  if (kind === "delivery") {
    const deliveryRows = await querySlots("delivery_slots", candidates)
    let base = mapRows(deliveryRows)
    if (!base.length) {
      base = defaultBaseSlots().map((s) => ({ id: String(s.id), label: s.label, startMin: s.startMin, endMin: s.endMin, is_active: true, fallbackCapacity: 9999 }))
    }
    return base
  }

  // pickup
  const [pickupRows, deliveryRows] = await Promise.all([
    querySlots("pickup_slots", candidates),
    querySlots("delivery_slots", candidates),
  ])

  const pickupMapped = mapRows(pickupRows)
  const deliveryMapped = mapRows(deliveryRows)

  const key = (s: { startMin: number; endMin: number }) => `${s.startMin}-${s.endMin}`
  const seen = new Set(pickupMapped.map(key))
  const merged = [...pickupMapped, ...deliveryMapped.filter((s) => !seen.has(key(s)))]

  if (!merged.length) {
    return defaultBaseSlots().map((s) => ({ id: String(s.id), label: s.label, startMin: s.startMin, endMin: s.endMin, is_active: true, fallbackCapacity: 9999 }))
  }

  merged.sort((a, b) => a.startMin - b.startMin)
  return merged
}

// DEFAULT-ALLOW serviceability
async function isServiceable(pincode?: string | null) {
  if (!pincode) return true
  try {
    const { data, error } = await supabase
      .from("service_areas")
      .select("pincode,is_active")
      .eq("pincode", pincode)
      .maybeSingle()
    if (error) return true
    if (!data) return true
    return !!data.is_active
  } catch {
    return true
  }
}

async function getCapacityBySlotId(dateISO: string) {
  const weekday = new Date(dateISO + "T00:00:00Z").getUTCDay()
  const capacity: Record<string, number> = {}
  try {
    const { data } = await supabase.from("slot_capacity").select("*").eq("weekday", weekday)
    data?.forEach((r: any) => {
      capacity[String(r.slot_id)] = toInt(r.capacity, 9999)
    })
  } catch {}
  return capacity
}

async function getBookedCounts({ dateISO, kind }: { dateISO: string; kind: "pickup" | "delivery" }) {
  const map: Record<string, number> = {}
  try {
    const isPickup = kind === "pickup"
    const colDate = isPickup ? "pickup_date" : "delivery_date"

    const { data, error } = await supabase
      .from("orders")
      .select("pickup_date, delivery_date, pickup_slot_id, delivery_slot_id, status")
      .eq(colDate, dateISO)

    if (!error && data) {
      for (const r of data as any[]) {
        const st = String(r.status ?? "").toLowerCase()
        if (EXCLUDED_ORDER_STATUSES.includes(st)) continue
        const key = String(isPickup ? r.pickup_slot_id : r.delivery_slot_id)
        map[key] = (map[key] ?? 0) + 1
      }
    }
  } catch {}
  return map
}

async function getMatrixRule(serviceType: "standard" | "express"): Promise<MatrixRule | null> {
  try {
    const { data } = await supabase
      .from("delivery_slot_matrix")
      .select("*")
      .eq("service_type", serviceType)
      .maybeSingle()
    if (!data) return null
    return {
      service_type: serviceType,
      min_days_from_pickup: toInt((data as any).min_days_from_pickup, undefined as any),
      min_gap_hours: toInt((data as any).min_gap_hours, undefined as any),
      allowed_slots_by_day: (data as any).allowed_slots_by_day || null,
    }
  } catch {
    return null
  }
}

/** STANDARD delivery rule: skip exactly ONE slot after pickup.
 * If overflow beyond day-end, move to next day and skip that day's first slot.
 */
async function computeStandardSkipBySlot(pickupDate: string, pickupEndMin: number) {
  const daySlots = await fetchBaseSlots("delivery", pickupDate)
  let pIdx = daySlots.findIndex((s) => s.endMin === pickupEndMin)
  if (pIdx < 0) {
    // nearest match fallback
    let best = -1, bestDiff = Number.POSITIVE_INFINITY
    daySlots.forEach((s, i) => {
      const d = Math.abs(s.endMin - pickupEndMin)
      if (d < bestDiff) { bestDiff = d; best = i }
    })
    pIdx = best
  }
  const desired = pIdx + 2 // skip-one
  if (desired < daySlots.length) {
    return { earliestDate: pickupDate, minStartMin: daySlots[desired].startMin }
  }
  // move to next day; index rolls over
  const next = new Date(pickupDate + "T00:00:00Z")
  next.setUTCDate(next.getUTCDate() + 1)
  const nextISO = formatISODate(next)
  const nextSlots = await fetchBaseSlots("delivery", nextISO)
  const idx2 = Math.min(Math.max(desired - daySlots.length, 0), Math.max(nextSlots.length - 1, 0))
  const minStartMin = nextSlots[idx2]?.startMin ?? 0
  return { earliestDate: nextISO, minStartMin }
}

/** EXPRESS delivery rule: take the very NEXT slot after pickup (no skipping).
 * If overflow beyond day-end, roll over to the next day and take its first slot.
 */
async function computeExpressNextBySlot(pickupDate: string, pickupEndMin: number) {
  const daySlots = await fetchBaseSlots("delivery", pickupDate)
  let pIdx = daySlots.findIndex((s) => s.endMin === pickupEndMin)
  if (pIdx < 0) {
    // nearest match fallback
    let best = -1, bestDiff = Number.POSITIVE_INFINITY
    daySlots.forEach((s, i) => {
      const d = Math.abs(s.endMin - pickupEndMin)
      if (d < bestDiff) { bestDiff = d; best = i }
    })
    pIdx = best
  }
  const desired = pIdx + 1 // next immediate slot
  if (desired < daySlots.length) {
    return { earliestDate: pickupDate, minStartMin: daySlots[desired].startMin }
  }
  // move to next day; choose the rolled-over index (commonly 0)
  const next = new Date(pickupDate + "T00:00:00Z")
  next.setUTCDate(next.getUTCDate() + 1)
  const nextISO = formatISODate(next)
  const nextSlots = await fetchBaseSlots("delivery", nextISO)
  const idx2 = Math.min(Math.max(desired - daySlots.length, 0), Math.max(nextSlots.length - 1, 0))
  const minStartMin = nextSlots[idx2]?.startMin ?? 0
  return { earliestDate: nextISO, minStartMin }
}

// EXPRESS helper based on current time (IST): next immediate slot from "now".
async function computeExpressNextFromNow(): Promise<{ earliestDate: string; minStartMin: number }> {
  const now = getISTNow()
  const todayISO = formatISODate(now)
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const slots = await fetchBaseSlots("delivery", todayISO)

  // Find the next slot strictly after 'now'
  let j = slots.findIndex((s) => s.startMin <= nowMin && nowMin < s.endMin)
  let desired = j >= 0 ? j + 1 : slots.findIndex((s) => s.startMin >= nowMin)

  if (desired >= 0 && desired < slots.length) {
    return { earliestDate: todayISO, minStartMin: slots[desired].startMin }
  }

  // No slot left today → roll to tomorrow, first slot
  const next = new Date(todayISO + "T00:00:00Z")
  next.setUTCDate(next.getUTCDate() + 1)
  const nextISO = formatISODate(next)
  const nextSlots = await fetchBaseSlots("delivery", nextISO)
  const first = nextSlots[0]?.startMin ?? 0
  return { earliestDate: nextISO, minStartMin: first }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { date, kind, serviceType, pincode, pickupDate, pickupEndMin } = body || {}

    if (!date || !kind || (kind === "delivery" && (!serviceType || !pickupDate))) {
      return NextResponse.json({ error: "Invalid payload. For delivery, provide serviceType and pickupDate." }, { status: 400 })
    }

    // 1) service area
    if (!(await isServiceable(pincode))) {
      return NextResponse.json({ date, kind, slots: [], earliest_date: null })
    }

    // 2) base slots
    let base = await fetchBaseSlots(kind, date)
    if (!base.length) {
      base = defaultBaseSlots().map((s) => ({ ...s, is_active: true, fallbackCapacity: 9999 })) as any
    }

    // ---- IST time fix (use local getters on IST-shifted Date) ----
    const nowIST = getISTNow()
    const today = formatISODate(nowIST)
    const nowMin = nowIST.getHours() * 60 + nowIST.getMinutes()

    const capMap = await getCapacityBySlotId(date)
    const bookedMap = await getBookedCounts({ dateISO: date, kind })

    // 3) delivery earliest + allowlist
    let earliestDate: string | null = null
    let minStartMin = 0
    let allowedForWeekday: Set<string> | null = null

    if (kind === "delivery") {
      if (serviceType === "standard" && typeof pickupEndMin === "number") {
        // STANDARD: skip one full slot after pickup
        const res = await computeStandardSkipBySlot(pickupDate, pickupEndMin)
        earliestDate = res.earliestDate
        minStartMin = res.minStartMin
        if (date < earliestDate) {
          return NextResponse.json({ date, kind, slots: [], earliest_date: earliestDate })
        }
      } else if (serviceType === "express" && typeof pickupEndMin === "number") {
        // EXPRESS: choose the earlier of (a) next after pickup, (b) next from current time
        const resPickup = await computeExpressNextBySlot(pickupDate, pickupEndMin)
        const resNow = await computeExpressNextFromNow()
        // Choose the later of the two constraints so delivery never precedes pickup.
        // Compare by date then by minStartMin.
        const useNow = resNow.earliestDate > resPickup.earliestDate ||
          (resNow.earliestDate === resPickup.earliestDate && resNow.minStartMin >= resPickup.minStartMin)
        const chosen = useNow ? resNow : resPickup
        earliestDate = chosen.earliestDate
        minStartMin = chosen.minStartMin
        if (date < earliestDate) {
          return NextResponse.json({ date, kind, slots: [], earliest_date: earliestDate })
        }
      } else {
        // Fallback when pickupEndMin is not provided.
        // Business rule: default to SAME-DAY delivery date so UI opens on pickup day;
        // precise time gating will be applied once a pickup slot is known.
        const earliest: string = String(pickupDate || date)
        earliestDate = earliest
        minStartMin = 0
        // If you still want to respect matrix min_days in this edge case, uncomment below:
        // const matrix = await getMatrixRule(serviceType)
        // const earliest = earliestDeliveryDateISO({ pickupDate, serviceType, matrix: matrix || undefined })
        // earliestDate = earliest
        // minStartMin = 0
        if (date < earliest) {
          return NextResponse.json({ date, kind, slots: [], earliest_date: earliest })
        }
      }

      // weekday allowlist support (0..6 / 1..7 / names)
      const w0 = new Date(date + "T00:00:00Z").getUTCDay()
      const k0 = String(w0)
      const k1 = String(w0 === 0 ? 7 : w0)
      const kn = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][w0]
      const matrix = await getMatrixRule(serviceType)
      const union = [
        ...(matrix?.allowed_slots_by_day?.[k0] ?? []),
        ...(matrix?.allowed_slots_by_day?.[k1] ?? []),
        ...(matrix?.allowed_slots_by_day?.[kn] ?? []),
      ].map((x: any) => String(x))
      if (union.length) allowedForWeekday = new Set(union)
    }

    // 4) build response
    // pickup: if today and inside some slot j -> j & j+1 unavailable (skip-next)
    let currentSlotIdx = -1
    if (kind === "pickup" && date === today) {
      currentSlotIdx = base.findIndex((s: any) => s.startMin <= nowMin && nowMin < s.endMin)
    }

    const slots = base
      .map((s: any, idx: number) => {
        const capacity = capMap[String(s.id)] ?? s.fallbackCapacity ?? 9999
        const booked = bookedMap[String(s.id)] || 0
        let available = s.is_active !== false && capacity - booked > 0

        if (kind === "pickup") {
          if (date === today) {
            if (currentSlotIdx >= 0) {
              // Standard: block current+next; Express: block only current.
              const skipCount = serviceType === "express" ? 0 : 1
              if (idx <= currentSlotIdx + skipCount) available = false
            } else {
              // not inside any slot -> only past ones (with buffer) blocked
              if (s.endMin <= nowMin + SAME_DAY_PICKUP_BUFFER_MINUTES) available = false
            }
          }
        } else {
          // delivery
          if (earliestDate && date === earliestDate && s.startMin < minStartMin) available = false
          if (allowedForWeekday && !allowedForWeekday.has(String(s.id))) available = false
        }

        return {
          id: String(s.id),
          display_time: s.label,
          start_time: minToHHmm(s.startMin),
          end_time: minToHHmm(s.endMin),
          is_available: available,
          remaining_capacity: Math.max(capacity - booked, 0),
        }
      })
      .sort((a: any, b: any) => (a.start_time < b.start_time ? -1 : a.start_time > b.start_time ? 1 : 0))

    return NextResponse.json({ date, kind, earliest_date: earliestDate, slots })
  } catch (e: any) {
    console.error("[slots:error]", e?.message)
    return NextResponse.json({ error: "Failed to compute slots. Please try again later." }, { status: 500 })
  }
}
