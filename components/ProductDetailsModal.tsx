"use client"

import { useState, useEffect } from "react"
import { X, ArrowLeft, Minus, Plus, ShoppingCart, Check } from "lucide-react"
import { supabase } from "@/lib/supabase"

interface ProductDetailsModalProps {
  product: {
    id: string
    product_name: string
    product_price: number
    image_url: string
    category_id: string
    is_enabled: boolean
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
  service_full_description?: string
  tag?: string
}

export default function ProductDetailsModal({ product, onClose }: ProductDetailsModalProps) {
  const [services, setServices] = useState<Service[]>([])
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [quantity, setQuantity] = useState(1)
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
          // Auto-select first service
          if (data.length > 0) {
            setSelectedService(data[0])
          }
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
    setSelectedService(service)
  }

  const handleQuantityChange = (value: number) => {
    if (quantity === 1 && value === -1) {
      // Show message and close modal when removing last item
      alert('Item removed from selection')
      onClose()
      return
    }
    setQuantity(prev => Math.max(1, prev + value))
  }

  const calculateTotal = () => {
    if (!selectedService) return product.product_price * quantity
    return (product.product_price + selectedService.price) * quantity
  }

  const handleAddToCart = () => {
    if (!selectedService) return

    const cartItem = {
      id: Date.now(),
      name: product.product_name,
      image: product.image_url,
      service: selectedService.name,
      price: product.product_price,
      servicePrice: selectedService.price,
      quantity,
      totalPrice: calculateTotal()
    }

    const existingCart = JSON.parse(localStorage.getItem('cart') || '[]')
    const updatedCart = [...existingCart, cartItem]
    localStorage.setItem('cart', JSON.stringify(updatedCart))
    
    // Show success message
    setShowSuccess(true)
    
    // Dispatch custom event to update cart count
    window.dispatchEvent(new CustomEvent('cartUpdated'))
    
    setTimeout(() => {
      onClose()
    }, 1500)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-0 sm:p-4 z-50">
      <div className="bg-white w-full h-full sm:max-w-md sm:w-full sm:h-auto sm:rounded-2xl sm:shadow-2xl sm:mx-4 sm:max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-blue-500 text-white sm:bg-white sm:text-gray-900">
          <button 
            onClick={onClose} 
            aria-label="Close product details"
            className="p-2 hover:bg-blue-600 sm:hover:bg-gray-100 rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5 sm:hidden" />
            <X className="w-5 h-5 hidden sm:block" />
          </button>
          <h1 className="text-lg font-semibold truncate flex-1 text-center">
            {product.product_name}
          </h1>
          <div className="w-9" /> {/* Spacer for centering */}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Product Image */}
          <div className="bg-gray-50 p-6 sm:p-8">
            <div className="w-48 h-48 sm:w-56 sm:h-56 mx-auto bg-white rounded-2xl border border-gray-200 flex items-center justify-center p-4">
              <img
                src={product.image_url || "/placeholder.svg"}
                alt={product.product_name}
                className="w-full h-full object-contain"
                loading="lazy"
                decoding="async"
                onError={(e) => {
                  const img = e.target as HTMLImageElement;
                  img.src = "/placeholder.svg";
                }}
              />
            </div>
          </div>

          <div className="p-4 sm:p-6">
            {/* Select Service Section */}
            <div className="mb-6">
              <h3 className="text-base font-semibold text-blue-500 mb-4">Select Service</h3>
              
              {loading && (
                <div className="flex justify-center items-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  <span className="ml-2 text-gray-600">Loading services...</span>
                </div>
              )}

              {error && (
                <div className="text-center py-4">
                  <p className="text-red-600 text-sm">{error}</p>
                </div>
              )}

              {!loading && !error && services.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {services.map((service) => (
                    <button
                      key={service.id}
                      onClick={() => handleServiceSelect(service)}
                      className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-full border-2 transition-all duration-200 ${
                        selectedService?.id === service.id
                          ? 'bg-blue-500 text-white border-blue-500'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-blue-300'
                      }`}
                    >
                      <div 
                        className={`w-4 h-4 rounded-full flex items-center justify-center text-xs ${
                          selectedService?.id === service.id ? 'bg-white text-blue-500' : 'text-white'
                        }`}
                        style={{ backgroundColor: selectedService?.id === service.id ? 'white' : service.color_hex }}
                      >
                        {getIconComponent(service.icon)}
                      </div>
                      <span className="text-sm font-medium">{service.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Selected Service Details */}
            {selectedService && (
              <div className="mb-6 p-4 bg-gray-50 rounded-xl">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-start gap-3">
                    {selectedService.tag && (
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-500 text-white">
                        {selectedService.tag}
                      </span>
                    )}
                  </div>
                  <span className="text-sm font-semibold text-blue-600">
                    ₹{selectedService.price}
                  </span>
                </div>
                <h4 className="font-semibold text-gray-900 mb-2">
                  {selectedService.name}
                </h4>
                {(selectedService.service_full_description || selectedService.service_description) && (
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {selectedService.service_full_description || selectedService.service_description}
                  </p>
                )}
              </div>
            )}

            {/* Quantity and Total */}
            <div className="flex items-center justify-between mb-6 p-4 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-gray-700">Quantity</span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleQuantityChange(-1)}
                    aria-label="Decrease quantity"
                    className="w-8 h-8 rounded-full bg-white border border-gray-300 flex items-center justify-center hover:bg-gray-50 transition-colors"
                    disabled={quantity <= 1}
                  >
                    <Minus className="w-4 h-4 text-gray-600" />
                  </button>
                  <span className="w-8 text-center font-semibold text-blue-600">
                    {quantity}
                  </span>
                  <button
                    onClick={() => handleQuantityChange(1)}
                    aria-label="Increase quantity"
                    className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center hover:bg-blue-600 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Total</p>
                <p className="text-lg font-bold text-blue-600">
                  ₹{calculateTotal()}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Success Message Overlay */}
        {showSuccess && (
          <div className="absolute inset-0 bg-white bg-opacity-95 flex items-center justify-center z-10">
            <div className="bg-green-500 text-white px-6 py-4 rounded-2xl shadow-lg flex items-center gap-3 animate-pulse">
              <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
                <Check className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="font-semibold">Added to Cart!</p>
                <p className="text-sm opacity-90">Item successfully added</p>
              </div>
            </div>
          </div>
        )}

        {/* Add to Cart Button */}
        <div className="p-4 sm:p-6 border-t border-gray-100 bg-white">
          <button
            onClick={handleAddToCart}
            disabled={!selectedService}
            className="w-full bg-blue-500 text-white py-3 sm:py-4 rounded-xl font-semibold text-base hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <ShoppingCart className="w-5 h-5" />
            Add to Cart
          </button>
        </div>
      </div>
    </div>
  )
}
