import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { exchangeStravaCode } from '@/lib/strava'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state') // User ID passed from initiation
  const error = searchParams.get('error')

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL!

  // Handle user denial
  if (error) {
    console.error('Strava auth error:', error)
    return NextResponse.redirect(`${baseUrl}/settings?error=strava_denied`)
  }

  if (!code) {
    return NextResponse.redirect(`${baseUrl}/settings?error=no_code`)
  }

  // Verify user session
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.redirect(`${baseUrl}/login`)
  }

  // Verify state matches user
  if (state && state !== session.user.id) {
    return NextResponse.redirect(`${baseUrl}/settings?error=state_mismatch`)
  }

  try {
    // Exchange code for tokens
    const tokens = await exchangeStravaCode(code)

    // Store integration in database using admin client
    const adminSupabase = createAdminClient()
    
    const integrationData = {
      user_id: session.user.id,
      service: 'strava',
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: new Date(tokens.expires_at * 1000).toISOString(),
      external_user_id: tokens.athlete.id.toString(),
      scopes: ['read', 'activity:read_all', 'profile:read_all'],
      last_sync_at: null,
      sync_status: 'active',
    }

    const { error: upsertError } = await (adminSupabase
      .from('integrations') as any)
      .upsert(integrationData, {
        onConflict: 'user_id,service',
      })

    if (upsertError) {
      console.error('Error saving Strava integration:', upsertError)
      return NextResponse.redirect(`${baseUrl}/settings?error=save_failed`)
    }

    // Redirect to settings with success
    return NextResponse.redirect(`${baseUrl}/settings?strava=connected`)

  } catch (err) {
    console.error('Strava token exchange error:', err)
    return NextResponse.redirect(`${baseUrl}/settings?error=token_exchange_failed`)
  }
}
