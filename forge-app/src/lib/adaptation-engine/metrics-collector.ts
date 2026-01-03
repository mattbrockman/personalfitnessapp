// @ts-nocheck
// Metrics Collector for Adaptive Periodization
// Gathers all data needed for the adaptation engine to make recommendations
// Note: @ts-nocheck is needed until training-plan.ts types are updated to match implementation

import { createClient } from '@/lib/supabase/server'
import { calculateCTL, calculateATL, calculateTSB, calculateACWR } from '@/lib/training-load'
import type {
  EvidenceSummary,
  AdaptationEvaluation,
  PhaseType,
} from '@/types/training-plan'

// Collected metrics structure
export interface CollectedMetrics {
  // Training load
  trainingLoad: {
    ctl: number
    atl: number
    tsb: number
    acwr: number
    tsbTrend: 'improving' | 'stable' | 'declining'
  }

  // Weekly compliance
  compliance: {
    currentWeek: {
      targetHours: number
      actualHours: number
      hoursPercent: number
      targetTss: number
      actualTss: number
      tssPercent: number
    }
    recentWeeks: Array<{
      weekStart: string
      hoursPercent: number
      tssPercent: number
    }>
    consecutiveLowComplianceWeeks: number
  }

  // Phase progress
  phaseProgress: {
    currentPhaseId: string | null
    currentPhaseName: string | null
    phaseType: PhaseType | null
    startDate: string | null
    endDate: string | null
    percentComplete: number
    daysRemaining: number
    daysElapsed: number
  }

  // Readiness
  readiness: {
    current: number | null
    avgLast7Days: number
    trend: 'improving' | 'stable' | 'declining'
    consecutiveDecliningDays: number
    latestAssessment: {
      date: string
      score: number
      subjectiveReadiness: number
      hrvPercentBaseline: number | null
      sleepHours: number | null
      adjustmentFactor: number
      recommendedIntensity: 'reduce' | 'maintain' | 'push'
    } | null
  }

  // Strength progress (for strength-focused plans)
  strengthProgress: Record<string, {
    exerciseName: string
    startE1rm: number | null
    currentE1rm: number | null
    targetE1rm: number | null
    percentToTarget: number | null
    weeksWithoutProgress: number
    trend: 'improving' | 'plateau' | 'declining'
  }>

  // Recovery quality
  recoveryQuality: {
    avgSleepHoursLast7Days: number | null
    hrvTrend: 'improving' | 'stable' | 'declining'
    avgRestingHr: number | null
  }

  // Upcoming events
  upcomingEvents: Array<{
    id: string
    name: string
    eventDate: string
    daysUntil: number
    priority: 'A' | 'B' | 'C'
    eventType: string
  }>
}

/**
 * Collect all metrics needed for adaptation evaluation
 */
export async function collectMetrics(
  userId: string,
  planId: string
): Promise<CollectedMetrics> {
  const supabase = await createClient()

  // Run all queries in parallel for performance
  const [
    trainingLoadData,
    complianceData,
    phaseData,
    readinessData,
    strengthData,
    recoveryData,
    eventsData,
  ] = await Promise.all([
    collectTrainingLoad(supabase, userId),
    collectCompliance(supabase, userId, planId),
    collectPhaseProgress(supabase, userId, planId),
    collectReadiness(supabase, userId),
    collectStrengthProgress(supabase, userId, planId),
    collectRecoveryQuality(supabase, userId),
    collectUpcomingEvents(supabase, planId),
  ])

  return {
    trainingLoad: trainingLoadData,
    compliance: complianceData,
    phaseProgress: phaseData,
    readiness: readinessData,
    strengthProgress: strengthData,
    recoveryQuality: recoveryData,
    upcomingEvents: eventsData,
  }
}

/**
 * Collect training load metrics (CTL, ATL, TSB, ACWR)
 */
