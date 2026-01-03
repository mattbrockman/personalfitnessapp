import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { startOfWeek, endOfWeek, subWeeks, format } from 'date-fns'

// GET /api/weekly-summary - Get comprehensive weekly progress summary
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()

    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    const searchParams = request.nextUrl.searchParams
    const weekOffset = parseInt(searchParams.get('week_offset') || '0')

    // Calculate week boundaries
    const targetDate = weekOffset === 0 ? new Date() : subWeeks(new Date(), Math.abs(weekOffset))
    const weekStart = startOfWeek(targetDate, { weekStartsOn: 1 })
    const weekEnd = endOfWeek(targetDate, { weekStartsOn: 1 })
    const weekStartStr = format(weekStart, 'yyyy-MM-dd')
    const weekEndStr = format(weekEnd, 'yyyy-MM-dd')

    // Previous week for comparison
    const prevWeekStart = subWeeks(weekStart, 1)
    const prevWeekEnd = subWeeks(weekEnd, 1)
    const prevWeekStartStr = format(prevWeekStart, 'yyyy-MM-dd')
    const prevWeekEndStr = format(prevWeekEnd, 'yyyy-MM-dd')

    // Fetch all workouts for this week
    const { data: thisWeekWorkouts, error: workoutError } = await adminClient
      .from('workouts')
      .select(`
        id,
        name,
        scheduled_date,
        status,
        category,
        workout_type,
        actual_duration_minutes,
        planned_duration_minutes,
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
            completed
          )
        )
      `)
      .eq('user_id', userId)
      .gte('scheduled_date', weekStartStr)
      .lte('scheduled_date', weekEndStr)
      .order('scheduled_date', { ascending: true })

    if (workoutError) {
      console.error('Error fetching workouts:', workoutError)
      return NextResponse.json({ error: 'Failed to fetch workouts' }, { status: 500 })
    }

    // Cast to any[] to work around Supabase type inference
    const workoutsData = (thisWeekWorkouts || []) as any[]

    // Fetch previous week workouts for comparison
    const { data: prevWeekWorkouts } = await adminClient
      .from('workouts')
      .select(`
        id,
        status,
        actual_duration_minutes,
        workout_exercises (
          sets:exercise_sets (
            actual_reps,
            actual_weight_lbs,
            completed
          )
        )
      `)
      .eq('user_id', userId)
      .eq('status', 'completed')
      .gte('scheduled_date', prevWeekStartStr)
      .lte('scheduled_date', prevWeekEndStr)

    // Calculate workout stats
    const completedWorkouts = workoutsData.filter(w => w.status === 'completed')
    const plannedWorkouts = workoutsData.filter(w => w.status === 'planned')
    const skippedWorkouts = workoutsData.filter(w => w.status === 'skipped')

    const prevCompletedCount = (prevWeekWorkouts || []).length

    // Calculate total duration
    const totalDuration = completedWorkouts.reduce((sum, w) =>
      sum + (w.actual_duration_minutes || 0), 0)
    const avgDuration = completedWorkouts.length > 0
      ? Math.round(totalDuration / completedWorkouts.length)
      : 0

    const prevTotalDuration = (prevWeekWorkouts || []).reduce((sum: number, w: any) =>
      sum + (w.actual_duration_minutes || 0), 0)

    // Calculate volume stats
    let totalVolume = 0
    let totalSets = 0
    const muscleDistribution: Record<string, number> = {}

    for (const workout of completedWorkouts) {
      for (const ex of (workout.workout_exercises || [])) {
        const primaryMuscles: string[] = (ex.exercise as any)?.primary_muscles || []
        const completedSets = ((ex.sets || []) as any[]).filter(
          (s: any) => s.completed && s.actual_weight_lbs && s.actual_reps
        )

        for (const set of completedSets) {
          totalVolume += (set.actual_weight_lbs || 0) * (set.actual_reps || 0)
          totalSets += 1

          // Track muscle distribution
          for (const muscle of primaryMuscles) {
            const normalizedMuscle = muscle.toLowerCase().replace(/\s+/g, '_')
            muscleDistribution[normalizedMuscle] = (muscleDistribution[normalizedMuscle] || 0) + 1
          }
        }
      }
    }

    // Previous week volume
    let prevTotalVolume = 0
    for (const workout of (prevWeekWorkouts || [])) {
      for (const ex of ((workout as any).workout_exercises || [])) {
        const completedSets = ((ex.sets || []) as any[]).filter(
          (s: any) => s.completed && s.actual_weight_lbs && s.actual_reps
        )
        for (const set of completedSets) {
          prevTotalVolume += (set.actual_weight_lbs || 0) * (set.actual_reps || 0)
        }
      }
    }

    // Fetch PRs achieved this week from strength estimates
    const { data: prData } = await adminClient
      .from('user_exercise_estimates')
      .select(`
        id,
        exercise_id,
        estimated_1rm_lbs,
        confidence,
        updated_at,
        exercise:exercises (
          id,
          name
        )
      `)
      .eq('user_id', userId)
      .gte('updated_at', weekStartStr)
      .lte('updated_at', `${weekEndStr}T23:59:59`)
      .order('updated_at', { ascending: false })

    // Format PRs for display
    const weeklyPRs = (prData || []).map((pr: any) => ({
      exerciseName: pr.exercise?.name || 'Unknown',
      exerciseId: pr.exercise_id,
      value: pr.estimated_1rm_lbs,
      type: 'e1rm' as const,
      date: pr.updated_at,
    }))

    // Calculate streak (consecutive days with completed workouts)
    const completedDates = new Set(
      completedWorkouts.map(w => w.scheduled_date)
    )

    let currentStreak = 0
    const today = new Date()
    let checkDate = new Date(today)

    // Count backwards from today
    while (true) {
      const dateStr = format(checkDate, 'yyyy-MM-dd')
      if (completedDates.has(dateStr)) {
        currentStreak++
        checkDate.setDate(checkDate.getDate() - 1)
      } else {
        break
      }
    }

    // Calculate comparison percentages
    const volumeChange = prevTotalVolume > 0
      ? Math.round(((totalVolume - prevTotalVolume) / prevTotalVolume) * 100)
      : 0
    const durationChange = prevTotalDuration > 0
      ? Math.round(((totalDuration - prevTotalDuration) / prevTotalDuration) * 100)
      : 0
    const workoutCountChange = prevCompletedCount > 0
      ? Math.round(((completedWorkouts.length - prevCompletedCount) / prevCompletedCount) * 100)
      : 0

    // Convert muscle distribution to sorted array
    const muscleDistributionArray = Object.entries(muscleDistribution)
      .map(([muscle, sets]) => ({ muscle, sets }))
      .sort((a, b) => b.sets - a.sets)
      .slice(0, 8) // Top 8 muscles

    // Get workout breakdown by type
    const workoutsByType: Record<string, number> = {}
    for (const w of completedWorkouts) {
      const type = w.category || w.workout_type || 'other'
      workoutsByType[type] = (workoutsByType[type] || 0) + 1
    }

    return NextResponse.json({
      week: {
        start: weekStartStr,
        end: weekEndStr,
        formatted: `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`,
      },
      workouts: {
        completed: completedWorkouts.length,
        planned: plannedWorkouts.length,
        skipped: skippedWorkouts.length,
        total: workoutsData.length,
        byType: workoutsByType,
      },
      volume: {
        total: Math.round(totalVolume),
        totalSets,
        previousWeek: Math.round(prevTotalVolume),
        changePercent: volumeChange,
      },
      duration: {
        total: totalDuration,
        average: avgDuration,
        previousWeek: prevTotalDuration,
        changePercent: durationChange,
      },
      prs: weeklyPRs,
      muscleDistribution: muscleDistributionArray,
      streak: {
        current: currentStreak,
      },
      comparison: {
        volumeVsLastWeek: volumeChange,
        workoutsVsLastWeek: workoutCountChange,
        durationVsLastWeek: durationChange,
      }
    })
  } catch (error) {
    console.error('Weekly summary error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
