import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/sleep/batch - Save multiple sleep logs at once
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { sleepLogs } = await request.json()

    if (!sleepLogs || !Array.isArray(sleepLogs) || sleepLogs.length === 0) {
      return NextResponse.json({ error: 'sleepLogs array is required' }, { status: 400 })
    }

    // Validate all logs have required fields
    for (const log of sleepLogs) {
      if (!log.log_date) {
        return NextResponse.json({ error: 'Each log must have a log_date' }, { status: 400 })
      }
    }

    // Add user_id and timestamps to all logs
    const logsWithUserId = sleepLogs.map(log => ({
      ...log,
      user_id: user.id,
      source: log.source || 'eight_sleep_screenshot',
      updated_at: new Date().toISOString(),
    }))

    // Upsert all logs (update if exists for user_id + log_date)
    const { data: savedLogs, error } = await (supabase as any)
      .from('sleep_logs')
      .upsert(logsWithUserId, {
        onConflict: 'user_id,log_date',
      })
      .select()

    if (error) {
      console.error('Error saving batch sleep logs:', error)
      return NextResponse.json({ error: 'Failed to save sleep logs' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      count: savedLogs?.length || logsWithUserId.length,
      sleepLogs: savedLogs
    })
  } catch (error) {
    console.error('Error in sleep batch POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
