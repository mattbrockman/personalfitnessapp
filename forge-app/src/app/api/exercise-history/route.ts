import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// GET /api/exercise-history?exercise_id=xxx&limit=20
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()

    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const exerciseId = searchParams.get('exercise_id')
    const exerciseName = searchParams.get('exercise_name')
    const limit = parseInt(searchParams.get('limit') || '20')

    if (!exerciseId && !exerciseName) {
      return NextResponse.json({ error: 'exercise_id or exercise_name required' }, { status: 400 })
    }

    // Query workout_exercises with exercise_sets and workouts
    // We need to find all times this exercise was done by this user
    let query = adminClient
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
        workout:workouts!inner(
          id,
          user_id,
          name,
          scheduled_date,
          status,
          workout_type,
          created_at
        ),
        sets:exercise_sets(
          id,
          set_number,
          set_type,
          target_reps,
          target_weight_lbs,
          target_rpe,
          actual_reps,
          actual_weight_lbs,
          actual_rpe,
          completed
        )
      `)
      .eq('workout.user_id', session.user.id)
      .eq('workout.status', 'completed')
      .order('created_at', { ascending: false })
      .limit(limit)

    // Filter by exercise_id or exercise_name
    if (exerciseId) {
      query = query.eq('exercise_id', exerciseId)
    } else if (exerciseName) {
      query = query.ilike('exercise_name', `%${exerciseName}%`)
    }

    const { data: workoutExercises, error } = await query

    if (error) {
      console.error('Error fetching exercise history:', error)
      return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 })
    }

    // Calculate best performances and 1RM data
    const history = (workoutExercises || []).map((we: any) => {
      const sets = we.sets || []
      const completedSets = sets.filter((s: any) => s.completed && s.actual_weight_lbs && s.actual_reps)

      // Calculate estimated 1RM for each set using Brzycki formula
      const estimated1RMs = completedSets.map((s: any) => ({
        weight: s.actual_weight_lbs,
        reps: s.actual_reps,
        estimated1RM: s.actual_reps === 1
          ? s.actual_weight_lbs
          : Math.round(s.actual_weight_lbs * (36 / (37 - s.actual_reps)))
      }))

      const best1RM = estimated1RMs.length > 0
        ? Math.max(...estimated1RMs.map((e: any) => e.estimated1RM))
        : null

      return {
        id: we.id,
        exercise_id: we.exercise_id,
        exercise_name: we.exercise_name,
        workout_id: we.workout?.id,
        workout_name: we.workout?.name,
        workout_date: we.workout?.scheduled_date || we.workout?.created_at,
        sets: sets.sort((a: any, b: any) => a.set_number - b.set_number),
        best_estimated_1rm: best1RM,
        superset_group: we.superset_group,
        rest_seconds: we.rest_seconds,
        notes: we.notes,
      }
    })

    // Calculate overall stats
    const allSets = history.flatMap((h: any) => h.sets.filter((s: any) => s.completed && s.actual_weight_lbs && s.actual_reps))

    // Best by rep range
    const bestByReps: Record<string, { weight: number; date: string }> = {}
    history.forEach((session: any) => {
      session.sets
        .filter((s: any) => s.completed && s.actual_weight_lbs && s.actual_reps)
        .forEach((s: any) => {
          const repKey = `${s.actual_reps}RM`
          if (!bestByReps[repKey] || s.actual_weight_lbs > bestByReps[repKey].weight) {
            bestByReps[repKey] = {
              weight: s.actual_weight_lbs,
              date: session.workout_date
            }
          }
        })
    })

    // 1RM trend over time
    const oneRMTrend = history
      .filter((h: any) => h.best_estimated_1rm)
      .map((h: any) => ({
        date: h.workout_date,
        estimated1RM: h.best_estimated_1rm,
        workout_name: h.workout_name,
      }))
      .reverse() // Chronological order for chart

    // Personal records
    const allEstimated1RMs = history
      .filter((h: any) => h.best_estimated_1rm)
      .map((h: any) => h.best_estimated_1rm)
    const pr1RM = allEstimated1RMs.length > 0 ? Math.max(...allEstimated1RMs) : null

    // Volume stats
    const totalVolume = allSets.reduce((sum: number, s: any) => sum + (s.actual_weight_lbs * s.actual_reps), 0)
    const totalSets = allSets.length

    return NextResponse.json({
      history,
      stats: {
        total_sessions: history.length,
        total_sets: totalSets,
        total_volume_lbs: Math.round(totalVolume),
        estimated_1rm_pr: pr1RM,
        best_by_reps: bestByReps,
        one_rm_trend: oneRMTrend,
      }
    })
  } catch (error) {
    console.error('Exercise history GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
