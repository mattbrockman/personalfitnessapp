import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getConnectedProviders } from '@/lib/junction'

// GET /api/junction/providers - Get connected providers for current user
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get Junction user ID from profile
    const { data: profile, error: profileError } = await (supabase as any)
      .from('profiles')
      .select('junction_user_id')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error('Error fetching profile:', profileError)
      // Column might not exist - check for that specific error
      if (profileError.message?.includes('junction_user_id')) {
        return NextResponse.json({
          error: 'Database migration required - junction_user_id column missing',
          providers: []
        }, { status: 500 })
      }
      return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 })
    }

    if (!profile?.junction_user_id) {
      return NextResponse.json({ providers: [] })
    }

    // Get connected providers from Junction
    const providers = await getConnectedProviders(profile.junction_user_id)

    // Update local cache of connected providers (ignore errors)
    const providerSlugs = providers.map(p => p.slug)
    await (supabase as any)
      .from('profiles')
      .update({ junction_connected_providers: providerSlugs })
      .eq('id', user.id)

    return NextResponse.json({ providers })
  } catch (error: any) {
    console.error('Error getting connected providers:', error)
    return NextResponse.json({
      error: 'Failed to get providers',
      details: error?.message || 'Unknown error'
    }, { status: 500 })
  }
}
