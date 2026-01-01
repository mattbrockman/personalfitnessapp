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
    const { data: profile } = await (supabase as any)
      .from('profiles')
      .select('junction_user_id')
      .eq('id', user.id)
      .single()

    if (!profile?.junction_user_id) {
      return NextResponse.json({ providers: [] })
    }

    // Get connected providers from Junction
    const providers = await getConnectedProviders(profile.junction_user_id)

    // Update local cache of connected providers
    const providerSlugs = providers.map(p => p.slug)
    await (supabase as any)
      .from('profiles')
      .update({ junction_connected_providers: providerSlugs })
      .eq('id', user.id)

    return NextResponse.json({ providers })
  } catch (error) {
    console.error('Error getting connected providers:', error)
    return NextResponse.json({ error: 'Failed to get providers' }, { status: 500 })
  }
}
