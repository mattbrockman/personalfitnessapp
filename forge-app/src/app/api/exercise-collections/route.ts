import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// GET /api/exercise-collections - Get all collections (system + user's own)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    const searchParams = request.nextUrl.searchParams
    const includeExercises = searchParams.get('include_exercises') === 'true'
    const slug = searchParams.get('slug')

    // If requesting a specific collection by slug
    if (slug) {
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
              primary_muscle,
              equipment,
              difficulty,
              is_compound,
              is_timed
            )
          )
        `)
        .or(`is_system.eq.true,user_id.eq.${userId}`)
        .eq('slug', slug)
        .single()

      if (error) {
        console.error('Error fetching collection:', error)
        return NextResponse.json({ error: 'Collection not found' }, { status: 404 })
      }

      return NextResponse.json({ collection })
    }

    // Get all collections
    let query = adminClient
      .from('exercise_collections')
      .select(includeExercises ? `
        *,
        items:exercise_collection_items (
          id,
          exercise_id
        )
      ` : '*')
      .or(`is_system.eq.true,user_id.eq.${userId}`)
      .order('is_system', { ascending: false })
      .order('name', { ascending: true })

    const { data: collections, error } = await query

    if (error) {
      console.error('Error fetching collections:', error)
      return NextResponse.json({ error: 'Failed to fetch collections' }, { status: 500 })
    }

    // Add exercise count to each collection
    const collectionsWithCount = ((collections || []) as any[]).map((c: any) => ({
      ...c,
      exercise_count: c.items?.length || 0,
      items: undefined, // Remove items array, just keep count
    }))

    return NextResponse.json({ collections: collectionsWithCount })
  } catch (error) {
    console.error('Exercise collections error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/exercise-collections - Create a new collection
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    const body = await request.json()
    const { name, description, icon, color } = body

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    // Generate slug from name
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')

    // Check if slug already exists for this user
    const { data: existing } = await (adminClient as any)
      .from('exercise_collections')
      .select('id')
      .eq('user_id', userId)
      .eq('slug', slug)
      .single()

    if (existing) {
      return NextResponse.json({ error: 'A collection with this name already exists' }, { status: 400 })
    }

    const { data: collection, error } = await (adminClient as any)
      .from('exercise_collections')
      .insert({
        user_id: userId,
        name,
        slug,
        description: description || null,
        icon: icon || 'folder',
        color: color || 'a855f7', // purple-500
        is_system: false,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating collection:', error)
      return NextResponse.json({ error: 'Failed to create collection' }, { status: 500 })
    }

    return NextResponse.json({ collection }, { status: 201 })
  } catch (error) {
    console.error('Create collection error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
