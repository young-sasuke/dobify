import { Metadata } from 'next'
import Link from 'next/link'
import { Building2, Home, Package, Users, Settings, BarChart } from 'lucide-react'

export const metadata: Metadata = {
  title: 'IronXpress Admin',
  description: 'Admin interface for IronXpress',
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-[100svh] md:min-h-screen grid grid-rows-[auto_1fr_auto] bg-gray-50">
      {/* Navigation Header */}
      <header className="row-start-1 sticky top-0 z-50 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">IX</span>
                </div>
                <h1 className="text-2xl font-bold text-gray-900">IronXpress Admin</h1>
              </div>
            </div>
            <nav className="flex space-x-8">
              <Link 
                href="/admin" 
                className="text-gray-600 hover:text-gray-900 px-3 py-2 text-sm font-medium flex items-center gap-2"
              >
                <Home className="h-4 w-4" />
                Dashboard
              </Link>
              <Link 
                href="/admin/stores" 
                className="text-gray-600 hover:text-gray-900 px-3 py-2 text-sm font-medium flex items-center gap-2"
              >
                <Building2 className="h-4 w-4" />
                Store Addresses
              </Link>
              <Link 
                href="/admin/products" 
                className="text-gray-600 hover:text-gray-900 px-3 py-2 text-sm font-medium flex items-center gap-2"
              >
                <Package className="h-4 w-4" />
                Products
              </Link>
              <Link 
                href="/admin/users" 
                className="text-gray-600 hover:text-gray-900 px-3 py-2 text-sm font-medium flex items-center gap-2"
              >
                <Users className="h-4 w-4" />
                Users
              </Link>
              <Link 
                href="/admin/analytics" 
                className="text-gray-600 hover:text-gray-900 px-3 py-2 text-sm font-medium flex items-center gap-2"
              >
                <BarChart className="h-4 w-4" />
                Analytics
              </Link>
              <Link 
                href="/admin/settings" 
                className="text-gray-600 hover:text-gray-900 px-3 py-2 text-sm font-medium flex items-center gap-2"
              >
                <Settings className="h-4 w-4" />
                Settings
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="row-start-2 flex-1">
        {children}
      </main>
    </div>
  )
}
