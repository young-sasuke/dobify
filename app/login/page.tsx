"use client"

import type React from "react"

import { Suspense, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import GoogleOAuth from "@/components/GoogleOAuth"
import { Shield, Zap, Award } from "lucide-react"


function LoginPageInner() {
  const router = useRouter()
  const params = useSearchParams()
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  })
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    // Real login process
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      })

      if (error) throw error

      // Proactively sync SSR cookies for middleware
      try {
        if (data?.session?.access_token && data?.session?.refresh_token) {
          await fetch('/api/auth/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ access_token: data.session.access_token, refresh_token: data.session.refresh_token })
          })
        }
      } catch {}

      const next = params.get('next') || '/review-cart'
      router.push(next)
    } catch (error) {
      console.error('Login error:', error);
      alert('Failed to log in. Please check your credentials.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 via-blue-50 to-cyan-100 p-4 sm:p-6">
      <div className="w-full max-w-sm sm:max-w-md lg:max-w-lg">
        {/* Main Card */}
        <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden backdrop-blur-sm">
          {/* Header Section */}
          <div className="px-6 sm:px-8 lg:px-10 pt-8 sm:pt-12 lg:pt-14 pb-6 sm:pb-8 lg:pb-10 text-center">
            {/* App Icon */}
            <div className="relative mx-auto mb-6 sm:mb-8 lg:mb-12">
              <div className="w-14 h-14 sm:w-16 sm:h-16 lg:w-20 lg:h-20 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl sm:rounded-2xl shadow-lg flex items-center justify-center transform hover:scale-105 transition-transform duration-300">
                <span className="text-white font-bold text-lg sm:text-xl lg:text-2xl tracking-wider">IX</span>
              </div>
            </div>
            
            {/* Welcome Text */}
            <h1 className="text-2xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-3 sm:mb-4 tracking-tight">
              Welcome to IronXpress
            </h1>
            <p className="text-gray-600 text-base sm:text-lg leading-relaxed mb-6 sm:mb-8 lg:mb-10">
              Sign in to continue to journey.
            </p>

            {/* Google OAuth Button */}
            <div className="mb-6 sm:mb-8">
              <GoogleOAuth mode="login" />
            </div>
          </div>

          {/* Features Section */}
          <div className="bg-gradient-to-r from-gray-50 to-blue-50 px-6 sm:px-8 lg:px-10 py-6 sm:py-8 border-t border-gray-100">
            <div className="grid grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
              {/* Secure */}
              <div className="text-center group">
                <div className="w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 bg-gradient-to-br from-green-500 to-green-600 rounded-lg sm:rounded-xl shadow-md flex items-center justify-center mx-auto mb-2 sm:mb-3 lg:mb-4 group-hover:scale-110 transition-transform duration-300">
                  <Shield className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-white" />
                </div>
                <span className="text-xs sm:text-sm font-medium text-gray-700">Secure</span>
              </div>
              
              {/* Fast */}
              <div className="text-center group">
                <div className="w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-lg sm:rounded-xl shadow-md flex items-center justify-center mx-auto mb-2 sm:mb-3 lg:mb-4 group-hover:scale-110 transition-transform duration-300">
                  <Zap className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-white" />
                </div>
                <span className="text-xs sm:text-sm font-medium text-gray-700">Fast</span>
              </div>
              
              {/* Trusted */}
              <div className="text-center group">
                <div className="w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg sm:rounded-xl shadow-md flex items-center justify-center mx-auto mb-2 sm:mb-3 lg:mb-4 group-hover:scale-110 transition-transform duration-300">
                  <Award className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-white" />
                </div>
                <span className="text-xs sm:text-sm font-medium text-gray-700">Trusted</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Footer Text */}
        <div className="text-center mt-6 sm:mt-8 lg:mt-10">
          <p className="text-xs sm:text-sm text-gray-500 px-4">
            By continuing, you agree to our{" "}
            <a href="#" className="text-blue-600 hover:text-blue-700 font-medium hover:underline transition-colors">
              Terms of Service
            </a>{" "}
            and{" "}
            <a href="#" className="text-blue-600 hover:text-blue-700 font-medium hover:underline transition-colors">
              Privacy Policy
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-6 text-center">Loading…</div>}>
      <LoginPageInner />
    </Suspense>
  )
}
