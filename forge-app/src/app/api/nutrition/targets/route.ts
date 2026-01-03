import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// GET /api/nutrition/targets - Get user's nutrition targets from profile
export async function GET() {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await (supabase as any)
      .from('profiles')
      .select('calorie_target, protein_target_g, carb_target_g, fat_target_g')
      .eq('id', user.id)
      .single()

    return NextResponse.json({
      calorie_target: (profile as any)?.calorie_target || 2400,
      protein_target_g: (profile as any)?.protein_target_g || 180,
      carb_target_g: (profile as any)?.carb_target_g || 250,
      fat_target_g: (profile as any)?.fat_target_g || 80,
    })
  } catch (error) {
    console.error('Get nutrition targets error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch nutrition targets' },
      { status: 500 }
    )
  }
}

// PATCH /api/nutrition/targets - Update user's nutrition targets
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      calorie_target,
      protein_target_g,
      carb_target_g,
      fat_target_g,
    } = body

    // Build update object with only provided fields
    const updates: Record<string, number> = {}
    if (calorie_target !== undefined) updates.calorie_target = parseInt(calorie_target) || 2400
    if (protein_target_g !== undefined) updates.protein_target_g = parseInt(protein_target_g) || 180
    if (carb_target_g !== undefined) updates.carb_target_g = parseInt(carb_target_g) || 250
    if (fat_target_g !== undefined) updates.fat_target_g = parseInt(fat_target_g) || 80

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      )
    }

    const { data: profile, error } = await (adminClient as any)
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select('calorie_target, protein_target_g, carb_target_g, fat_target_g')
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      calorie_target: profile.calorie_target,
      protein_target_g: profile.protein_target_g,
      carb_target_g: profile.carb_target_g,
      fat_target_g: profile.fat_target_g,
    })
  } catch (error) {
    console.error('Update nutrition targets error:', error)
    return NextResponse.json(
      { error: 'Failed to update nutrition targets' },
      { status: 500 }
    )
  }
}
