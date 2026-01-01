import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { disconnectProvider, getConnectedProviders } from '@/lib/junction'

// POST /api/junction/disconnect - Disconnect a provider
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { provider } = body

    if (!provider) {
      return NextResponse.json({ error: 'Provider is required' }, { status: 400 })
    }

    // Get Junction user ID
    const { data: profile } = await (supabase as any)
      .from('profiles')
      .select('junction_user_id')
      .eq('id', user.id)
      .single()

    if (!profile?.junction_user_id) {
      return NextResponse.json({ error: 'No Junction connection' }, { status: 400 })
    }

    // Disconnect provider
    await disconnectProvider(profile.junction_user_id, provider)

    // Update local cache of connected providers
    const providers = await getConnectedProviders(profile.junction_user_id)
    const providerSlugs = providers.map(p => p.slug)

    await (supabase as any)
      .from('profiles')
      .update({ junction_connected_providers: providerSlugs })
      .eq('id', user.id)

    return NextResponse.json({
      success: true,
      disconnected: provider,
      remaining_providers: providerSlugs
    })
  } catch (error) {
    console.error('Error disconnecting provider:', error)
    return NextResponse.json({ error: 'Failed to disconnect provider' }, { status: 500 })
  }
}
