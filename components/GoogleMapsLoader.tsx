"use client"

import { useEffect } from "react"
import { ensureGoogleMapsLoaded } from "@/lib/googleMaps"

// Loads Google Maps JS globally once, after the app becomes interactive
export default function GoogleMapsLoader() {
  useEffect(() => {
    // Attempt to load; fail silently to allow graceful fallback
    ensureGoogleMapsLoaded().catch(() => {
      // no-op: components should gracefully degrade when maps isn't available
    })
  }, [])

  return null
}
