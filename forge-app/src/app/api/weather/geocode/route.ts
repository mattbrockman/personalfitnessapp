import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCoordinatesFromZip } from '@/lib/weather'

// POST /api/weather/geocode - Convert zip code to coordinates and save
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { zipCode, lat, lon, locationName } = body

    // If lat/lon provided directly (from browser geolocation)
    if (lat !== undefined && lon !== undefined) {
      const name = locationName || `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`

      // Save to profile
      const { error: updateError } = await (supabase as any)
        .from('profiles')
        .update({
          weather_lat: lat,
          weather_lon: lon,
          weather_location_name: name,
          weather_zip_code: null, // Clear zip if using coordinates directly
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)

      if (updateError) {
        console.error('Error saving location:', updateError)
        return NextResponse.json(
          { error: 'Failed to save location' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        lat,
        lon,
        name,
        saved: true,
      })
    }

    // If zip code provided, geocode it
    if (!zipCode) {
      return NextResponse.json(
        { error: 'Either zipCode or lat/lon required' },
        { status: 400 }
      )
    }

    // Get coordinates from zip code
    const location = await getCoordinatesFromZip(zipCode)

    // Save to profile
    const { error: updateError } = await (supabase as any)
      .from('profiles')
      .update({
        weather_zip_code: zipCode,
        weather_lat: location.lat,
        weather_lon: location.lon,
        weather_location_name: location.name,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)

    if (updateError) {
      console.error('Error saving location:', updateError)
      return NextResponse.json(
        { error: 'Failed to save location' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      lat: location.lat,
      lon: location.lon,
      name: location.name,
      saved: true,
    })
  } catch (error: any) {
    console.error('Geocoding error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to geocode location' },
      { status: 500 }
    )
  }
}
