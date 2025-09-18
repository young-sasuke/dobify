import type React from "react"
import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Toaster } from "sonner"

const inter = Inter({ subsets: ["latin"] })

export const viewport: Viewport = {
  themeColor: "#2563eb",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
}

export const metadata: Metadata = {
  title: "IronXpress - Professional Ironing Service",
  description: "Quick and professional ironing service delivered to your doorstep",
  generator: 'v0.dev',
  openGraph: {
    title: "IronXpress",
    description: "Doorstep ironing & laundry services",
    url: "https://<your-domain>", // TODO: replace with deployed domain
    siteName: "IronXpress",
    type: "website",
  },
  alternates: {
    canonical: "https://<your-domain>", // TODO: replace with deployed domain
  },
}

import GoogleMapsLoader from "@/components/GoogleMapsLoader"
import { AuthProvider } from "@/components/AuthProvider"

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          {children}
        </AuthProvider>
        {/* Load Google Maps client-side, once */}
        <GoogleMapsLoader />
        <Toaster richColors position="top-center" />
      </body>
    </html>
  )
}
