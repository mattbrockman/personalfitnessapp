import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { exchangeStravaCode } from '@/lib/strava'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state') // User ID passed from initiation
  const error = searchParams.get('error')

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://personalfitnessapp.vercel.app'

  // Handle user denial
  if (error) {
    console.error('Strava auth error:', error)
    return NextResponse.redirect(`${baseUrl}/calendar?error=strava_denied`)
  }

  if (!code) {
    console.error('No code received from Strava')
    return NextResponse.redirect(`${baseUrl}/calendar?error=no_code`)
  }

  // Verify user session
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    console.error('No session found during Strava callback')
    return NextResponse.redirect(`${baseUrl}/login`)
  }

  // Verify state matches user
  if (state && state !== session.user.id) {
    console.error('State mismatch:', state, 'vs', session.user.id)
    return NextResponse.redirect(`${baseUrl}/calendar?error=state_mismatch`)
  }

  try {
    // Exchange code for tokens
    console.log('Exchanging Strava code for tokens...')
    const tokens = await exchangeStravaCode(code)
    console.log('Got tokens for athlete:', tokens.athlete.id)

    // Store integration in database using admin client
    const adminSupabase = createAdminClient()

    // First check if integration exists
    const { data: existing } = await (adminSupabase
      .from('integrations') as any)
      .select('id')
      .eq('user_id', session.user.id)
      .eq('service', 'strava')
      .single()

    const integrationData = {
      user_id: session.user.id,
      service: 'strava',
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: new Date(tokens.expires_at * 1000).toISOString(),
      external_user_id: tokens.athlete.id.toString(),
      scopes: ['read', 'activity:read_all', 'profile:read_all'],
      sync_status: 'active',
    }

    let saveError
    if (existing) {
      // Update existing
      const { error } = await (adminSupabase
        .from('integrations') as any)
        .update(integrationData)
        .eq('id', existing.id)
      saveError = error
    } else {
      // Insert new
      const { error } = await (adminSupabase
        .from('integrations') as any)
        .insert(integrationData)
      saveError = error
    }

    if (saveError) {
      console.error('Error saving Strava integration:', saveError)
      return NextResponse.redirect(`${baseUrl}/calendar?error=save_failed&details=${encodeURIComponent(saveError.message)}`)
    }

    console.log('Strava integration saved successfully')
    // Redirect to calendar with success
    return NextResponse.redirect(`${baseUrl}/calendar?strava=connected`)

  } catch (err: any) {
    console.error('Strava token exchange error:', err)
    return NextResponse.redirect(`${baseUrl}/calendar?error=token_exchange_failed&details=${encodeURIComponent(err.message)}`)
  }
}
