// Push notification subscription management
// POST: Save a new push subscription
// DELETE: Remove a push subscription
// GET: Get VAPID public key

import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getVapidPublicKey } from '@/lib/push-notifications'

// GET: Return VAPID public key for client-side subscription
export async function GET() {
  const publicKey = getVapidPublicKey()

  if (!publicKey) {
    return NextResponse.json(
      { error: 'Push notifications not configured' },
      { status: 503 }
    )
  }

  return NextResponse.json({ publicKey })
}

// POST: Save a new push subscription
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { subscription } = body

    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return NextResponse.json(
        { error: 'Invalid subscription object' },
        { status: 400 }
      )
    }

    const adminSupabase = createAdminClient()

    // Upsert the subscription (update if endpoint already exists)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: dbError } = await (adminSupabase as any)
      .from('push_subscriptions')
      .upsert({
        user_id: user.id,
        endpoint: subscription.endpoint,
        keys_p256dh: subscription.keys.p256dh,
        keys_auth: subscription.keys.auth,
        user_agent: request.headers.get('user-agent') || null,
        last_used_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,endpoint',
      })

    if (dbError) {
      console.error('Failed to save push subscription:', dbError)
      return NextResponse.json(
        { error: 'Failed to save subscription' },
        { status: 500 }
      )
    }

    // Enable push notifications in profile
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (adminSupabase as any)
      .from('profiles')
      .update({ push_notifications_enabled: true })
      .eq('id', user.id)

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Push subscription error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Subscription failed' },
      { status: 500 }
    )
  }
}

// DELETE: Remove a push subscription
export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { endpoint } = body

    if (!endpoint) {
      return NextResponse.json(
        { error: 'endpoint is required' },
        { status: 400 }
      )
    }

    const adminSupabase = createAdminClient()

    // Delete the subscription
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (adminSupabase as any)
      .from('push_subscriptions')
      .delete()
      .eq('user_id', user.id)
      .eq('endpoint', endpoint)

    // Check if user has any remaining subscriptions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: remaining } = await (adminSupabase as any)
      .from('push_subscriptions')
      .select('id')
      .eq('user_id', user.id)
      .limit(1)

    // If no subscriptions left, disable push in profile
    if (!remaining || remaining.length === 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (adminSupabase as any)
        .from('profiles')
        .update({ push_notifications_enabled: false })
        .eq('id', user.id)
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Push unsubscribe error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unsubscribe failed' },
      { status: 500 }
    )
  }
}
