import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// POST /api/suggested-workouts/[id]/schedule - Schedule a suggested workout
export async function POST(
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

    // Get the suggested workout with plan info
    const { data: suggestedWorkout, error: workoutError } = await (adminClient as any)
      .from('suggested_workouts')
      .select(`
        *,
        training_plans!inner(user_id)
      `)
      .eq('id', id)
      .single()

    if (workoutError || !suggestedWorkout) {
      return NextResponse.json({ error: 'Workout not found' }, { status: 404 })
    }

    if (suggestedWorkout.training_plans.user_id !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    if (suggestedWorkout.status === 'scheduled') {
      return NextResponse.json(
        { error: 'Workout already scheduled', scheduled_workout_id: suggestedWorkout.scheduled_workout_id },
        { status: 400 }
      )
    }

    // Parse optional overrides from body
    const body = await request.json().catch(() => ({}))
    const scheduledDate = body.scheduled_date || suggestedWorkout.suggested_date
    const scheduledTime = body.scheduled_time || null

    // Create the actual workout record
    const { data: createdWorkout, error: createError } = await (adminClient as any)
      .from('workouts')
      .insert({
        user_id: session.user.id,
        category: suggestedWorkout.category,
        workout_type: suggestedWorkout.workout_type,
        name: suggestedWorkout.name,
        description: suggestedWorkout.description,
        date: scheduledDate,
        time: scheduledTime,
        planned_duration_minutes: suggestedWorkout.planned_duration_minutes,
        duration_minutes: null, // Will be filled after completion
        status: 'planned',
        notes: `Generated from training plan`,
      })
      .select()
      .single()

    if (createError) {
      console.error('Error creating workout:', createError)
      return NextResponse.json({ error: 'Failed to create workout' }, { status: 500 })
    }

    // If strength workout with exercises, create workout_exercises records
    if (suggestedWorkout.category === 'strength' && suggestedWorkout.exercises?.length > 0) {
      for (let i = 0; i < suggestedWorkout.exercises.length; i++) {
        const ex = suggestedWorkout.exercises[i]

        // Try to find exercise_id by name
        const { data: exerciseRecord } = await (adminClient as any)
          .from('exercises')
          .select('id')
          .eq('name', ex.exercise_name)
          .single()

        // Create workout_exercise record
        const { data: workoutExercise, error: weError } = await (adminClient as any)
          .from('workout_exercises')
          .insert({
            workout_id: createdWorkout.id,
            exercise_id: exerciseRecord?.id || null,
            exercise_name: ex.exercise_name,
            order_index: i,
            notes: ex.notes || null,
          })
          .select()
          .single()

        if (weError) {
          console.error('Error creating workout_exercise:', weError)
          continue
        }

        // Create exercise_sets records for target values
        for (let setNum = 1; setNum <= ex.sets; setNum++) {
          await (adminClient as any)
            .from('exercise_sets')
            .insert({
              workout_exercise_id: workoutExercise.id,
              set_number: setNum,
              target_reps: ex.reps_max, // Use max as target
              target_weight: null, // User will fill in
              rest_seconds: ex.rest_seconds,
            })
        }
      }
    }

    // Update the suggested workout status
    const { error: updateError } = await (adminClient as any)
      .from('suggested_workouts')
      .update({
        status: 'scheduled',
        scheduled_workout_id: createdWorkout.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (updateError) {
      console.error('Error updating suggested workout status:', updateError)
      // Don't fail - the workout was created successfully
    }

    return NextResponse.json({
      success: true,
      workout: createdWorkout,
      suggested_workout_id: id,
    })
  } catch (error) {
    console.error('Schedule workout error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
