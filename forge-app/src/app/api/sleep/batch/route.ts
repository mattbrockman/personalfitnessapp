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

    // Filter out logs without log_date and deduplicate by date
    const validLogs = sleepLogs.filter(log => log.log_date)

    if (validLogs.length === 0) {
      return NextResponse.json({
        error: 'No valid sleep logs to save (all missing log_date)',
        skipped: sleepLogs.length
      }, { status: 400 })
    }

    // Deduplicate by log_date (keep first occurrence)
    const seenDates = new Set<string>()
    const deduplicatedLogs = validLogs.filter(log => {
      if (seenDates.has(log.log_date)) {
        return false
      }
      seenDates.add(log.log_date)
      return true
    })

    console.log(`Batch save: ${sleepLogs.length} total, ${validLogs.length} valid, ${deduplicatedLogs.length} after dedup`)

    // Add user_id and timestamps to all logs
    // Also convert bedtime/wake_time from "HH:MM" to full timestamps
    const logsWithUserId = deduplicatedLogs.map(log => {
      const logDate = log.log_date

      // Convert "HH:MM" times to full timestamps
      let bedtime = null
      let wakeTime = null

      if (log.bedtime && typeof log.bedtime === 'string' && log.bedtime.match(/^\d{2}:\d{2}$/)) {
        // If bedtime is after 12:00, assume it's the night before
        const [hours] = log.bedtime.split(':').map(Number)
        const bedDate = hours >= 12 ? logDate : logDate // Same date if PM
        bedtime = `${bedDate}T${log.bedtime}:00`
      } else if (log.bedtime) {
        bedtime = log.bedtime
      }

      if (log.wake_time && typeof log.wake_time === 'string' && log.wake_time.match(/^\d{2}:\d{2}$/)) {
        wakeTime = `${logDate}T${log.wake_time}:00`
      } else if (log.wake_time) {
        wakeTime = log.wake_time
      }

      return {
        user_id: user.id,
        log_date: logDate,
        bedtime,
        wake_time: wakeTime,
        total_sleep_minutes: log.total_sleep_minutes,
        time_in_bed_minutes: log.time_in_bed_minutes,
        deep_sleep_minutes: log.deep_sleep_minutes,
        rem_sleep_minutes: log.rem_sleep_minutes,
        light_sleep_minutes: log.light_sleep_minutes,
        awake_minutes: log.awake_minutes,
        sleep_score: log.sleep_score,
        hrv_avg: log.hrv_avg,
        resting_hr: log.resting_hr,
        respiratory_rate: log.respiratory_rate,
        recovery_score: log.recovery_score,
        source: log.source || 'eight_sleep_screenshot',
        updated_at: new Date().toISOString(),
      }
    })

    console.log('Attempting to save sleep logs:', JSON.stringify(logsWithUserId, null, 2))

    // Upsert all logs (update if exists for user_id + log_date)
    const { data: savedLogs, error } = await (supabase as any)
      .from('sleep_logs')
      .upsert(logsWithUserId, {
        onConflict: 'user_id,log_date',
      })
      .select()

    if (error) {
      console.error('Error saving batch sleep logs:', error)
      return NextResponse.json({
        error: 'Failed to save sleep logs',
        details: error.message,
        code: error.code
      }, { status: 500 })
    }

    console.log('Saved sleep logs:', savedLogs?.length || 0, 'records')

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
