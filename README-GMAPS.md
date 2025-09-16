# Google Maps + Places Autocomplete Integration

This change adds a client-only Google Maps JavaScript loader, an Address Autocomplete component, and wires it into the Add Address step. It also persists the selected structured address and merges it into the final order payload non-destructively.

## Environment variable

Set a public browser key in your environment:

- NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

Failover: If the key is missing or the script fails to load, we show a standard text input fallback without breaking the page.

Note: Do not log the key. The code does not print the key in any console output.

## Google Cloud setup (configuration only)

Enable these APIs for the browser key:
- Maps JavaScript API
- Places API
- Geocoding API (recommended)

Lock down the key:
- Application restriction: HTTP referrers (web sites)
- Allowed referrers:
  - https://ironxpress.in/*
  - https://www.ironxpress.in/* (optional)
  - http://localhost:3000/* (optional for local dev)
- API restrictions: limit to Maps JavaScript API, Places API, Geocoding API

## Files added

- lib/googleMaps.ts
  - Client-only script loader; injects the Maps JS SDK once with libraries=places,geometry. Safely handles SSR and avoids duplicate loads.
- components/GoogleMapsLoader.tsx
  - Small client component that triggers the loader once after the app is interactive.
- components/address/AddressAutocomplete.tsx
  - Places Autocomplete with country restriction (IN by default), structured address parsing, optional map preview, and keyboard-friendly input.
- lib/order.ts
  - Helper to merge the selected address into any order payload: sets `delivery_address` and `address_details` JSON non-destructively.

## Files updated (mount points)

- app/layout.tsx
  - Renders the global <GoogleMapsLoader /> near the end of <body>, ensuring the SDK loads once on the client.
- app/add-address/page.tsx
  - Renders the AddressAutocomplete above the existing fields (non-destructive). When a place is selected, it pre-fills form fields and stores `selectedAddress` in localStorage.
- app/payment/page.tsx
  - On Pay, builds a base payload and calls `mergeSelectedAddressIntoPayload`. Stores the result in `localStorage.lastOrderPayload` for verification/testing.

## Structured address shape

The component returns a structured object:
```
{
  fullAddress,
  line1,
  line2,
  city,
  state,
  postalCode,
  country,
  lat,
  lng,
  placeId
}
```

At order creation, we merge into payload as:
- delivery_address = fullAddress
- address_details (JSON) = {
  line1, line2, city, state, postal_code, country, lat, lng, place_id
}

## India-specific parsing

- If `locality` is missing, we fall back to `administrative_area_level_2` or `sublocality`.
- Line 1 aggregates `street_number` + `route` when available; falls back to the place name.
- Line 2 uses `sublocality` levels and locality.

## Fallback behavior

- If the Maps script fails to load or the key is missing, the autocomplete shows a regular text input.
- We ignore any selection that does not contain geometry.
- The SDK is injected exactly once and only on the client.

## How to test

1) Set the env var and run the app
- Ensure NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is set before build.
- Local dev (example):
  - Windows PowerShell: `$env:NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = "{{YOUR_GOOGLE_MAPS_BROWSER_KEY}}"; npm run dev`
  - Bash: `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY={{YOUR_GOOGLE_MAPS_BROWSER_KEY}} npm run dev`

2) Navigate to /add-address
- Type in the new "Search and select address" field.
- You should see Google-powered suggestions limited to India.
- Select a suggestion; form fields are pre-filled and a small map preview centers on the selected pin.

3) Verify persistence
- After selecting an address, the object is stored at `localStorage.selectedAddress`.
  - Inspect via DevTools Application tab or `JSON.parse(localStorage.getItem('selectedAddress'))`.

4) Verify payload merge
- Proceed to payment and click Pay.
- The merged payload is stored at `localStorage.lastOrderPayload`.
  - Inspect via `JSON.parse(localStorage.getItem('lastOrderPayload'))`.
  - It should contain `delivery_address` and `address_details` with the specified fields.

## Quality checks

- Typing in the address field shows Google suggestions (India-restricted).
- Selecting an address yields a structured object with lat/lng and placeId.
- Optional map preview centers on the chosen location with a single marker.
- The address is persisted and included in the final order payload (see lastOrderPayload).
- No console errors like "google is not defined" or missing API key; the code avoids referencing google before the SDK is loaded and handles missing keys gracefully.
- The app remains fully client-side compatible and builds statically for cPanel hosting.

## Notes on cPanel static hosting

- The integration is entirely client-side and only uses `NEXT_PUBLIC_` env vars which are inlined at build time.
- No server runtime is required.

