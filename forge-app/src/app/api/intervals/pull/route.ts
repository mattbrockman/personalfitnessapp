// Pull activities from Intervals.icu
// Matches completed activities to pushed workouts and creates RPE prompts

import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { IntervalsICUClient, formatDateForIntervals, mapSourceToPlatform } from '@/lib/intervals-icu'

// Type for intervals_event_links joined data (table not in generated types yet)
interface EventLink {
  id: string
  user_id: string
  suggested_workout_id: string | null
  workout_id: string | null
  intervals_event_id: string
  external_id: string
  sync_direction: 'push' | 'pull'
  scheduled_date: string
  suggested_workouts?: {
    id: string
    name: string
    workout_type: string
    category: string
  } | null
  workouts?: {
    id: string
    name: string
    status: string
    completed_at: string | null
  } | null
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { days_back = 7, force_rematch = false } = body

    const adminSupabase = createAdminClient()

    // Check Intervals.icu connection
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: integration, error: integrationError } = await (adminSupabase as any)
      .from('integrations')
      .select('*')
      .eq('user_id', user.id)
      .eq('provider', 'intervals_icu')
      .single()

    if (integrationError || !integration) {
      return NextResponse.json(
        { error: 'Intervals.icu not connected' },
        { status: 400 }
      )
    }

    const client = new IntervalsICUClient(adminSupabase, user.id)

    const today = new Date()
    const startDate = new Date()
    startDate.setDate(today.getDate() - days_back)

    // Fetch activities from Intervals.icu
    const activities = await client.getActivities(
      formatDateForIntervals(startDate),
      formatDateForIntervals(today)
    )

    // Get our pushed events to match against
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: eventLinks } = await (adminSupabase as any)
      .from('intervals_event_links')
      .select(`
        *,
        suggested_workouts (
          id,
          name,
          workout_type,
          category
        ),
        workouts (
          id,
          name,
          status,
          completed_at
        )
      `)
      .eq('user_id', user.id)
      .eq('sync_direction', 'push')
      .gte('scheduled_date', formatDateForIntervals(startDate))

    // Get user's RPE prompt delay setting
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile } = await (adminSupabase as any)
      .from('profiles')
      .select('rpe_prompt_delay_minutes')
      .eq('id', user.id)
      .single()

    const promptDelay = profile?.rpe_prompt_delay_minutes || 30

    // Create lookup maps
    const typedEventLinks = eventLinks as EventLink[] | null
    const linksByExternalId = new Map(
      typedEventLinks?.map((l: EventLink) => [l.external_id, l]) || []
    )
    const linksByDate = new Map<string, EventLink[]>()
    typedEventLinks?.forEach((l: EventLink) => {
      const date = l.scheduled_date
      if (!linksByDate.has(date)) {
        linksByDate.set(date, [])
      }
      linksByDate.get(date)!.push(l)
    })

    const results = {
      activities_found: activities.length,
      matched: 0,
      new_workouts: 0,
      rpe_prompts_created: 0,
      details: [] as Array<{
        activity_id: string
        activity_name: string
        matched_workout_id: string | null
        source_platform: string
      }>,
    }

    for (const activity of activities) {
      let matchedLink = null

      // Try to match by external_id first (exact match)
      if (activity.external_id) {
        matchedLink = linksByExternalId.get(activity.external_id) || null
      }

      // Try date-based matching if no exact match
      if (!matchedLink) {
        const activityDate = activity.start_date_local.split('T')[0]
        const potentialMatches = linksByDate.get(activityDate) || []

        // Match by workout type
        for (const link of potentialMatches) {
          if (link.workouts?.status === 'completed' && !force_rematch) {
            continue // Skip already completed
          }

          // Basic type matching
          const activityType = activity.type?.toLowerCase() || ''
          const workoutType = link.suggested_workouts?.workout_type?.toLowerCase() || ''

          if (
            (activityType.includes('ride') && workoutType === 'bike') ||
            (activityType.includes('run') && workoutType === 'run') ||
            (activityType.includes('swim') && workoutType === 'swim')
          ) {
            matchedLink = link
            break
          }
        }
      }

      const sourcePlatform = mapSourceToPlatform(activity.source)

      if (matchedLink && matchedLink.workout_id) {
        // Check if already completed (unless force_rematch)
        if (matchedLink.workouts?.status === 'completed' && !force_rematch) {
          results.details.push({
            activity_id: activity.id,
            activity_name: activity.name,
            matched_workout_id: matchedLink.workout_id,
            source_platform: sourcePlatform,
          })
          continue
        }

        // Update the workout with actual metrics
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (adminSupabase as any)
          .from('workouts')
          .update({
            status: 'completed',
            completed_at: activity.start_date_local,
            actual_duration_minutes: Math.round(activity.moving_time / 60),
            actual_distance_miles: activity.distance ? activity.distance / 1609.344 : null,
            actual_elevation_ft: activity.total_elevation_gain ? activity.total_elevation_gain * 3.28084 : null,
            actual_avg_power: activity.average_watts,
            actual_np: activity.icu_weighted_avg_watts,
            actual_avg_hr: activity.average_heartrate,
            actual_max_hr: activity.max_heartrate,
            actual_tss: activity.icu_training_load,
            training_load: activity.icu_training_load,
            external_id: activity.id,
            external_url: `https://intervals.icu/activities/${activity.id}`,
            updated_at: new Date().toISOString(),
          })
          .eq('id', matchedLink.workout_id)

        // Create RPE prompt if not already responded
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: existingPrompt } = await (adminSupabase as any)
          .from('rpe_prompts')
          .select('id, responded_at')
          .eq('workout_id', matchedLink.workout_id)
          .single()

        if (!existingPrompt || (existingPrompt && !existingPrompt.responded_at)) {
          const completedAt = new Date(activity.start_date_local)
          const durationMinutes = activity.moving_time / 60
          const scheduledFor = new Date(completedAt.getTime() + (durationMinutes + promptDelay) * 60 * 1000)

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (adminSupabase as any)
            .from('rpe_prompts')
            .upsert({
              user_id: user.id,
              workout_id: matchedLink.workout_id,
              suggested_workout_id: matchedLink.suggested_workout_id,
              intervals_activity_id: activity.id,
              source_platform: sourcePlatform,
              prompt_type: 'both',
              scheduled_for: scheduledFor.toISOString(),
            }, {
              onConflict: 'workout_id',
            })

          results.rpe_prompts_created++
        }

        results.matched++
        results.details.push({
          activity_id: activity.id,
          activity_name: activity.name,
          matched_workout_id: matchedLink.workout_id,
          source_platform: sourcePlatform,
        })
      } else {
        // No match found - could create a new workout from the activity
        // For now, just log it
        results.details.push({
          activity_id: activity.id,
          activity_name: activity.name,
          matched_workout_id: null,
          source_platform: sourcePlatform,
        })
      }
    }

    // Update last poll timestamp
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (adminSupabase as any)
      .from('integrations')
      .update({
        last_poll_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', integration.id)

    return NextResponse.json(results)

  } catch (error) {
    console.error('Intervals.icu pull error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Pull failed' },
      { status: 500 }
    )
  }
}

