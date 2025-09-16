// Slot utilities shared between client and server
// Timezone helpers and business rules for pickup/delivery flows

export type ServiceType = "standard" | "express"
export type Kind = "pickup" | "delivery"

export type BaseSlot = {
  id: string
  label: string
  startMin: number // minutes after midnight
  endMin: number
}

export type MatrixRule = {
  service_type: ServiceType
  min_days_from_pickup?: number
  min_gap_hours?: number
  // Optional mapping of weekday index (0..6 or 1..7 with 7=Sun, or "sun".."sat")
  allowed_slots_by_day?: Record<string, (string | number)[]>
}

// Global
export const TIMEZONE_ID = "Asia/Kolkata"
export const SAME_DAY_PICKUP_BUFFER_MINUTES = 30
export const MIN_GAP_DAYS: Record<ServiceType, number> = { standard: 1, express: 0 }
export const EXCLUDED_ORDER_STATUSES = ["canceled", "cancelled", "refunded", "failed", "rejected", "expired"]

/**
 * Return a Date shifted to IST (UTC+5:30).
 * IMPORTANT: Call .getHours()/.getMinutes() on this Date to read IST wall-clock time.
 * Works correctly even if the system is already in IST (no double shift).
 */
export function getISTNow(): Date {
  const local = new Date()
  // Correct conversion: IST = local + (localOffset + 330) minutes
  //  - localOffset = getTimezoneOffset() (e.g. IST => -330, UTC => 0)
  const minutesToAdd = local.getTimezoneOffset() + 330
  return new Date(local.getTime() + minutesToAdd * 60 * 1000)
}

/** Format a Date to YYYY-MM-DD using UTC getters */
export function formatISODate(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, "0")
  const day = String(d.getUTCDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export function addDaysISO(dateISO: string, days: number): string {
  const d = new Date(dateISO + "T00:00:00Z")
  d.setUTCDate(d.getUTCDate() + days)
  return formatISODate(d)
}

/** Next 7 dates for the selector (IST) */
export function getSevenDates() {
  const nowIST = getISTNow()
  const start = new Date(Date.UTC(nowIST.getUTCFullYear(), nowIST.getUTCMonth(), nowIST.getUTCDate()))
  const days: { date: string; day: string; dayNum: string; month: string }[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(start)
    d.setUTCDate(start.getUTCDate() + i)
    const date = formatISODate(d)
    const day = d.toLocaleDateString("en-US", { weekday: "short" })
    const dayNum = String(d.getUTCDate())
    const month = d.toLocaleDateString("en-US", { month: "short" })
    days.push({ date, day, dayNum, month })
  }
  return days
}

/** Current minutes-of-day in IST */
export function minutesNowIST(): number {
  const n = getISTNow()
  return n.getHours() * 60 + n.getMinutes()
}

/** Whether a slot is past for a given IST "now" snapshot */
export function isPastSlot({
  date,
  startMin,
  endMin,
  now,
}: {
  date: string
  startMin: number
  endMin: number
  now?: { dateISO: string; minOfDay: number }
}) {
  const nowISTMin = now?.minOfDay ?? minutesNowIST()
  const todayISO = now?.dateISO ?? formatISODate(getISTNow())
  if (date === todayISO) {
    return endMin <= nowISTMin + SAME_DAY_PICKUP_BUFFER_MINUTES
  }
  return false
}

// ---------- THE IMPORTANT PART: time-of-day aware earliest delivery ----------
/**
 * Generic earliest delivery computation used for Express (and as fallback).
 *
 * Rule:
 *  - If min_days_from_pickup === 0  → earliest = pickup_end + 2h (same day; can roll over if > 24h)
 *  - If min_days_from_pickup  >= 1  → earliest is on (pickupDate + minDays) AT time = max(0, pickup_end - 12h)
 *    Examples:
 *     - pickup 14:00-16:00 → earliest same-day 18:00 (2h buffer)
 *     - pickup 20:00-22:00 with minDays=1 → next day 10:00 (not 08:00)
 *     - pickup 18:00-20:00 with minDays=1 → next day 08:00
 */
export function computeDeliveryEarliest({
  pickupDate,
  pickupEndMin,
  serviceType,
  matrix,
}: {
  pickupDate: string
  pickupEndMin: number
  serviceType: ServiceType
  matrix?: MatrixRule | null
}): { earliestDate: string; minStartMin: number } {
  const minDays =
    typeof matrix?.min_days_from_pickup === "number"
      ? matrix!.min_days_from_pickup!
      : MIN_GAP_DAYS[serviceType]

  if (minDays === 0) {
    // same-day with a strict 2h buffer
    const minutes = pickupEndMin + 120
    const carry = Math.floor(minutes / 1440)
    const minStartMin = minutes % 1440
    const earliestDate = addDaysISO(pickupDate, carry)
    return { earliestDate, minStartMin }
  }

  // next-day-or-more with a 12h "morning deferral"
  const earliestDate = addDaysISO(pickupDate, minDays)
  const minStartMin = Math.max(0, pickupEndMin - 720) // 720 = 12h
  return { earliestDate, minStartMin }
}

/**
 * Date-only helper (used by UI before a pickup slot is chosen).
 * For STANDARD we still return +1 day by default; once the user selects a pickup slot,
 * the frontend allows same-day and the server enforces the exact "skip-one-slot" timing.
 */
export function earliestDeliveryDateISO({
  pickupDate,
  serviceType,
  matrix,
}: {
  pickupDate: string
  serviceType: ServiceType
  matrix?: MatrixRule | null
}): string {
  const minDays =
    typeof matrix?.min_days_from_pickup === "number"
      ? matrix!.min_days_from_pickup!
      : MIN_GAP_DAYS[serviceType]
  return addDaysISO(pickupDate, minDays)
}

/** Parse labels like "08:00 AM - 10:00 AM" to minutes */
export function parseLabelToMinutes(label: string): { startMin: number; endMin: number } | null {
  const clean = label.replace(/\s/g, "")
  const m = clean.match(/(\d{1,2}):?(\d{2})?(AM|PM)?-(\d{1,2}):?(\d{2})?(AM|PM)?/i)
  if (!m) return null
  const toMin = (h: number, min: number, ap?: string) => {
    let hh = h
    if (ap) {
      const up = ap.toUpperCase()
      if (up === "AM") hh = hh === 12 ? 0 : hh
      else if (up === "PM") hh = hh === 12 ? 12 : hh + 12
    }
    return hh * 60 + min
  }
  const sH = parseInt(m[1], 10), sM = parseInt(m[2] || "0", 10), sAP = m[3]
  const eH = parseInt(m[4], 10), eM = parseInt(m[5] || "0", 10), eAP = m[6]
  return { startMin: toMin(sH, sM, sAP), endMin: toMin(eH, eM, eAP) }
}

/** Default 7 pickup/delivery slots (08–22 in 2h windows) */
export function defaultBaseSlots(): BaseSlot[] {
  const labels = [
    "08:00 AM - 10:00 AM",
    "10:00 AM - 12:00 PM",
    "12:00 PM - 02:00 PM",
    "02:00 PM - 04:00 PM",
    "04:00 PM - 06:00 PM",
    "06:00 PM - 08:00 PM",
    "08:00 PM - 10:00 PM",
  ]
  return labels.map((label, idx) => {
    const mm = parseLabelToMinutes(label)!
    return { id: String(idx + 1), label, startMin: mm.startMin, endMin: mm.endMin }
  })
}
