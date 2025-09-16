import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Building2, Package, Users, ShoppingCart } from 'lucide-react'

export default function AdminDashboard() {
  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-600 mt-1">Welcome to IronXpress Admin Panel</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Store Addresses</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">
              Manage store locations
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Products</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">
              Total products available
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">
              Registered customers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">
              Orders processed
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <a href="/admin/stores" className="flex items-center gap-3 p-3 rounded-lg border hover:bg-gray-50 transition-colors">
              <Building2 className="h-5 w-5 text-blue-600" />
              <div>
                <div className="font-medium">Manage Store Addresses</div>
                <div className="text-sm text-gray-600">Add and manage pickup/delivery locations</div>
              </div>
            </a>
            <a href="/admin/products" className="flex items-center gap-3 p-3 rounded-lg border hover:bg-gray-50 transition-colors">
              <Package className="h-5 w-5 text-green-600" />
              <div>
                <div className="font-medium">Manage Products</div>
                <div className="text-sm text-gray-600">Add and edit product catalog</div>
              </div>
            </a>
            <a href="/admin/users" className="flex items-center gap-3 p-3 rounded-lg border hover:bg-gray-50 transition-colors">
              <Users className="h-5 w-5 text-purple-600" />
              <div>
                <div className="font-medium">User Management</div>
                <div className="text-sm text-gray-600">View and manage customer accounts</div>
              </div>
            </a>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center text-gray-500 py-8">
              <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No recent activity to display</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
