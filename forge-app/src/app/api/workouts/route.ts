import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// GET /api/workouts - List workouts for current user
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const workoutType = searchParams.get('type')
    const status = searchParams.get('status')

    let query = supabase
      .from('workouts')
      .select(`
        *,
        workout_zones (*)
      `)
      .eq('user_id', session.user.id)
      .order('scheduled_date', { ascending: false })

    if (startDate) {
      query = query.gte('scheduled_date', startDate)
    }
    if (endDate) {
      query = query.lte('scheduled_date', endDate)
    }
    if (workoutType) {
      query = query.eq('workout_type', workoutType)
    }
    if (status) {
      query = query.eq('status', status)
    }

    const { data: workouts, error } = await query

    if (error) {
      console.error('Error fetching workouts:', error)
      return NextResponse.json({ error: 'Failed to fetch workouts' }, { status: 500 })
    }

    return NextResponse.json({ workouts })
  } catch (error) {
    console.error('Workouts GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/workouts - Create a new workout
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()
    
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      workout_type,
      name,
      scheduled_date,
      scheduled_time,
      description,
      planned_duration_minutes,
      planned_tss,
      notes,
      category,
      primary_intensity,
      workout_zones,
      exercises, // For lifting workouts
    } = body

    // Insert workout
    const { data: workout, error: workoutError }: any = await (adminClient
      .from('workouts') as any)
      .insert({
        user_id: session.user.id,
        workout_type: workout_type || 'other',
        name: name || null,
        scheduled_date,
        scheduled_time: scheduled_time || null,
        description: description || null,
        planned_duration_minutes: planned_duration_minutes || null,
        planned_tss: planned_tss || null,
        notes: notes || null,
        category: category || 'other',
        primary_intensity: primary_intensity || null,
        status: 'planned',
        source: 'manual',
      })
      .select()
      .single()

    if (workoutError) {
      console.error('Error creating workout:', workoutError)
      return NextResponse.json({
        error: 'Failed to create workout',
        details: workoutError.message,
        code: workoutError.code
      }, { status: 500 })
    }

    // Insert workout zones if provided
    if (workout_zones && workout_zones.length > 0) {
      const zonesWithWorkoutId = workout_zones.map((zone: any) => ({
        ...zone,
        workout_id: workout.id,
      }))

      const { error: zonesError }: any = await (adminClient
        .from('workout_zones') as any)
        .insert(zonesWithWorkoutId)

      if (zonesError) {
        console.error('Error creating workout zones:', zonesError)
        // Don't fail the whole request, just log it
      }
    }

    // Insert exercises if provided (for lifting workouts)
    if (exercises && exercises.length > 0) {
      const exercisesWithWorkoutId = exercises.map((ex: any, index: number) => ({
        workout_id: workout.id,
        exercise_id: ex.exercise_id,
        order_index: index,
        superset_group: ex.superset_group,
        rest_seconds: ex.rest_seconds,
        notes: ex.notes,
      }))

      const { data: workoutExercises, error: exError }: any = await (adminClient
        .from('workout_exercises') as any)
        .insert(exercisesWithWorkoutId)
        .select()

      if (exError) {
        console.error('Error creating workout exercises:', exError)
      } else if (workoutExercises) {
        // Insert sets for each exercise
        for (let i = 0; i < workoutExercises.length; i++) {
          const we = workoutExercises[i]
          const sets = exercises[i].sets

          if (sets && sets.length > 0) {
            const setsWithIds = sets.map((set: any, setIndex: number) => ({
              workout_exercise_id: we.id,
              set_number: setIndex + 1,
              set_type: set.set_type || 'working',
              target_reps: set.target_reps,
              target_weight_lbs: set.target_weight,
              target_rpe: set.target_rpe,
              actual_reps: set.actual_reps,
              actual_weight_lbs: set.actual_weight,
              actual_rpe: set.actual_rpe,
              completed: set.completed || false,
            }))

            await (adminClient.from('exercise_sets') as any).insert(setsWithIds)
          }
        }
      }
    }

    return NextResponse.json({ workout })
  } catch (error) {
    console.error('Workouts POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/workouts - Update a workout
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()
    
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: 'Workout ID required' }, { status: 400 })
    }

    // Verify ownership
    const { data: existing }: any = await supabase
      .from('workouts')
      .select('user_id')
      .eq('id', id)
      .single()

    if (!existing || existing.user_id !== session.user.id) {
      return NextResponse.json({ error: 'Workout not found' }, { status: 404 })
    }

    // Update workout
    const { data: workout, error: updateError }: any = await (adminClient
      .from('workouts') as any)
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating workout:', updateError)
      return NextResponse.json({ error: 'Failed to update workout' }, { status: 500 })
    }

    return NextResponse.json({ workout })
  } catch (error) {
    console.error('Workouts PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/workouts - Delete a workout
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

    if (!id) {
      return NextResponse.json({ error: 'Workout ID required' }, { status: 400 })
    }

    // Verify ownership
    const { data: existing }: any = await supabase
      .from('workouts')
      .select('user_id')
      .eq('id', id)
      .single()

    if (!existing || existing.user_id !== session.user.id) {
      return NextResponse.json({ error: 'Workout not found' }, { status: 404 })
    }

    // Delete workout (cascades to related tables)
    const { error: deleteError } = await adminClient
      .from('workouts')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('Error deleting workout:', deleteError)
      return NextResponse.json({ error: 'Failed to delete workout' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Workouts DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
