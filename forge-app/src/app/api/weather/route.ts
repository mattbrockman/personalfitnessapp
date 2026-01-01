import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWeatherForecast } from '@/lib/weather'

// GET /api/weather - Get weather forecast for user's saved location
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's saved location
    const { data: profile } = await (supabase as any)
      .from('profiles')
      .select('weather_lat, weather_lon, weather_location_name')
      .eq('id', user.id)
      .single()

    if (!profile?.weather_lat || !profile?.weather_lon) {
      return NextResponse.json({
        error: 'No location set',
        message: 'Please set your location in Settings to see weather forecasts',
      }, { status: 400 })
    }

    // Fetch weather forecast
    const forecast = await getWeatherForecast(
      profile.weather_lat,
      profile.weather_lon,
      14 // 14 days
    )

    return NextResponse.json({
      location: profile.weather_location_name || 'Unknown location',
      lat: profile.weather_lat,
      lon: profile.weather_lon,
      forecast,
    })
  } catch (error: any) {
    console.error('Weather API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch weather', details: error.message },
      { status: 500 }
    )
  }
}
