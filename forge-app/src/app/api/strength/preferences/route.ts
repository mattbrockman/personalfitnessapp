import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ProgressionModel, StrengthPreferences } from '@/types/strength'

// Default preferences
const DEFAULT_PREFERENCES: Omit<StrengthPreferences, 'id' | 'user_id' | 'created_at' | 'updated_at'> = {
  progression_model: 'double',
  linear_increment_lbs: 5.0,
  linear_increment_upper_lbs: 2.5,
  double_rep_target_low: 8,
  double_rep_target_high: 12,
  double_weight_increase_lbs: 5.0,
  rpe_target_low: 7.0,
  rpe_target_high: 9.0,
}

// GET /api/strength/preferences - Get user's strength training preferences
export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: prefs, error } = await supabase
      .from('strength_preferences')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows found, which is fine
      console.error('Error fetching preferences:', error)
      return NextResponse.json({ error: 'Failed to fetch preferences' }, { status: 500 })
    }

    // Return existing or defaults
    const preferences = prefs || {
      ...DEFAULT_PREFERENCES,
      user_id: user.id,
    }

    return NextResponse.json({ preferences })
  } catch (error) {
    console.error('Error in preferences GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/strength/preferences - Update user's strength training preferences
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      progression_model,
      linear_increment_lbs,
      linear_increment_upper_lbs,
      double_rep_target_low,
      double_rep_target_high,
      double_weight_increase_lbs,
      rpe_target_low,
      rpe_target_high,
    }: Partial<StrengthPreferences> = body

    // Validate progression_model
    const validModels: ProgressionModel[] = ['linear', 'double', 'rpe_based']
    if (progression_model && !validModels.includes(progression_model)) {
      return NextResponse.json({
        error: 'Invalid progression_model. Must be linear, double, or rpe_based'
      }, { status: 400 })
    }

    // Validate rep ranges
    if (double_rep_target_low && double_rep_target_high) {
      if (double_rep_target_low >= double_rep_target_high) {
        return NextResponse.json({
          error: 'double_rep_target_low must be less than double_rep_target_high'
        }, { status: 400 })
      }
    }

    // Validate RPE ranges
    if (rpe_target_low && rpe_target_high) {
      if (rpe_target_low >= rpe_target_high) {
        return NextResponse.json({
          error: 'rpe_target_low must be less than rpe_target_high'
        }, { status: 400 })
      }
      if (rpe_target_low < 5 || rpe_target_high > 10) {
        return NextResponse.json({
          error: 'RPE targets must be between 5 and 10'
        }, { status: 400 })
      }
    }

    // Build update object
    const updates: Record<string, any> = {
      user_id: user.id,
      updated_at: new Date().toISOString(),
    }

    if (progression_model !== undefined) updates.progression_model = progression_model
    if (linear_increment_lbs !== undefined) updates.linear_increment_lbs = linear_increment_lbs
    if (linear_increment_upper_lbs !== undefined) updates.linear_increment_upper_lbs = linear_increment_upper_lbs
    if (double_rep_target_low !== undefined) updates.double_rep_target_low = double_rep_target_low
    if (double_rep_target_high !== undefined) updates.double_rep_target_high = double_rep_target_high
    if (double_weight_increase_lbs !== undefined) updates.double_weight_increase_lbs = double_weight_increase_lbs
    if (rpe_target_low !== undefined) updates.rpe_target_low = rpe_target_low
    if (rpe_target_high !== undefined) updates.rpe_target_high = rpe_target_high

    // Upsert preferences
    const { data: prefs, error: upsertError } = await (supabase as any)
      .from('strength_preferences')
      .upsert(updates, { onConflict: 'user_id' })
      .select()
      .single()

    if (upsertError) {
      console.error('Error upserting preferences:', upsertError)
      return NextResponse.json({ error: 'Failed to update preferences' }, { status: 500 })
    }

    return NextResponse.json({ preferences: prefs })
  } catch (error) {
    console.error('Error in preferences PUT:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/strength/preferences - Same as PUT (for convenience)
export async function POST(request: NextRequest) {
  return PUT(request)
}
