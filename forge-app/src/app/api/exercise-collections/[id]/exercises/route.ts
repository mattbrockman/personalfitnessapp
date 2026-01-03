import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// Type for collection (not in generated types yet)
interface Collection {
  id: string
  user_id: string | null
  is_system: boolean
}

// POST /api/exercise-collections/[id]/exercises - Add exercise to collection
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()
    const { id: collectionId } = await params

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    const body = await request.json()
    const { exercise_id, notes } = body

    if (!exercise_id) {
      return NextResponse.json({ error: 'exercise_id is required' }, { status: 400 })
    }

    // Check collection ownership (must be user's collection)
    const { data: collection } = await (adminClient as any)
      .from('exercise_collections')
      .select('id, user_id, is_system')
      .eq('id', collectionId)
      .single() as { data: Collection | null }

    if (!collection) {
      return NextResponse.json({ error: 'Collection not found' }, { status: 404 })
    }

    if (collection.is_system || collection.user_id !== userId) {
      return NextResponse.json({ error: 'Cannot modify this collection' }, { status: 403 })
    }

    // Check if exercise exists
    const { data: exercise } = await adminClient
      .from('exercises')
      .select('id, name')
      .eq('id', exercise_id)
      .single()

    if (!exercise) {
      return NextResponse.json({ error: 'Exercise not found' }, { status: 404 })
    }

    // Add to collection (upsert to handle duplicates gracefully)
    const { data: item, error } = await (adminClient as any)
      .from('exercise_collection_items')
      .upsert({
        collection_id: collectionId,
        exercise_id,
        notes: notes || null,
      }, {
        onConflict: 'collection_id,exercise_id',
      })
      .select(`
        id,
        notes,
        added_at,
        exercise:exercises (
          id,
          name,
          primary_muscle,
          equipment
        )
      `)
      .single()

    if (error) {
      console.error('Error adding to collection:', error)
      return NextResponse.json({ error: 'Failed to add exercise' }, { status: 500 })
    }

    return NextResponse.json({ item, message: `Added ${(exercise as any).name} to collection` }, { status: 201 })
  } catch (error) {
    console.error('Add to collection error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/exercise-collections/[id]/exercises - Remove exercise from collection
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()
    const { id: collectionId } = await params

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    const searchParams = request.nextUrl.searchParams
    const exerciseId = searchParams.get('exercise_id')

    if (!exerciseId) {
      return NextResponse.json({ error: 'exercise_id is required' }, { status: 400 })
    }

    // Check collection ownership
    const { data: collection } = await (adminClient as any)
      .from('exercise_collections')
      .select('id, user_id, is_system')
      .eq('id', collectionId)
      .single() as { data: Collection | null }

    if (!collection) {
      return NextResponse.json({ error: 'Collection not found' }, { status: 404 })
    }

    if (collection.is_system || collection.user_id !== userId) {
      return NextResponse.json({ error: 'Cannot modify this collection' }, { status: 403 })
    }

    const { error } = await (adminClient as any)
      .from('exercise_collection_items')
      .delete()
      .eq('collection_id', collectionId)
      .eq('exercise_id', exerciseId)

    if (error) {
      console.error('Error removing from collection:', error)
      return NextResponse.json({ error: 'Failed to remove exercise' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Remove from collection error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
