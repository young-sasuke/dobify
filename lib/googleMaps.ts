// Client-side Google Maps JS loader and helpers
// Ensures the script is injected exactly once and only on the client.
// Reads the API key from NEXT_PUBLIC_GOOGLE_MAPS_API_KEY at build time.

// Declare a global to track the loader promise and avoid multiple loads
declare global {
  interface Window {
    __googleMapsLoaderPromise?: Promise<any>;
  }
}

export type GoogleMapsAvailability =
  | { status: "loaded"; maps: any }
  | { status: "unavailable"; reason: string };

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

export function ensureGoogleMapsLoaded(): Promise<any> {
  // SSR guard
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps can only load in the browser"));
  }

  // Already available
  if ((window as any).google?.maps) {
    return Promise.resolve((window as any).google.maps);
  }

  // If a previous load is in-flight, return it
  if (window.__googleMapsLoaderPromise) {
    return window.__googleMapsLoaderPromise;
  }

  // Fail fast if no API key is provided (do not log the key)
  if (!GOOGLE_MAPS_API_KEY) {
    return Promise.reject(new Error("Google Maps API key missing"));
  }

  // Build script URL
  const params = new URLSearchParams({
    key: GOOGLE_MAPS_API_KEY,
    libraries: "places,geometry",
    v: "weekly",
    // Optional defaults for India; can be adjusted as needed
    region: "IN",
  });
  const src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;

  // Avoid duplicate script tags
  const existing = document.querySelector<HTMLScriptElement>(
    'script[data-google-maps-loader="true"]'
  );
  if (existing) {
    // If a tag exists, wait until google.maps becomes available
    window.__googleMapsLoaderPromise = new Promise<any>((resolve, reject) => {
      const tryResolve = () => {
        if ((window as any).google?.maps) {
          resolve((window as any).google.maps)
          return true
        }
        return false
      }
      if (tryResolve()) return
      existing.addEventListener("load", () => {
        if (tryResolve()) return
        // Poll briefly in case load fires before google is ready
        const start = Date.now()
        const id = window.setInterval(() => {
          if (tryResolve()) {
            window.clearInterval(id)
          } else if (Date.now() - start > 5000) {
            window.clearInterval(id)
            reject(new Error("Google Maps failed to initialize"))
          }
        }, 100)
      })
      existing.addEventListener("error", () => {
        reject(new Error("Failed to load Google Maps script"))
      })
    })
    return window.__googleMapsLoaderPromise
  }

  const script = document.createElement("script");
  script.src = src;
  script.async = true;
  script.defer = true;
  script.setAttribute("data-google-maps-loader", "true");

  window.__googleMapsLoaderPromise = new Promise<any>((resolve, reject) => {
    const finalize = () => {
      if ((window as any).google?.maps) {
        resolve((window as any).google.maps)
      } else {
        // Poll for up to 5s in case onload fires before globals are attached
        const start = Date.now()
        const id = window.setInterval(() => {
          if ((window as any).google?.maps) {
            window.clearInterval(id)
            resolve((window as any).google.maps)
          } else if (Date.now() - start > 5000) {
            window.clearInterval(id)
            reject(new Error("Google Maps failed to initialize"))
          }
        }, 100)
      }
    }

    script.addEventListener("load", finalize)
    script.addEventListener("error", () => {
      reject(new Error("Failed to load Google Maps script"))
    })
  })

  document.head.appendChild(script);
  return window.__googleMapsLoaderPromise;
}

export async function getGoogleMapsAvailability(): Promise<GoogleMapsAvailability> {
  try {
    const maps = await ensureGoogleMapsLoaded();
    return { status: "loaded", maps };
  } catch (e: any) {
    return { status: "unavailable", reason: e?.message || "Unknown error" };
  }
}
