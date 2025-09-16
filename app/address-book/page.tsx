"use client"

import React, { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Navbar from "@/components/Navbar"
import Footer from "@/components/Footer"
import { ArrowLeft, Plus, Home, Briefcase, MapPinIcon, Edit, Trash2, CheckCircle2, Check } from "lucide-react"
import { supabase } from "@/lib/supabase"

type DBRow = {
  id: string
  recipient_name: string
  phone_number: string
  address_line_1: string
  address_line_2: string | null
  landmark: string | null
  pincode: string
  city: string
  state: string
  address_type: "Home" | "Office" | "Other"
  is_default: boolean
  latitude: number | null
  longitude: number | null
}

type AddressCard = {
  id: string
  type: "home" | "work" | "other"
  isDefault: boolean
  line1: string
  line2?: string
  landmark?: string
  city: string
  state: string
  pincode: string
  lat?: number
  lng?: number
}

const typeIcon = (t: AddressCard["type"]) =>
  t === "home" ? (
    <Home className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
  ) : t === "work" ? (
    <Briefcase className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
  ) : (
    <MapPinIcon className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600" />
  )

const fullPreview = (a: AddressCard) =>
  [a.line1, a.line2, a.landmark, `${a.city}, ${a.state} ${a.pincode}`].filter(Boolean).join(", ")

export default function AddressBookPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<AddressCard[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // hydrate selected badge from localStorage
  useEffect(() => {
    try {
      const sel = localStorage.getItem("selectedAddress")
      if (sel) {
        const s = JSON.parse(sel)
        if (s?.id) setSelectedId(String(s.id))
      }
    } catch {}
  }, [])

  // fetch from Supabase (fallback to local if empty)
  useEffect(() => {
    let ignore = false
    ;(async () => {
      setLoading(true)
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user?.id) {
          const q = await supabase
            .from("user_addresses")
            .select(
              "id, address_line_1, address_line_2, landmark, pincode, city, state, address_type, is_default, latitude, longitude"
            )
            .eq("user_id", user.id)
            .order("is_default", { ascending: false })
            .order("created_at", { ascending: false })

          if (!ignore && !q.error && q.data) {
            const mapped: AddressCard[] = (q.data as DBRow[]).map((r) => ({
              id: r.id,
              type: r.address_type === "Home" ? "home" : r.address_type === "Office" ? "work" : "other",
              isDefault: r.is_default,
              line1: r.address_line_1,
              line2: r.address_line_2 || undefined,
              landmark: r.landmark || undefined,
              city: r.city,
              state: r.state,
              pincode: r.pincode,
              lat: r.latitude ?? undefined,
              lng: r.longitude ?? undefined,
            }))
            setRows(mapped)
          }
        }
      } catch {}
      // local fallback
      if (!ignore) {
        if (rows.length === 0) {
          try {
            const local = JSON.parse(localStorage.getItem("addressBook") || "[]")
            if (Array.isArray(local) && local.length) {
              const mapped: AddressCard[] = local.map((x: any) => ({
                id: x.id,
                type: (x.type || "home") as AddressCard["type"],
                isDefault: !!x.isDefault,
                line1: x.structured?.line1 || x.structured?.fullAddress || "",
                line2: x.structured?.line2 || undefined,
                city: x.structured?.city || "",
                state: x.structured?.state || "",
                pincode: x.structured?.postalCode || "",
                lat: x.structured?.lat,
                lng: x.structured?.lng,
              }))
              setRows(mapped)
            } else {
              const sel = localStorage.getItem("selectedAddress")
              if (sel) {
                const a = JSON.parse(sel)
                setRows([
                  {
                    id: a.id || "local-1",
                    type: "home",
                    isDefault: true,
                    line1: a.line1 || a.fullAddress || "",
                    line2: a.line2 || undefined,
                    city: a.city || "",
                    state: a.state || "",
                    pincode: a.postalCode || "",
                    lat: a.lat,
                    lng: a.lng,
                  },
                ])
              }
            }
          } catch {}
        }
        setLoading(false)
      }
    })()
    return () => {
      ignore = true
    }
  }, [])

  const selectAddress = (a: AddressCard) => {
    const structured = {
      id: a.id,
      fullAddress: fullPreview(a),
      line1: a.line1,
      line2: a.line2,
      city: a.city,
      state: a.state,
      postalCode: a.pincode,
      country: "India",
      lat: a.lat,
      lng: a.lng,
    }
    try {
      localStorage.setItem("selectedAddress", JSON.stringify(structured))
      setSelectedId(a.id)
    } catch {}
    router.back()
  }

  const setDefault = async (id: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.id) return
      await supabase.from("user_addresses").update({ is_default: false }).eq("user_id", user.id).eq("is_default", true)
      await supabase.from("user_addresses").update({ is_default: true }).eq("id", id)
      setRows((prev) => prev.map((x) => ({ ...x, isDefault: x.id === id })))
    } catch {}
  }

  const remove = async (id: string) => {
    try { await supabase.from("user_addresses").delete().eq("id", id) } catch {}
    setRows((p) => p.filter((x) => x.id !== id))
    try {
      const list = JSON.parse(localStorage.getItem("addressBook") || "[]").filter((x: any) => x.id !== id)
      localStorage.setItem("addressBook", JSON.stringify(list))
    } catch {}
    if (selectedId === id) setSelectedId(null)
  }

  const edit = (a: AddressCard) => {
    const q = new URLSearchParams({
      edit: a.id,
      line1: a.line1 || "",
      line2: a.line2 || "",
      city: a.city || "",
      state: a.state || "",
      postalCode: a.pincode || "",
      lat: a.lat ? String(a.lat) : "",
      lng: a.lng ? String(a.lng) : "",
    })
    router.push(`/add-address?${q.toString()}`)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar cartCount={0} />
      <main className="container mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 lg:py-8">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-4 sm:mb-6 lg:mb-8">
            <div className="flex items-center gap-3 sm:gap-4">
              <button
                onClick={() => router.back()}
                className="p-2 hover:bg-gray-100 rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              >
                <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6 text-gray-600" />
              </button>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">Select Your Location</h1>
            </div>
            <button
              onClick={() => router.push("/map-picker")}
              className="bg-blue-600 text-white p-2 sm:p-3 rounded-full hover:bg-blue-700 transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              title="Add new address"
            >
              <Plus className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          </div>

          {/* Saved Addresses */}
          {!loading && rows.length === 0 && (
            <div className="bg-white border border-gray-100 rounded-xl p-6 text-center">
              <MapPinIcon className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="font-semibold text-gray-800">No saved address</p>
              <p className="text-gray-500 text-sm mt-1">Add one to speed up checkout.</p>
              <button
                onClick={() => router.push("/map-picker")}
                className="mt-4 bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 transition"
              >
                Add New Address
              </button>
            </div>
          )}

          <div className="space-y-3 sm:space-y-4">
            {rows.map((a) => {
              const isSelected = selectedId && selectedId === a.id
              return (
                <div
                  key={a.id}
                  className={`bg-white rounded-xl shadow-sm border p-4 sm:p-5 transition-all duration-200 ${
                    isSelected ? "border-emerald-400 ring-1 ring-emerald-200" : "border-gray-100 hover:shadow-md"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    {/* Clickable body */}
                    <button
                      onClick={() => selectAddress(a)}
                      className="text-left flex-1"
                    >
                      <div className="flex items-center gap-2 sm:gap-3">
                        {typeIcon(a.type)}
                        <h3 className="font-semibold text-gray-900 text-sm sm:text-base">
                          {a.type === "home" ? "Home" : a.type === "work" ? "Work" : "Other"}
                        </h3>
                        {isSelected && (
                          <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-[11px] sm:text-xs px-2 py-0.5 rounded-full font-medium">
                            <Check className="w-3 h-3" /> SELECTED
                          </span>
                        )}
                        {a.isDefault && (
                          <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 text-[11px] sm:text-xs px-2 py-0.5 rounded-full font-medium">
                            <CheckCircle2 className="w-3 h-3" /> Default
                          </span>
                        )}
                      </div>
                      {/* Only address preview (no name/phone) */}
                      <p className="ml-7 text-xs sm:text-sm text-gray-600 mt-1 line-clamp-2">
                        {fullPreview(a)}
                      </p>
                    </button>

                    {/* Actions */}
                    <div className="flex items-center gap-1 sm:gap-2 ml-3">
                      {!a.isDefault && (
                        <button
                          onClick={() => setDefault(a.id)}
                          className="px-2 py-1 text-xs sm:text-sm rounded-md border hover:bg-gray-50"
                          title="Set as default"
                        >
                          Set Default
                        </button>
                      )}
                      <button
                        onClick={() => edit(a)}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => remove(a.id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Add button */}
          <button
            onClick={() => router.push("/map-picker")}
            className="w-full mt-4 sm:mt-6 bg-gray-100 text-gray-700 py-3 sm:py-4 rounded-xl hover:bg-gray-200 transition-all font-medium text-sm sm:text-base flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
          >
            <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
            Add New Address
          </button>
        </div>
      </main>
      <Footer />
    </div>
  )
}