// GET endpoint to check pull status
export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const adminSupabase = createAdminClient()

  // Get last poll time
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: integration } = await (adminSupabase as any)
    .from('integrations')
    .select('last_poll_at')
    .eq('user_id', user.id)
    .eq('provider', 'intervals_icu')
    .single()

  // Get recent event links
  const today = new Date()
  const weekAgo = new Date()
  weekAgo.setDate(today.getDate() - 7)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: recentLinks } = await (adminSupabase as any)
    .from('intervals_event_links')
    .select('*')
    .eq('user_id', user.id)
    .gte('synced_at', weekAgo.toISOString())
    .order('synced_at', { ascending: false })
    .limit(10)

  // Get pending RPE prompts
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: pendingPrompts } = await (adminSupabase as any)
    .from('rpe_prompts')
    .select(`
      *,
      workouts (
        id,
        name,
        scheduled_date,
        completed_at
      )
    `)
    .eq('user_id', user.id)
    .is('responded_at', null)
    .lte('scheduled_for', new Date().toISOString())
    .order('scheduled_for', { ascending: false })

  return NextResponse.json({
    connected: !!integration,
    last_poll_at: integration?.last_poll_at,
    recent_syncs: recentLinks?.length || 0,
    pending_rpe_prompts: pendingPrompts?.length || 0,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prompts: pendingPrompts?.map((p: any) => ({
      id: p.id,
      workout_id: p.workout_id,
      workout_name: p.workouts?.name,
      source_platform: p.source_platform,
      scheduled_for: p.scheduled_for,
    })),
  })
}
