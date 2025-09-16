"use client"

import type React from "react"
import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Navbar from "@/components/Navbar"
import Footer from "@/components/Footer"
import { ArrowLeft, User, Phone, Home, Briefcase, MapPinIcon } from "lucide-react"
import AddressAutocomplete, { StructuredAddress } from "@/components/address/AddressAutocomplete"
import { supabase } from "@/lib/supabase"
import { ensureGoogleMapsLoaded } from "@/lib/googleMaps"

type AddressType = "home" | "work" | "other"

type Form = {
  fullName: string
  phone: string
  addressLine1: string
  addressLine2: string
  landmark: string
  pincode: string
  city: string
  state: string
  country: string
  type: AddressType
  isDefault: boolean
  lat?: number
  lng?: number
}

const addressTypeOptions = [
  { value: "home", label: "Home", icon: Home },
  { value: "work", label: "Work", icon: Briefcase },
  { value: "other", label: "Other", icon: MapPinIcon },
] as const

// UI -> DB value mapping as per check constraint
const mapTypeToDB = (t: AddressType) => (t === "home" ? "Home" : t === "work" ? "Office" : "Other")

export default function AddAddressPage() {
  const router = useRouter()
  const search = useSearchParams()

  // Prefill: query → pendingAddress → selectedAddress
  const prefill = useMemo(() => {
    const qp = (k: string) => (search.get(k) || "").trim()
    const fromQuery: Partial<Form> = {
      addressLine1: qp("line1") || decodeURIComponent(qp("fullAddress") || qp("address") || ""),
      addressLine2: qp("line2"),
      city: qp("city"),
      state: qp("state"),
      pincode: qp("postalCode"),
      country: qp("country") || "India",
      lat: +(qp("lat") || "0") || undefined,
      lng: +(qp("lng") || "0") || undefined,
    }
    const hasQuery = Object.values(fromQuery).some(Boolean)
    if (hasQuery) return fromQuery

    try {
      const pending = localStorage.getItem("pendingAddress")
      if (pending) {
        const pa = JSON.parse(pending)
        return {
          addressLine1: pa.line1 || pa.fullAddress || "",
          addressLine2: pa.line2 || "",
          city: pa.city || "",
          state: pa.state || "",
          pincode: pa.postalCode || "",
          country: pa.country || "India",
          lat: pa.lat,
          lng: pa.lng,
        }
      }
    } catch {}
    try {
      const saved = localStorage.getItem("selectedAddress")
      if (saved) {
        const sa = JSON.parse(saved)
        return {
          addressLine1: sa.line1 || sa.fullAddress || "",
          addressLine2: sa.line2 || "",
          city: sa.city || "",
          state: sa.state || "",
          pincode: sa.postalCode || "",
          country: sa.country || "India",
          lat: sa.lat,
          lng: sa.lng,
        }
      }
    } catch {}
    return {}
  }, [search])

  const [form, setForm] = useState<Form>({
    fullName: "",
    phone: "",
    addressLine1: prefill.addressLine1 || "",
    addressLine2: prefill.addressLine2 || "",
    landmark: "",
    pincode: prefill.pincode || "",
    city: prefill.city || "",
    state: prefill.state || "",
    country: prefill.country || "India",
    type: "home",
    isDefault: true,
    lat: prefill.lat,
    lng: prefill.lng,
  })

  const [selectedAddr, setSelectedAddr] = useState<StructuredAddress | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reverse geocode if we only have lat/lng
  useEffect(() => {
    const needsRG =
      form.lat && form.lng && (!form.addressLine1 || !form.city || !form.state || !form.pincode)
    if (!needsRG) return

    ;(async () => {
      try {
        await ensureGoogleMapsLoaded()
        const geocoder = new (window as any).google.maps.Geocoder()
        geocoder.geocode({ location: { lat: form.lat, lng: form.lng } }, (results: any, status: string) => {
          if (status === "OK" && results?.length) {
            const parsed = parseGeocode(results[0])
            setForm((prev) => ({
              ...prev,
              addressLine1: prev.addressLine1 || parsed.line1 || parsed.fullAddress || "",
              addressLine2: prev.addressLine2 || parsed.line2 || "",
              city: prev.city || parsed.city || "",
              state: prev.state || parsed.state || "",
              pincode: prev.pincode || parsed.postalCode || "",
              country: prev.country || parsed.country || "India",
            }))
            setSelectedAddr(parsed)
          }
        })
      } catch {}
    })()
  }, [form.lat, form.lng])

  // Autocomplete → fill form
  const onAutocomplete = (addr: StructuredAddress) => {
    setSelectedAddr(addr)
    setForm((prev) => ({
      ...prev,
      addressLine1: addr.line1 || addr.fullAddress || prev.addressLine1,
      addressLine2: addr.line2 || prev.addressLine2,
      city: addr.city || prev.city,
      state: addr.state || prev.state,
      pincode: addr.postalCode || prev.pincode,
      country: addr.country || prev.country || "India",
      lat: addr.lat ?? prev.lat,
      lng: addr.lng ?? prev.lng,
    }))
  }

  // Inputs
  const onChange =
    (name: keyof Form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const v = e.currentTarget.value
      setForm((prev) => ({
        ...prev,
        [name]:
          name === "phone"
            ? v.replace(/[^\d]/g, "").slice(0, 10)
            : name === "pincode"
            ? v.replace(/[^\d]/g, "").slice(0, 6)
            : v,
      }))
    }

  const validate = () => {
    if (!form.fullName.trim()) return "Please enter your full name"
    if (!/^\d{10}$/.test(form.phone)) return "Please enter a valid 10-digit phone number"
    if (!form.addressLine1.trim()) return "Please enter Address Line 1"
    if (!form.city.trim()) return "Please enter City"
    if (!form.state.trim()) return "Please enter State"
    if (!/^\d{6}$/.test(form.pincode)) return "Please enter a valid 6-digit PIN code"
    return null
  }

  // Local AddressBook helper so UI shows instantly
  function upsertLocalAddressBook(structured: StructuredAddress & { id?: string }) {
    const entry = {
      id: structured.id || `${Date.now()}`,
      name: form.fullName.trim() || "Saved Address",
      type: form.type,
      phone: form.phone.trim(),
      isDefault: form.isDefault,
      structured,
    }
    let list: any[] = []
    try { list = JSON.parse(localStorage.getItem("addressBook") || "[]") } catch {}
    if (entry.isDefault) list = list.map((x) => ({ ...x, isDefault: false }))
    // remove duplicates with same id
    list = list.filter((x) => x.id !== entry.id)
    list.unshift(entry)
    localStorage.setItem("addressBook", JSON.stringify(list))
  }

  // Save to Supabase per YOUR schema
  async function saveToSupabase(): Promise<string | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.id) return null

      // ensure only one default per user (unique partial index)
      if (form.isDefault) {
        await supabase
          .from("user_addresses")
          .update({ is_default: false })
          .eq("user_id", user.id)
          .eq("is_default", true)
      }

      const payload = {
        user_id: user.id,
        recipient_name: form.fullName.trim(),
        phone_number: form.phone.trim(),
        address_line_1: form.addressLine1.trim(),
        address_line_2: form.addressLine2.trim() || null,
        landmark: form.landmark.trim() || null,
        pincode: form.pincode.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        address_type: mapTypeToDB(form.type), // "Home" | "Office" | "Other"
        is_default: form.isDefault,
        latitude: form.lat ?? null,
        longitude: form.lng ?? null,
      }

      const res = await supabase
        .from("user_addresses")
        .insert(payload)
        .select("id")
        .maybeSingle()

      if (res.error) {
        // console.error("insert error", res.error)
        return null
      }
      return res.data?.id ?? null
    } catch {
      return null
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const v = validate()
    if (v) { setError(v); return }

    setIsLoading(true)
    try {
      const fullAddress = [
        form.addressLine1, form.addressLine2, form.city, form.state, form.pincode, form.country || "India"
      ].filter(Boolean).join(", ")

      const structured: StructuredAddress = {
        fullAddress,
        line1: form.addressLine1,
        line2: form.addressLine2 || undefined,
        city: form.city,
        state: form.state,
        postalCode: form.pincode,
        country: form.country || "India",
        lat: form.lat,
        lng: form.lng,
        placeId: selectedAddr?.placeId,
      }

      // Save to DB first (so we can keep the id)
      const dbId = await saveToSupabase()

      // Persist locally for instant UX
      const withId = dbId ? { ...structured, id: dbId } : structured
      try {
        localStorage.setItem("selectedAddress", JSON.stringify(withId))
        upsertLocalAddressBook(withId)
        localStorage.removeItem("pendingAddress")
      } catch {}

      router.replace("/address-book")
    } catch {
      setError("Could not save the address. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar cartCount={0} />
      <main className="container mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 lg:py-8">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-6 lg:mb-8">
            <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-full focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2">
              <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6 text-gray-600" />
            </button>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">Add Address</h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
            {/* Contact */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
              <h3 className="font-semibold text-gray-900 text-sm sm:text-base mb-3 sm:mb-4">Contact Information</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                  <input value={form.fullName} onChange={onChange("fullName")} placeholder="Full Name" className="w-full pl-9 pr-3 py-3 sm:py-3.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm" />
                </div>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                  <input value={form.phone} onChange={onChange("phone")} placeholder="10-digit mobile number" className="w-full pl-9 pr-3 py-3 sm:py-3.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm" />
                </div>
              </div>
            </div>

            {/* Address */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
              <h3 className="font-semibold text-gray-900 text-sm sm:text-base mb-3 sm:mb-4">Address Details</h3>

              <div className="mb-3 sm:mb-4">
                <AddressAutocomplete
                  label="Search and select address"
                  placeholder="Start typing area, society, landmark…"
                  defaultCountry="IN"
                  showMapPreview={true}
                  onSelect={onAutocomplete}
                />
              </div>

              <div className="space-y-3 sm:space-y-4">
                <textarea
                  value={form.addressLine1}
                  onChange={onChange("addressLine1")}
                  placeholder="Address Line 1 (House / Flat / Society)"
                  rows={2}
                  className="w-full px-3 py-3 sm:py-3.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm resize-none"
                />
                <input
                  value={form.addressLine2}
                  onChange={onChange("addressLine2")}
                  placeholder="Address Line 2 (Area / Sector / Locality)"
                  className="w-full px-3 py-3 sm:py-3.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <input
                    value={form.landmark}
                    onChange={onChange("landmark")}
                    placeholder="Landmark (optional)"
                    className="w-full px-3 py-3 sm:py-3.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  />
                  <input
                    value={form.pincode}
                    onChange={onChange("pincode")}
                    placeholder="PIN Code"
                    className="w-full px-3 py-3 sm:py-3.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <input
                    value={form.city}
                    onChange={onChange("city")}
                    placeholder="City"
                    className="w-full px-3 py-3 sm:py-3.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  />
                  <input
                    value={form.state}
                    onChange={onChange("state")}
                    placeholder="State"
                    className="w-full px-3 py-3 sm:py-3.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  />
                </div>
                <input
                  value={form.country}
                  onChange={onChange("country")}
                  placeholder="Country"
                  className="w-full px-3 py-3 sm:py-3.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
              </div>
            </div>

            {/* Type & default */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
              <h3 className="font-semibold text-gray-900 text-sm sm:text-base mb-3 sm:mb-4">Address Type</h3>
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                {addressTypeOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, type: opt.value }))}
                    className={`flex flex-col items-center gap-2 p-3 sm:p-4 rounded-lg border transition-all ${
                      form.type === opt.value ? "border-blue-500 bg-blue-50 text-blue-600" : "border-gray-200 hover:bg-gray-50 text-gray-700"
                    }`}
                  >
                    <opt.icon className="w-5 h-5" />
                    <span className="text-xs sm:text-sm font-medium">{opt.label}</span>
                  </button>
                ))}
              </div>
              <label className="mt-4 inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.isDefault}
                  onChange={(e) => setForm((p) => ({ ...p, isDefault: e.target.checked }))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Set as default address</span>
              </label>
            </div>

            {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{error}</div>}

            <button
              type="submit"
              disabled={isLoading}
              className={`w-full py-3 sm:py-4 rounded-lg font-semibold text-sm sm:text-base transition-all ${
                isLoading ? "bg-gray-300 text-gray-500 cursor-not-allowed" : "bg-blue-600 text-white hover:bg-blue-700 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              }`}
            >
              {isLoading ? "Saving Address…" : "Save Address"}
            </button>
          </form>
        </div>
      </main>

      <Footer />
    </div>
  )
}

