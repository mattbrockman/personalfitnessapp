import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createJunctionUser } from '@/lib/junction'

// POST /api/junction/user - Create Junction user for current user
export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user already has a Junction user ID
    const { data: profile } = await (supabase as any)
      .from('profiles')
      .select('junction_user_id')
      .eq('id', user.id)
      .single()

    if (profile?.junction_user_id) {
      return NextResponse.json({
        junction_user_id: profile.junction_user_id,
        already_exists: true
      })
    }

    // Create Junction user
    const junctionUser = await createJunctionUser(user.id)

    // Save Junction user ID to profile
    const { error: updateError } = await (supabase as any)
      .from('profiles')
      .update({ junction_user_id: junctionUser.user_id })
      .eq('id', user.id)

    if (updateError) {
      console.error('Error saving Junction user ID:', updateError)
      return NextResponse.json({ error: 'Failed to save Junction user' }, { status: 500 })
    }

    return NextResponse.json({
      junction_user_id: junctionUser.user_id,
      already_exists: false
    })
  } catch (error) {
    console.error('Error creating Junction user:', error)
    return NextResponse.json({ error: 'Failed to create Junction user' }, { status: 500 })
  }
}

// GET /api/junction/user - Get current user's Junction user ID
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await (supabase as any)
      .from('profiles')
      .select('junction_user_id, junction_connected_providers')
      .eq('id', user.id)
      .single()

    return NextResponse.json({
      junction_user_id: profile?.junction_user_id || null,
      connected_providers: profile?.junction_connected_providers || []
    })
  } catch (error) {
    console.error('Error getting Junction user:', error)
    return NextResponse.json({ error: 'Failed to get Junction user' }, { status: 500 })
  }
}
