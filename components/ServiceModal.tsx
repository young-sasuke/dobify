"use client"

import { useState, useEffect } from "react"
import { X, Check } from "lucide-react"
import { supabase } from "@/lib/supabase"

interface ServiceModalProps {
  product: {
    name: string
    image: string
    price?: number
  }
  onClose: () => void
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
  tag?: string
}

export default function ServiceModal({ product, onClose }: ServiceModalProps) {
  const [services, setServices] = useState<Service[]>([])
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)

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

  const handleServiceSelect = (service: Service) => {
    setSelectedService(service)
    // Add item to cart with proper structure
    const existingCart = JSON.parse(localStorage.getItem('cart') || '[]');
    const cartItem = {
      id: Date.now(), // Simple ID generation
      name: product.name,
      image: product.image,
      service: service.name,
      price: product.price || 0,
      servicePrice: service.price,
      quantity: 1,
      totalPrice: (product.price || 0) + service.price
    };
    const updatedCart = [...existingCart, cartItem];
    localStorage.setItem('cart', JSON.stringify(updatedCart));
    setShowSuccess(true);
    setTimeout(() => {
      onClose();
    }, 1500);
  }

  const getIconComponent = (iconName: string) => {
    // Map Material Icons to appropriate symbols or use text
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

  if (showSuccess) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 sm:p-6 z-50">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Item Added to Cart!</h3>
          <p className="text-gray-600 mb-1">{product.name}</p>
          <p className="text-sm text-gray-500">Service: {selectedService?.name}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 sm:p-6 z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Select Service</h3>
            <p className="text-gray-600 text-sm mt-1">{product.name}</p>
          </div>
          <button onClick={onClose} aria-label="Close service modal" className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Product Image */}
          <div className="text-center mb-6">
            <div className="w-20 h-20 mx-auto bg-gray-100 rounded-xl flex items-center justify-center mb-2">
              <img
                src={product.image || "/placeholder.svg"}
                alt={product.name}
                className="w-full h-full object-contain rounded-xl"
                loading="lazy"
                decoding="async"
                onError={(e) => {
                  const img = e.target as HTMLImageElement;
                  img.src = "/placeholder.svg";
                }}
              />
            </div>
            <p className="text-sm text-gray-600">Selected Item</p>
            <p className="font-medium text-gray-900">{product.name}</p>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-gray-600">Loading services...</span>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="text-center py-8">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            </div>
          )}

          {/* Service Options */}
          {!loading && !error && services.length > 0 && (
            <div className="space-y-3">
              {services.map((service) => (
                <button
                  key={service.id}
                  onClick={() => handleServiceSelect(service)}
                  className="w-full p-4 border border-gray-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-all duration-200 group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div 
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium mt-1"
                        style={{ backgroundColor: service.color_hex }}
                      >
                        {getIconComponent(service.icon)}
                      </div>
                      <div className="text-left">
                        <div className="font-medium text-gray-900 group-hover:text-blue-700 text-left">
                          {service.name}
                        </div>
                        {service.service_description && (
                          <div className="text-sm text-gray-500 mt-1 leading-relaxed text-left">
                            {service.service_description}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right ml-3">
                      <div className="flex items-center gap-2">
                        {service.tag && (
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-500 text-white">
                            {service.tag}
                          </span>
                        )}
                        <span className="font-semibold text-gray-900">
                          {service.price > 0 ? `₹${service.price}` : 'Free'}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* No Services Message */}
          {!loading && !error && services.length === 0 && (
            <div className="text-center py-8">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                <p className="text-gray-600">No services available at the moment.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
