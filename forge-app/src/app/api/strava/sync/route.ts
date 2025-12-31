import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { 
  refreshStravaToken, 
  getStravaActivities, 
  getStravaActivityZones,
  mapStravaTypeToWorkoutType,
  metersToMiles,
  metersToFeet,
  estimateTSS,
  StravaActivity,
} from '@/lib/strava'

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const adminSupabase = createAdminClient() as any

  // Get Strava integration
  const { data: integration, error: integrationError } = await adminSupabase
    .from('integrations')
    .select('*')
    .eq('user_id', session.user.id)
    .eq('provider', 'strava')
    .single()

  if (integrationError || !integration) {
    return NextResponse.json({ error: 'Strava not connected' }, { status: 400 })
  }

  let accessToken = integration.access_token!

  // Always try to refresh token to ensure it's valid
  try {
    const newTokens = await refreshStravaToken(integration.refresh_token!)
    accessToken = newTokens.access_token

    // Update tokens in database (only essential fields)
    await adminSupabase
      .from('integrations')
      .update({
        access_token: newTokens.access_token,
        refresh_token: newTokens.refresh_token,
      })
      .eq('id', integration.id)

  } catch (err) {
    console.error('Token refresh failed, trying with existing token:', err)
    // Continue with existing token - it might still work
  }

  try {
    // Get request body for sync options
    const body = await request.json().catch(() => ({}))
    const { daysBack = 30 } = body

    // Calculate date range
    const after = Math.floor(Date.now() / 1000) - (daysBack * 24 * 60 * 60)

    // Fetch activities
    const activities = await getStravaActivities(accessToken, {
      after,
      per_page: 100,
    })

    // Get user's FTP for TSS calculation
    const { data: profile } = await adminSupabase
      .from('profiles')
      .select('ftp_watts')
      .eq('id', session.user.id)
      .single()

    const ftp = profile?.ftp_watts

    // Process each activity
    const results: {
      synced: number
      matched: number
      skipped: number
      errors: number
      lastError?: string
    } = {
      synced: 0,
      matched: 0,
      skipped: 0,
      errors: 0,
    }

    for (const activity of activities) {
      try {
        // Check if already imported by looking for Strava URL in notes
        const stravaUrl = `strava.com/activities/${activity.id}`
        const { data: existing } = await adminSupabase
          .from('workouts')
          .select('id')
          .eq('user_id', session.user.id)
          .ilike('notes', `%${stravaUrl}%`)
          .single()

        if (existing) {
          results.skipped++
          continue
        }

        // Map to our workout type
        const { category, workoutType } = mapStravaTypeToWorkoutType(activity.sport_type || activity.type)
        const activityDate = activity.start_date_local.split('T')[0]

        // Try to find a matching planned workout on the same day
        const { data: plannedWorkout } = await adminSupabase
          .from('workouts')
          .select('id, name')
          .eq('user_id', session.user.id)
          .eq('scheduled_date', activityDate)
          .eq('status', 'planned')
          .or(`workout_type.eq.${workoutType},category.eq.${category}`)
          .single()

        // Actual data from Strava - only use columns that exist in database
        const durationMinutes = Math.round(activity.moving_time / 60)
        const distanceMiles = activity.distance ? metersToMiles(activity.distance).toFixed(2) : null

        // Build notes with Strava details
        const noteParts = [
          `Strava: ${activity.name}`,
          `Duration: ${durationMinutes} min`,
          distanceMiles ? `Distance: ${distanceMiles} mi` : null,
          activity.average_heartrate ? `Avg HR: ${Math.round(activity.average_heartrate)} bpm` : null,
          activity.average_watts ? `Avg Power: ${Math.round(activity.average_watts)}w` : null,
          `https://www.strava.com/activities/${activity.id}`,
        ].filter(Boolean).join(' | ')

        const actualData = {
          status: 'completed' as const,
          planned_duration_minutes: durationMinutes,
          notes: noteParts,
        }

        let workout
        let workoutError

        if (plannedWorkout) {
          // Update the existing planned workout with actual data
          const { data, error } = await adminSupabase
            .from('workouts')
            .update({
              ...actualData,
              // Keep the original planned name if it exists, otherwise use Strava name
              name: plannedWorkout.name || activity.name,
            })
            .eq('id', plannedWorkout.id)
            .select()
            .single()

          workout = data
          workoutError = error
          if (!error) results.matched++
        } else {
          // Create a new workout
          const workoutData = {
            user_id: session.user.id,
            scheduled_date: activityDate,
            category,
            workout_type: workoutType,
            name: activity.name,
            ...actualData,
          }

          const { data, error } = await adminSupabase
            .from('workouts')
            .insert(workoutData)
            .select()
            .single()

          workout = data
          workoutError = error
          if (!error) results.synced++
        }

        if (workoutError) {
          console.error('Error inserting workout:', workoutError)
          results.errors++
          results.lastError = workoutError.message
          continue
        }

      } catch (activityError: any) {
        console.error('Error processing activity:', activity.id, activityError)
        results.errors++
        results.lastError = activityError?.message || String(activityError)
      }
    }

    return NextResponse.json({
      success: true,
      version: 2,
      ...results,
      total: activities.length,
    })

  } catch (err: any) {
    console.error('Strava sync error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// GET endpoint to check sync status
export async function GET() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: integration } = await (supabase
    .from('integrations') as any)
    .select('id, service')
    .eq('user_id', session.user.id)
    .eq('provider', 'strava')
    .single()

  if (!integration) {
    return NextResponse.json({ connected: false })
  }

  return NextResponse.json({
    connected: true,
    service: integration.service,
  })
}
