import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createJunctionUser, getLinkToken } from '@/lib/junction'

// POST /api/junction/link - Get link token for connecting a provider
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const providers = body.providers as string[] | undefined

    // Get or create Junction user
    let { data: profile } = await (supabase as any)
      .from('profiles')
      .select('junction_user_id')
      .eq('id', user.id)
      .single()

    let junctionUserId = profile?.junction_user_id

    // Create Junction user if doesn't exist
    if (!junctionUserId) {
      const junctionUser = await createJunctionUser(user.id)
      junctionUserId = junctionUser.user_id

      // Save to profile
      await (supabase as any)
        .from('profiles')
        .update({ junction_user_id: junctionUserId })
        .eq('id', user.id)
    }

    // Get link token
    const linkToken = await getLinkToken(junctionUserId, providers)

    return NextResponse.json({
      link_token: linkToken.link_token,
      junction_user_id: junctionUserId
    })
  } catch (error) {
    console.error('Error getting link token:', error)
    return NextResponse.json({ error: 'Failed to get link token' }, { status: 500 })
  }
}
