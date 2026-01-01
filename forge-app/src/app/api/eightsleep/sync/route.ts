import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSleepTrends, refreshToken, mapEightSleepToSleepLog } from '@/lib/eightsleep'

// POST /api/eightsleep/sync - Sync sleep data from Eight Sleep
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const { start_date, end_date } = body

    // Default to last 30 days
    const endDate = end_date || new Date().toISOString().split('T')[0]
    const startDate = start_date || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    // Get Eight Sleep credentials
    const { data: profile } = await (supabase as any)
      .from('profiles')
      .select('eightsleep_user_id, eightsleep_access_token, eightsleep_refresh_token, eightsleep_token_expires_at')
      .eq('id', user.id)
      .single()

    if (!profile?.eightsleep_user_id || !profile?.eightsleep_access_token) {
      return NextResponse.json(
        { error: 'Eight Sleep not connected. Please connect first.' },
        { status: 400 }
      )
    }

    let accessToken = profile.eightsleep_access_token

    // Check if token needs refresh
    const tokenExpiry = profile.eightsleep_token_expires_at
      ? new Date(profile.eightsleep_token_expires_at)
      : new Date(0)

    if (tokenExpiry < new Date()) {
      console.log('Eight Sleep token expired, refreshing...')
      try {
        const newTokens = await refreshToken(profile.eightsleep_refresh_token)
        accessToken = newTokens.access_token

        // Update tokens in database
        const newExpiry = new Date(Date.now() + newTokens.expires_in * 1000)
        await (supabase as any)
          .from('profiles')
          .update({
            eightsleep_access_token: newTokens.access_token,
            eightsleep_refresh_token: newTokens.refresh_token,
            eightsleep_token_expires_at: newExpiry.toISOString(),
          })
          .eq('id', user.id)
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError)
        return NextResponse.json(
          { error: 'Session expired. Please reconnect Eight Sleep.' },
          { status: 401 }
        )
      }
    }

    // Fetch sleep data from Eight Sleep
    console.log('Fetching Eight Sleep trends for user:', profile.eightsleep_user_id)
    console.log('Date range:', startDate, 'to', endDate)

    let trends
    try {
      trends = await getSleepTrends(
        accessToken,
        profile.eightsleep_user_id,
        startDate,
        endDate
      )
      console.log('Trends response:', JSON.stringify(trends).slice(0, 500))
    } catch (trendsError: any) {
      console.error('Failed to fetch trends:', trendsError)
      return NextResponse.json(
        { error: 'Failed to fetch sleep data from Eight Sleep', details: trendsError.message },
        { status: 500 }
      )
    }

    if (!trends.days || trends.days.length === 0) {
      return NextResponse.json({
        synced: 0,
        message: 'No sleep data found for the specified period'
      })
    }

    // Map Eight Sleep data to our schema
    console.log('Mapping', trends.days.length, 'days of sleep data')
    const sleepLogs = trends.days
      .filter(day => day.sessions && day.sessions.length > 0)
      .map(day => {
        // Use the main/first session for each day
        const session = day.sessions[0]
        return {
          user_id: user.id,
          ...mapEightSleepToSleepLog(day, session),
          updated_at: new Date().toISOString(),
        }
      })

    console.log('Mapped sleep logs:', sleepLogs.length)

    if (sleepLogs.length === 0) {
      return NextResponse.json({
        synced: 0,
        message: 'No sleep sessions found for the specified period'
      })
    }

    // Upsert sleep logs
    const { data: savedLogs, error: upsertError } = await (supabase as any)
      .from('sleep_logs')
      .upsert(sleepLogs, {
        onConflict: 'user_id,log_date',
      })
      .select()

    if (upsertError) {
      console.error('Error saving sleep logs:', upsertError)
      return NextResponse.json(
        { error: 'Failed to save sleep data', details: upsertError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      synced: savedLogs?.length || sleepLogs.length,
      start_date: startDate,
      end_date: endDate,
    })
  } catch (error: any) {
    console.error('Eight Sleep sync error:', error)
    return NextResponse.json(
      { error: 'Failed to sync data', details: error.message },
      { status: 500 }
    )
  }
}
