"use client"

import React, { useEffect, useRef, useState } from "react"
import { ensureGoogleMapsLoaded } from "@/lib/googleMaps"

export type StructuredAddress = {
  fullAddress: string
  line1: string
  line2?: string
  city?: string
  state?: string
  postalCode?: string
  country?: string
  lat?: number
  lng?: number
  placeId?: string
}

type Props = {
  id?: string
  label?: string
  placeholder?: string
  defaultCountry?: string // ISO 3166-1 alpha-2; e.g., "IN"
  initialValue?: string
  onSelect?: (addr: StructuredAddress) => void
  showMapPreview?: boolean
  className?: string
}

/** Minimal type for Google Places address component */
type GAddressComponent = {
  long_name: string
  short_name: string
  types: string[]
}

export default function AddressAutocomplete({
  id = "address-autocomplete",
  label = "Search address",
  placeholder = "Start typing your address...",
  defaultCountry = "IN",
  initialValue,
  onSelect,
  showMapPreview = true,
  className,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [mapsReady, setMapsReady] = useState(false)
  const [selected, setSelected] = useState<StructuredAddress | null>(null)
  const mapRef = useRef<HTMLDivElement | null>(null)
  const mapInstance = useRef<any>(null)
  const markerInstance = useRef<any>(null)

  // Load maps (safe if already loaded elsewhere)
  useEffect(() => {
    let mounted = true
    ensureGoogleMapsLoaded()
      .then(() => {
        if (!mounted) return
        setMapsReady(true)
        // Attach autocomplete if input exists
        setupAutocomplete()
      })
      .catch(() => {
        setMapsReady(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  // Initialize value
  useEffect(() => {
    if (initialValue && inputRef.current) {
      inputRef.current.value = initialValue
    }
  }, [initialValue])

  const setupAutocomplete = () => {
    if (!inputRef.current) return

    const attach = (): boolean => {
      if (!(window as any).google?.maps?.places) return false
      const autocomplete = new (window as any).google.maps.places.Autocomplete(inputRef.current!, {
        fields: ["address_components", "formatted_address", "geometry", "place_id", "name"],
        types: ["geocode"],
        componentRestrictions: defaultCountry ? { country: defaultCountry.toLowerCase() } : undefined,
      })

      autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace()
        if (!place || !place.geometry || !place.geometry.location) {
          // Ignore selections without geometry
          return
        }

        const parsed = parsePlace(place)
        setSelected(parsed)
        if (inputRef.current) {
          inputRef.current.value = parsed.fullAddress || place.formatted_address || inputRef.current.value
        }
        // Persist latest selection for checkout
        try {
          localStorage.setItem("selectedAddress", JSON.stringify(parsed))
        } catch {}
        // Fire callback to parent
        onSelect?.(parsed)

        // Map preview
        if (showMapPreview && mapRef.current) {
          renderMap(parsed)
        }
      })
      return true
    }

    if (!attach()) {
      // Poll briefly for the Places library to be ready
      const start = Date.now()
      const timerId = window.setInterval(() => {
        if (attach() || Date.now() - start > 5000) {
          window.clearInterval(timerId)
        }
      }, 100)
    }
  }

  const renderMap = (addr: StructuredAddress) => {
    if (!addr.lat || !addr.lng || !(window as any).google?.maps || !mapRef.current) return
    const center = { lat: addr.lat, lng: addr.lng }

    if (!mapInstance.current) {
      mapInstance.current = new (window as any).google.maps.Map(mapRef.current, {
        center,
        zoom: 16,
        disableDefaultUI: true,
        zoomControl: true,
        clickableIcons: false,
        gestureHandling: "cooperative",
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      })
    } else {
      mapInstance.current.setCenter(center)
    }

    if (!markerInstance.current) {
      markerInstance.current = new (window as any).google.maps.Marker({
        position: center,
        map: mapInstance.current,
      })
    } else {
      markerInstance.current.setPosition(center)
    }
  }

  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <input
        id={id}
        ref={inputRef}
        type="text"
        aria-autocomplete="list"
        aria-controls={`${id}-list`}
        placeholder={placeholder}
        className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-sm"
      />
      {/* Map preview */}
      {showMapPreview && (
        <div
          ref={mapRef}
          aria-label="Map preview"
          className="mt-3 h-40 rounded-lg border border-gray-200"
        />
      )}
      {/* If maps failed to load, the input still works as a normal text field */}
      {!mapsReady && (
        <p className="mt-2 text-xs text-gray-500">Autocomplete unavailable. You can still type your address.</p>
      )}
    </div>
  )
}

function parsePlace(place: any): StructuredAddress {
  const components: GAddressComponent[] = Array.isArray(place.address_components)
    ? (place.address_components as GAddressComponent[])
    : []

  const get = (type: string): GAddressComponent | undefined =>
    components.find((c: GAddressComponent) => Array.isArray(c.types) && c.types.includes(type))

  const getLong = (type: string) => get(type)?.long_name
  const getShort = (type: string) => get(type)?.short_name

  const streetNumber = getLong("street_number")
  const route = getLong("route")

  // In India, locality is sometimes missing; fall back to administrative_area_level_2 or sublocality
  const locality =
    getLong("locality") ||
    getLong("administrative_area_level_2") ||
    getLong("sublocality") ||
    getLong("sublocality_level_1")

  const sublocality1 = getLong("sublocality") || getLong("sublocality_level_1")
  const sublocality2 = getLong("sublocality_level_2")

  const state = getLong("administrative_area_level_1")
  const postal = getLong("postal_code")
  const country = getLong("country") || getShort("country")

  const line1Parts = [streetNumber, route].filter(Boolean)
  const line1 = line1Parts.join(" ") || place.name || ""

  const line2Parts = [sublocality1, sublocality2, locality].filter(Boolean)
  const line2 = line2Parts.filter(Boolean).join(", ") || undefined

  const fullAddress =
    place.formatted_address || [line1, line2, locality, state, postal, country].filter(Boolean).join(", ")

  const lat = typeof place.geometry?.location?.lat === "function" ? place.geometry.location.lat() : undefined
  const lng = typeof place.geometry?.location?.lng === "function" ? place.geometry.location.lng() : undefined

  return {
    fullAddress,
    line1,
    line2,
    city: locality,
    state,
    postalCode: postal,
    country,
    lat: typeof lat === "number" ? lat : undefined,
    lng: typeof lng === "number" ? lng : undefined,
    placeId: place.place_id,
  }
}
