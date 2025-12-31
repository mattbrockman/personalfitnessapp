import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { DEFAULT_CENTENARIAN_GOALS } from '@/types/longevity'

// GET /api/centenarian-goals - List centenarian decathlon goals for current user
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')

    let query = supabase
      .from('centenarian_goals')
      .select('*')
      .eq('user_id', session.user.id)
      .order('display_order', { ascending: true })

    if (category) {
      query = query.eq('category', category)
    }

    const { data: goals, error } = await query

    if (error) {
      console.error('Error fetching centenarian goals:', error)
      return NextResponse.json({ error: 'Failed to fetch centenarian goals' }, { status: 500 })
    }

    return NextResponse.json({ goals })
  } catch (error) {
    console.error('Centenarian goals GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/centenarian-goals - Create a new goal or initialize defaults
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()

    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    // Special action: initialize with defaults
    if (body.action === 'initialize_defaults') {
      // Check if user already has goals
      const { data: existingGoals } = await supabase
        .from('centenarian_goals')
        .select('id')
        .eq('user_id', session.user.id)
        .limit(1)

      if (existingGoals && existingGoals.length > 0) {
        return NextResponse.json({
          error: 'Goals already initialized. Delete existing goals first to reinitialize.',
        }, { status: 400 })
      }

      // Insert default goals
      const defaultGoalsWithUser = DEFAULT_CENTENARIAN_GOALS.map((goal, index) => ({
        user_id: session.user.id,
        goal_name: goal.goal_name,
        description: goal.description,
        target_age: goal.target_age,
        category: goal.category,
        current_ability: goal.current_ability,
        current_score: null,
        target_ability: goal.target_ability,
        required_strength: goal.required_strength,
        required_cardio: goal.required_cardio,
        required_mobility: goal.required_mobility,
        is_achieved: false,
        display_order: index,
      }))

      const { data: goals, error: insertError } = await adminClient
        .from('centenarian_goals')
        .insert(defaultGoalsWithUser)
        .select()

      if (insertError) {
        console.error('Error initializing centenarian goals:', insertError)
        return NextResponse.json({
          error: 'Failed to initialize centenarian goals',
          details: insertError.message,
        }, { status: 500 })
      }

      return NextResponse.json({ goals, initialized: true })
    }

    // Regular goal creation
    const {
      goal_name,
      description,
      target_age,
      category,
      current_ability,
      current_score,
      target_ability,
      required_strength,
      required_cardio,
      required_mobility,
      display_order,
    } = body

    // Validate required fields
    if (!goal_name || !category) {
      return NextResponse.json({
        error: 'goal_name and category are required'
      }, { status: 400 })
    }

    const { data: goal, error: insertError } = await adminClient
      .from('centenarian_goals')
      .insert({
        user_id: session.user.id,
        goal_name,
        description: description || null,
        target_age: target_age || 100,
        category,
        current_ability: current_ability || null,
        current_score: current_score || null,
        target_ability: target_ability || null,
        required_strength: required_strength || null,
        required_cardio: required_cardio || null,
        required_mobility: required_mobility || null,
        is_achieved: false,
        display_order: display_order || 0,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error creating centenarian goal:', insertError)
      return NextResponse.json({
        error: 'Failed to create centenarian goal',
        details: insertError.message,
      }, { status: 500 })
    }

    return NextResponse.json({ goal })
  } catch (error) {
    console.error('Centenarian goals POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/centenarian-goals - Update a goal
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()

    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id } = body

    if (!id) {
      return NextResponse.json({ error: 'Goal ID required' }, { status: 400 })
    }

    // Verify ownership
    const { data: existing } = await supabase
      .from('centenarian_goals')
      .select('user_id')
      .eq('id', id)
      .single()

    if (!existing || existing.user_id !== session.user.id) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 })
    }

    // Only allow updating specific fields
    const allowedFields = [
      'goal_name', 'description', 'target_age', 'category',
      'current_ability', 'current_score', 'target_ability',
      'required_strength', 'required_cardio', 'required_mobility',
      'is_achieved', 'achieved_date', 'last_tested_date', 'display_order'
    ]
    const updates: Record<string, any> = { updated_at: new Date().toISOString() }

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field]
      }
    }

    // Auto-set achieved_date if marking as achieved
    if (body.is_achieved === true && !body.achieved_date) {
      updates.achieved_date = new Date().toISOString().split('T')[0]
    }

    const { data: goal, error: updateError } = await adminClient
      .from('centenarian_goals')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating centenarian goal:', updateError)
      return NextResponse.json({
        error: 'Failed to update centenarian goal',
        details: updateError.message,
      }, { status: 500 })
    }

    return NextResponse.json({ goal })
  } catch (error) {
    console.error('Centenarian goals PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/centenarian-goals - Delete a goal
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()

    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const deleteAll = searchParams.get('delete_all') === 'true'

    if (deleteAll) {
      // Delete all goals for user (for reset)
      const { error: deleteError } = await adminClient
        .from('centenarian_goals')
        .delete()
        .eq('user_id', session.user.id)

      if (deleteError) {
        console.error('Error deleting all centenarian goals:', deleteError)
        return NextResponse.json({ error: 'Failed to delete centenarian goals' }, { status: 500 })
      }

      return NextResponse.json({ success: true, deletedAll: true })
    }

    if (!id) {
      return NextResponse.json({ error: 'Goal ID required' }, { status: 400 })
    }

    // Verify ownership
    const { data: existing } = await supabase
      .from('centenarian_goals')
      .select('user_id')
      .eq('id', id)
      .single()

    if (!existing || existing.user_id !== session.user.id) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 })
    }

    const { error: deleteError } = await adminClient
      .from('centenarian_goals')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('Error deleting centenarian goal:', deleteError)
      return NextResponse.json({ error: 'Failed to delete centenarian goal' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Centenarian goals DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
