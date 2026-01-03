import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
