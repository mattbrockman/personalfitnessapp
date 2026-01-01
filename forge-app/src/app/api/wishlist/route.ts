import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// GET /api/wishlist - Get all wishlist items
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminClient = createAdminClient()

    const { data: items, error } = await (adminClient as any)
      .from('wishlist_items')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Wishlist fetch error:', error)
      return NextResponse.json({ error: 'Failed to fetch wishlist' }, { status: 500 })
    }

    return NextResponse.json({ items })
  } catch (error) {
    console.error('Wishlist GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/wishlist - Add item to wishlist
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { item, category = 'wishlist' } = body

    if (!item || typeof item !== 'string') {
      return NextResponse.json({ error: 'Item is required' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    const { data, error } = await (adminClient as any)
      .from('wishlist_items')
      .insert({
        user_id: session.user.id,
        item,
        category,
      })
      .select()
      .single()

    if (error) {
      console.error('Wishlist insert error:', error)
      return NextResponse.json({ error: 'Failed to add to wishlist' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Added to ${category}: "${item}"`,
      item: data,
    })
  } catch (error) {
    console.error('Wishlist POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/wishlist - Update wishlist item (e.g., mark as completed)
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id, category, completed } = body

    if (!id) {
      return NextResponse.json({ error: 'Item ID is required' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    const updates: Record<string, any> = { updated_at: new Date().toISOString() }
    if (category) updates.category = category
    if (completed !== undefined) {
      updates.category = completed ? 'completed' : 'wishlist'
      updates.completed_at = completed ? new Date().toISOString() : null
    }

    const { data, error } = await (adminClient as any)
      .from('wishlist_items')
      .update(updates)
      .eq('id', id)
      .eq('user_id', session.user.id)
      .select()
      .single()

    if (error) {
      console.error('Wishlist update error:', error)
      return NextResponse.json({ error: 'Failed to update wishlist item' }, { status: 500 })
    }

    return NextResponse.json({ success: true, item: data })
  } catch (error) {
    console.error('Wishlist PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/wishlist - Delete wishlist item
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Item ID is required' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    const { error } = await (adminClient as any)
      .from('wishlist_items')
      .delete()
      .eq('id', id)
      .eq('user_id', session.user.id)

    if (error) {
      console.error('Wishlist delete error:', error)
      return NextResponse.json({ error: 'Failed to delete wishlist item' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Wishlist DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
