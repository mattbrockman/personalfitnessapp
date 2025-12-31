import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getVolumeLandmarks,
  analyzeVolumeStatus,
  calculateEffectiveReps,
  calculateRelativeIntensity,
} from '@/lib/strength-calculations'
import { calculateTrainingAge, adjustVolumeLandmarks } from '@/lib/galpin-calculations'
import {
  WeeklyVolumeAnalysis,
  MuscleVolumeAnalysis,
  VolumeAlert,
  VolumeLandmarks,
  FrequencyAnalysis,
} from '@/types/strength'

// GET /api/strength/volume-analysis - Get weekly volume analysis per muscle group
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const weeksBack = parseInt(searchParams.get('weeks') || '1')

    // Calculate week start (Monday)
    const now = new Date()
    const dayOfWeek = now.getDay()
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() + diff - (weeksBack - 1) * 7)
    weekStart.setHours(0, 0, 0, 0)

    const weekStartStr = weekStart.toISOString().split('T')[0]

    // Fetch user's training age for volume adjustment
    const { data: profile } = await supabase
      .from('profiles')
      .select('training_start_date')
      .eq('id', user.id)
      .single() as { data: { training_start_date: string | null } | null; error: any }

    const trainingAge = calculateTrainingAge(profile?.training_start_date || null)
    const volumeMultiplier = trainingAge.volumeToleranceMultiplier

    // Fetch user's custom volume landmarks
    const { data: customLandmarks } = await supabase
      .from('volume_landmarks')
      .select('*')
      .eq('user_id', user.id)

    const landmarkMap = new Map<string, VolumeLandmarks>()
    ;(customLandmarks || []).forEach((l: any) => {
      // Adjust landmarks based on training age
      const adjusted = adjustVolumeLandmarks(
        l.mev_sets,
        l.mav_low,
        l.mav_high,
        l.mrv_sets,
        volumeMultiplier
      )
      landmarkMap.set(l.muscle_group, {
        mev: adjusted.mev,
        mavLow: adjusted.mavLow,
        mavHigh: adjusted.mavHigh,
        mrv: adjusted.mrv,
      })
    })

    // Fetch user's 1RM estimates for relative intensity calculation
    const { data: estimates } = await supabase
      .from('user_exercise_estimates')
      .select('exercise_id, estimated_1rm_lbs')
      .eq('user_id', user.id)

    const estimateMap = new Map<string, number>()
    ;(estimates || []).forEach((e: any) => {
      estimateMap.set(e.exercise_id, Number(e.estimated_1rm_lbs))
    })

    // Fetch completed workouts in the date range
    const { data: workouts, error: workoutError } = await (supabase as any)
      .from('workouts')
      .select(`
        id,
        scheduled_date,
        workout_exercises (
          id,
          exercise_id,
          exercise_name,
          exercise:exercises (
            id,
            name,
            primary_muscles
          ),
          sets:exercise_sets (
            id,
            set_type,
            actual_reps,
            actual_weight_lbs,
            actual_rpe,
            completed
          )
        )
      `)
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .gte('scheduled_date', weekStartStr)
      .order('scheduled_date', { ascending: false }) as { data: any[] | null; error: any }

    if (workoutError) {
      console.error('Error fetching workouts:', workoutError)
      return NextResponse.json({ error: 'Failed to fetch workouts' }, { status: 500 })
    }

    // Aggregate volume per muscle group
    const muscleStats = new Map<string, {
      hardSets: number
      effectiveReps: number
      totalVolume: number
      relativeIntensities: number[]
      sessionDates: Set<string>
    }>()

    for (const workout of (workouts || []) as any[]) {
      const workoutDate = workout.scheduled_date
      const exercises = workout.workout_exercises || []

      for (const ex of exercises) {
        const exercise = ex.exercise
        const primaryMuscles: string[] = exercise?.primary_muscles || []
        const exerciseId = ex.exercise_id
        const estimated1RM = estimateMap.get(exerciseId)

        // Get completed working sets (exclude warmups)
        const workingSets = (ex.sets || []).filter(
          (s: any) => s.completed && s.set_type !== 'warmup' && s.actual_reps && s.actual_weight_lbs
        )

        for (const muscle of primaryMuscles) {
          const normalizedMuscle = muscle.toLowerCase().replace(/\s+/g, '_')

          if (!muscleStats.has(normalizedMuscle)) {
            muscleStats.set(normalizedMuscle, {
              hardSets: 0,
              effectiveReps: 0,
              totalVolume: 0,
              relativeIntensities: [],
              sessionDates: new Set(),
            })
          }

          const stats = muscleStats.get(normalizedMuscle)!
          stats.sessionDates.add(workoutDate)

          for (const set of workingSets) {
            stats.hardSets += 1
            stats.totalVolume += set.actual_weight_lbs * set.actual_reps

            // Calculate effective reps
            const effectiveResult = calculateEffectiveReps(
              set.actual_reps,
              set.actual_rpe || null,
              null
            )
            stats.effectiveReps += effectiveResult.effectiveReps

            // Calculate relative intensity if we have 1RM
            if (estimated1RM) {
              const ri = calculateRelativeIntensity(set.actual_weight_lbs, estimated1RM)
              stats.relativeIntensities.push(ri)
            }
          }
        }
      }
    }

    // Build muscle analysis results
    const muscles: MuscleVolumeAnalysis[] = []
    const alerts: VolumeAlert[] = []

    for (const [muscleGroup, stats] of Array.from(muscleStats.entries())) {
      // Get landmarks (user custom or defaults, adjusted for training age)
      let landmarks = landmarkMap.get(muscleGroup)
      if (!landmarks) {
        const defaults = getVolumeLandmarks(muscleGroup)
        const adjusted = adjustVolumeLandmarks(
          defaults.mev,
          defaults.mavLow,
          defaults.mavHigh,
          defaults.mrv,
          volumeMultiplier
        )
        landmarks = adjusted
      }
      const volumeStatus = analyzeVolumeStatus(stats.hardSets, landmarks, muscleGroup)

      // Calculate average relative intensity
      const avgRI = stats.relativeIntensities.length > 0
        ? stats.relativeIntensities.reduce((a, b) => a + b, 0) / stats.relativeIntensities.length
        : null

      // Frequency analysis
      const sessionsPerWeek = stats.sessionDates.size
      const frequencyAnalysis: FrequencyAnalysis = {
        muscleGroup,
        sessionsPerWeek,
        isOptimal: sessionsPerWeek >= 2,
        recommendation: sessionsPerWeek >= 2
          ? 'Good frequency for hypertrophy'
          : sessionsPerWeek === 1
            ? 'Consider adding another session for this muscle'
            : 'No training detected - add sessions if priority muscle'
      }

      muscles.push({
        muscle_group: muscleGroup,
        hard_sets: stats.hardSets,
        effective_reps: stats.effectiveReps,
        total_volume_lbs: Math.round(stats.totalVolume),
        avg_relative_intensity: avgRI ? Math.round(avgRI * 10) / 10 : null,
        sessions_count: sessionsPerWeek,
        volume_status: volumeStatus,
        frequency_status: frequencyAnalysis,
      })

      // Generate alerts
      if (volumeStatus.status === 'below_mev') {
        alerts.push({
          id: `vol-${muscleGroup}-low`,
          type: 'volume',
          severity: 'warning',
          muscle_group: muscleGroup,
          message: `${muscleGroup} volume is below MEV (${stats.hardSets}/${landmarks.mev} sets)`,
          recommendation: volumeStatus.recommendation,
        })
      } else if (volumeStatus.status === 'over_mrv') {
        alerts.push({
          id: `vol-${muscleGroup}-high`,
          type: 'volume',
          severity: 'critical',
          muscle_group: muscleGroup,
          message: `${muscleGroup} volume exceeds MRV (${stats.hardSets}/${landmarks.mrv} sets)`,
          recommendation: volumeStatus.recommendation,
        })
      }

      if (sessionsPerWeek < 2 && stats.hardSets > 0) {
        alerts.push({
          id: `freq-${muscleGroup}`,
          type: 'frequency',
          severity: 'info',
          muscle_group: muscleGroup,
          message: `${muscleGroup} trained only ${sessionsPerWeek}x this week`,
          recommendation: frequencyAnalysis.recommendation,
        })
      }
    }

    // Sort by volume status priority (over_mrv first, then below_mev)
    muscles.sort((a, b) => {
      const priority: Record<string, number> = {
        'over_mrv': 0,
        'approaching_mrv': 1,
        'below_mev': 2,
        'approaching_mev': 3,
        'in_mav': 4,
      }
      return (priority[a.volume_status.status] || 5) - (priority[b.volume_status.status] || 5)
    })

    const analysis: WeeklyVolumeAnalysis = {
      week_start_date: weekStartStr,
      muscles,
      alerts,
      summary: {
        total_hard_sets: muscles.reduce((sum, m) => sum + m.hard_sets, 0),
        total_effective_reps: muscles.reduce((sum, m) => sum + m.effective_reps, 0),
        total_volume_lbs: muscles.reduce((sum, m) => sum + m.total_volume_lbs, 0),
        muscles_below_mev: muscles.filter(m => m.volume_status.status === 'below_mev').length,
        muscles_over_mrv: muscles.filter(m => m.volume_status.status === 'over_mrv').length,
      }
    }

    return NextResponse.json({
      analysis,
      training_age: {
        years: trainingAge.trainingAgeYears,
        months: trainingAge.trainingAgeMonths,
        experience_level: trainingAge.experienceLevel,
        volume_multiplier: volumeMultiplier,
      }
    })
  } catch (error) {
    console.error('Error in volume-analysis GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
