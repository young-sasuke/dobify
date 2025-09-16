import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client with service role for admin operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// GET - Fetch all store addresses
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('store_addresses')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching store addresses:', error)
      
      // If table doesn't exist, return empty array
      if (error.code === 'PGRST116' || error.message.includes('does not exist')) {
        return NextResponse.json({ 
          data: [], 
          message: 'Store addresses table does not exist. Please create it first.' 
        })
      }
      
      return NextResponse.json(
        { error: 'Failed to fetch store addresses', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Server error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Add new store address
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate required fields
    const requiredFields = [
      'store_name',
      'contact_person_name', 
      'phone_number',
      'address_line_1',
      'city',
      'state',
      'pincode'
    ]
    
    const missingFields = requiredFields.filter(field => !body[field])
    if (missingFields.length > 0) {
      return NextResponse.json(
        { error: `Missing required fields: ${missingFields.join(', ')}` },
        { status: 400 }
      )
    }

    // Insert new store address
    const { data, error } = await supabase
      .from('store_addresses')
      .insert([{
        store_name: body.store_name,
        address_type: body.address_type || 'Store',
        contact_person_name: body.contact_person_name,
        phone_number: body.phone_number,
        address_line_1: body.address_line_1,
        address_line_2: body.address_line_2,
        landmark: body.landmark,
        city: body.city,
        state: body.state,
        pincode: body.pincode,
        latitude: body.latitude ? parseFloat(body.latitude) : null,
        longitude: body.longitude ? parseFloat(body.longitude) : null,
        is_active: true
      }])
      .select()

    if (error) {
      console.error('Error adding store address:', error)
      return NextResponse.json(
        { error: 'Failed to add store address', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: data[0] }, { status: 201 })
  } catch (error) {
    console.error('Server error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