async function collectTrainingLoad(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<CollectedMetrics['trainingLoad']> {
  // Get TSS history for the last 60 days
  const sixtyDaysAgo = new Date()
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)

  const { data: workouts } = await (supabase as any)
    .from('workouts')
    .select('workout_date, actual_tss, planned_tss')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .gte('workout_date', sixtyDaysAgo.toISOString().split('T')[0])
    .order('workout_date', { ascending: false })

  const tssHistory = ((workouts || []) as any[]).map((w: any) => ({
    date: w.workout_date,
    tss: w.actual_tss || w.planned_tss || 0,
  }))

  const ctl = calculateCTL(tssHistory)
  const atl = calculateATL(tssHistory)
  const tsb = calculateTSB(ctl, atl)
  const acwr = calculateACWR(atl, ctl)

  // Calculate TSB trend over last 7 days
  const tsbTrend = await calculateTsbTrend(supabase, userId)

  return {
    ctl,
    atl,
    tsb,
    acwr,
    tsbTrend,
  }
}

/**
 * Calculate TSB trend over last 7 days
 */
async function calculateTsbTrend(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<'improving' | 'stable' | 'declining'> {
  const { data: history } = await (supabase as any)
    .from('training_load_history')
    .select('recorded_at, tsb')
    .eq('user_id', userId)
    .order('recorded_at', { ascending: false })
    .limit(7)

  if (!history || history.length < 3) return 'stable'

  // Simple linear regression on TSB values
  const values = ((history as any[]) || []).map((h: any) => h.tsb as number).reverse()
  const n = values.length

  // Calculate slope
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0
  for (let i = 0; i < n; i++) {
    sumX += i
    sumY += values[i]
    sumXY += i * values[i]
    sumX2 += i * i
  }

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)

  if (slope > 1) return 'improving'
  if (slope < -1) return 'declining'
  return 'stable'
}

/**
 * Collect compliance metrics
 */
async function collectCompliance(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  planId: string
): Promise<CollectedMetrics['compliance']> {
  // Get current week start (Monday)
  const now = new Date()
  const dayOfWeek = now.getDay()
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const currentWeekStart = new Date(now)
  currentWeekStart.setDate(now.getDate() + mondayOffset)
  currentWeekStart.setHours(0, 0, 0, 0)
  const currentWeekStartStr = currentWeekStart.toISOString().split('T')[0]

  // Get current week's target
  const { data: weeklyTarget } = await (supabase as any)
    .from('weekly_targets')
    .select(`
      target_hours,
      target_tss,
      training_phases!inner(plan_id)
    `)
    .eq('training_phases.plan_id', planId)
    .eq('week_start_date', currentWeekStartStr)
    .single()

  // Get current week's actual workouts
  const currentWeekEnd = new Date(currentWeekStart)
  currentWeekEnd.setDate(currentWeekStart.getDate() + 7)

  const { data: currentWeekWorkouts } = await (supabase as any)
    .from('workouts')
    .select('actual_duration_minutes, planned_duration_minutes, actual_tss, planned_tss')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .gte('workout_date', currentWeekStartStr)
    .lt('workout_date', currentWeekEnd.toISOString().split('T')[0])

  const actualHours = ((currentWeekWorkouts || []) as any[]).reduce(
    (sum: number, w: any) => sum + ((w.actual_duration_minutes || w.planned_duration_minutes || 0) / 60),
    0
  )
  const actualTss = ((currentWeekWorkouts || []) as any[]).reduce(
    (sum: number, w: any) => sum + (w.actual_tss || w.planned_tss || 0),
    0
  )

  const targetHours = (weeklyTarget as any)?.target_hours || 0
  const targetTss = (weeklyTarget as any)?.target_tss || 0

  const hoursPercent = targetHours > 0 ? actualHours / targetHours : 0
  const tssPercent = targetTss > 0 ? actualTss / targetTss : 0

  // Get recent weeks' compliance (last 4 weeks)
  const recentWeeks: CollectedMetrics['compliance']['recentWeeks'] = []
  let consecutiveLowComplianceWeeks = 0
  let stillCountingLow = true

  for (let i = 1; i <= 4; i++) {
    const weekStart = new Date(currentWeekStart)
    weekStart.setDate(weekStart.getDate() - (7 * i))
    const weekStartStr = weekStart.toISOString().split('T')[0]
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 7)

    const { data: weekTarget } = await (supabase as any)
      .from('weekly_targets')
      .select('target_hours, target_tss, training_phases!inner(plan_id)')
      .eq('training_phases.plan_id', planId)
      .eq('week_start_date', weekStartStr)
      .single()

    const { data: weekWorkouts } = await (supabase as any)
      .from('workouts')
      .select('actual_duration_minutes, planned_duration_minutes, actual_tss, planned_tss')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .gte('workout_date', weekStartStr)
      .lt('workout_date', weekEnd.toISOString().split('T')[0])

    const weekActualHours = ((weekWorkouts || []) as any[]).reduce(
      (sum: number, w: any) => sum + ((w.actual_duration_minutes || w.planned_duration_minutes || 0) / 60),
      0
    )
    const weekActualTss = ((weekWorkouts || []) as any[]).reduce(
      (sum: number, w: any) => sum + (w.actual_tss || w.planned_tss || 0),
      0
    )

    const weekHoursPercent = (weekTarget as any)?.target_hours
      ? weekActualHours / (weekTarget as any).target_hours
      : 1
    const weekTssPercent = (weekTarget as any)?.target_tss
      ? weekActualTss / (weekTarget as any).target_tss
      : 1

    recentWeeks.push({
      weekStart: weekStartStr,
      hoursPercent: weekHoursPercent,
      tssPercent: weekTssPercent,
    })

    // Count consecutive low compliance weeks (< 80%)
    if (stillCountingLow && weekHoursPercent < 0.8) {
      consecutiveLowComplianceWeeks++
    } else {
      stillCountingLow = false
    }
  }

  return {
    currentWeek: {
      targetHours,
      actualHours: Math.round(actualHours * 10) / 10,
      hoursPercent: Math.round(hoursPercent * 100) / 100,
      targetTss,
      actualTss,
      tssPercent: Math.round(tssPercent * 100) / 100,
    },
    recentWeeks,
    consecutiveLowComplianceWeeks,
  }
}

