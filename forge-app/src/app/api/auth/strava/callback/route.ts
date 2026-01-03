import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { exchangeStravaCode, parseScopeString } from '@/lib/strava'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state') // User ID (optionally with :upgrade suffix)
  const error = searchParams.get('error')
  const grantedScope = searchParams.get('scope') // Strava returns granted scopes in URL

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://forge.app'

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

  // Parse state - may include :upgrade suffix
  const [stateUserId, upgradeFlag] = state?.split(':') || []
  const isUpgrade = upgradeFlag === 'upgrade'

  // Verify state matches user
  if (stateUserId && stateUserId !== session.user.id) {
    console.error('State mismatch:', stateUserId, 'vs', session.user.id)
    return NextResponse.redirect(`${baseUrl}/calendar?error=state_mismatch`)
  }

  try {
    // Exchange code for tokens
    console.log('Exchanging Strava code for tokens...')
    const tokens = await exchangeStravaCode(code)
    console.log('Got tokens for athlete:', tokens.athlete.id)

    // Parse granted scopes from URL or token response
    const scopes = grantedScope ? parseScopeString(grantedScope) : []
    console.log('Granted scopes:', scopes)

    // Store integration in database using admin client
    const adminSupabase = createAdminClient()

    // First check if integration exists
    const { data: existing } = await (adminSupabase
      .from('integrations') as any)
      .select('id')
      .eq('user_id', session.user.id)
      .eq('provider', 'strava')
      .single()

    // Include new columns for scopes and athlete ID
    const integrationData = {
      user_id: session.user.id,
      provider: 'strava',
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      scopes: scopes,
      strava_athlete_id: String(tokens.athlete.id),
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
    // Redirect to calendar with success (include upgrade flag if applicable)
    const successParam = isUpgrade ? 'strava=upgraded' : 'strava=connected'
    return NextResponse.redirect(`${baseUrl}/calendar?${successParam}`)

  } catch (err: any) {
    console.error('Strava token exchange error:', err)
    return NextResponse.redirect(`${baseUrl}/calendar?error=token_exchange_failed&details=${encodeURIComponent(err.message)}`)
  }
}
