import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// Type for collection (not in generated types yet)
interface Collection {
  id: string
  user_id: string | null
  name: string
  slug: string
  description: string | null
  icon: string | null
  color: string | null
  is_system: boolean
  created_at: string
}

// GET /api/exercise-collections/[id] - Get a specific collection with exercises
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()
    const { id } = await params

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id

    const { data: collection, error } = await adminClient
      .from('exercise_collections')
      .select(`
        *,
        items:exercise_collection_items (
          id,
          notes,
          added_at,
          exercise:exercises (
            id,
            name,
            description,
            primary_muscle,
            secondary_muscles,
            equipment,
            difficulty,
            is_compound,
            is_unilateral,
            is_timed,
            coaching_cues,
            thumbnail_url
          )
        )
      `)
      .eq('id', id)
      .or(`is_system.eq.true,user_id.eq.${userId}`)
      .single()

    if (error) {
      console.error('Error fetching collection:', error)
      return NextResponse.json({ error: 'Collection not found' }, { status: 404 })
    }

    return NextResponse.json({ collection })
  } catch (error) {
    console.error('Get collection error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/exercise-collections/[id] - Update collection details
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()
    const { id } = await params

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    const body = await request.json()
    const { name, description, icon, color } = body

    // Check ownership (can't edit system collections)
    const { data: existing } = await (adminClient as any)
      .from('exercise_collections')
      .select('id, user_id, is_system')
      .eq('id', id)
      .single() as { data: Collection | null }

    if (!existing) {
      return NextResponse.json({ error: 'Collection not found' }, { status: 404 })
    }

    if (existing.is_system || existing.user_id !== userId) {
      return NextResponse.json({ error: 'Cannot edit this collection' }, { status: 403 })
    }

    const updates: Record<string, any> = {}
    if (name) updates.name = name
    if (description !== undefined) updates.description = description
    if (icon) updates.icon = icon
    if (color) updates.color = color

    const { data: collection, error } = await (adminClient as any)
      .from('exercise_collections')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating collection:', error)
      return NextResponse.json({ error: 'Failed to update collection' }, { status: 500 })
    }

    return NextResponse.json({ collection })
  } catch (error) {
    console.error('Update collection error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/exercise-collections/[id] - Delete a collection
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()
    const { id } = await params

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id

    // Check ownership (can't delete system collections)
    const { data: existing } = await (adminClient as any)
      .from('exercise_collections')
      .select('id, user_id, is_system')
      .eq('id', id)
      .single() as { data: Collection | null }

    if (!existing) {
      return NextResponse.json({ error: 'Collection not found' }, { status: 404 })
    }

    if (existing.is_system || existing.user_id !== userId) {
      return NextResponse.json({ error: 'Cannot delete this collection' }, { status: 403 })
    }

    const { error } = await (adminClient as any)
      .from('exercise_collections')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting collection:', error)
      return NextResponse.json({ error: 'Failed to delete collection' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete collection error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