/**
 * Collect phase progress metrics
 */
async function collectPhaseProgress(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  planId: string
): Promise<CollectedMetrics['phaseProgress']> {
  const today = new Date().toISOString().split('T')[0]

  // Get active phase
  const { data: phase } = await (supabase as any)
    .from('training_phases')
    .select('id, name, phase_type, start_date, end_date')
    .eq('plan_id', planId)
    .lte('start_date', today)
    .gte('end_date', today)
    .single()

  if (!phase) {
    return {
      currentPhaseId: null,
      currentPhaseName: null,
      phaseType: null,
      startDate: null,
      endDate: null,
      percentComplete: 0,
      daysRemaining: 0,
      daysElapsed: 0,
    }
  }

  const phaseData = phase as any
  const startDate = new Date(phaseData.start_date)
  const endDate = new Date(phaseData.end_date)
  const now = new Date()

  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
  const daysElapsed = Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
  const daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  const percentComplete = Math.min(1, daysElapsed / totalDays)

  return {
    currentPhaseId: phaseData.id,
    currentPhaseName: phaseData.name,
    phaseType: phaseData.phase_type as PhaseType,
    startDate: phaseData.start_date,
    endDate: phaseData.end_date,
    percentComplete: Math.round(percentComplete * 100) / 100,
    daysRemaining: Math.max(0, daysRemaining),
    daysElapsed,
  }
}

/**
 * Collect readiness metrics
 */
