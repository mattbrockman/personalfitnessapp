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
    .eq('service', 'strava')
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
    const results = {
      synced: 0,
      matched: 0,
      skipped: 0,
      errors: 0,
    }

    for (const activity of activities) {
      try {
        // Check if already imported
        const { data: existing } = await adminSupabase
          .from('workouts')
          .select('id')
          .eq('user_id', session.user.id)
          .eq('source', 'strava')
          .eq('external_id', activity.id.toString())
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

        // Actual data from Strava
        const actualData = {
          completed_at: activity.start_date,
          actual_duration_minutes: Math.round(activity.moving_time / 60),
          actual_distance_miles: activity.distance ? parseFloat(metersToMiles(activity.distance).toFixed(2)) : null,
          actual_tss: estimateTSS(activity, ftp || undefined),
          actual_avg_hr: activity.average_heartrate || null,
          actual_max_hr: activity.max_heartrate || null,
          actual_avg_power: activity.average_watts || null,
          actual_elevation_ft: activity.total_elevation_gain ? Math.round(metersToFeet(activity.total_elevation_gain)) : null,
          status: 'completed' as const,
          source: 'strava' as const,
          external_id: activity.id.toString(),
          external_url: `https://www.strava.com/activities/${activity.id}`,
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
          continue
        }

        // Try to get zone data
        if (activity.has_heartrate || activity.device_watts) {
          try {
            const zones = await getStravaActivityZones(accessToken, activity.id)
            
            for (const zone of zones) {
              const zoneType = zone.type === 'heartrate' ? 'heart_rate' : 'power'
              
              const zoneData = {
                workout_id: workout.id,
                zone_type: zoneType,
                zone_1_seconds: zone.distribution_buckets[0]?.time || 0,
                zone_2_seconds: zone.distribution_buckets[1]?.time || 0,
                zone_3_seconds: zone.distribution_buckets[2]?.time || 0,
                zone_4_seconds: zone.distribution_buckets[3]?.time || 0,
                zone_5_seconds: zone.distribution_buckets[4]?.time || 0,
                zone_6_seconds: zone.distribution_buckets[5]?.time || 0,
                zone_7_seconds: zone.distribution_buckets[6]?.time || 0,
              }

              await adminSupabase
                .from('workout_zones')
                .insert(zoneData)
            }
          } catch (zoneError) {
            // Zones are optional, don't fail the whole sync
            console.warn('Could not get zones for activity', activity.id)
          }
        }

      } catch (activityError) {
        console.error('Error processing activity:', activity.id, activityError)
        results.errors++
      }
    }

    return NextResponse.json({
      success: true,
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
    .eq('service', 'strava')
    .single()

  if (!integration) {
    return NextResponse.json({ connected: false })
  }

  return NextResponse.json({
    connected: true,
    service: integration.service,
  })
}
