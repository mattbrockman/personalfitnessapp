import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  suggestProgression,
  detectPlateau,
  calculate1RM,
} from '@/lib/strength-calculations'
import { ProgressionModel, ProgressionSuggestion, PlateauInfo } from '@/types/strength'

// GET /api/strength/progression - Get progression suggestion for an exercise
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const exerciseId = searchParams.get('exercise_id')
    const exerciseName = searchParams.get('exercise_name')

    if (!exerciseId && !exerciseName) {
      return NextResponse.json({ error: 'exercise_id or exercise_name required' }, { status: 400 })
    }

    // Get user's strength preferences
    const { data: prefs } = await (supabase as any)
      .from('strength_preferences')
      .select('*')
      .eq('user_id', user.id)
      .single()

    const prefsData = prefs as any
    const progressionModel: ProgressionModel = prefsData?.progression_model || 'double'
    const linearIncrement = prefsData?.linear_increment_lbs || 5
    const repRangeLow = prefsData?.double_rep_target_low || 8
    const repRangeHigh = prefsData?.double_rep_target_high || 12
    const weightIncrease = prefsData?.double_weight_increase_lbs || 5
    const rpeTargetLow = prefsData?.rpe_target_low || 7
    const rpeTargetHigh = prefsData?.rpe_target_high || 9

    // Get recent workout history for this exercise
    let workoutsQuery = (supabase as any)
      .from('workout_exercises')
      .select(`
        id,
        exercise_id,
        exercise_name,
        workout:workouts!inner (
          id,
          user_id,
          scheduled_date,
          status
        ),
        sets:exercise_sets (
          id,
          set_number,
          actual_reps,
          actual_weight_lbs,
          actual_rpe,
          completed
        )
      `)
      .eq('workout.user_id', user.id)
      .eq('workout.status', 'completed')
      .order('created_at', { ascending: false })
      .limit(20)

    if (exerciseId) {
      workoutsQuery = workoutsQuery.eq('exercise_id', exerciseId)
    } else if (exerciseName) {
      workoutsQuery = workoutsQuery.ilike('exercise_name', `%${exerciseName}%`)
    }

    const { data: workoutExercises, error } = await workoutsQuery as { data: any[] | null; error: any }

    if (error) {
      console.error('Error fetching exercise history:', error)
      return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 })
    }

    if (!workoutExercises || workoutExercises.length === 0) {
      return NextResponse.json({
        suggestion: {
          model: progressionModel,
          currentWeight: 0,
          currentReps: repRangeLow,
          suggestedWeight: 0,
          suggestedReps: repRangeLow,
          reasoning: 'No workout history found. Start with a weight you can do for ' + repRangeLow + ' reps with good form.',
        },
        plateauInfo: null,
        history: []
      })
    }

    // Build progression history (best set per session)
    const sessionHistory: { date: string; weight: number; reps: number; rpe: number | null; e1rm: number }[] = []

    for (const we of workoutExercises) {
      const workout = we.workout as any
      const sets = (we.sets || []).filter((s: any) =>
        s.completed && s.actual_reps && s.actual_weight_lbs
      )

      if (sets.length === 0) continue

      // Find best set by estimated 1RM
      let bestSet = sets[0]
      let bestE1RM = 0

      for (const set of sets) {
        const e1rm = calculate1RM(set.actual_weight_lbs, set.actual_reps).estimated1RM
        if (e1rm > bestE1RM) {
          bestE1RM = e1rm
          bestSet = set
        }
      }

      sessionHistory.push({
        date: workout.scheduled_date,
        weight: bestSet.actual_weight_lbs,
        reps: bestSet.actual_reps,
        rpe: bestSet.actual_rpe,
        e1rm: bestE1RM,
      })
    }

    // Get most recent session
    const lastSession = sessionHistory[0]
    if (!lastSession) {
      return NextResponse.json({
        suggestion: {
          model: progressionModel,
          currentWeight: 0,
          currentReps: repRangeLow,
          suggestedWeight: 0,
          suggestedReps: repRangeLow,
          reasoning: 'No completed sets found.',
        },
        plateauInfo: null,
        history: sessionHistory
      })
    }

    // Check for plateau
    const plateauData = detectPlateau(
      sessionHistory.map(h => ({ week: h.date, best_e1rm: h.e1rm })),
      3
    )

    // Get exercise name for plateau info
    const exerciseNameResolved = workoutExercises[0]?.exercise_name || 'this exercise'

    const plateauInfo: PlateauInfo | null = plateauData.plateau ? {
      exercise_id: exerciseId || '',
      exercise_name: exerciseNameResolved,
      plateau_detected: true,
      weeks_without_progress: plateauData.weeksStagnant,
      last_pr_date: sessionHistory.find(h => h.e1rm === Math.max(...sessionHistory.map(s => s.e1rm)))?.date,
      last_pr_e1rm: Math.max(...sessionHistory.map(s => s.e1rm)),
      suggestion: plateauData.weeksStagnant >= 4
        ? 'Consider a deload week, then try a different rep range or variation'
        : 'Push through with small increments or add an extra set',
    } : null

    // Generate progression suggestion
    const suggestion = suggestProgression(
      progressionModel,
      lastSession.weight,
      lastSession.reps,
      repRangeLow,
      repRangeHigh,
      progressionModel === 'linear' ? linearIncrement : weightIncrease,
      { low: rpeTargetLow, high: rpeTargetHigh },
      lastSession.rpe || undefined
    )

    // Adjust suggestion if plateau detected
    if (plateauData.plateau && plateauData.weeksStagnant >= 4) {
      suggestion.reasoning += ' Note: Plateau detected - consider varying rep range or exercise selection.'
    }

    return NextResponse.json({
      suggestion,
      plateauInfo,
      history: sessionHistory.slice(0, 10),
      preferences: {
        model: progressionModel,
        linearIncrement,
        repRangeLow,
        repRangeHigh,
        weightIncrease,
        rpeTargetLow,
        rpeTargetHigh,
      }
    })
  } catch (error) {
    console.error('Error in progression GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
