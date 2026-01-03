import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// GET /api/nutrition/favorites - List user's favorite foods
export async function GET() {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: favorites, error } = await (adminClient as any)
      .from('nutrition_favorites')
      .select('*')
      .eq('user_id', user.id)
      .order('times_logged', { ascending: false })
      .order('last_logged_at', { ascending: false })

    if (error) {
      throw error
    }

    return NextResponse.json({
      favorites: favorites.map((f: any) => ({
        id: f.id,
        name: f.food_name,
        brand: f.brand,
        serving_size: f.serving_size,
        serving_unit: f.serving_unit,
        servings: 1,
        calories: f.calories,
        protein_g: f.protein_g,
        carbs_g: f.carbs_g,
        fat_g: f.fat_g,
        fiber_g: f.fiber_g,
        source: 'favorite' as const,
        barcode: f.barcode,
        times_logged: f.times_logged,
      })),
    })
  } catch (error) {
    console.error('Get favorites error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch favorites' },
      { status: 500 }
    )
  }
}

// POST /api/nutrition/favorites - Add a food to favorites
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      food_name,
      brand,
      serving_size,
      serving_unit,
      calories,
      protein_g,
      carbs_g,
      fat_g,
      fiber_g,
      original_source,
      barcode,
    } = body

    if (!food_name) {
      return NextResponse.json(
        { error: 'food_name is required' },
        { status: 400 }
      )
    }

    // Upsert - update if exists, insert if not
    const { data: favorite, error } = await (adminClient as any)
      .from('nutrition_favorites')
      .upsert(
        {
          user_id: user.id,
          food_name,
          brand: brand || null,
          serving_size: serving_size || 1,
          serving_unit: serving_unit || 'serving',
          calories: calories || null,
          protein_g: protein_g || null,
          carbs_g: carbs_g || null,
          fat_g: fat_g || null,
          fiber_g: fiber_g || null,
          original_source: original_source || null,
          barcode: barcode || null,
          last_logged_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id,food_name,brand,serving_unit',
          ignoreDuplicates: false,
        }
      )
      .select()
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      favorite: {
        id: favorite.id,
        name: favorite.food_name,
        brand: favorite.brand,
        serving_size: favorite.serving_size,
        serving_unit: favorite.serving_unit,
        calories: favorite.calories,
        protein_g: favorite.protein_g,
        carbs_g: favorite.carbs_g,
        fat_g: favorite.fat_g,
        fiber_g: favorite.fiber_g,
      },
    })
  } catch (error) {
    console.error('Add favorite error:', error)
    return NextResponse.json(
      { error: 'Failed to add favorite' },
      { status: 500 }
    )
  }
}

// DELETE /api/nutrition/favorites - Remove a food from favorites
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      )
    }

    // Verify ownership
    const { data: favorite } = await (adminClient as any)
      .from('nutrition_favorites')
      .select('id, user_id')
      .eq('id', id)
      .single()

    if (!favorite || favorite.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Favorite not found' },
        { status: 404 }
      )
    }

    // Delete
    const { error } = await (adminClient as any)
      .from('nutrition_favorites')
      .delete()
      .eq('id', id)

    if (error) {
      throw error
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete favorite error:', error)
    return NextResponse.json(
      { error: 'Failed to delete favorite' },
      { status: 500 }
    )
  }
}
