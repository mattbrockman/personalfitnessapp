import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { format, subDays, addDays } from 'date-fns'
import {
  CalendarEvent,
  generateVCalendar,
  getWorkoutEmoji,
  getEventEmoji,
  applyTimeToDate,
  calculateEndTime,
} from '@/lib/ical'

// GET /api/calendar/[token] - Returns iCal feed
// No authentication needed - token IS the authentication
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    // Validate token format (should be UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!token || !uuidRegex.test(token)) {
      return new NextResponse('Calendar not found', { status: 404 })
    }

    const adminClient = createAdminClient()

    // 1. Look up user by calendar_token
    const { data: profile, error: profileError } = await (adminClient as any)
      .from('profiles')
      .select('id, calendar_enabled, full_name')
      .eq('calendar_token', token)
      .single()

    if (profileError || !profile) {
      return new NextResponse('Calendar not found', { status: 404 })
    }

    // 2. Check if calendar is enabled
    if (!profile.calendar_enabled) {
      return new NextResponse('Calendar feed is disabled', { status: 403 })
    }

    const userId = profile.id
    const today = format(new Date(), 'yyyy-MM-dd')
    const ninetyDaysAgo = format(subDays(new Date(), 90), 'yyyy-MM-dd')
    const oneYearFromNow = format(addDays(new Date(), 365), 'yyyy-MM-dd')

    // 3. Get active training plan
    const { data: activePlan } = await (adminClient as any)
      .from('training_plans')
      .select('id, name')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single()

    // 4. Fetch suggested workouts (future only, from active plan)
    let suggestedWorkouts: any[] = []
    if (activePlan) {
      const { data } = await (adminClient as any)
        .from('suggested_workouts')
        .select('*')
        .eq('plan_id', activePlan.id)
        .gte('suggested_date', today)
        .lte('suggested_date', oneYearFromNow)
        .in('status', ['suggested', 'scheduled'])
        .order('suggested_date', { ascending: true })

      suggestedWorkouts = data || []
    }

    // 5. Fetch actual workouts (90 days past + all future)
    const { data: workouts } = await (adminClient as any)
      .from('workouts')
      .select('*')
      .eq('user_id', userId)
      .gte('scheduled_date', ninetyDaysAgo)
      .lte('scheduled_date', oneYearFromNow)
      .order('scheduled_date', { ascending: true })

    // 6. Fetch plan events (from active plan)
    let planEvents: any[] = []
    if (activePlan) {
      const { data } = await (adminClient as any)
        .from('plan_events')
        .select('*')
        .eq('plan_id', activePlan.id)
        .gte('event_date', ninetyDaysAgo)
        .order('event_date', { ascending: true })

      planEvents = data || []
    }

    // 7. Convert to CalendarEvent format
    const calendarEvents: CalendarEvent[] = []

    // Add suggested workouts
    for (const sw of suggestedWorkouts) {
      const startDate = applyTimeToDate(new Date(sw.suggested_date), sw.scheduled_time)
      const endDate = sw.duration_minutes
        ? calculateEndTime(startDate, sw.duration_minutes)
        : calculateEndTime(startDate, 60) // Default 1 hour

      const emoji = getWorkoutEmoji(sw.workout_type || sw.category || 'other')
      const description = buildSuggestedWorkoutDescription(sw)

      calendarEvents.push({
        uid: `suggested-${sw.id}@forge.app`,
        title: `${emoji} ${sw.name || sw.workout_type || 'Workout'}`,
        start: startDate,
        end: endDate,
        description,
        status: 'TENTATIVE', // Suggested workouts are tentative
      })
    }

    // Add actual workouts
    for (const w of workouts || []) {
      const startDate = applyTimeToDate(new Date(w.scheduled_date), w.scheduled_time)
      const duration = w.actual_duration_minutes || w.planned_duration_minutes || 60
      const endDate = calculateEndTime(startDate, duration)

      const emoji = getWorkoutEmoji(w.workout_type || w.category || 'other')
      const description = buildWorkoutDescription(w)

      calendarEvents.push({
        uid: `workout-${w.id}@forge.app`,
        title: `${emoji} ${w.name || w.workout_type || 'Workout'}`,
        start: startDate,
        end: endDate,
        description,
        status: w.status === 'completed' ? 'CONFIRMED' :
                w.status === 'skipped' ? 'CANCELLED' : 'CONFIRMED',
      })
    }

    // Add plan events (races, competitions, etc.)
    for (const event of planEvents) {
      const emoji = getEventEmoji(event.event_type || 'other')
      const description = buildEventDescription(event)

      if (event.end_date && event.end_date !== event.event_date) {
        // Multi-day event
        calendarEvents.push({
          uid: `event-${event.id}@forge.app`,
          title: `${emoji} ${event.name}`,
          start: new Date(event.event_date),
          end: new Date(event.end_date),
          allDay: true,
          description,
          location: event.location,
          status: 'CONFIRMED',
        })
      } else {
        // Single day event
        calendarEvents.push({
          uid: `event-${event.id}@forge.app`,
          title: `${emoji} ${event.name}`,
          start: new Date(event.event_date),
          allDay: true,
          description,
          location: event.location,
          status: 'CONFIRMED',
        })
      }
    }

    // 8. Generate iCal
    const calendarName = profile.full_name
      ? `FORGE - ${profile.full_name}'s Training`
      : 'FORGE Training'

    const icalContent = generateVCalendar(calendarEvents, calendarName)

    // 9. Return with proper headers
    return new NextResponse(icalContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'attachment; filename="forge-training.ics"',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    })
  } catch (error) {
    console.error('Calendar feed error:', error)
    return new NextResponse('Internal server error', { status: 500 })
  }
}

