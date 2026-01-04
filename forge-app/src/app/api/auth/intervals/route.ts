// Intervals.icu OAuth route - Deprecated in favor of API Key authentication
// Redirects to settings page where user can enter their API key

import { NextResponse } from 'next/server'

export async function GET() {
  // Redirect to settings - API key auth is now used instead of OAuth
  const settingsUrl = new URL('/settings', process.env.NEXT_PUBLIC_APP_URL)
  settingsUrl.searchParams.set('tab', 'integrations')
  settingsUrl.searchParams.set('message', 'Enter your Intervals.icu API key in settings')

  return NextResponse.redirect(settingsUrl)
}
