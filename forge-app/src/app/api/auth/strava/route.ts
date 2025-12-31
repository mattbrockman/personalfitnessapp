import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStravaAuthUrl } from '@/lib/strava'

export async function GET() {
  // Verify user is logged in
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) {
    return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL))
  }

  // Generate Strava OAuth URL
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/strava/callback`
  const state = session.user.id // Pass user ID in state for verification
  const authUrl = getStravaAuthUrl(redirectUri, state)

  return NextResponse.redirect(authUrl)
}
