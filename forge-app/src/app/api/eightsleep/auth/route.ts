import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { authenticate } from '@/lib/eightsleep'

// POST /api/eightsleep/auth - Authenticate with Eight Sleep
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Authenticate with Eight Sleep
    const tokens = await authenticate(email, password)

    // Calculate expiry time
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000)

    // Save tokens to profile
    const { error: updateError } = await (supabase as any)
      .from('profiles')
      .update({
        eightsleep_user_id: tokens.user_id,
        eightsleep_access_token: tokens.access_token,
        eightsleep_refresh_token: tokens.refresh_token,
        eightsleep_token_expires_at: expiresAt.toISOString(),
      })
      .eq('id', user.id)

    if (updateError) {
      console.error('Error saving Eight Sleep tokens:', updateError)
      return NextResponse.json(
        { error: 'Failed to save credentials' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      user_id: tokens.user_id,
      expires_at: expiresAt.toISOString(),
    })
  } catch (error: any) {
    console.error('Eight Sleep auth error:', error)
    return NextResponse.json(
      { error: error.message || 'Authentication failed' },
      { status: 500 }
    )
  }
}

// GET /api/eightsleep/auth - Check connection status
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await (supabase as any)
      .from('profiles')
      .select('eightsleep_user_id, eightsleep_token_expires_at')
      .eq('id', user.id)
      .single()

    const isConnected = !!profile?.eightsleep_user_id
    const isExpired = profile?.eightsleep_token_expires_at
      ? new Date(profile.eightsleep_token_expires_at) < new Date()
      : true

    return NextResponse.json({
      connected: isConnected,
      needs_refresh: isConnected && isExpired,
      user_id: profile?.eightsleep_user_id || null,
    })
  } catch (error) {
    console.error('Error checking Eight Sleep status:', error)
    return NextResponse.json({ error: 'Failed to check status' }, { status: 500 })
  }
}

// DELETE /api/eightsleep/auth - Disconnect Eight Sleep
export async function DELETE() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await (supabase as any)
      .from('profiles')
      .update({
        eightsleep_user_id: null,
        eightsleep_access_token: null,
        eightsleep_refresh_token: null,
        eightsleep_token_expires_at: null,
      })
      .eq('id', user.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error disconnecting Eight Sleep:', error)
    return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 })
  }
}
