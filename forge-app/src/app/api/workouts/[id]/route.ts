import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// GET /api/workouts/[id] - Get single workout with exercises and sets
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()

    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const workoutId = params.id

    // Fetch workout
    const { data: workout, error: workoutError } = await adminClient
      .from('workouts')
      .select('*')
      .eq('id', workoutId)
      .eq('user_id', session.user.id)
      .single()

    if (workoutError || !workout) {
      return NextResponse.json({ error: 'Workout not found' }, { status: 404 })
    }

    // Fetch workout exercises with their sets
    const { data: workoutExercisesData, error: exercisesError } = await adminClient
      .from('workout_exercises')
      .select(`
        id,
        exercise_id,
        exercise_name,
        order_index,
        superset_group,
        rest_seconds,
        notes,
        created_at,
        exercise:exercises(
          id,
          name,
          primary_muscles,
          secondary_muscles,
          equipment,
          coaching_cues
        )
      `)
      .eq('workout_id', workoutId)
      .order('order_index', { ascending: true })
    const workoutExercises = workoutExercisesData as any[] | null

    if (exercisesError) {
      console.error('Error fetching workout exercises:', exercisesError)
    }

    // Fetch sets for each exercise
    const exerciseIds = (workoutExercises || []).map((we: any) => we.id)
    let sets: any[] = []

    if (exerciseIds.length > 0) {
      const { data: setsData, error: setsError } = await adminClient
        .from('exercise_sets')
        .select('*')
        .in('workout_exercise_id', exerciseIds)
        .order('set_number', { ascending: true })

      if (setsError) {
        console.error('Error fetching exercise sets:', setsError)
      } else {
        sets = setsData || []
      }
    }

    // Group sets by workout_exercise_id
    const setsByExercise: Record<string, any[]> = {}
    sets.forEach(set => {
      if (!setsByExercise[set.workout_exercise_id]) {
        setsByExercise[set.workout_exercise_id] = []
      }
      setsByExercise[set.workout_exercise_id].push(set)
    })

    // Combine exercises with their sets
    const exercisesWithSets = (workoutExercises || []).map((we: any) => ({
      id: we.id,
      exercise_id: we.exercise_id,
      exercise_name: we.exercise_name || we.exercise?.name,
      order_index: we.order_index,
      superset_group: we.superset_group,
      rest_seconds: we.rest_seconds,
      notes: we.notes,
      exercise: we.exercise,
      sets: setsByExercise[we.id] || [],
    }))

    return NextResponse.json({
      workout: {
        ...(workout as any),
        exercises: exercisesWithSets,
      }
    })
  } catch (error) {
    console.error('Workout GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/workouts/[id] - Update workout (status, completion, etc.)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()

    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const workoutId = params.id
    const body = await request.json()

    // Verify ownership
    const { data: existingData } = await adminClient
      .from('workouts')
      .select('user_id')
      .eq('id', workoutId)
      .single()
    const existing = existingData as { user_id: string } | null

    if (!existing || existing.user_id !== session.user.id) {
      return NextResponse.json({ error: 'Workout not found' }, { status: 404 })
    }

    // Allowed fields to update
    const allowedFields = [
      'name', 'status', 'notes', 'perceived_exertion',
      'actual_duration_minutes', 'actual_distance_miles', 'actual_calories',
      'avg_heart_rate', 'max_heart_rate', 'completed_at'
    ]

    const updates: Record<string, any> = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field]
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid updates provided' }, { status: 400 })
    }

    updates.updated_at = new Date().toISOString()

    const { data: workout, error } = await (adminClient as any)
      .from('workouts')
      .update(updates)
      .eq('id', workoutId)
      .select()
      .single()

    if (error) {
      console.error('Error updating workout:', error)
      return NextResponse.json({ error: 'Failed to update workout' }, { status: 500 })
    }

    return NextResponse.json({ workout })
  } catch (error) {
    console.error('Workout PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
