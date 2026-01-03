import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStravaAuthUrl } from '@/lib/strava'

export async function GET(request: NextRequest) {
  // Check for upgrade flag (requesting write scope)
  const { searchParams } = new URL(request.url)
  const upgrade = searchParams.get('upgrade') === 'true'

  // Verify user is logged in
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL))
  }

  // Generate Strava OAuth URL
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/strava/callback`
  // Include upgrade flag in state for callback to know we're upgrading
  const state = upgrade ? `${session.user.id}:upgrade` : session.user.id
  const authUrl = getStravaAuthUrl(redirectUri, state, upgrade)

  return NextResponse.redirect(authUrl)
}
