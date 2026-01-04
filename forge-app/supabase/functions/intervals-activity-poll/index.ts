// Intervals.icu Activity Poll Edge Function
// Runs on a schedule (every 15 minutes) to check for completed activities
// and create RPE prompts for matched workouts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const INTERVALS_API_BASE = 'https://intervals.icu/api/v1'
const INTERVALS_TOKEN_URL = 'https://intervals.icu/oauth/token'

// ============================================================================
// Types
// ============================================================================

interface IntervalsActivity {
  id: string
  start_date_local: string
  name: string
  type: string
  source: string
  moving_time: number
  elapsed_time: number
  distance?: number
  total_elevation_gain?: number
  average_watts?: number
  icu_weighted_avg_watts?: number
  average_heartrate?: number
  max_heartrate?: number
  icu_training_load?: number
  external_id?: string
}

interface Integration {
  id: string
  user_id: string
  access_token: string
  refresh_token: string
  token_expires_at: string
  intervals_athlete_id: string
}

interface PushSubscription {
  endpoint: string
  keys_p256dh: string
  keys_auth: string
}

// ============================================================================
// Helpers
// ============================================================================

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

function mapSourceToPlatform(source: string): string {
  const mapping: Record<string, string> = {
    'ZWIFT': 'zwift',
    'WAHOO': 'wahoo',
    'WAHOO_CLOUD': 'wahoo',
    'GARMIN': 'garmin',
    'GARMIN_CONNECT': 'garmin',
    'STRAVA': 'strava',
  }
  return mapping[source?.toUpperCase()] || 'other'
}

// ============================================================================
// Token Management
// ============================================================================

async function refreshToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  const response = await fetch(INTERVALS_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
  })

  if (!response.ok) {
    throw new Error(`Token refresh failed: ${await response.text()}`)
  }

  return response.json()
}

async function getValidToken(
  supabase: any,
  integration: Integration,
  clientId: string,
  clientSecret: string
): Promise<string> {
  const expiresAt = new Date(integration.token_expires_at)
  const now = new Date()
  const bufferMs = 5 * 60 * 1000 // 5 minutes

  if (expiresAt.getTime() - now.getTime() < bufferMs) {
    // Refresh token
    const tokens = await refreshToken(integration.refresh_token, clientId, clientSecret)

    // Update in database
    await supabase
      .from('integrations')
      .update({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || integration.refresh_token,
        token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', integration.id)

    return tokens.access_token
  }

  return integration.access_token
}

// ============================================================================
// Intervals.icu API
// ============================================================================

async function getActivities(
  token: string,
  athleteId: string,
  startDate: string,
  endDate: string
): Promise<IntervalsActivity[]> {
  const response = await fetch(
    `${INTERVALS_API_BASE}/athlete/${athleteId}/activities?oldest=${startDate}&newest=${endDate}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  )

  if (!response.ok) {
    throw new Error(`Failed to fetch activities: ${await response.text()}`)
  }

  return response.json()
}

// ============================================================================
// Push Notifications (simplified for Edge Function)
// ============================================================================

async function sendPushNotification(
  subscription: PushSubscription,
  title: string,
  body: string,
  data: Record<string, unknown>
): Promise<boolean> {
  // Note: Full web-push implementation requires crypto operations
  // For production, consider calling your Next.js API endpoint instead
  try {
    const appUrl = Deno.env.get('NEXT_PUBLIC_APP_URL') || 'https://forge.app'

    // Call the Next.js API to send the notification
    const response = await fetch(`${appUrl}/api/push-notifications/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({
        subscription: {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.keys_p256dh,
            auth: subscription.keys_auth,
          },
        },
        payload: { title, body, data },
      }),
    })

    return response.ok
  } catch (error) {
    console.error('Failed to send push notification:', error)
    return false
  }
}

// ============================================================================
// Main Handler
// ============================================================================

