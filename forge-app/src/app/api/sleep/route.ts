import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/sleep - Fetch sleep logs
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const limit = parseInt(searchParams.get('limit') || '30')

    let query = (supabase as any)
      .from('sleep_logs')
      .select('*')
      .eq('user_id', user.id)
      .order('log_date', { ascending: false })
      .limit(limit)

    if (startDate) {
      query = query.gte('log_date', startDate)
    }
    if (endDate) {
      query = query.lte('log_date', endDate)
    }

    const { data: sleepLogs, error } = await query

    console.log('Sleep GET - user:', user.id, 'found:', sleepLogs?.length || 0, 'logs')

    if (error) {
      console.error('Error fetching sleep logs:', error)
      return NextResponse.json({ error: 'Failed to fetch sleep logs' }, { status: 500 })
    }

    return NextResponse.json({ sleepLogs: sleepLogs || [] })
  } catch (error) {
    console.error('Error in sleep GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/sleep - Create or update sleep log
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      log_date,
      bedtime,
      wake_time,
      total_sleep_minutes,
      time_in_bed_minutes,
      deep_sleep_minutes,
      rem_sleep_minutes,
      light_sleep_minutes,
      awake_minutes,
      sleep_score,
      hrv_avg,
      resting_hr,
      respiratory_rate,
      recovery_score,
      source,
      notes,
    } = body

    if (!log_date) {
      return NextResponse.json({ error: 'log_date is required' }, { status: 400 })
    }

    // Convert "HH:MM" times to full timestamps if needed
    let bedtimeValue = null
    let wakeTimeValue = null

    if (bedtime && typeof bedtime === 'string' && bedtime.match(/^\d{2}:\d{2}$/)) {
      bedtimeValue = `${log_date}T${bedtime}:00`
    } else if (bedtime) {
      bedtimeValue = bedtime
    }

    if (wake_time && typeof wake_time === 'string' && wake_time.match(/^\d{2}:\d{2}$/)) {
      wakeTimeValue = `${log_date}T${wake_time}:00`
    } else if (wake_time) {
      wakeTimeValue = wake_time
    }

    // Upsert - update if exists for this date, insert if not
    const { data: sleepLog, error } = await (supabase as any)
      .from('sleep_logs')
      .upsert({
        user_id: user.id,
        log_date,
        bedtime: bedtimeValue,
        wake_time: wakeTimeValue,
        total_sleep_minutes,
        time_in_bed_minutes,
        deep_sleep_minutes,
        rem_sleep_minutes,
        light_sleep_minutes,
        awake_minutes,
        sleep_score,
        hrv_avg,
        resting_hr,
        respiratory_rate,
        recovery_score,
        source: source || 'manual',
        notes,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,log_date',
      })
      .select()
      .single()

    if (error) {
      console.error('Error saving sleep log:', error)
      return NextResponse.json({ error: 'Failed to save sleep log' }, { status: 500 })
    }

    return NextResponse.json({ sleepLog })
  } catch (error) {
    console.error('Error in sleep POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/sleep - Delete a sleep log
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const logDate = searchParams.get('log_date')

    if (!logDate) {
      return NextResponse.json({ error: 'log_date is required' }, { status: 400 })
    }

    const { error } = await (supabase as any)
      .from('sleep_logs')
      .delete()
      .eq('user_id', user.id)
      .eq('log_date', logDate)

    if (error) {
      console.error('Error deleting sleep log:', error)
      return NextResponse.json({ error: 'Failed to delete sleep log' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in sleep DELETE:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
