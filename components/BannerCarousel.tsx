"use client"

import { useState, useEffect } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { supabase } from "@/lib/supabase"

interface Banner {
  id: string
  image_url: string
  redirect_to?: string | null
  is_active: boolean
  sort_order: number
}

export default function BannerCarousel() {
  const [currentSlide, setCurrentSlide] = useState(0)
  const [banners, setBanners] = useState<Banner[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch banners from Supabase
  useEffect(() => {
    async function fetchBanners() {
      try {
        const { data, error } = await supabase
          .from('banners')
          .select('id, image_url, redirect_to, is_active, sort_order')
          .eq('is_active', true)
          .order('sort_order', { ascending: true })

        if (error) {
          throw error
        }

        setBanners(data || [])
      } catch (err) {
        console.error('Error fetching banners:', err)
        setError(err instanceof Error ? err.message : 'Failed to load banners')
      } finally {
        setLoading(false)
      }
    }

    fetchBanners()
  }, [])

  useEffect(() => {
    if (banners.length === 0) return
    
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % banners.length)
    }, 5000)

    return () => clearInterval(timer)
  }, [banners.length])

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % banners.length)
  }

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + banners.length) % banners.length)
  }

  // Show loading state
  if (loading) {
    return (
      <div className="relative w-full h-48 sm:h-56 lg:h-64 rounded-xl overflow-hidden bg-gradient-to-r from-blue-500 to-purple-600 mb-6 sm:mb-8 flex items-center justify-center">
        <div className="text-white text-lg">Loading banners...</div>
      </div>
    )
  }

  // Show error state
  if (error) {
    return (
      <div className="relative w-full h-48 sm:h-56 lg:h-64 rounded-xl overflow-hidden bg-gradient-to-r from-red-500 to-red-600 mb-6 sm:mb-8 flex items-center justify-center">
        <div className="text-white text-lg text-center px-4">
          <p>Failed to load banners</p>
          <p className="text-sm opacity-75">{error}</p>
        </div>
      </div>
    )
  }

  // Show message if no banners available
  if (banners.length === 0) {
    return (
      <div className="relative w-full h-48 sm:h-56 lg:h-64 rounded-xl overflow-hidden bg-gradient-to-r from-gray-500 to-gray-600 mb-6 sm:mb-8 flex items-center justify-center">
        <div className="text-white text-lg">No banners available</div>
      </div>
    )
  }

  return (
    <div className="relative w-full h-56 sm:h-64 md:h-72 lg:h-80 xl:h-96 rounded-xl overflow-hidden mb-6 sm:mb-8">
      {/* Banner Images */}
      <div className="relative w-full h-full">
        {banners.map((banner, index) => (
          <div
            key={banner.id}
            className={`absolute inset-0 transition-opacity duration-500 ${
              index === currentSlide ? "opacity-100" : "opacity-0"
            }`}
            onClick={() => {
              if (banner.redirect_to) {
                window.open(banner.redirect_to, '_blank', 'noopener,noreferrer')
              }
            }}
            role={banner.redirect_to ? 'link' : undefined}
            tabIndex={banner.redirect_to ? 0 : -1}
            onKeyDown={(e) => {
              if (!banner.redirect_to) return
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                window.open(banner.redirect_to!, '_blank', 'noopener,noreferrer')
              }
            }}
            style={{ cursor: banner.redirect_to ? 'pointer' : 'default' }}
          >
            <img 
              src={banner.image_url} 
              alt={`Banner ${index + 1}`}
              className="w-full h-full object-cover"
              loading="lazy"
              decoding="async"
              onError={(e) => {
                const target = e.target as HTMLImageElement
                target.src = '/placeholder.svg?height=200&width=800&text=Banner+Not+Found'
              }}
            />
          </div>
        ))}
      </div>

      {/* Navigation Arrows */}
      <button
        onClick={prevSlide}
        aria-label="Previous slide"
        className="absolute left-2 sm:left-4 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-20 hover:bg-opacity-30 text-white p-2 rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50"
      >
        <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
      </button>
      <button
        onClick={nextSlide}
        aria-label="Next slide"
        className="absolute right-2 sm:right-4 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-20 hover:bg-opacity-30 text-white p-2 rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50"
      >
        <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
      </button>

      {/* Dots Indicator */}
      <div className="absolute bottom-3 sm:bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2">
        {banners.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentSlide(index)}
            aria-label={`Go to slide ${index + 1}`}
            aria-current={index === currentSlide ? 'true' : undefined}
            className={`w-2 h-2 sm:w-3 sm:h-3 rounded-full transition-all duration-200 ${
              index === currentSlide ? "bg-white" : "bg-white bg-opacity-50"
            }`}
          />
        ))}
      </div>
    </div>
  )
}
