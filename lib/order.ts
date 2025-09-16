export type AddressDetailsPayload = {
  line1?: string
  line2?: string
  city?: string
  state?: string
  postal_code?: string
  country?: string
  lat?: number
  lng?: number
  place_id?: string
}

// Non-destructively merge the selected address (from localStorage) into a payload
export function mergeSelectedAddressIntoPayload<T extends Record<string, any>>(payload: T): T & {
  delivery_address?: string
  address_details?: AddressDetailsPayload
} {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem("selectedAddress") : null
    if (!raw) return payload
    const addr = JSON.parse(raw)

    const address_details: AddressDetailsPayload = {
      line1: addr?.line1 || undefined,
      line2: addr?.line2 || undefined,
      city: addr?.city || undefined,
      state: addr?.state || undefined,
      postal_code: addr?.postalCode || undefined,
      country: addr?.country || undefined,
      lat: typeof addr?.lat === "number" ? addr.lat : undefined,
      lng: typeof addr?.lng === "number" ? addr.lng : undefined,
      place_id: addr?.placeId || undefined,
    }

    return {
      ...payload,
      delivery_address: addr?.fullAddress || payload.delivery_address,
      address_details: {
        ...(payload as any).address_details,
        ...address_details,
      },
    }
  } catch {
    return payload
  }
}
// ------- ADD THESE HELPERS AT THE BOTTOM -------

export function normalizeOrderStatus(s?: string | null) {
  const t = (s || "").toLowerCase().trim();
  // kuch common synonyms map
  const map: Record<string, string> = {
    pending: "pending",
    placed: "pending",
    confirmed: "confirmed",
    processing: "processing",
    picked_up: "picked_up",
    shipped: "shipped",
    out_for_delivery: "out_for_delivery",
    delivered: "delivered",
    completed: "delivered",
    cancelled: "cancelled",
    canceled: "cancelled",
    failed: "failed",
    refunded: "refunded",
  };
  return map[t] || t;
}

export function isOrderCancellable(status?: string | null) {
  const s = normalizeOrderStatus(status);
  // yahan wahi states allow rakhein jahan cancel hona chahiye
  return s === "pending" || s === "processing" || s === "confirmed";
}

