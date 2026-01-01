import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { format, subDays, startOfWeek, eachWeekOfInterval, parseISO } from 'date-fns'

interface WeeklyDataPoint {
  date: string
  weekStart: string
  weight?: number
  bodyFat?: number
  benchPress?: number
  squat?: number
  deadlift?: number
  ctl?: number
  atl?: number
  tsb?: number
  weeklyVolume?: number
  avgSleepScore?: number
  avgHRV?: number
  proteinAvg?: number
}

interface PersonalRecord {
  exercise: string
  weight: number
  reps: number
  date: string
  previousBest?: number
}

// GET /api/progress - Fetch aggregated progress data
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const range = searchParams.get('range') || '3m'

    // Calculate date range
    const endDate = new Date()
    let startDate: Date
    switch (range) {
      case '1m':
        startDate = subDays(endDate, 30)
        break
      case '3m':
        startDate = subDays(endDate, 90)
        break
      case '6m':
        startDate = subDays(endDate, 180)
        break
      case '1y':
        startDate = subDays(endDate, 365)
        break
      case 'all':
        startDate = subDays(endDate, 730) // 2 years max
        break
      default:
        startDate = subDays(endDate, 90)
    }

    const startStr = format(startDate, 'yyyy-MM-dd')
    const endStr = format(endDate, 'yyyy-MM-dd')

    // Fetch all data in parallel
    const [
      bodyCompResult,
      trainingLoadResult,
      sleepResult,
      nutritionResult,
      strengthEstimatesResult,
      exerciseProgressResult,
    ] = await Promise.all([
      // Body composition logs
      (adminClient as any)
        .from('body_composition_logs')
        .select('log_date, weight_lbs, body_fat_pct')
        .eq('user_id', user.id)
        .gte('log_date', startStr)
        .lte('log_date', endStr)
        .order('log_date', { ascending: true }),

      // Training load history (CTL/ATL/TSB, volume)
      (adminClient as any)
        .from('training_load_history')
        .select('log_date, ctl, atl, tsb, training_load')
        .eq('user_id', user.id)
        .gte('log_date', startStr)
        .lte('log_date', endStr)
        .order('log_date', { ascending: true }),

      // Sleep logs
      (adminClient as any)
        .from('sleep_logs')
        .select('log_date, sleep_score, hrv_avg')
        .eq('user_id', user.id)
        .gte('log_date', startStr)
        .lte('log_date', endStr)
        .order('log_date', { ascending: true }),

      // Nutrition logs
      (adminClient as any)
        .from('nutrition_logs')
        .select('log_date, total_protein_g')
        .eq('user_id', user.id)
        .gte('log_date', startStr)
        .lte('log_date', endStr)
        .order('log_date', { ascending: true }),

      // Strength estimates (current 1RMs)
      (adminClient as any)
        .from('user_exercise_estimates')
        .select('exercise_id, estimated_1rm_lbs, last_updated')
        .eq('user_id', user.id),

      // Exercise progress history (for PRs and strength over time)
      (adminClient as any)
        .from('exercise_progress')
        .select('exercise_name, estimated_1rm, calculated_at')
        .eq('user_id', user.id)
        .gte('calculated_at', startStr)
        .order('calculated_at', { ascending: true }),
    ])

    // Extract data
    const bodyComp = bodyCompResult.data || []
    const trainingLoad = trainingLoadResult.data || []
    const sleep = sleepResult.data || []
    const nutrition = nutritionResult.data || []
    const strengthEstimates = strengthEstimatesResult.data || []
    const exerciseProgress = exerciseProgressResult.data || []

    // Get exercise names for strength estimates
    const exerciseIds = strengthEstimates.map((e: any) => e.exercise_id)
    let exerciseMap = new Map<string, string>()
    if (exerciseIds.length > 0) {
      const { data: exercises } = await (adminClient as any)
        .from('exercises')
        .select('id, name')
        .in('id', exerciseIds)

      exerciseMap = new Map((exercises || []).map((e: any) => [e.id, e.name]))
    }

    // Group data by week
    const weeks = eachWeekOfInterval({ start: startDate, end: endDate })
    const weeklyData: WeeklyDataPoint[] = weeks.map(weekStart => {
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 6)
      const weekStartStr = format(weekStart, 'yyyy-MM-dd')
      const weekEndStr = format(weekEnd, 'yyyy-MM-dd')

      // Filter data for this week
      const weekBodyComp = bodyComp.filter((d: any) =>
        d.log_date >= weekStartStr && d.log_date <= weekEndStr
      )
      const weekTraining = trainingLoad.filter((d: any) =>
        d.log_date >= weekStartStr && d.log_date <= weekEndStr
      )
      const weekSleep = sleep.filter((d: any) =>
        d.log_date >= weekStartStr && d.log_date <= weekEndStr
      )
      const weekNutrition = nutrition.filter((d: any) =>
        d.log_date >= weekStartStr && d.log_date <= weekEndStr
      )

      // Calculate averages/totals
      const avgWeight = weekBodyComp.length > 0
        ? weekBodyComp.reduce((sum: number, d: any) => sum + (d.weight_lbs || 0), 0) / weekBodyComp.length
        : undefined

      const avgBodyFat = weekBodyComp.filter((d: any) => d.body_fat_pct).length > 0
        ? weekBodyComp.filter((d: any) => d.body_fat_pct).reduce((sum: number, d: any) => sum + d.body_fat_pct, 0) / weekBodyComp.filter((d: any) => d.body_fat_pct).length
        : undefined

      const lastTraining = weekTraining[weekTraining.length - 1]
      const weeklyVolume = weekTraining.reduce((sum: number, d: any) => sum + (d.training_load || 0), 0)

      const avgSleepScore = weekSleep.length > 0
        ? weekSleep.reduce((sum: number, d: any) => sum + (d.sleep_score || 0), 0) / weekSleep.length
        : undefined

      const avgHRV = weekSleep.filter((d: any) => d.hrv_avg).length > 0
        ? weekSleep.filter((d: any) => d.hrv_avg).reduce((sum: number, d: any) => sum + d.hrv_avg, 0) / weekSleep.filter((d: any) => d.hrv_avg).length
        : undefined

      const avgProtein = weekNutrition.length > 0
        ? weekNutrition.reduce((sum: number, d: any) => sum + (d.total_protein_g || 0), 0) / weekNutrition.length
        : undefined

      // Get strength numbers for this week from exercise_progress
      const weekStrength = exerciseProgress.filter((d: any) => {
        const calcDate = d.calculated_at?.split('T')[0] || d.calculated_at
        return calcDate >= weekStartStr && calcDate <= weekEndStr
      })

      // Find bench, squat, deadlift from this week's progress
      const benchEntry = weekStrength.find((d: any) =>
        d.exercise_name?.toLowerCase().includes('bench')
      )
      const squatEntry = weekStrength.find((d: any) =>
        d.exercise_name?.toLowerCase().includes('squat') &&
        !d.exercise_name?.toLowerCase().includes('front')
      )
      const deadliftEntry = weekStrength.find((d: any) =>
        d.exercise_name?.toLowerCase().includes('deadlift')
      )

      return {
        date: format(weekStart, 'MMM d'),
        weekStart: weekStartStr,
        weight: avgWeight ? Math.round(avgWeight * 10) / 10 : undefined,
        bodyFat: avgBodyFat ? Math.round(avgBodyFat * 10) / 10 : undefined,
        benchPress: benchEntry ? Math.round(benchEntry.estimated_1rm) : undefined,
        squat: squatEntry ? Math.round(squatEntry.estimated_1rm) : undefined,
        deadlift: deadliftEntry ? Math.round(deadliftEntry.estimated_1rm) : undefined,
        ctl: lastTraining?.ctl ? Math.round(lastTraining.ctl) : undefined,
        atl: lastTraining?.atl ? Math.round(lastTraining.atl) : undefined,
        tsb: lastTraining?.tsb ? Math.round(lastTraining.tsb) : undefined,
        weeklyVolume: weeklyVolume || undefined,
        avgSleepScore: avgSleepScore ? Math.round(avgSleepScore) : undefined,
        avgHRV: avgHRV ? Math.round(avgHRV) : undefined,
        proteinAvg: avgProtein ? Math.round(avgProtein) : undefined,
      }
    })

    // Filter out weeks with no data at all
    const filteredData = weeklyData.filter(w =>
      w.weight || w.benchPress || w.squat || w.deadlift ||
      w.ctl || w.weeklyVolume || w.avgSleepScore || w.proteinAvg
    )

    // Build personal records from exercise_progress
    // Group by exercise, find highest 1RM
    const prMap = new Map<string, { weight: number, date: string, previousBest?: number }>()

    exerciseProgress.forEach((entry: any) => {
      const name = entry.exercise_name
      const weight = entry.estimated_1rm
      const date = entry.calculated_at?.split('T')[0] || entry.calculated_at

      if (!prMap.has(name) || weight > prMap.get(name)!.weight) {
        const previous = prMap.get(name)?.weight
        prMap.set(name, {
          weight,
          date,
          previousBest: previous
        })
      }
    })

    // Convert to array and sort by date (most recent first)
    const personalRecords: PersonalRecord[] = Array.from(prMap.entries())
      .map(([exercise, data]) => ({
        exercise,
        weight: Math.round(data.weight),
        reps: 1, // Assuming 1RM
        date: data.date,
        previousBest: data.previousBest ? Math.round(data.previousBest) : undefined,
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10) // Top 10 PRs

    // Get current strength estimates for summary
    const currentStrength = {
      benchPress: strengthEstimates.find((e: any) =>
        exerciseMap.get(e.exercise_id)?.toLowerCase().includes('bench')
      )?.estimated_1rm_lbs,
      squat: strengthEstimates.find((e: any) =>
        exerciseMap.get(e.exercise_id)?.toLowerCase().includes('squat')
      )?.estimated_1rm_lbs,
      deadlift: strengthEstimates.find((e: any) =>
        exerciseMap.get(e.exercise_id)?.toLowerCase().includes('deadlift')
      )?.estimated_1rm_lbs,
    }

    // Get latest values for summary cards
    const latestWeight = bodyComp[bodyComp.length - 1]?.weight_lbs
    const latestCTL = trainingLoad[trainingLoad.length - 1]?.ctl
    const latestHRV = sleep[sleep.length - 1]?.hrv_avg

    return NextResponse.json({
      weeklyData: filteredData,
      personalRecords,
      currentStrength,
      summary: {
        latestWeight: latestWeight ? Math.round(latestWeight * 10) / 10 : null,
        latestBenchPress: currentStrength.benchPress ? Math.round(currentStrength.benchPress) : null,
        latestCTL: latestCTL ? Math.round(latestCTL) : null,
        latestHRV: latestHRV ? Math.round(latestHRV) : null,
      },
    })
  } catch (error) {
    console.error('Progress API error:', error)
    return NextResponse.json({ error: 'Failed to fetch progress data' }, { status: 500 })
  }
}
