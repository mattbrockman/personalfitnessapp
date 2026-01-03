import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import {
  refreshStravaToken,
  createStravaActivity,
  mapWorkoutTypeToStravaType,
  hasWriteScope,
} from '@/lib/strava'

// POST /api/strava/push - Push a workout to Strava
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()

    // Verify auth
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { workout_id } = await request.json()
    if (!workout_id) {
      return NextResponse.json({ error: 'workout_id is required' }, { status: 400 })
    }

    // Get the workout
    const { data: workout, error: workoutError } = await (adminClient as any)
      .from('workouts')
      .select('*')
      .eq('id', workout_id)
      .eq('user_id', session.user.id)
      .single()

    if (workoutError || !workout) {
      return NextResponse.json({ error: 'Workout not found' }, { status: 404 })
    }

    // Verify workout is completed
    if (workout.status !== 'completed') {
      return NextResponse.json(
        { error: 'Only completed workouts can be pushed to Strava' },
        { status: 400 }
      )
    }

    // Check if already pushed to Strava
    const { data: existingLink } = await (adminClient as any)
      .from('strava_activity_links')
      .select('id, strava_activity_id')
      .eq('workout_id', workout_id)
      .eq('sync_direction', 'push')
      .single()

    if (existingLink) {
      return NextResponse.json({
        error: 'Workout already synced to Strava',
        strava_activity_id: existingLink.strava_activity_id,
      }, { status: 409 })
    }

    // Get Strava integration
    const { data: integration, error: integrationError } = await (adminClient as any)
      .from('integrations')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('provider', 'strava')
      .single()

    if (integrationError || !integration) {
      return NextResponse.json({ error: 'Strava not connected' }, { status: 400 })
    }

    // Check for write scope
    if (!hasWriteScope(integration.scopes)) {
      return NextResponse.json({
        error: 'write_scope_required',
        message: 'Please reconnect Strava with write permissions to push workouts',
      }, { status: 403 })
    }

    // Refresh token if needed (Strava tokens expire)
    let accessToken = integration.access_token
    const tokenExpiry = integration.expires_at ? new Date(integration.expires_at).getTime() / 1000 : 0
    const now = Date.now() / 1000

    if (tokenExpiry && tokenExpiry < now + 60) {
      try {
        const newTokens = await refreshStravaToken(integration.refresh_token)
        accessToken = newTokens.access_token

        // Update stored tokens
        await (adminClient as any)
          .from('integrations')
          .update({
            access_token: newTokens.access_token,
            refresh_token: newTokens.refresh_token,
          })
          .eq('id', integration.id)
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError)
        return NextResponse.json({
          error: 'Token refresh failed. Please reconnect Strava.',
        }, { status: 401 })
      }
    }

    // Map workout to Strava activity format
    const sportType = mapWorkoutTypeToStravaType(workout.category, workout.workout_type)

    // Build activity description
    let description = workout.notes || ''
    if (workout.exercises_completed) {
      const exerciseCount = Array.isArray(workout.exercises_completed)
        ? workout.exercises_completed.length
        : 0
      if (exerciseCount > 0) {
        description = description
          ? `${description}\n\n${exerciseCount} exercises completed`
          : `${exerciseCount} exercises completed`
      }
    }
    description = description ? `${description}\n\nTracked with Forge` : 'Tracked with Forge'

    // Calculate elapsed time in seconds (prefer actual over planned)
    const durationMinutes = workout.actual_duration_minutes || workout.planned_duration_minutes
    const elapsedTime = durationMinutes
      ? durationMinutes * 60
      : 60 * 60 // Default 1 hour if no duration

    // Get the workout date - prefer scheduled_date, fall back to completed_at or created_at
    const workoutDate = workout.scheduled_date || workout.completed_at || workout.created_at
    // Ensure we have a proper ISO timestamp with time component
    const startDateLocal = workoutDate
      ? (workoutDate.includes('T') ? workoutDate : `${workoutDate}T09:00:00`)
      : new Date().toISOString()

    // Create Strava activity
    const stravaActivity = await createStravaActivity(accessToken, {
      name: workout.name || `${workout.category} - ${workout.workout_type}`,
      sport_type: sportType,
      start_date_local: startDateLocal,
      elapsed_time: elapsedTime,
      description: description,
      distance: workout.distance_miles ? workout.distance_miles * 1609.344 : undefined,
    })

    // Store the link
    const { error: linkError } = await (adminClient as any)
      .from('strava_activity_links')
      .insert({
        user_id: session.user.id,
        workout_id: workout_id,
        strava_activity_id: stravaActivity.id,
        sync_direction: 'push',
      })

    if (linkError) {
      console.error('Error storing activity link:', linkError)
      // Activity was created on Strava, so return success but log the error
    }

    return NextResponse.json({
      success: true,
      strava_activity_id: stravaActivity.id,
      strava_url: `https://www.strava.com/activities/${stravaActivity.id}`,
    })

  } catch (error: any) {
    console.error('Push to Strava error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to push workout to Strava' },
      { status: 500 }
    )
  }
}

// GET /api/strava/push?workout_id=xxx - Check if workout is already on Strava
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()

    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const workoutId = searchParams.get('workout_id')

    if (!workoutId) {
      return NextResponse.json({ error: 'workout_id is required' }, { status: 400 })
    }

    // Check for existing link
    const { data: link } = await (adminClient as any)
      .from('strava_activity_links')
      .select('strava_activity_id, sync_direction, synced_at')
      .eq('workout_id', workoutId)
      .eq('user_id', session.user.id)
      .single()

    if (link) {
      return NextResponse.json({
        synced: true,
        strava_activity_id: link.strava_activity_id,
        sync_direction: link.sync_direction,
        synced_at: link.synced_at,
        strava_url: `https://www.strava.com/activities/${link.strava_activity_id}`,
      })
    }

    return NextResponse.json({ synced: false })

  } catch (error: any) {
    console.error('Check Strava sync error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
