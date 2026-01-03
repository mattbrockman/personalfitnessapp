import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import {
  refreshStravaToken,
  getStravaActivityById,
  mapStravaTypeToWorkoutType,
  metersToMiles,
  metersToFeet,
  estimateTSS,
} from '@/lib/strava'

// Secret for cron job authentication
const CRON_SECRET = process.env.CRON_SECRET

// POST /api/strava/process-webhooks - Process queued webhook events
// Called by Vercel Cron or manually
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret if set (for production security)
    const authHeader = request.headers.get('authorization')
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminClient = createAdminClient()

    // Get unprocessed events (limit to avoid timeouts, oldest first)
    const { data: events, error: fetchError } = await (adminClient as any)
      .from('strava_webhook_events')
      .select('*')
      .eq('processed', false)
      .order('created_at', { ascending: true })
      .limit(10)

    if (fetchError) {
      console.error('Failed to fetch webhook events:', fetchError)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    if (!events || events.length === 0) {
      return NextResponse.json({ message: 'No events to process', processed: 0 })
    }

    console.log(`Processing ${events.length} webhook events`)

    let processed = 0
    let errors = 0

    for (const event of events) {
      try {
        // Only handle activity events for now
        if (event.object_type !== 'activity') {
          await markEventProcessed(adminClient, event.id, 'Skipped: not an activity event')
          continue
        }

        // Find user by strava_athlete_id
        const { data: integration, error: intError } = await (adminClient as any)
          .from('integrations')
          .select('*')
          .eq('strava_athlete_id', String(event.owner_id))
          .eq('provider', 'strava')
          .single()

        if (intError || !integration) {
          await markEventProcessed(adminClient, event.id, 'No integration found for athlete')
          continue
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
            await markEventProcessed(adminClient, event.id, `Token refresh failed: ${refreshError}`)
            errors++
            continue
          }
        }

        // Handle different event types
        if (event.aspect_type === 'create' || event.aspect_type === 'update') {
          // Fetch the activity from Strava
          const activity = await getStravaActivityById(accessToken, event.object_id)

          // Check if we already have this activity linked
          const { data: existingLink } = await (adminClient as any)
            .from('strava_activity_links')
            .select('workout_id')
            .eq('strava_activity_id', event.object_id)
            .eq('user_id', integration.user_id)
            .single()

          const { category, workoutType } = mapStravaTypeToWorkoutType(activity.sport_type)

          // Get user's FTP for TSS calculation
          const { data: profile } = await (adminClient as any)
            .from('profiles')
            .select('ftp')
            .eq('id', integration.user_id)
            .single()

          const workoutData = {
            user_id: integration.user_id,
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
          }

          if (existingLink) {
            // Update existing workout
            const { error: updateError } = await (adminClient as any)
              .from('workouts')
              .update(workoutData)
              .eq('id', existingLink.workout_id)

            if (updateError) {
              await markEventProcessed(adminClient, event.id, `Update failed: ${updateError.message}`)
              errors++
              continue
            }
          } else {
            // Create new workout
            const { data: newWorkout, error: createError } = await (adminClient as any)
              .from('workouts')
              .insert(workoutData)
              .select('id')
              .single()

            if (createError) {
              await markEventProcessed(adminClient, event.id, `Create failed: ${createError.message}`)
              errors++
              continue
            }

            // Create the link
            await (adminClient as any)
              .from('strava_activity_links')
              .insert({
                user_id: integration.user_id,
                workout_id: newWorkout.id,
                strava_activity_id: activity.id,
                sync_direction: 'pull',
              })
          }

          // Update last_webhook_at timestamp
          await (adminClient as any)
            .from('integrations')
            .update({ last_webhook_at: new Date().toISOString() })
            .eq('id', integration.id)

        } else if (event.aspect_type === 'delete') {
          // Find and optionally delete the linked workout
          const { data: link } = await (adminClient as any)
            .from('strava_activity_links')
            .select('workout_id')
            .eq('strava_activity_id', event.object_id)
            .eq('user_id', integration.user_id)
            .single()

          if (link) {
            // Delete the link (keep the workout as orphan, user can delete manually)
            await (adminClient as any)
              .from('strava_activity_links')
              .delete()
              .eq('strava_activity_id', event.object_id)
              .eq('user_id', integration.user_id)

            // Optionally: Update workout to mark as unlinked from Strava
            await (adminClient as any)
              .from('workouts')
              .update({ external_id: null, external_url: null })
              .eq('id', link.workout_id)
          }
        }

        await markEventProcessed(adminClient, event.id, null)
        processed++

      } catch (eventError: any) {
        console.error(`Error processing event ${event.id}:`, eventError)
        await markEventProcessed(adminClient, event.id, eventError.message || 'Unknown error')
        errors++
      }
    }

    return NextResponse.json({
      message: 'Processing complete',
      processed,
      errors,
      total: events.length,
    })

  } catch (error: any) {
    console.error('Webhook processor error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

async function markEventProcessed(
  adminClient: any,
  eventId: string,
  error: string | null
) {
  await (adminClient as any)
    .from('strava_webhook_events')
    .update({
      processed: true,
      processed_at: new Date().toISOString(),
      error: error,
    })
    .eq('id', eventId)
}

// Also support GET for manual testing/cron
export async function GET(request: NextRequest) {
  return POST(request)
}
