import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSleepTrends, refreshToken } from '@/lib/eightsleep'

// GET /api/eightsleep/debug - Debug Eight Sleep API response
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get Eight Sleep credentials
    const { data: profile } = await (supabase as any)
      .from('profiles')
      .select('eightsleep_user_id, eightsleep_access_token, eightsleep_refresh_token, eightsleep_token_expires_at')
      .eq('id', user.id)
      .single()

    if (!profile?.eightsleep_user_id) {
      return NextResponse.json({ error: 'Not connected' }, { status: 400 })
    }

    let accessToken = profile.eightsleep_access_token

    // Check if token needs refresh
    const tokenExpiry = profile.eightsleep_token_expires_at
      ? new Date(profile.eightsleep_token_expires_at)
      : new Date(0)

    if (tokenExpiry < new Date()) {
      try {
        const newTokens = await refreshToken(profile.eightsleep_refresh_token)
        accessToken = newTokens.access_token

        const newExpiry = new Date(Date.now() + newTokens.expires_in * 1000)
        await (supabase as any)
          .from('profiles')
          .update({
            eightsleep_access_token: newTokens.access_token,
            eightsleep_refresh_token: newTokens.refresh_token,
            eightsleep_token_expires_at: newExpiry.toISOString(),
          })
          .eq('id', user.id)
      } catch (e) {
        return NextResponse.json({ error: 'Token refresh failed', details: e }, { status: 401 })
      }
    }

    // Fetch last 7 days
    const endDate = new Date().toISOString().split('T')[0]
    const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    const trends = await getSleepTrends(
      accessToken,
      profile.eightsleep_user_id,
      startDate,
      endDate
    )

    return NextResponse.json({
      user_id: profile.eightsleep_user_id,
      date_range: { start: startDate, end: endDate },
      raw_response: trends,
      days_count: trends.days?.length || 0,
      first_day: trends.days?.[0] || null,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
