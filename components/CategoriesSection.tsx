"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import ProductDetailsModal from "./ProductDetailsModal"
import ServiceSelectionPopup from "./ServiceSelectionPopup"
import Toast from "./Toast"

interface Category {
  id: string
  name: string
  image_url: string | null
  is_active: boolean
  sort_order: number | null
}

interface Product {
  id: string
  product_name: string
  product_price: number
  image_url: string
  category_id: string
  is_enabled: boolean
}

export default function CategoriesSection() {
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>("")
  const [selectedProduct, setSelectedProduct] = useState<any>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isServicePopupOpen, setIsServicePopupOpen] = useState(false)
  const [productForService, setProductForService] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null)

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type })
  }

  const hideToast = () => {
    setToast(null)
  }

  useEffect(() => {
    async function fetchCategories() {
      try {
        const { data, error } = await supabase
          .from("categories")
          .select("*")
          .eq("is_active", true)
          .order("sort_order", { ascending: true, nullsFirst: false })
          .order("name", { ascending: true })

        if (error) {
          console.error("Error fetching categories:", error)
          setError("Failed to load categories")
          showToast("Failed to load categories", "error")
          return
        }

        if (data && data.length > 0) {
          setCategories(data)
          setSelectedCategory(data[0].id)
        }
      } catch (err) {
        console.error("Unexpected error:", err)
        setError("An unexpected error occurred")
      }
    }

    fetchCategories()
  }, [])

  useEffect(() => {
    async function fetchProducts() {
      try {
        const { data, error } = await supabase
          .from("products")
          .select(`
            id,
            product_name,
            product_price,
            image_url,
            category_id,
            is_enabled
          `)
          .eq("is_enabled", true)

        if (error) {
          console.error("Error fetching products:", error)
          setError("Failed to load products")
          showToast("Failed to load products", "error")
          return
        }

        if (data) {
          setProducts(data)
        }
      } catch (err) {
        console.error("Unexpected error:", err)
        setError("An unexpected error occurred")
      } finally {
        setLoading(false)
      }
    }

    fetchProducts()
  }, [])

  const filteredProducts = products.filter((product) => product.category_id === selectedCategory)

  const handleProductClick = (product: any) => {
    setSelectedProduct(product)
    setIsModalOpen(true)
  }

  const handleAddButtonClick = (event: React.MouseEvent, product: any) => {
    event.stopPropagation() // Prevent triggering product click
    setProductForService(product)
    setIsServicePopupOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setSelectedProduct(null)
  }

  const closeServicePopup = () => {
    setIsServicePopupOpen(false)
    setProductForService(null)
  }

  const handleServiceSelected = (service: any) => {
    showToast(`${productForService?.product_name} with ${service.name} added to cart!`, "success")
    closeServicePopup()
  }

  const handleCategoryChange = (categoryId: string) => {
    setSelectedCategory(categoryId)
    const category = categories.find((cat) => cat.id === categoryId)
    if (category) {
      showToast(`Switched to ${category.name} category`, "success")
    }
  }

  return (
    <section id="categories" className="py-8 sm:py-12 lg:py-16 bg-white">
      <div className="container mx-auto px-3 sm:px-4 lg:px-6">
        <div className="text-center mb-8 sm:mb-12">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-3 sm:mb-4">Choose Category</h2>
          <p className="text-sm sm:text-base lg:text-lg text-gray-600 max-w-2xl mx-auto">
            Select from our wide range of clothing categories for professional ironing services
          </p>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-gray-600">Loading categories...</span>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="text-center py-12">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 max-w-md mx-auto">
              <p className="text-red-600">{error}</p>
            </div>
          </div>
        )}

        {/* Category Selection */}
        {!loading && !error && categories.length > 0 && (
          <div className="mb-8 sm:mb-12">
            <div className="w-full overflow-x-auto scrollbar-hide">
              <div className="flex justify-center items-start gap-6 sm:gap-8 lg:gap-10 px-4 py-6 min-w-max">
                {categories.map((category) => (
                  <div key={category.id} className="flex-shrink-0 text-center max-w-20 sm:max-w-24 lg:max-w-28">
                    <div className="mb-3">
                      <button
                        onClick={() => handleCategoryChange(category.id)}
                        className={`w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 rounded-full border-2 transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-offset-2 flex items-center justify-center overflow-hidden shadow-md hover:shadow-lg ${
                          selectedCategory === category.id
                            ? "bg-blue-600 text-white border-blue-600 shadow-lg focus:ring-blue-500"
                            : "bg-white text-gray-700 border-gray-300 hover:border-blue-400 hover:bg-blue-50 focus:ring-gray-500"
                        }`}
                        aria-label={`Select ${category.name} category`}
                      >
                        {category.image_url ? (
                          <img
                            src={category.image_url}
                            alt={category.name}
                            className="w-full h-full object-cover rounded-full"
                            loading="lazy"
                            decoding="async"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = "/placeholder.svg"
                            }}
                          />
                        ) : (
                          <span className="text-sm sm:text-base lg:text-lg font-semibold">
                            {category.name.slice(0, 3)}
                          </span>
                        )}
                      </button>
                    </div>
                    <p className="text-xs sm:text-sm lg:text-base font-medium text-gray-700 text-center leading-tight">
                      {category.name}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Products Grid */}
        {!loading && !error && filteredProducts.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 sm:gap-6 lg:gap-8">
            {filteredProducts.map((product) => (
              <div
                key={product.id}
                onClick={() =>
                  handleProductClick({
                    ...product,
                    name: product.product_name,
                    image: product.image_url,
                    price: product.product_price,
                  })
                }
                className={`bg-white rounded-xl border-2 cursor-pointer ${
                  selectedProduct && selectedProduct.id === product.id
                    ? "border-blue-600 shadow-lg"
                    : "border-gray-300 hover:border-blue-300 hover:bg-blue-50"
                } shadow-sm overflow-hidden transition-all duration-300 transform hover:scale-105`}
              >
                {/* Product Image */}
                <div className="aspect-square bg-gray-100 p-4 sm:p-6">
                  <img
                    src={product.image_url || "/placeholder.svg"}
                    alt={product.product_name}
                    className="w-full h-full object-contain"
                    loading="lazy"
                    decoding="async"
                    onError={(e) => {
                      const img = e.target as HTMLImageElement
                      img.src = "/placeholder.svg"
                    }}
                  />
                </div>

                {/* Product Info */}
                <div className="p-3 sm:p-4">
                  <h3 className="font-semibold text-gray-900 text-sm sm:text-base mb-2 sm:mb-3 text-center">
                    {product.product_name}
                  </h3>
                  <p className="text-center text-blue-600 font-semibold mb-3"></p>
                  <button
                    onClick={(e) => handleAddButtonClick(e, product)}
                    className="w-full bg-blue-600 text-white py-2 sm:py-3 rounded-lg hover:bg-blue-700 transition-all duration-200 font-medium text-xs sm:text-sm transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    aria-label={`Add ${product.product_name}`}
                  >
                    Add
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* No Products Message */}
        {!loading && !error && selectedCategory && filteredProducts.length === 0 && (
          <div className="text-center py-12">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 max-w-md mx-auto">
              <p className="text-gray-600">No products available in this category.</p>
            </div>
          </div>
        )}
      </div>

      {/* Product Details Modal */}
      {isModalOpen && selectedProduct && <ProductDetailsModal product={selectedProduct} onClose={closeModal} />}

      {/* Service Selection Popup */}
      {isServicePopupOpen && productForService && (
        <ServiceSelectionPopup
          product={productForService}
          onClose={closeServicePopup}
          onServiceSelected={handleServiceSelected}
        />
      )}

      {/* Toast Notifications */}
      {toast && (
        <Toast
          isVisible={true}           // ✅ required by ToastProps
          message={toast.message}
          type={toast.type}
          onClose={hideToast}
        />
      )}
    </section>
  )
}
