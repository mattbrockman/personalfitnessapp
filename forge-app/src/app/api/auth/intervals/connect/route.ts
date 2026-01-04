import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { validateIntervalsApiKey } from '@/lib/intervals-icu'

/**
 * POST /api/auth/intervals/connect
 * Connect to Intervals.icu using API Key authentication
 *
 * Body: { athlete_id: string, api_key: string }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { athlete_id, api_key } = await request.json()

    if (!athlete_id || !api_key) {
      return NextResponse.json(
        { error: 'Missing athlete_id or api_key' },
        { status: 400 }
      )
    }

    // Validate the API key by fetching athlete profile
    let athlete
    try {
      athlete = await validateIntervalsApiKey(athlete_id, api_key)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid credentials'
      return NextResponse.json({ error: message }, { status: 401 })
    }

    // Store credentials in integrations table
    const adminSupabase = createAdminClient()

    const { error: upsertError } = await (adminSupabase as any)
      .from('integrations')
      .upsert({
        user_id: session.user.id,
        provider: 'intervals_icu',
        access_token: api_key,  // Store API key in access_token field
        intervals_athlete_id: athlete_id,
        external_user_id: athlete_id,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,provider'
      })

    if (upsertError) {
      console.error('Failed to store Intervals.icu credentials:', upsertError)
      return NextResponse.json(
        { error: 'Failed to save connection' },
        { status: 500 }
      )
    }

    // Enable intervals sync in profile
    await (adminSupabase as any)
      .from('profiles')
      .update({ intervals_sync_enabled: true })
      .eq('id', session.user.id)

    return NextResponse.json({
      success: true,
      athlete: {
        id: athlete.id,
        name: athlete.name,
        email: athlete.email,
      }
    })
  } catch (error) {
    console.error('Intervals.icu connect error:', error)
    return NextResponse.json(
      { error: 'Failed to connect to Intervals.icu' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/auth/intervals/connect
 * Disconnect from Intervals.icu
 */
export async function DELETE() {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminSupabase = createAdminClient()

    // Remove integration
    await (adminSupabase as any)
      .from('integrations')
      .delete()
      .eq('user_id', session.user.id)
      .eq('provider', 'intervals_icu')

    // Disable intervals sync in profile
    await (adminSupabase as any)
      .from('profiles')
      .update({ intervals_sync_enabled: false })
      .eq('id', session.user.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Intervals.icu disconnect error:', error)
    return NextResponse.json(
      { error: 'Failed to disconnect' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/auth/intervals/connect
 * Check connection status
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: integration } = await (supabase as any)
      .from('integrations')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('provider', 'intervals_icu')
      .single()

    if (!integration) {
      return NextResponse.json({ connected: false })
    }

    return NextResponse.json({
      connected: true,
      athlete_id: integration.intervals_athlete_id || integration.external_user_id,
      connected_at: integration.updated_at,
    })
  } catch (error) {
    console.error('Intervals.icu status error:', error)
    return NextResponse.json({ connected: false })
  }
}
