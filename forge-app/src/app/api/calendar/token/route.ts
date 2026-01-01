import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// GET /api/calendar/token - Get current calendar settings and URL
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminClient = createAdminClient()

    // Get or create calendar token
    const { data: profile, error: profileError } = await (adminClient as any)
      .from('profiles')
      .select('calendar_token, calendar_enabled')
      .eq('id', user.id)
      .single()

    if (profileError) {
      throw profileError
    }

    // If no token exists, generate one
    let token = profile.calendar_token
    if (!token) {
      const { data: updatedProfile, error: updateError } = await (adminClient as any)
        .from('profiles')
        .update({ calendar_token: crypto.randomUUID() })
        .eq('id', user.id)
        .select('calendar_token')
        .single()

      if (updateError) throw updateError
      token = updatedProfile.calendar_token
    }

    // Build the full URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://forge.app'
    const calendarUrl = `${baseUrl}/api/calendar/${token}`

    return NextResponse.json({
      calendar_enabled: profile.calendar_enabled || false,
      calendar_url: calendarUrl,
      token,
    })
  } catch (error) {
    console.error('Get calendar token error:', error)
    return NextResponse.json(
      { error: 'Failed to get calendar settings' },
      { status: 500 }
    )
  }
}

// POST /api/calendar/token - Regenerate token (invalidates old URL)
export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminClient = createAdminClient()

    // Generate new token
    const newToken = crypto.randomUUID()

    const { error: updateError } = await (adminClient as any)
      .from('profiles')
      .update({ calendar_token: newToken })
      .eq('id', user.id)

    if (updateError) throw updateError

    // Build the new URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://forge.app'
    const calendarUrl = `${baseUrl}/api/calendar/${newToken}`

    return NextResponse.json({
      calendar_url: calendarUrl,
      token: newToken,
      message: 'Calendar URL regenerated. Old URL will no longer work.',
    })
  } catch (error) {
    console.error('Regenerate calendar token error:', error)
    return NextResponse.json(
      { error: 'Failed to regenerate calendar URL' },
      { status: 500 }
    )
  }
}

// PATCH /api/calendar/token - Enable or disable calendar feed
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { enabled } = body

    if (typeof enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'enabled must be a boolean' },
        { status: 400 }
      )
    }

    const adminClient = createAdminClient()

    const { error: updateError } = await (adminClient as any)
      .from('profiles')
      .update({ calendar_enabled: enabled })
      .eq('id', user.id)

    if (updateError) throw updateError

    return NextResponse.json({
      calendar_enabled: enabled,
      message: enabled ? 'Calendar feed enabled' : 'Calendar feed disabled',
    })
  } catch (error) {
    console.error('Update calendar settings error:', error)
    return NextResponse.json(
      { error: 'Failed to update calendar settings' },
      { status: 500 }
    )
  }
}
