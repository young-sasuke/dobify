"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { useRouter } from "next/navigation"
import Navbar from "@/components/Navbar"
import Footer from "@/components/Footer"
import { ArrowLeft, MapPin, Navigation } from "lucide-react"
import AddressAutocomplete, { StructuredAddress } from "@/components/address/AddressAutocomplete"
import { ensureGoogleMapsLoaded } from "@/lib/googleMaps"

type NearbyPlace = {
  place_id: string
  name: string
  vicinity?: string
  formatted_address?: string
  lat: number
  lng: number
}

export default function MapPickerPage() {
  const router = useRouter()
  const mapRef = useRef<HTMLDivElement | null>(null)
  const mapInstance = useRef<any>(null)
  const markerInstance = useRef<any>(null)
  const geocoderRef = useRef<any>(null)
  const placesServiceRef = useRef<any>(null)

  const [mapsReady, setMapsReady] = useState(false)
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number; address: string } | null>(null)
  const [selectedDetails, setSelectedDetails] = useState<StructuredAddress | null>(null)
  const [nearbyPlaces, setNearbyPlaces] = useState<NearbyPlace[]>([])
  const [isSearching, setIsSearching] = useState(false)

  // Load Google Maps (+places) and init map
  useEffect(() => {
    let mounted = true
    ensureGoogleMapsLoaded()
      .then(() => {
        if (!mounted) return
        setMapsReady(true)
        geocoderRef.current = new (window as any).google.maps.Geocoder()

        const fallback = { lat: 20.2961, lng: 85.8245 } // Bhubaneswar fallback
        const initMap = (center: { lat: number; lng: number }) => {
          if (!mapRef.current) return
          mapInstance.current = new (window as any).google.maps.Map(mapRef.current, {
            center,
            zoom: 15,
            disableDefaultUI: true,
            zoomControl: true,
            clickableIcons: false,
          })

          // init marker
          markerInstance.current = new (window as any).google.maps.Marker({
            position: center,
            map: mapInstance.current,
          })

          // init places service (if available)
          try {
            if ((window as any).google?.maps?.places) {
              placesServiceRef.current = new (window as any).google.maps.places.PlacesService(mapInstance.current)
            }
          } catch {}

          // Reverse geocode initial center
          reverseGeocode(center.lat, center.lng)

          // On map click → move marker & reverse geocode
          mapInstance.current.addListener("click", (e: any) => {
            const lat = e.latLng.lat()
            const lng = e.latLng.lng()
            markerInstance.current?.setPosition({ lat, lng })
            mapInstance.current.setCenter({ lat, lng })
            reverseGeocode(lat, lng)
          })

          // Live nearby search when map idles
          mapInstance.current.addListener("idle", () => {
            const c = mapInstance.current?.getCenter?.()
            if (!c) return
            fetchNearby({ lat: c.lat(), lng: c.lng() })
          })
        }

        // Try geolocation first
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude }
              initMap(loc)
            },
            () => initMap(fallback),
            { enableHighAccuracy: true, timeout: 8000 }
          )
        } else {
          initMap(fallback)
        }
      })
      .catch(() => setMapsReady(false))

    return () => {
      mounted = false
    }
  }, [])

  // Reverse geocode to a structured address
  const reverseGeocode = (lat: number, lng: number) => {
    if (!geocoderRef.current) return
    geocoderRef.current.geocode({ location: { lat, lng } }, (results: any, status: string) => {
      if (status === "OK" && results && results.length) {
        const r = results[0]
        const parsed = parseFromAddressComponents(r)
        const full: StructuredAddress = { ...parsed, lat, lng }
        setSelectedDetails(full)
        setSelectedLocation({ lat, lng, address: parsed.fullAddress || r.formatted_address })
      } else {
        setSelectedDetails({
          fullAddress: "Selected Location",
          line1: "",
          line2: "",
          city: "",
          state: "",
          postalCode: "",
          country: "India",
          lat,
          lng,
          placeId: undefined,
        })
        setSelectedLocation({ lat, lng, address: "Selected Location" })
      }
    })
  }

  // Realtime nearby places around the map center
  const fetchNearby = ({ lat, lng }: { lat: number; lng: number }) => {
    if (!placesServiceRef.current) {
      setNearbyPlaces([])
      return
    }
    setIsSearching(true)

    const request = {
      location: new (window as any).google.maps.LatLng(lat, lng),
      radius: 1500, // 1.5 km
      type: ["point_of_interest"], // broad; you can use 'establishment'
      // or add keyword: "market|mall|laundry|apartment|society"
    }
    placesServiceRef.current.nearbySearch(request, (results: any[], status: string) => {
      setIsSearching(false)
      if (status !== (window as any).google.maps.places.PlacesServiceStatus.OK || !results) {
        setNearbyPlaces([])
        return
      }
      const mapped: NearbyPlace[] = results.slice(0, 8).map((p: any) => {
        const loc = p.geometry?.location
        return {
          place_id: p.place_id,
          name: p.name,
          vicinity: p.vicinity,
          formatted_address: p.formatted_address,
          lat: typeof loc?.lat === "function" ? loc.lat() : undefined,
          lng: typeof loc?.lng === "function" ? loc.lng() : undefined,
        } as NearbyPlace
      })
      setNearbyPlaces(mapped.filter((m) => m.lat && m.lng))
    })
  }

  // Autocomplete selection → center & set details
  const handlePlaceSelected = (addr: StructuredAddress) => {
    if (addr.lat && addr.lng) {
      const center = { lat: addr.lat, lng: addr.lng }
      mapInstance.current?.setCenter(center)
      markerInstance.current?.setPosition(center)
      setSelectedLocation({ lat: center.lat, lng: center.lng, address: addr.fullAddress || "" })
      setSelectedDetails(addr)
      // trigger nearby refresh
      fetchNearby(center)
    } else {
      setSelectedDetails(addr)
      setSelectedLocation((prev) =>
        prev
          ? { ...prev, address: addr.fullAddress || prev.address }
          : { lat: 20.2961, lng: 85.8245, address: addr.fullAddress || "Selected Location" }
      )
    }
  }

  const confirmLocation = () => {
    if (!selectedLocation) return
    const det: StructuredAddress =
      selectedDetails || {
        fullAddress: selectedLocation.address,
        line1: "",
        line2: "",
        city: "",
        state: "",
        postalCode: "",
        country: "India",
        lat: selectedLocation.lat,
        lng: selectedLocation.lng,
        placeId: undefined,
      }

    // persist for Add Address + rest of flow
    try {
      localStorage.setItem("pendingAddress", JSON.stringify(det))
      localStorage.setItem(
        "selectedAddress",
        JSON.stringify({
          id: "",
          name: det.line1 || "Address",
          phone: "",
          line1: det.line1 || "",
          line2: det.line2 || "",
          city: det.city || "",
          state: det.state || "",
          postalCode: String(det.postalCode || ""),
          country: det.country || "India",
          fullAddress: det.fullAddress || selectedLocation.address,
          lat: det.lat,
          lng: det.lng,
        })
      )
    } catch {}

    const q = new URLSearchParams({
      lat: String(selectedLocation.lat),
      lng: String(selectedLocation.lng),
      fullAddress: det.fullAddress || "",
      line1: det.line1 || "",
      line2: det.line2 || "",
      city: det.city || "",
      state: det.state || "",
      postalCode: det.postalCode || "",
      country: det.country || "India",
    })
    router.push(`/add-address?${q.toString()}`)
  }

  return (
    <div className="min-h-[100svh] md:min-h-screen grid grid-rows-[auto_1fr_auto] bg-gray-50">
      <Navbar cartCount={0} />

      <main className="row-start-2 container mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 lg:py-8">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-gray-100 rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            >
              <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6 text-gray-600" />
            </button>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">Select Location</h1>
          </div>

          {/* Search */}
          <div className="mb-4 sm:mb-6">
            <AddressAutocomplete
              label="Search for area, society, landmark…"
              placeholder="Search for area, society, landmark…"
              defaultCountry="IN"
              showMapPreview={false}
              onSelect={handlePlaceSelected}
            />
          </div>

          {/* Map */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-4 sm:mb-6 overflow-hidden">
            <div className="h-64 sm:h-80 relative">
              <div ref={mapRef} className="absolute inset-0" aria-label="Interactive Map" />
              {!mapsReady && (
                <div className="absolute inset-0 bg-gradient-to-br from-blue-100 to-green-100 flex items-center justify-center">
                  <div className="text-center">
                    <MapPin className="w-12 h-12 sm:w-16 sm:h-16 text-blue-600 mx-auto mb-2" />
                    <p className="text-sm sm:text-base text-gray-600">Interactive Map</p>
                    <p className="text-xs sm:text-sm text-gray-500">Tap to select location</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Current Location */}
          <button
            onClick={() => {
              if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                  (pos) => {
                    const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude }
                    mapInstance.current?.setCenter(loc)
                    markerInstance.current?.setPosition(loc)
                    reverseGeocode(loc.lat, loc.lng)
                    fetchNearby(loc)
                  },
                  () => {},
                  { enableHighAccuracy: true, timeout: 8000 }
                )
              }
            }}
            className="w-full bg-blue-600 text-white py-3 sm:py-4 rounded-lg hover:bg-blue-700 transition-all duration-200 font-medium text-sm sm:text-base flex items-center justify-center gap-2 mb-4 sm:mb-6 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <Navigation className="w-5 h-5 sm:w-6 sm:h-6" />
            Use Current Location
          </button>

          {/* Selected Location */}
          {selectedLocation && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 sm:p-6 mb-4 sm:mb-6">
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-blue-900 text-sm sm:text-base mb-1">Selected Location</h3>
                  <p className="text-xs sm:text-sm text-blue-800">{selectedLocation.address}</p>
                </div>
              </div>
            </div>
          )}

          {/* Nearby Places (Realtime) */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6 mb-4 sm:mb-6">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <h3 className="font-semibold text-gray-900 text-sm sm:text-base">Nearby Places</h3>
              {isSearching && <span className="text-xs text-gray-500">Searching…</span>}
            </div>
            <div className="space-y-2 sm:space-y-3">
              {nearbyPlaces.length === 0 ? (
                <p className="text-sm text-gray-500">No places found around this location.</p>
              ) : (
                nearbyPlaces.map((place) => (
                  <button
                    key={place.place_id}
                    onClick={() => {
                      const loc = { lat: place.lat, lng: place.lng }
                      mapInstance.current?.setCenter(loc)
                      markerInstance.current?.setPosition(loc)
                      // We’ll reverse geocode to get rich components, but also set a quick preview
                      setSelectedLocation({ ...loc, address: place.formatted_address || place.vicinity || place.name })
                      reverseGeocode(loc.lat, loc.lng)
                    }}
                    className="w-full text-left p-3 sm:p-4 hover:bg-gray-50 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    <div className="flex items-start gap-3">
                      <MapPin className="w-5 h-5 sm:w-6 sm:h-6 text-gray-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-gray-900 text-sm sm:text-base">{place.name}</p>
                        <p className="text-xs sm:text-sm text-gray-600">
                          {place.formatted_address || place.vicinity}
                        </p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Confirm */}
          <button
            onClick={confirmLocation}
            disabled={!selectedLocation}
            className={`w-full py-3 sm:py-4 rounded-lg font-semibold text-sm sm:text-base transition-all duration-200 ${
              selectedLocation
                ? "bg-blue-600 text-white hover:bg-blue-700 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                : "bg-gray-300 text-gray-500 cursor-not-allowed"
            }`}
          >
            Confirm Location
          </button>
        </div>
      </main>

      <Footer />
    </div>
  )
}

// Convert Geocoder result → StructuredAddress
function parseFromAddressComponents(result: any): StructuredAddress {
  const components = result.address_components || []
  const get = (type: string) => components.find((c: any) => c.types.includes(type))
  const getLong = (type: string) => get(type)?.long_name
  const getShort = (type: string) => get(type)?.short_name

  const streetNumber = getLong("street_number")
  const route = getLong("route")
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
