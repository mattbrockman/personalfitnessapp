// Intervals.icu OAuth callback route - DEPRECATED
// OAuth has been replaced with API Key authentication
// This route just redirects to settings - use /api/auth/intervals/connect instead

import { NextResponse } from 'next/server'

export async function GET() {
  const settingsUrl = new URL('/settings', process.env.NEXT_PUBLIC_APP_URL)
  settingsUrl.searchParams.set('tab', 'integrations')
  settingsUrl.searchParams.set('message', 'Please use API key authentication to connect Intervals.icu')

  return NextResponse.redirect(settingsUrl)
}
