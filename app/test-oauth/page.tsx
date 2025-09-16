"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"

export default function TestOAuth() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)

  const testOAuth = async () => {
    setLoading(true)
    setResult(null)
    
    try {
      console.log('Testing OAuth flow...')
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: 'https://ironxpressmaster.vercel.app/auth/callback',
        }
      })

      console.log('OAuth Response:', { data, error })
      setResult({ data, error, success: !error })
      
      if (data.url) {
        console.log('Redirecting to:', data.url)
        // Don't redirect automatically for testing
        // window.location.href = data.url
      }
      
    } catch (err) {
      console.error('OAuth Error:', err)
      setResult({ error: err, success: false })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">OAuth Test Page</h1>
        
        <div className="bg-white p-6 rounded-lg shadow-lg">
          <button
            onClick={testOAuth}
            disabled={loading}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Testing OAuth...' : 'Test Google OAuth'}
          </button>
          
          {result && (
            <div className="mt-6 p-4 bg-gray-100 rounded-lg">
              <h3 className="font-semibold mb-2">Result:</h3>
              <pre className="text-sm overflow-auto">
                {JSON.stringify(result, null, 2)}
              </pre>
              
              {result.data?.url && (
                <div className="mt-4">
                  <p className="font-semibold">Generated OAuth URL:</p>
                  <a
                    href={result.data.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline break-all"
                  >
                    {result.data.url}
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className="mt-8 bg-white p-6 rounded-lg shadow-lg">
          <h3 className="font-semibold mb-4">Environment Check:</h3>
          <div className="space-y-2 text-sm">
            <p><strong>Supabase URL:</strong> {process.env.NEXT_PUBLIC_SUPABASE_URL || 'Not set'}</p>
            <p><strong>Supabase Anon Key:</strong> {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Set (hidden)' : 'Not set'}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
