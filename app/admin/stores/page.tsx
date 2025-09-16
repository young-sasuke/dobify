'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Plus, MapPin, Phone, User, Building2 } from 'lucide-react'

interface StoreAddress {
  id: string
  store_name: string
  address_type: string
  contact_person_name: string
  phone_number: string
  address_line_1: string
  address_line_2?: string
  landmark?: string
  city: string
  state: string
  pincode: string
  latitude?: number
  longitude?: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export default function StoreAddressesPage() {
  const [storeAddresses, setStoreAddresses] = useState<StoreAddress[]>([])
  const [loading, setLoading] = useState(true)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [formData, setFormData] = useState({
    store_name: '',
    address_type: 'Store',
    contact_person_name: '',
    phone_number: '',
    address_line_1: '',
    address_line_2: '',
    landmark: '',
    city: '',
    state: '',
    pincode: '',
    latitude: '',
    longitude: ''
  })

  // Fetch store addresses
  const fetchStoreAddresses = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/stores')
      
      if (!response.ok) {
        throw new Error('Failed to fetch addresses')
      }
      
      const result = await response.json()
      setStoreAddresses(result.data || [])
      
      // Show message if table doesn't exist
      if (result.message) {
        toast.info(result.message)
      }
    } catch (error) {
      console.error('Error fetching store addresses:', error)
      toast.error('Failed to fetch addresses')
    } finally {
      setLoading(false)
    }
  }

  // Add new store address
  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const response = await fetch('/api/admin/stores', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to add store address')
      }

      const result = await response.json()
      setStoreAddresses(prev => [result.data, ...prev])
      
      // Reset form
      setFormData({
        store_name: '',
        address_type: 'Store',
        contact_person_name: '',
        phone_number: '',
        address_line_1: '',
        address_line_2: '',
        landmark: '',
        city: '',
        state: '',
        pincode: '',
        latitude: '',
        longitude: ''
      })
      
      setIsAddDialogOpen(false)
      toast.success('Store address added successfully!')
    } catch (error: any) {
      console.error('Error adding store address:', error)
      toast.error(error.message || 'Failed to add store address')
    }
  }

  // Handle input changes
  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  useEffect(() => {
    fetchStoreAddresses()
  }, [])

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Store Addresses</h1>
          <p className="text-gray-600 mt-1">Manage your store pickup and delivery locations</p>
        </div>
        
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add Store Address
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Store Address</DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleAddAddress} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="store_name">Store Name *</Label>
                  <Input
                    id="store_name"
                    value={formData.store_name}
                    onChange={(e) => handleInputChange('store_name', e.target.value)}
                    placeholder="Enter store name"
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="address_type">Address Type</Label>
                  <Select 
                    value={formData.address_type} 
                    onValueChange={(value) => handleInputChange('address_type', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Store">Store</SelectItem>
                      <SelectItem value="Warehouse">Warehouse</SelectItem>
                      <SelectItem value="Pickup Point">Pickup Point</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="contact_person_name">Contact Person Name *</Label>
                  <Input
                    id="contact_person_name"
                    value={formData.contact_person_name}
                    onChange={(e) => handleInputChange('contact_person_name', e.target.value)}
                    placeholder="Enter contact person name"
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="phone_number">Phone Number *</Label>
                  <Input
                    id="phone_number"
                    value={formData.phone_number}
                    onChange={(e) => handleInputChange('phone_number', e.target.value)}
                    placeholder="Enter phone number"
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="address_line_1">Address Line 1 *</Label>
                <Input
                  id="address_line_1"
                  value={formData.address_line_1}
                  onChange={(e) => handleInputChange('address_line_1', e.target.value)}
                  placeholder="Enter address line 1"
                  required
                />
              </div>

              <div>
                <Label htmlFor="address_line_2">Address Line 2</Label>
                <Input
                  id="address_line_2"
                  value={formData.address_line_2}
                  onChange={(e) => handleInputChange('address_line_2', e.target.value)}
                  placeholder="Enter address line 2 (optional)"
                />
              </div>

              <div>
                <Label htmlFor="landmark">Landmark</Label>
                <Input
                  id="landmark"
                  value={formData.landmark}
                  onChange={(e) => handleInputChange('landmark', e.target.value)}
                  placeholder="Enter landmark (optional)"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="city">City *</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => handleInputChange('city', e.target.value)}
                    placeholder="Enter city"
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="state">State *</Label>
                  <Input
                    id="state"
                    value={formData.state}
                    onChange={(e) => handleInputChange('state', e.target.value)}
                    placeholder="Enter state"
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="pincode">Pincode *</Label>
                  <Input
                    id="pincode"
                    value={formData.pincode}
                    onChange={(e) => handleInputChange('pincode', e.target.value)}
                    placeholder="Enter pincode"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="latitude">Latitude (Optional)</Label>
                  <Input
                    id="latitude"
                    type="number"
                    step="any"
                    value={formData.latitude}
                    onChange={(e) => handleInputChange('latitude', e.target.value)}
                    placeholder="e.g., 20.2961"
                  />
                </div>
                
                <div>
                  <Label htmlFor="longitude">Longitude (Optional)</Label>
                  <Input
                    id="longitude"
                    type="number"
                    step="any"
                    value={formData.longitude}
                    onChange={(e) => handleInputChange('longitude', e.target.value)}
                    placeholder="e.g., 85.8245"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  Add Address
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="grid gap-6">
          <div className="text-sm text-gray-600 mb-4">
            Store Addresses ({storeAddresses.length})
          </div>
          
          {storeAddresses.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Building2 className="h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No store addresses found</h3>
                <p className="text-gray-600 text-center mb-6">
                  Add your first store address to get started with deliveries.
                </p>
                <Button onClick={() => setIsAddDialogOpen(true)} className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Add Store Address
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {storeAddresses.map((address) => (
                <Card key={address.id}>
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">{address.store_name}</CardTitle>
                        <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                          <Building2 className="h-4 w-4" />
                          {address.address_type}
                        </div>
                      </div>
                      <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                        address.is_active 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {address.is_active ? 'Active' : 'Inactive'}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-start gap-3">
                      <MapPin className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
                      <div className="text-sm">
                        <div>{address.address_line_1}</div>
                        {address.address_line_2 && <div>{address.address_line_2}</div>}
                        {address.landmark && <div>Near {address.landmark}</div>}
                        <div className="font-medium">{address.city}, {address.state} - {address.pincode}</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6 text-sm">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-gray-500" />
                        <span>{address.contact_person_name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-gray-500" />
                        <span>{address.phone_number}</span>
                      </div>
                    </div>

                    {(address.latitude && address.longitude) && (
                      <div className="text-xs text-gray-500">
                        Coordinates: {address.latitude}, {address.longitude}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
