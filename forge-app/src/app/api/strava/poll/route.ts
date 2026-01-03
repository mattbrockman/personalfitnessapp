import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import {
  refreshStravaToken,
  getStravaActivities,
  mapStravaTypeToWorkoutType,
  metersToMiles,
  metersToFeet,
  estimateTSS,
} from '@/lib/strava'

// POST /api/strava/poll - Poll for recent Strava activities
// Used as a fallback when webhooks may not be working
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()

    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get Strava integration
    const { data: integration, error: intError } = await (adminClient as any)
      .from('integrations')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('provider', 'strava')
      .single()

    if (intError || !integration) {
      return NextResponse.json({ error: 'Strava not connected' }, { status: 400 })
    }

    // Check if webhook is working (received event in last 24 hours)
    const recentWebhookCutoff = new Date()
    recentWebhookCutoff.setHours(recentWebhookCutoff.getHours() - 24)

    if (integration.last_webhook_at) {
      const lastWebhook = new Date(integration.last_webhook_at)
      if (lastWebhook > recentWebhookCutoff) {
        // Webhook is working, skip polling
        return NextResponse.json({
          message: 'Webhook active, polling skipped',
          last_webhook_at: integration.last_webhook_at,
          synced: 0,
        })
      }
    }

    // Check if we polled recently (within last 30 minutes)
    const recentPollCutoff = new Date()
    recentPollCutoff.setMinutes(recentPollCutoff.getMinutes() - 30)

    if (integration.last_poll_at) {
      const lastPoll = new Date(integration.last_poll_at)
      if (lastPoll > recentPollCutoff) {
        return NextResponse.json({
          message: 'Recently polled, skipping',
          last_poll_at: integration.last_poll_at,
          synced: 0,
        })
      }
    }

    // Refresh token if needed
    let accessToken = integration.access_token
    const tokenExpiry = integration.expires_at
      ? new Date(integration.expires_at).getTime() / 1000
      : 0
    const now = Date.now() / 1000

    if (tokenExpiry && tokenExpiry < now + 60) {
      try {
        const newTokens = await refreshStravaToken(integration.refresh_token)
        accessToken = newTokens.access_token

        await (adminClient as any)
          .from('integrations')
          .update({
            access_token: newTokens.access_token,
            refresh_token: newTokens.refresh_token,
          })
          .eq('id', integration.id)
      } catch (refreshError) {
        return NextResponse.json({ error: 'Token refresh failed' }, { status: 401 })
      }
    }

    // Fetch activities from last 7 days
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const activities = await getStravaActivities(accessToken, {
      after: Math.floor(sevenDaysAgo.getTime() / 1000),
      per_page: 50,
    })

    // Get user's FTP for TSS calculation
    const { data: profile } = await (adminClient as any)
      .from('profiles')
      .select('ftp')
      .eq('id', session.user.id)
      .single()

    let synced = 0

    for (const activity of activities) {
      // Check if already linked
      const { data: existingLink } = await (adminClient as any)
        .from('strava_activity_links')
        .select('id')
        .eq('strava_activity_id', activity.id)
        .eq('user_id', session.user.id)
        .single()

      if (existingLink) {
        // Already synced
        continue
      }

      // Check for duplicate by external_id
      const { data: existingWorkout } = await (adminClient as any)
        .from('workouts')
        .select('id')
        .eq('external_id', String(activity.id))
        .eq('user_id', session.user.id)
        .single()

      if (existingWorkout) {
        // Create link for existing workout
        await (adminClient as any)
          .from('strava_activity_links')
          .insert({
            user_id: session.user.id,
            workout_id: existingWorkout.id,
            strava_activity_id: activity.id,
            sync_direction: 'pull',
          })
        continue
      }

      // Create new workout
      const { category, workoutType } = mapStravaTypeToWorkoutType(activity.sport_type)

      const { data: newWorkout, error: createError } = await (adminClient as any)
        .from('workouts')
        .insert({
          user_id: session.user.id,
          name: activity.name,
          category,
          workout_type: workoutType,
          status: 'completed',
          scheduled_date: activity.start_date_local?.split('T')[0],
          completed_at: activity.start_date,
          source: 'strava',
          external_id: String(activity.id),
          external_url: `https://www.strava.com/activities/${activity.id}`,
          planned_duration_minutes: Math.round(activity.elapsed_time / 60),
          actual_duration_minutes: Math.round(activity.moving_time / 60),
          actual_distance_miles: activity.distance ? metersToMiles(activity.distance) : null,
          actual_elevation_ft: activity.total_elevation_gain
            ? Math.round(metersToFeet(activity.total_elevation_gain))
            : null,
          actual_avg_hr: activity.average_heartrate || null,
          actual_max_hr: activity.max_heartrate || null,
          actual_avg_power: activity.average_watts || null,
          actual_np: activity.weighted_average_watts || null,
          actual_tss: estimateTSS(activity, profile?.ftp) || null,
          calories: activity.calories || null,
        })
        .select('id')
        .single()

      if (!createError && newWorkout) {
        // Create link
        await (adminClient as any)
          .from('strava_activity_links')
          .insert({
            user_id: session.user.id,
            workout_id: newWorkout.id,
            strava_activity_id: activity.id,
            sync_direction: 'pull',
          })
        synced++
      }
    }

    // Update last_poll_at
    await (adminClient as any)
      .from('integrations')
      .update({ last_poll_at: new Date().toISOString() })
      .eq('id', integration.id)

    return NextResponse.json({
      message: synced > 0 ? `Synced ${synced} new activities` : 'No new activities',
      synced,
      checked: activities.length,
    })

  } catch (error: any) {
    console.error('Strava poll error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// GET for convenience
export async function GET(request: NextRequest) {
  return POST(request)
}