Deno.serve(async (req) => {
  // This function should be called by pg_cron or a scheduled task
  // Verify the request is authorized
  const authHeader = req.headers.get('Authorization')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!authHeader || !authHeader.includes(serviceRoleKey || '')) {
    // Allow cron jobs without auth header (they come from within Supabase)
    if (req.headers.get('X-Supabase-Cron') !== 'true') {
      return new Response('Unauthorized', { status: 401 })
    }
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabase = createClient(supabaseUrl, serviceRoleKey!)

  const intervalsClientId = Deno.env.get('INTERVALS_ICU_CLIENT_ID')
  const intervalsClientSecret = Deno.env.get('INTERVALS_ICU_CLIENT_SECRET')

  if (!intervalsClientId || !intervalsClientSecret) {
    return new Response(
      JSON.stringify({ error: 'Intervals.icu credentials not configured' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const results = {
    users_processed: 0,
    activities_found: 0,
    matched: 0,
    rpe_prompts_created: 0,
    notifications_sent: 0,
    errors: [] as string[],
  }

  try {
    // Get all users with Intervals.icu connected
    const { data: integrations, error: integrationError } = await supabase
      .from('integrations')
      .select('*')
      .eq('provider', 'intervals_icu')
      .not('access_token', 'is', null)

    if (integrationError) {
      throw new Error(`Failed to fetch integrations: ${integrationError.message}`)
    }

    const today = new Date()
    const threeDaysAgo = new Date()
    threeDaysAgo.setDate(today.getDate() - 3)

    for (const integration of integrations || []) {
      try {
        // Get valid token
        const token = await getValidToken(
          supabase,
          integration as Integration,
          intervalsClientId,
          intervalsClientSecret
        )

        // Fetch activities
        const activities = await getActivities(
          token,
          integration.intervals_athlete_id,
          formatDate(threeDaysAgo),
          formatDate(today)
        )

        results.activities_found += activities.length

        // Get pushed events for this user
        const { data: eventLinks } = await supabase
          .from('intervals_event_links')
          .select('*, workouts(*)')
          .eq('user_id', integration.user_id)
          .eq('sync_direction', 'push')
          .gte('scheduled_date', formatDate(threeDaysAgo))

        const linksByExternalId = new Map(
          eventLinks?.map((l: any) => [l.external_id, l]) || []
        )

        // Get user profile settings
        const { data: profile } = await supabase
          .from('profiles')
          .select('rpe_prompt_delay_minutes, push_notifications_enabled')
          .eq('id', integration.user_id)
          .single()

        const promptDelay = profile?.rpe_prompt_delay_minutes || 30

        for (const activity of activities) {
          // Try to match by external_id
          const matchedLink = activity.external_id
            ? linksByExternalId.get(activity.external_id)
            : null

          if (matchedLink && matchedLink.workout_id) {
            // Check if workout already completed
            if (matchedLink.workouts?.status === 'completed') {
              continue
            }

            // Update workout with actual metrics
            await supabase
              .from('workouts')
              .update({
                status: 'completed',
                completed_at: activity.start_date_local,
                actual_duration_minutes: Math.round(activity.moving_time / 60),
                actual_avg_power: activity.average_watts,
                actual_np: activity.icu_weighted_avg_watts,
                actual_avg_hr: activity.average_heartrate,
                actual_max_hr: activity.max_heartrate,
                actual_tss: activity.icu_training_load,
                training_load: activity.icu_training_load,
                external_id: activity.id,
                updated_at: new Date().toISOString(),
              })
              .eq('id', matchedLink.workout_id)

            // Check for existing RPE prompt
            const { data: existingPrompt } = await supabase
              .from('rpe_prompts')
              .select('id, responded_at')
              .eq('workout_id', matchedLink.workout_id)
              .single()

            if (!existingPrompt) {
              // Create RPE prompt
              const completedAt = new Date(activity.start_date_local)
              const durationMinutes = activity.moving_time / 60
              const scheduledFor = new Date(
                completedAt.getTime() + (durationMinutes + promptDelay) * 60 * 1000
              )

              await supabase
                .from('rpe_prompts')
                .insert({
                  user_id: integration.user_id,
                  workout_id: matchedLink.workout_id,
                  intervals_activity_id: activity.id,
                  source_platform: mapSourceToPlatform(activity.source),
                  prompt_type: 'both',
                  scheduled_for: scheduledFor.toISOString(),
                })

              results.rpe_prompts_created++

              // Send push notification if enabled and prompt is due
              if (profile?.push_notifications_enabled && scheduledFor <= new Date()) {
                const { data: subscriptions } = await supabase
                  .from('push_subscriptions')
                  .select('*')
                  .eq('user_id', integration.user_id)

                for (const sub of subscriptions || []) {
                  const sent = await sendPushNotification(
                    sub as PushSubscription,
                    'How was your workout?',
                    `Rate your ${matchedLink.workouts?.name || 'workout'}`,
                    {
                      type: 'rpe_prompt',
                      workout_id: matchedLink.workout_id,
                      url: `/calendar?rpe=${matchedLink.workout_id}`,
                    }
                  )

                  if (sent) {
                    results.notifications_sent++

                    // Update prompt as sent
                    await supabase
                      .from('rpe_prompts')
                      .update({ sent_at: new Date().toISOString() })
                      .eq('workout_id', matchedLink.workout_id)
                  }
                }
              }
            }

            results.matched++
          }
        }

        // Update last poll timestamp
        await supabase
          .from('integrations')
          .update({
            last_poll_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', integration.id)

        results.users_processed++

      } catch (userError: any) {
        results.errors.push(`User ${integration.user_id}: ${userError.message}`)
      }
    }

  } catch (error: any) {
    results.errors.push(error.message)
    return new Response(
      JSON.stringify({ error: error.message, results }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  return new Response(
    JSON.stringify(results),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
})