async function collectReadiness(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<CollectedMetrics['readiness']> {
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  // Get readiness assessments from last 7 days
  const { data: assessments } = await (supabase as any)
    .from('readiness_assessments')
    .select('*')
    .eq('user_id', userId)
    .gte('assessment_date', sevenDaysAgo.toISOString().split('T')[0])
    .order('assessment_date', { ascending: false })

  // Get baselines for HRV comparison
  const { data: baselines } = await (supabase as any)
    .from('readiness_baselines')
    .select('avg_hrv')
    .eq('user_id', userId)
    .single()

  const assessmentList = (assessments || []) as any[]

  if (assessmentList.length === 0) {
    return {
      current: null,
      avgLast7Days: 0,
      trend: 'stable',
      consecutiveDecliningDays: 0,
      latestAssessment: null,
    }
  }

  const latest = assessmentList[0]
  const scores = assessmentList.map((a: any) => a.calculated_readiness_score || 50)
  const avgScore = scores.reduce((sum: number, s: number) => sum + s, 0) / scores.length

  // Calculate trend
  let trend: 'improving' | 'stable' | 'declining' = 'stable'
  let consecutiveDecliningDays = 0

  if (assessmentList.length >= 3) {
    // Check if declining
    let declining = true
    for (let i = 0; i < assessmentList.length - 1; i++) {
      const current = assessmentList[i].calculated_readiness_score || 50
      const previous = assessmentList[i + 1].calculated_readiness_score || 50
      if (current >= previous) {
        declining = false
        break
      }
      consecutiveDecliningDays++
    }

    if (declining && consecutiveDecliningDays >= 3) {
      trend = 'declining'
    } else if (scores[0] > avgScore + 5) {
      trend = 'improving'
    }
  }

  // Calculate HRV percent of baseline
  let hrvPercentBaseline: number | null = null
  if (latest.hrv_reading && (baselines as any)?.avg_hrv) {
    hrvPercentBaseline = Math.round((latest.hrv_reading / (baselines as any).avg_hrv) * 100)
  }

  return {
    current: latest.calculated_readiness_score,
    avgLast7Days: Math.round(avgScore),
    trend,
    consecutiveDecliningDays,
    latestAssessment: {
      date: latest.assessment_date,
      score: latest.calculated_readiness_score || 50,
      subjectiveReadiness: latest.subjective_readiness,
      hrvPercentBaseline,
      sleepHours: latest.sleep_hours,
      adjustmentFactor: latest.adjustment_factor || 1.0,
      recommendedIntensity: latest.recommended_intensity as 'reduce' | 'maintain' | 'push' || 'maintain',
    },
  }
}

/**
 * Collect strength progress metrics
 */
async function collectStrengthProgress(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  planId: string
): Promise<CollectedMetrics['strengthProgress']> {
  // Get plan's goal pathway for strength targets
  const { data: plan } = await (supabase as any)
    .from('training_plans')
    .select('goal_pathway, athlete_profile_snapshot, start_date')
    .eq('id', planId)
    .single()

  if (!plan) return {}

  const planData = plan as any

  // Get current 1RM estimates
  const { data: estimates } = await (supabase as any)
    .from('user_exercise_estimates')
    .select('exercise_name, estimated_1rm, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })

  const estimatesList = (estimates || []) as any[]
  if (estimatesList.length === 0) return {}

  const progress: CollectedMetrics['strengthProgress'] = {}

  // Main compound lifts to track
  const mainLifts = ['Barbell Back Squat', 'Barbell Bench Press', 'Deadlift', 'Overhead Press']

  for (const lift of mainLifts) {
    const estimate = estimatesList.find((e: any) =>
      e.exercise_name.toLowerCase().includes(lift.split(' ').pop()?.toLowerCase() || '')
    )

    if (estimate) {
      const currentE1rm = estimate.estimated_1rm

      // Get starting 1RM from athlete profile snapshot
      let startE1rm: number | null = null
      const snapshot = planData.athlete_profile_snapshot as Record<string, unknown> | null
      if (snapshot) {
        const key = lift.toLowerCase().includes('squat') ? 'squat_1rm'
          : lift.toLowerCase().includes('bench') ? 'bench_1rm'
          : lift.toLowerCase().includes('deadlift') ? 'deadlift_1rm'
          : lift.toLowerCase().includes('overhead') ? 'ohp_1rm'
          : null
        if (key && snapshot[key]) {
          startE1rm = snapshot[key] as number
        }
      }

      // Get target from goal pathway
      let targetE1rm: number | null = null
      const pathway = planData.goal_pathway as Record<string, unknown> | null
      if (pathway) {
        // Try to find target in pathway
        const liftKey = lift.toLowerCase().replace(/\s+/g, '_')
        if (pathway[liftKey] && typeof pathway[liftKey] === 'object') {
          const liftPathway = pathway[liftKey] as Record<string, unknown>
          targetE1rm = (liftPathway.target as number) || null
        }
      }

      // Calculate percent to target
      let percentToTarget: number | null = null
      if (startE1rm && targetE1rm && currentE1rm) {
        const totalGain = targetE1rm - startE1rm
        const currentGain = currentE1rm - startE1rm
        percentToTarget = totalGain > 0 ? Math.round((currentGain / totalGain) * 100) : 100
      }

      // Detect plateau (check if 1RM hasn't improved in recent weeks)
      // For now, we'll use a simplified approach - could be enhanced with historical data
      const weeksWithoutProgress = 0 // TODO: Calculate from exercise_sets history

      progress[lift] = {
        exerciseName: lift,
        startE1rm,
        currentE1rm,
        targetE1rm,
        percentToTarget,
        weeksWithoutProgress,
        trend: weeksWithoutProgress >= 2 ? 'plateau' : 'improving',
      }
    }
  }

  return progress
}

/**
 * Collect recovery quality metrics
 */
async function collectRecoveryQuality(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<CollectedMetrics['recoveryQuality']> {
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  // Get sleep data
  const { data: sleepLogs } = await (supabase as any)
    .from('sleep_logs')
    .select('total_sleep_hours, hrv_avg')
    .eq('user_id', userId)
    .gte('sleep_date', sevenDaysAgo.toISOString().split('T')[0])
    .order('sleep_date', { ascending: false })

  // Get readiness assessments for HRV trend
  const { data: assessments } = await (supabase as any)
    .from('readiness_assessments')
    .select('hrv_reading, resting_hr')
    .eq('user_id', userId)
    .gte('assessment_date', sevenDaysAgo.toISOString().split('T')[0])
    .order('assessment_date', { ascending: false })

  const sleepLogList = (sleepLogs || []) as any[]
  const assessmentList = (assessments || []) as any[]

  // Calculate averages
  let avgSleepHours: number | null = null
  if (sleepLogList.length > 0) {
    const totalSleep = sleepLogList.reduce((sum: number, log: any) => sum + (log.total_sleep_hours || 0), 0)
    avgSleepHours = Math.round((totalSleep / sleepLogList.length) * 10) / 10
  }

  let avgRestingHr: number | null = null
  if (assessmentList.length > 0) {
    const restingHrs = assessmentList.filter((a: any) => a.resting_hr).map((a: any) => a.resting_hr as number)
    if (restingHrs.length > 0) {
      avgRestingHr = Math.round(restingHrs.reduce((sum: number, hr: number) => sum + hr, 0) / restingHrs.length)
    }
  }

  // Calculate HRV trend
  let hrvTrend: 'improving' | 'stable' | 'declining' = 'stable'
  if (assessmentList.length >= 3) {
    const hrvValues = assessmentList.filter((a: any) => a.hrv_reading).map((a: any) => a.hrv_reading as number)
    if (hrvValues.length >= 3) {
      const recent = hrvValues.slice(0, 3).reduce((sum, v) => sum + v, 0) / 3
      const older = hrvValues.slice(-3).reduce((sum, v) => sum + v, 0) / Math.min(3, hrvValues.length)

      if (recent > older * 1.05) hrvTrend = 'improving'
      else if (recent < older * 0.95) hrvTrend = 'declining'
    }
  }

  return {
    avgSleepHoursLast7Days: avgSleepHours,
    hrvTrend,
    avgRestingHr,
  }
}

/**
 * Collect upcoming events
 */
async function collectUpcomingEvents(
  supabase: Awaited<ReturnType<typeof createClient>>,
  planId: string
): Promise<CollectedMetrics['upcomingEvents']> {
  const today = new Date().toISOString().split('T')[0]
  const thirtyDaysFromNow = new Date()
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)

  const { data: events } = await (supabase as any)
    .from('plan_events')
    .select('id, name, event_date, priority, event_type')
    .eq('plan_id', planId)
    .gte('event_date', today)
    .lte('event_date', thirtyDaysFromNow.toISOString().split('T')[0])
    .order('event_date', { ascending: true })

  if (!events) return []

  return ((events || []) as any[]).map((event: any) => {
    const eventDate = new Date(event.event_date)
    const now = new Date()
    const daysUntil = Math.ceil((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

    return {
      id: event.id,
      name: event.name,
      eventDate: event.event_date,
      daysUntil,
      priority: event.priority as 'A' | 'B' | 'C',
      eventType: event.event_type,
    }
  })
}

/**
 * Convert collected metrics to evidence summary for recommendations
 */
export function toEvidenceSummary(metrics: CollectedMetrics): EvidenceSummary {
  return {
    training_load: {
      ctl: metrics.trainingLoad.ctl,
      atl: metrics.trainingLoad.atl,
      tsb: metrics.trainingLoad.tsb,
      tsb_trend: metrics.trainingLoad.tsbTrend,
    },
    compliance: {
      hours_percent: metrics.compliance.currentWeek.hoursPercent,
      tss_percent: metrics.compliance.currentWeek.tssPercent,
    },
    readiness: {
      current: metrics.readiness.current || undefined,
      avg_7day: metrics.readiness.avgLast7Days,
      trend: metrics.readiness.trend,
    },
    strength_progress: Object.fromEntries(
      Object.entries(metrics.strengthProgress).map(([lift, data]) => [
        lift,
        {
          start: data.startE1rm || undefined,
          current: data.currentE1rm || undefined,
          target: data.targetE1rm || undefined,
          percent_complete: data.percentToTarget || undefined,
        },
      ])
    ),
    recovery_quality: {
      sleep_avg: metrics.recoveryQuality.avgSleepHoursLast7Days || undefined,
      hrv_trend: metrics.recoveryQuality.hrvTrend,
    },
  }
}

/**
 * Convert collected metrics to adaptation evaluation metrics snapshot
 */
export function toMetricsSnapshot(
  metrics: CollectedMetrics
): AdaptationEvaluation['metrics_snapshot'] {
  return {
    training_load: {
      ctl: metrics.trainingLoad.ctl,
      atl: metrics.trainingLoad.atl,
      tsb: metrics.trainingLoad.tsb,
      acwr: metrics.trainingLoad.acwr,
    },
    compliance: {
      hours_percent: metrics.compliance.currentWeek.hoursPercent,
      tss_percent: metrics.compliance.currentWeek.tssPercent,
    },
    phase_progress: metrics.phaseProgress.currentPhaseId ? {
      current_phase: metrics.phaseProgress.currentPhaseName || '',
      percent_complete: metrics.phaseProgress.percentComplete,
      days_remaining: metrics.phaseProgress.daysRemaining,
    } : undefined,
    readiness: metrics.readiness.current !== null ? {
      current: metrics.readiness.current,
      avg_7day: metrics.readiness.avgLast7Days,
      trend: metrics.readiness.trend,
    } : undefined,
    strength_progress: Object.keys(metrics.strengthProgress).length > 0
      ? Object.fromEntries(
          Object.entries(metrics.strengthProgress).map(([lift, data]) => [
            lift,
            {
              start: data.startE1rm || 0,
              current: data.currentE1rm || 0,
              target: data.targetE1rm || 0,
              percent: data.percentToTarget || 0,
            },
          ])
        )
      : undefined,
    recovery_quality: {
      sleep_avg: metrics.recoveryQuality.avgSleepHoursLast7Days || 0,
      hrv_trend: metrics.recoveryQuality.hrvTrend,
    },
  }
}
