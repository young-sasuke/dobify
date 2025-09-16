"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"

export default function TestSupabaseConnection() {
  const [status, setStatus] = useState<'testing' | 'success' | 'error'>('testing')
  const [categories, setCategories] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [error, setError] = useState<string>('')

  useEffect(() => {
    async function testConnection() {
      try {
        // Test categories fetch
        const { data: categoriesData, error: categoriesError } = await supabase
          .from('categories')
          .select('*')
          .limit(5)

        if (categoriesError) {
          throw new Error(`Categories Error: ${categoriesError.message}`)
        }

        // Test products fetch
        const { data: productsData, error: productsError } = await supabase
          .from('products')
          .select('*')
          .limit(5)

        if (productsError) {
          throw new Error(`Products Error: ${productsError.message}`)
        }

        setCategories(categoriesData || [])
        setProducts(productsData || [])
        setStatus('success')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
        setStatus('error')
      }
    }

    testConnection()
  }, [])

  if (status === 'testing') {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 m-4">
        <p className="text-blue-700">Testing Supabase connection...</p>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 m-4">
        <h3 className="text-red-800 font-semibold">Connection Error</h3>
        <p className="text-red-700">{error}</p>
      </div>
    )
  }

  return (
    <div className="bg-green-50 border border-green-200 rounded-lg p-4 m-4">
      <h3 className="text-green-800 font-semibold mb-2">✅ Supabase Connected Successfully!</h3>
      <div className="text-sm text-green-700">
        <p>Categories found: {categories.length}</p>
        <p>Products found: {products.length}</p>
        {categories.length > 0 && (
          <div className="mt-2">
            <p><strong>Sample categories:</strong></p>
            <ul className="list-disc list-inside ml-2">
              {categories.map((cat) => (
                <li key={cat.id}>{cat.name}</li>
              ))}
            </ul>
          </div>
        )}
        {products.length > 0 && (
          <div className="mt-2">
            <p><strong>Sample products:</strong></p>
            <ul className="list-disc list-inside ml-2">
              {products.map((prod) => (
                <li key={prod.id}>{prod.product_name} - ₹{prod.product_price}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
