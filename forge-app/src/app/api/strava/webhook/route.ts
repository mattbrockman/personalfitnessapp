import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// Verify token for Strava webhook subscription
const WEBHOOK_VERIFY_TOKEN = process.env.STRAVA_WEBHOOK_VERIFY_TOKEN || 'forge-strava-webhook'

// GET /api/strava/webhook - Webhook verification (Strava sends this during subscription setup)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  // Strava sends these params for verification
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  // Verify the request is from Strava
  if (mode === 'subscribe' && token === WEBHOOK_VERIFY_TOKEN) {
    console.log('Strava webhook subscription verified')
    // Return the challenge to confirm subscription
    return NextResponse.json({ 'hub.challenge': challenge })
  }

  console.error('Invalid webhook verification request:', { mode, token })
  return NextResponse.json({ error: 'Invalid verification request' }, { status: 403 })
}

// POST /api/strava/webhook - Receive webhook events from Strava
export async function POST(request: NextRequest) {
  try {
    const event = await request.json()

    console.log('Received Strava webhook event:', {
      object_type: event.object_type,
      object_id: event.object_id,
      aspect_type: event.aspect_type,
      owner_id: event.owner_id,
    })

    // Validate required fields
    if (!event.object_type || !event.object_id || !event.aspect_type || !event.owner_id) {
      console.error('Invalid webhook event - missing required fields:', event)
      return NextResponse.json({ error: 'Invalid event' }, { status: 400 })
    }

    // Store the event in the queue for processing
    // Using admin client since webhooks don't have user auth
    const adminClient = createAdminClient()

    const { error } = await (adminClient as any)
      .from('strava_webhook_events')
      .insert({
        object_type: event.object_type,     // 'activity' or 'athlete'
        object_id: event.object_id,          // Activity ID or athlete ID
        aspect_type: event.aspect_type,      // 'create', 'update', or 'delete'
        owner_id: event.owner_id,            // Strava athlete ID
        subscription_id: event.subscription_id,
        updates: event.updates || null,      // For updates, contains changed fields
        processed: false,
      })

    if (error) {
      console.error('Failed to store webhook event:', error)
      // Still return 200 to acknowledge receipt - Strava will retry otherwise
    }

    // Always return 200 quickly to acknowledge receipt
    // Processing happens asynchronously via the processor endpoint
    return NextResponse.json({ received: true })

  } catch (error) {
    console.error('Webhook error:', error)
    // Return 200 anyway to prevent Strava from retrying
    return NextResponse.json({ received: true })
  }
}
