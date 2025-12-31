import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { GalpinAdaptation, UserAdaptationGoals, SetAdaptationGoalsRequest } from '@/types/galpin'

const VALID_ADAPTATIONS: GalpinAdaptation[] = [
  'skill', 'speed_power', 'strength', 'hypertrophy', 'muscular_endurance',
  'anaerobic_capacity', 'vo2max', 'long_duration', 'body_composition'
]

// GET /api/adaptations - Get user's adaptation goals
export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: goals, error } = await supabase
      .from('user_adaptation_goals')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching adaptation goals:', error)
      return NextResponse.json({ error: 'Failed to fetch goals' }, { status: 500 })
    }

    // Return existing goals or null if none set
    return NextResponse.json({ goals: goals as UserAdaptationGoals | null })
  } catch (error) {
    console.error('Error in adaptations GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/adaptations - Set or update user's adaptation goals
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: SetAdaptationGoalsRequest = await request.json()
    const {
      primary_adaptation,
      secondary_adaptation,
      tertiary_adaptation,
      priorities,
      notes
    } = body

    // Validate primary_adaptation
    if (!primary_adaptation || !VALID_ADAPTATIONS.includes(primary_adaptation)) {
      return NextResponse.json({
        error: 'primary_adaptation is required and must be one of: ' + VALID_ADAPTATIONS.join(', ')
      }, { status: 400 })
    }

    // Validate secondary/tertiary if provided
    if (secondary_adaptation && !VALID_ADAPTATIONS.includes(secondary_adaptation)) {
      return NextResponse.json({
        error: 'secondary_adaptation must be one of: ' + VALID_ADAPTATIONS.join(', ')
      }, { status: 400 })
    }

    if (tertiary_adaptation && !VALID_ADAPTATIONS.includes(tertiary_adaptation)) {
      return NextResponse.json({
        error: 'tertiary_adaptation must be one of: ' + VALID_ADAPTATIONS.join(', ')
      }, { status: 400 })
    }

    // Validate priorities if provided
    if (priorities) {
      const priorityValues = Object.values(priorities)
      const uniqueValues = new Set(priorityValues)

      // Check all values are 1-9 and unique
      if (priorityValues.some(v => v < 1 || v > 9)) {
        return NextResponse.json({
          error: 'priorities values must be between 1 and 9'
        }, { status: 400 })
      }

      if (uniqueValues.size !== priorityValues.length) {
        return NextResponse.json({
          error: 'priorities values must be unique (no ties)'
        }, { status: 400 })
      }
    }

    // Upsert the goals
    const { data: goals, error: upsertError } = await (supabase as any)
      .from('user_adaptation_goals')
      .upsert({
        user_id: user.id,
        primary_adaptation,
        secondary_adaptation: secondary_adaptation || null,
        tertiary_adaptation: tertiary_adaptation || null,
        priorities: priorities || null,
        notes: notes || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })
      .select()
      .single()

    if (upsertError) {
      console.error('Error upserting adaptation goals:', upsertError)
      return NextResponse.json({ error: 'Failed to save goals' }, { status: 500 })
    }

    return NextResponse.json({ goals })
  } catch (error) {
    console.error('Error in adaptations POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/adaptations - Remove user's adaptation goals
export async function DELETE(_request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { error: deleteError } = await supabase
      .from('user_adaptation_goals')
      .delete()
      .eq('user_id', user.id)

    if (deleteError) {
      console.error('Error deleting adaptation goals:', deleteError)
      return NextResponse.json({ error: 'Failed to delete goals' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in adaptations DELETE:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