// Helper: Build description for suggested workouts
function buildSuggestedWorkoutDescription(sw: any): string {
  const lines: string[] = []

  lines.push('📋 SUGGESTED WORKOUT')

  if (sw.workout_type) {
    lines.push(`Type: ${sw.workout_type}`)
  }
  if (sw.category) {
    lines.push(`Category: ${sw.category}`)
  }
  if (sw.intensity_level) {
    lines.push(`Intensity: ${sw.intensity_level}`)
  }
  if (sw.duration_minutes) {
    lines.push(`Duration: ${sw.duration_minutes} min`)
  }
  if (sw.target_tss) {
    lines.push(`Target TSS: ${sw.target_tss}`)
  }
  if (sw.description) {
    lines.push('')
    lines.push(sw.description)
  }
  if (sw.notes) {
    lines.push('')
    lines.push(`Notes: ${sw.notes}`)
  }

  return lines.join('\n')
}

// Helper: Build description for actual workouts
function buildWorkoutDescription(w: any): string {
  const lines: string[] = []

  const statusLabel = w.status === 'completed' ? '✅ COMPLETED' :
                      w.status === 'skipped' ? '⏭️ SKIPPED' :
                      w.status === 'planned' ? '📅 PLANNED' : '📋 SCHEDULED'
  lines.push(statusLabel)

  if (w.workout_type) {
    lines.push(`Type: ${w.workout_type}`)
  }
  if (w.category) {
    lines.push(`Category: ${w.category}`)
  }
  if (w.intensity_level) {
    lines.push(`Intensity: ${w.intensity_level}`)
  }

  // Planned metrics
  if (w.planned_duration_minutes) {
    lines.push(`Planned: ${w.planned_duration_minutes} min`)
  }
  if (w.planned_tss) {
    lines.push(`Planned TSS: ${w.planned_tss}`)
  }

  // Actual metrics (for completed workouts)
  if (w.status === 'completed') {
    lines.push('')
    lines.push('--- Actual Results ---')
    if (w.actual_duration_minutes) {
      lines.push(`Duration: ${w.actual_duration_minutes} min`)
    }
    if (w.actual_distance_km) {
      lines.push(`Distance: ${w.actual_distance_km.toFixed(1)} km`)
    }
    if (w.actual_tss) {
      lines.push(`TSS: ${w.actual_tss}`)
    }
    if (w.avg_heart_rate) {
      lines.push(`Avg HR: ${w.avg_heart_rate} bpm`)
    }
    if (w.avg_power) {
      lines.push(`Avg Power: ${w.avg_power}W`)
    }
    if (w.normalized_power) {
      lines.push(`NP: ${w.normalized_power}W`)
    }
    if (w.avg_pace_per_km) {
      lines.push(`Avg Pace: ${w.avg_pace_per_km}`)
    }
    if (w.total_elevation_gain_m) {
      lines.push(`Elevation: ${w.total_elevation_gain_m}m`)
    }
  }

  if (w.description) {
    lines.push('')
    lines.push(w.description)
  }
  if (w.notes) {
    lines.push('')
    lines.push(`Notes: ${w.notes}`)
  }

  return lines.join('\n')
}

// Helper: Build description for plan events
function buildEventDescription(event: any): string {
  const lines: string[] = []

  if (event.event_type) {
    const typeLabel = event.event_type.charAt(0).toUpperCase() + event.event_type.slice(1)
    lines.push(`Type: ${typeLabel}`)
  }
  if (event.priority) {
    lines.push(`Priority: ${event.priority}-Race`)
  }
  if (event.sport) {
    lines.push(`Sport: ${event.sport}`)
  }
  if (event.distance_km) {
    lines.push(`Distance: ${event.distance_km} km`)
  }
  if (event.elevation_gain_m) {
    lines.push(`Elevation: ${event.elevation_gain_m}m`)
  }
  if (event.expected_duration_hours) {
    lines.push(`Expected Duration: ${event.expected_duration_hours}h`)
  }
  if (event.goal_time) {
    lines.push(`Goal Time: ${event.goal_time}`)
  }
  if (event.description) {
    lines.push('')
    lines.push(event.description)
  }
  if (event.notes) {
    lines.push('')
    lines.push(`Notes: ${event.notes}`)
  }

  return lines.join('\n')
}