// --------- Utils ----------
function parseGeocode(result: any): StructuredAddress {
  const components = result.address_components || []
  const get = (type: string) => components.find((c: any) => c.types.includes(type))
  const getLong = (t: string) => get(t)?.long_name
  const getShort = (t: string) => get(t)?.short_name

  const streetNumber = getLong("street_number")
  const route = getLong("route")
  const locality =
    getLong("locality") || getLong("administrative_area_level_2") || getLong("sublocality") || getLong("sublocality_level_1")
  const sublocality1 = getLong("sublocality") || getLong("sublocality_level_1")
  const sublocality2 = getLong("sublocality_level_2")
  const state = getLong("administrative_area_level_1")
  const postal = getLong("postal_code")
  const country = getLong("country") || getShort("country")

  const line1 = [streetNumber, route].filter(Boolean).join(" ") || result.formatted_address || ""
  const line2 = [sublocality1, sublocality2, locality].filter(Boolean).join(", ") || undefined

  const loc = result.geometry?.location
  const lat = typeof loc?.lat === "function" ? loc.lat() : undefined
  const lng = typeof loc?.lng === "function" ? loc.lng() : undefined

  return {
    fullAddress: result.formatted_address,
    line1,
    line2,
    city: locality,
    state,
    postalCode: postal,
    country,
    lat,
    lng,
    placeId: result.place_id,
  }
}
