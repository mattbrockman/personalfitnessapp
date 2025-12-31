import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// POST /api/suggested-workouts/schedule-bulk - Schedule multiple suggested workouts
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()

    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { suggested_workout_ids, skip_existing = true } = body

    if (!suggested_workout_ids || !Array.isArray(suggested_workout_ids) || suggested_workout_ids.length === 0) {
      return NextResponse.json({ error: 'suggested_workout_ids is required' }, { status: 400 })
    }

    // Fetch all suggested workouts
    const { data: suggestedWorkouts, error: fetchError } = await (adminClient as any)
      .from('suggested_workouts')
      .select(`
        *,
        training_plans!inner(user_id)
      `)
      .in('id', suggested_workout_ids)

    if (fetchError) {
      console.error('Error fetching suggested workouts:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch workouts' }, { status: 500 })
    }

    // Verify ownership for all workouts
    const unauthorizedWorkouts = suggestedWorkouts.filter(
      (w: any) => w.training_plans.user_id !== session.user.id
    )
    if (unauthorizedWorkouts.length > 0) {
      return NextResponse.json({ error: 'Unauthorized access to some workouts' }, { status: 403 })
    }

    // Filter out already scheduled if skip_existing is true
    const workoutsToSchedule = skip_existing
      ? suggestedWorkouts.filter((w: any) => w.status === 'suggested')
      : suggestedWorkouts.filter((w: any) => w.status !== 'scheduled')

    const results: { success: any[]; errors: any[] } = {
      success: [],
      errors: [],
    }

    // Process each workout
    for (const suggestedWorkout of workoutsToSchedule) {
      try {
        // Create the actual workout record
        const { data: createdWorkout, error: createError } = await (adminClient as any)
          .from('workouts')
          .insert({
            user_id: session.user.id,
            category: suggestedWorkout.category,
            workout_type: suggestedWorkout.workout_type,
            name: suggestedWorkout.name,
            description: suggestedWorkout.description,
            date: suggestedWorkout.suggested_date,
            time: null,
            planned_duration_minutes: suggestedWorkout.planned_duration_minutes,
            duration_minutes: null,
            status: 'planned',
            notes: `Generated from training plan`,
          })
          .select()
          .single()

        if (createError) {
          results.errors.push({
            suggested_workout_id: suggestedWorkout.id,
            error: createError.message,
          })
          continue
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

            // Create exercise_sets records
            for (let setNum = 1; setNum <= ex.sets; setNum++) {
              await (adminClient as any)
                .from('exercise_sets')
                .insert({
                  workout_exercise_id: workoutExercise.id,
                  set_number: setNum,
                  target_reps: ex.reps_max,
                  target_weight: null,
                  rest_seconds: ex.rest_seconds,
                })
            }
          }
        }

        // Update the suggested workout status
        await (adminClient as any)
          .from('suggested_workouts')
          .update({
            status: 'scheduled',
            scheduled_workout_id: createdWorkout.id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', suggestedWorkout.id)

        results.success.push({
          suggested_workout_id: suggestedWorkout.id,
          workout_id: createdWorkout.id,
          date: suggestedWorkout.suggested_date,
          name: suggestedWorkout.name,
        })
      } catch (err) {
        results.errors.push({
          suggested_workout_id: suggestedWorkout.id,
          error: err instanceof Error ? err.message : 'Unknown error',
        })
      }
    }

    return NextResponse.json({
      scheduled: results.success.length,
      failed: results.errors.length,
      skipped: suggested_workout_ids.length - workoutsToSchedule.length,
      results,
    })
  } catch (error) {
    console.error('Bulk schedule error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
