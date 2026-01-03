import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// GET /api/training-plans/[id]/suggested-workouts - Get suggested workouts for a plan
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: planId } = await params
    const supabase = await createClient()
    const adminClient = createAdminClient()

    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify plan ownership
    const { data: plan, error: planError } = await (adminClient as any)
      .from('training_plans')
      .select('id, user_id')
      .eq('id', planId)
      .single()

    if (planError || !plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    if (plan.user_id !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Parse query params for filtering
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const status = searchParams.get('status')
    const weekNumber = searchParams.get('week_number')

    // Build query - include linked workout status for completed detection
    let query = (adminClient as any)
      .from('suggested_workouts')
      .select(`
        *,
        linked_workout:workouts!scheduled_workout_id (
          id,
          status,
          completed_at
        )
      `)
      .eq('plan_id', planId)
      .order('suggested_date', { ascending: true })
      .order('order_in_day', { ascending: true })

    if (startDate) {
      query = query.gte('suggested_date', startDate)
    }
    if (endDate) {
      query = query.lte('suggested_date', endDate)
    }
    if (status) {
      query = query.eq('status', status)
    }
    if (weekNumber) {
      query = query.eq('week_number', Number(weekNumber))
    }

    const { data: workouts, error } = await query

    if (error) {
      console.error('Error fetching suggested workouts:', error)
      return NextResponse.json({ error: 'Failed to fetch workouts' }, { status: 500 })
    }

    return NextResponse.json({ suggested_workouts: workouts })
  } catch (error) {
    console.error('Suggested workouts error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/training-plans/[id]/suggested-workouts - Create a manual suggested workout
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: planId } = await params
    const supabase = await createClient()
    const adminClient = createAdminClient()

    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify plan ownership
    const { data: plan, error: planError } = await (adminClient as any)
      .from('training_plans')
      .select('id, user_id')
      .eq('id', planId)
      .single()

    if (planError || !plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    if (plan.user_id !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Parse request body
    const body = await request.json()
    const {
      suggested_date,
      day_of_week,
      category,
      workout_type,
      name,
      description,
      planned_duration_minutes,
      status = 'suggested',
    } = body

    // Validate required fields
    if (!suggested_date || !category || !workout_type || !name) {
      return NextResponse.json(
        { error: 'Missing required fields: suggested_date, category, workout_type, name' },
        { status: 400 }
      )
    }

    // Get the max order_in_day for this date to place new workout at end
    const { data: existingWorkouts } = await (adminClient as any)
      .from('suggested_workouts')
      .select('order_in_day')
      .eq('plan_id', planId)
      .eq('suggested_date', suggested_date)
      .order('order_in_day', { ascending: false })
      .limit(1)

    const orderInDay = existingWorkouts?.[0]?.order_in_day != null
      ? existingWorkouts[0].order_in_day + 1
      : 0

    // Create the suggested workout
    const { data: workout, error: createError } = await (adminClient as any)
      .from('suggested_workouts')
      .insert({
        plan_id: planId,
        suggested_date,
        day_of_week: day_of_week || null,
        category,
        workout_type,
        name,
        description: description || null,
        planned_duration_minutes: planned_duration_minutes || 60,
        status,
        order_in_day: orderInDay,
      })
      .select()
      .single()

    if (createError) {
      console.error('Error creating suggested workout:', createError)
      return NextResponse.json({ error: 'Failed to create workout' }, { status: 500 })
    }

    return NextResponse.json({ suggested_workout: workout }, { status: 201 })
  } catch (error) {
    console.error('Create suggested workout error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/training-plans/[id]/suggested-workouts - Delete all suggested workouts (for regeneration)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: planId } = await params
    const supabase = await createClient()
    const adminClient = createAdminClient()

    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify plan ownership
    const { data: plan, error: planError } = await (adminClient as any)
      .from('training_plans')
      .select('id, user_id')
      .eq('id', planId)
      .single()

    if (planError || !plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    if (plan.user_id !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Parse query params for selective deletion
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const statusFilter = searchParams.get('status') || 'suggested' // Only delete suggested by default

    let query = (adminClient as any)
      .from('suggested_workouts')
      .delete()
      .eq('plan_id', planId)
      .eq('status', statusFilter)

    if (startDate) {
      query = query.gte('suggested_date', startDate)
    }
    if (endDate) {
      query = query.lte('suggested_date', endDate)
    }

    const { error } = await query

    if (error) {
      console.error('Error deleting suggested workouts:', error)
      return NextResponse.json({ error: 'Failed to delete workouts' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete suggested workouts error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
