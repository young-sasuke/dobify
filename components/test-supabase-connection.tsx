'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface Category {
  id: string
  name: string
  image_url: string | null
  is_active: boolean
}

export function TestSupabaseConnection() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchCategories() {
      try {
        const { data, error } = await supabase
          .from('categories')
          .select('id, name, image_url, is_active')
          .eq('is_active', true)
          .limit(5)

        if (error) {
          throw error
        }

        setCategories(data || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }

    fetchCategories()
  }, [])

  if (loading) {
    return (
      <div className="p-4 border rounded-lg">
        <h3 className="text-lg font-semibold mb-2">Supabase Connection Test</h3>
        <p>Loading categories...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 border rounded-lg border-red-300 bg-red-50">
        <h3 className="text-lg font-semibold mb-2 text-red-700">Connection Error</h3>
        <p className="text-red-600">{error}</p>
      </div>
    )
  }

  return (
    <div className="p-4 border rounded-lg border-green-300 bg-green-50">
      <h3 className="text-lg font-semibold mb-2 text-green-700">✅ Supabase Connected!</h3>
      <p className="text-green-600 mb-3">Successfully connected to ironXpress database</p>
      
      {categories.length > 0 ? (
        <div>
          <h4 className="font-medium mb-2">Active Categories:</h4>
          <ul className="list-disc list-inside text-sm">
            {categories.map((category) => (
              <li key={category.id}>{category.name}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-gray-600">No active categories found</p>
      )}
    </div>
  )
}
