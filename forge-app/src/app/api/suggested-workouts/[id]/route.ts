import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// Helper to verify workout ownership
async function verifyWorkoutOwnership(adminClient: any, workoutId: string, userId: string) {
  const { data: workout, error } = await adminClient
    .from('suggested_workouts')
    .select(`
      *,
      training_plans!inner(user_id)
    `)
    .eq('id', workoutId)
    .single()

  if (error || !workout) {
    return { error: 'Workout not found', status: 404 }
  }

  if (workout.training_plans.user_id !== userId) {
    return { error: 'Unauthorized', status: 403 }
  }

  return { workout }
}

// GET /api/suggested-workouts/[id] - Get a single suggested workout
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const adminClient = createAdminClient()

    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await verifyWorkoutOwnership(adminClient, id, session.user.id)
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json({ suggested_workout: result.workout })
  } catch (error) {
    console.error('Get suggested workout error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/suggested-workouts/[id] - Update a suggested workout
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const adminClient = createAdminClient()

    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await verifyWorkoutOwnership(adminClient, id, session.user.id)
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    const body = await request.json()

    // Only allow updating certain fields
    const allowedFields = [
      'name',
      'description',
      'planned_duration_minutes',
      'primary_intensity',
      'planned_tss',
      'exercises',
      'cardio_structure',
      'status',
      'suggested_date',
      'day_of_week',
    ]

    const updates: Record<string, any> = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field]
      }
    }
    updates.updated_at = new Date().toISOString()

    const { data: workout, error } = await (adminClient as any)
      .from('suggested_workouts')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating suggested workout:', error)
      return NextResponse.json({ error: 'Failed to update workout' }, { status: 500 })
    }

    return NextResponse.json({ suggested_workout: workout })
  } catch (error) {
    console.error('Update suggested workout error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/suggested-workouts/[id] - Delete a suggested workout
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const adminClient = createAdminClient()

    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await verifyWorkoutOwnership(adminClient, id, session.user.id)
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    const { error } = await (adminClient as any)
      .from('suggested_workouts')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting suggested workout:', error)
      return NextResponse.json({ error: 'Failed to delete workout' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete suggested workout error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
