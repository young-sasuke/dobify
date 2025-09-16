"use client"

import { useState, useEffect } from "react"
import { X } from "lucide-react"
import { supabase } from "@/lib/supabase"

interface ServiceSelectionPopupProps {
  product: {
    id: string
    product_name: string
    product_price: number
    image_url: string
    category_id: string
    is_enabled: boolean
  }
  onClose: () => void
  onServiceSelected?: (service: Service) => void
}

interface Service {
  id: string
  name: string
  price: number
  icon: string
  color_hex: string
  is_active: boolean
  sort_order: number
  service_description?: string
  service_full_description?: string
  tag?: string
}

export default function ServiceSelectionPopup({ product, onClose, onServiceSelected }: ServiceSelectionPopupProps) {
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchServices() {
      try {
        const { data, error } = await supabase
          .from('services')
          .select('*')
          .eq('is_active', true)
          .order('sort_order', { ascending: true })
          .order('name', { ascending: true })

        if (error) {
          console.error('Error fetching services:', error)
          setError('Failed to load services')
          return
        }

        if (data) {
          setServices(data)
        }
      } catch (err) {
        console.error('Unexpected error:', err)
        setError('An unexpected error occurred')
      } finally {
        setLoading(false)
      }
    }

    fetchServices()
  }, [])

  const getIconComponent = (iconName: string) => {
    const iconMap: { [key: string]: string } = {
      'flash_on': '⚡',
      'cloud': '☁️',
      'local_fire_department': '🔥',
      'electric_bolt': '⚡',
      'whatshot': '🔥',
      'water_drop': '💧'
    }
    return iconMap[iconName] || '🔧'
  }

  const handleServiceSelect = (service: Service) => {
    // Add to cart with selected service
    const cartItem = {
      id: Date.now(),
      name: product.product_name,
      image: product.image_url,
      service: service.name,
      price: product.product_price,
      servicePrice: service.price,
      quantity: 1,
      totalPrice: product.product_price + service.price
    }

    const existingCart = JSON.parse(localStorage.getItem('cart') || '[]')
    const updatedCart = [...existingCart, cartItem]
    localStorage.setItem('cart', JSON.stringify(updatedCart))
    
    // Dispatch custom event to update cart count
    window.dispatchEvent(new CustomEvent('cartUpdated'))
    
    // Notify parent component if callback provided
    if (onServiceSelected) {
      onServiceSelected(service)
    }
    
    // Close popup
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white w-full max-w-sm mx-auto rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Choose Service</h2>
          <button 
            onClick={onClose} 
            aria-label="Close service selection"
            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Subtitle */}
        <div className="px-4 pt-2 pb-4">
          <p className="text-sm text-gray-500">Select service for {product.product_name}</p>
        </div>

        {/* Content */}
        <div className="px-4 pb-4 max-h-80 overflow-y-auto">
          {loading && (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-gray-600 text-sm">Loading services...</span>
            </div>
          )}

          {error && (
            <div className="text-center py-4">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {!loading && !error && services.length > 0 && (
            <div className="space-y-3">
              {services.map((service) => (
                <button
                  key={service.id}
                  onClick={() => handleServiceSelect(service)}
                  className="w-full flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-all duration-200 group"
                >
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm"
                      style={{ backgroundColor: service.color_hex }}
                    >
                      {getIconComponent(service.icon)}
                    </div>
                    <div className="text-left">
                      <h3 className="font-semibold text-gray-900 text-sm group-hover:text-blue-600">
                        {service.name}
                      </h3>
                      <p className="text-xs text-gray-500">
                        {service.service_description && service.service_description.length > 40
                          ? service.service_description.substring(0, 40) + '...'
                          : service.service_description}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-blue-600 font-semibold text-sm">₹{service.price}</p>
                    {service.tag && (
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-500 text-white">
                        {service.tag}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {!loading && !error && services.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-500">No services available</p>
            </div>
          )}
        </div>

        {/* Cancel Button */}
        <div className="p-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="w-full py-2 text-blue-500 font-medium hover:bg-blue-50 transition-colors rounded-lg"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
