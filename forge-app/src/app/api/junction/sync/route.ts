import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSleepSummaries, mapJunctionSleepToSleepLog } from '@/lib/junction'

// POST /api/junction/sync - Sync sleep data from Junction
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const { start_date, end_date, provider } = body

    // Default to last 30 days if no dates provided
    const endDate = end_date || new Date().toISOString().split('T')[0]
    const startDate = start_date || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    // Get Junction user ID
    const { data: profile } = await (supabase as any)
      .from('profiles')
      .select('junction_user_id')
      .eq('id', user.id)
      .single()

    if (!profile?.junction_user_id) {
      return NextResponse.json({
        error: 'No Junction connection. Please connect a provider first.'
      }, { status: 400 })
    }

    // Fetch sleep data from Junction
    const sleepData = await getSleepSummaries(
      profile.junction_user_id,
      startDate,
      endDate,
      provider
    )

    if (sleepData.length === 0) {
      return NextResponse.json({
        synced: 0,
        message: 'No sleep data found for the specified period'
      })
    }

    // Map Junction data to our schema
    const sleepLogs = sleepData.map(sleep => ({
      user_id: user.id,
      ...mapJunctionSleepToSleepLog(sleep),
      updated_at: new Date().toISOString(),
    }))

    // Upsert sleep logs
    const { data: savedLogs, error: upsertError } = await (supabase as any)
      .from('sleep_logs')
      .upsert(sleepLogs, {
        onConflict: 'user_id,log_date',
      })
      .select()

    if (upsertError) {
      console.error('Error saving sleep logs:', upsertError)
      return NextResponse.json({
        error: 'Failed to save sleep data',
        details: upsertError.message
      }, { status: 500 })
    }

    return NextResponse.json({
      synced: savedLogs?.length || sleepLogs.length,
      start_date: startDate,
      end_date: endDate,
      provider: provider || 'all'
    })
  } catch (error) {
    console.error('Error syncing Junction data:', error)
    return NextResponse.json({ error: 'Failed to sync data' }, { status: 500 })
  }
}
