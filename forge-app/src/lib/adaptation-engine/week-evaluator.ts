// @ts-nocheck
// Week Evaluator for Weekly Adaptation Analysis
// Analyzes compliance, recovery needs, and generates week-level recommendations
// TODO: Fix Supabase type generation to include newer tables

import { createAdminClient } from '@/lib/supabase/server'
import { collectMetrics, CollectedMetrics } from './metrics-collector'
import type {
  PlanRecommendation,
  WeekVolumeAdjustChange,
  WeekTypeChangeChange,
  PerformanceTriggerData,
  TimeTriggerData,
} from '@/types/training-plan'

export interface WeekEvaluationResult {
  hasRecommendation: boolean
  recommendations: Array<Omit<PlanRecommendation, 'id' | 'created_at' | 'updated_at'>>
  analysis: WeekAnalysis
}

export interface WeekAnalysis {
  weekId: string | null
  weekNumber: number
  weekStartDate: string
  weekType: string
  compliance: {
    hoursPercent: number
    tssPercent: number
    isLow: boolean
    consecutiveLowWeeks: number
  }
  recovery: {
    needsRecovery: boolean
    tsbStatus: 'fresh' | 'neutral' | 'fatigued' | 'very_fatigued'
    readinessTrend: 'improving' | 'stable' | 'declining'
    avgReadiness7Day: number
  }
  volumeRecommendation: 'increase' | 'maintain' | 'decrease' | null
  suggestedWeekType: string | null
}

/**
 * Evaluate the current week and generate recommendations
 */
export async function evaluateCurrentWeek(
  userId: string,
  planId: string
): Promise<WeekEvaluationResult> {
  const adminClient = createAdminClient()

  // Collect all metrics
  const metrics = await collectMetrics(userId, planId)

  // Get current week info
  const weekInfo = await getCurrentWeekInfo(adminClient, planId)

  // Analyze the week
  const analysis = analyzeWeek(metrics, weekInfo)

  // Generate recommendations based on analysis
  const recommendations = generateWeekRecommendations(
    userId,
    planId,
    analysis,
    metrics
  )

  return {
    hasRecommendation: recommendations.length > 0,
    recommendations,
    analysis,
  }
}

/**
 * Get current week information
 */
async function getCurrentWeekInfo(
  adminClient: ReturnType<typeof createAdminClient>,
  planId: string
): Promise<{
  weekId: string | null
  weekNumber: number
  weekStartDate: string
  weekType: string
  targetHours: number
  targetTss: number
}> {
  // Calculate current week start (Monday)
  const now = new Date()
  const dayOfWeek = now.getDay()
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() + mondayOffset)
  weekStart.setHours(0, 0, 0, 0)
  const weekStartStr = weekStart.toISOString().split('T')[0]

  // Try to find this week in weekly_targets
  const { data: weekTarget } = await (adminClient as any)
    .from('weekly_targets')
    .select(`
      id,
      week_number,
      week_start_date,
      week_type,
      target_hours,
      target_tss,
      training_phases!inner(plan_id)
    `)
    .eq('training_phases.plan_id', planId)
    .eq('week_start_date', weekStartStr)
    .single()

  if (weekTarget) {
    return {
      weekId: weekTarget.id,
      weekNumber: weekTarget.week_number,
      weekStartDate: weekTarget.week_start_date,
      weekType: weekTarget.week_type || 'normal',
      targetHours: weekTarget.target_hours || 0,
      targetTss: weekTarget.target_tss || 0,
    }
  }

  // Fallback if no weekly target found
  return {
    weekId: null,
    weekNumber: 0,
    weekStartDate: weekStartStr,
    weekType: 'normal',
    targetHours: 0,
    targetTss: 0,
  }
}

/**
 * Analyze the current week based on collected metrics
 */
function analyzeWeek(
  metrics: CollectedMetrics,
  weekInfo: {
    weekId: string | null
    weekNumber: number
    weekStartDate: string
    weekType: string
    targetHours: number
    targetTss: number
  }
): WeekAnalysis {
  const { trainingLoad, compliance, readiness } = metrics

  // Compliance analysis
  const isLowCompliance = compliance.currentWeek.hoursPercent < 0.8

  // TSB status
  let tsbStatus: 'fresh' | 'neutral' | 'fatigued' | 'very_fatigued'
  if (trainingLoad.tsb > 10) tsbStatus = 'fresh'
  else if (trainingLoad.tsb >= -10) tsbStatus = 'neutral'
  else if (trainingLoad.tsb >= -20) tsbStatus = 'fatigued'
  else tsbStatus = 'very_fatigued'

  // Recovery needs analysis
  const needsRecovery =
    tsbStatus === 'very_fatigued' ||
    (tsbStatus === 'fatigued' && readiness.trend === 'declining') ||
    readiness.consecutiveDecliningDays >= 5 ||
    (readiness.avgLast7Days < 40 && readiness.trend !== 'improving')

  // Volume recommendation
  let volumeRecommendation: 'increase' | 'maintain' | 'decrease' | null = null
  if (needsRecovery) {
    volumeRecommendation = 'decrease'
  } else if (tsbStatus === 'fresh' && readiness.avgLast7Days > 70) {
    volumeRecommendation = 'increase'
  } else if (isLowCompliance && compliance.consecutiveLowComplianceWeeks >= 2) {
    // If consistently not hitting targets, maybe targets are too high
    volumeRecommendation = 'decrease'
  }

  // Suggested week type
  let suggestedWeekType: string | null = null
  if (needsRecovery && weekInfo.weekType !== 'recovery' && weekInfo.weekType !== 'deload') {
    suggestedWeekType = 'recovery'
  }

  return {
    weekId: weekInfo.weekId,
    weekNumber: weekInfo.weekNumber,
    weekStartDate: weekInfo.weekStartDate,
    weekType: weekInfo.weekType,
    compliance: {
      hoursPercent: compliance.currentWeek.hoursPercent,
      tssPercent: compliance.currentWeek.tssPercent,
      isLow: isLowCompliance,
      consecutiveLowWeeks: compliance.consecutiveLowComplianceWeeks,
    },
    recovery: {
      needsRecovery,
      tsbStatus,
      readinessTrend: readiness.trend,
      avgReadiness7Day: readiness.avgLast7Days,
    },
    volumeRecommendation,
    suggestedWeekType,
  }
}

/**
 * Generate week-level recommendations based on analysis
 */
function generateWeekRecommendations(
  userId: string,
  planId: string,
  analysis: WeekAnalysis,
  metrics: CollectedMetrics
): Array<Omit<PlanRecommendation, 'id' | 'created_at' | 'updated_at'>> {
  const recommendations: Array<Omit<PlanRecommendation, 'id' | 'created_at' | 'updated_at'>> = []

  // Don't generate recommendations if we don't have a week target
  if (!analysis.weekId) {
    return recommendations
  }

  // Recovery week recommendation
  if (analysis.suggestedWeekType === 'recovery') {
    recommendations.push(
      generateWeekTypeChangeRecommendation(userId, planId, analysis, metrics)
    )
  }

  // Volume adjustment recommendation (if not already recommending recovery)
  if (analysis.volumeRecommendation && !analysis.suggestedWeekType) {
    const volumeRec = generateVolumeAdjustRecommendation(
      userId,
      planId,
      analysis,
      metrics
    )
    if (volumeRec) {
      recommendations.push(volumeRec)
    }
  }

  // Compliance alert recommendation
  if (analysis.compliance.consecutiveLowWeeks >= 2) {
    recommendations.push(
      generateComplianceAlertRecommendation(userId, planId, analysis, metrics)
    )
  }

  return recommendations
}

/**
 * Generate a week type change recommendation (e.g., normal → recovery)
 */
function generateWeekTypeChangeRecommendation(
  userId: string,
  planId: string,
  analysis: WeekAnalysis,
  metrics: CollectedMetrics
): Omit<PlanRecommendation, 'id' | 'created_at' | 'updated_at'> {
  const triggerData: PerformanceTriggerData = {
    metric: 'tsb',
    threshold: -20,
    current_value: metrics.trainingLoad.tsb,
    direction: 'below',
  }

  const changes: WeekTypeChangeChange = {
    original_type: analysis.weekType,
    proposed_type: 'recovery',
    reason: analysis.recovery.tsbStatus === 'very_fatigued'
      ? 'tsb_very_low'
      : 'readiness_declining',
  }

  const reasoning = buildWeekTypeChangeReasoning(analysis, metrics)

  // Calculate priority - recovery needs are urgent
  let priority = 2
  if (analysis.recovery.tsbStatus === 'very_fatigued') priority = 1

  // Expires at end of week
  const weekEnd = new Date(analysis.weekStartDate)
  weekEnd.setDate(weekEnd.getDate() + 6)
  weekEnd.setHours(23, 59, 59, 999)

  return {
    plan_id: planId,
    user_id: userId,
    recommendation_type: 'week_type_change',
    scope: 'week',
    trigger_type: 'performance',
    trigger_date: new Date().toISOString(),
    trigger_data: triggerData,
    target_phase_id: null,
    target_week_id: analysis.weekId,
    target_workout_id: null,
    proposed_changes: changes as unknown as Record<string, unknown>,
    reasoning,
    confidence_score: calculateWeekRecommendationConfidence(metrics),
    evidence_summary: {
      training_load: {
        tsb: metrics.trainingLoad.tsb,
        tsb_trend: metrics.trainingLoad.tsbTrend,
      },
      readiness: {
        current: metrics.readiness.current || undefined,
        avg_7day: metrics.readiness.avgLast7Days,
        trend: metrics.readiness.trend,
      },
      compliance: {
        hours_percent: analysis.compliance.hoursPercent,
      },
    },
    projected_impact: {
      recovery_benefit: 'High - allows body to absorb training stress',
      fitness_impact: 'Minimal short-term, positive long-term',
    },
    priority,
    expires_at: weekEnd.toISOString(),
    status: 'pending',
    user_notes: null,
    modified_changes: null,
    responded_at: null,
    applied_at: null,
  }
}

/**
 * Generate a volume adjustment recommendation
 */
function generateVolumeAdjustRecommendation(
  userId: string,
  planId: string,
  analysis: WeekAnalysis,
  metrics: CollectedMetrics
): Omit<PlanRecommendation, 'id' | 'created_at' | 'updated_at'> | null {
  // Only generate if we have meaningful targets
  if (metrics.compliance.currentWeek.targetHours === 0) {
    return null
  }

  let volumeChangePercent: number
  let reason: string

  if (analysis.volumeRecommendation === 'decrease') {
    // Recommend 15-25% reduction based on severity
    volumeChangePercent = analysis.recovery.tsbStatus === 'fatigued' ? -15 : -25
    reason = analysis.compliance.consecutiveLowWeeks >= 2
      ? 'Consistent difficulty meeting targets - adjusting to achievable levels'
      : 'Recovery needs indicate lower volume would be beneficial'
  } else if (analysis.volumeRecommendation === 'increase') {
    // Recommend 5-10% increase
    volumeChangePercent = 10
    reason = 'Good recovery state and high readiness indicate capacity for more training'
  } else {
    return null
  }

  const currentTargetHours = metrics.compliance.currentWeek.targetHours
  const proposedHours = Math.round(currentTargetHours * (1 + volumeChangePercent / 100) * 10) / 10

  const triggerData: PerformanceTriggerData = {
    metric: analysis.volumeRecommendation === 'decrease' ? 'compliance' : 'readiness',
    threshold: analysis.volumeRecommendation === 'decrease' ? 0.8 : 70,
    current_value: analysis.volumeRecommendation === 'decrease'
      ? analysis.compliance.hoursPercent
      : metrics.readiness.avgLast7Days,
    direction: analysis.volumeRecommendation === 'decrease' ? 'below' : 'above',
  }

  const changes: WeekVolumeAdjustChange = {
    target_hours: {
      original: currentTargetHours,
      proposed: proposedHours,
    },
    volume_percentage_change: volumeChangePercent,
    reason: analysis.volumeRecommendation === 'decrease' ? 'recovery_needed' : 'capacity_available',
  }

  // Priority - volume adjustments are moderate priority
  const priority = analysis.volumeRecommendation === 'decrease' ? 3 : 4

  // Expires at end of week
  const weekEnd = new Date(analysis.weekStartDate)
  weekEnd.setDate(weekEnd.getDate() + 6)
  weekEnd.setHours(23, 59, 59, 999)

  return {
    plan_id: planId,
    user_id: userId,
    recommendation_type: 'week_volume_adjust',
    scope: 'week',
    trigger_type: 'performance',
    trigger_date: new Date().toISOString(),
    trigger_data: triggerData,
    target_phase_id: null,
    target_week_id: analysis.weekId,
    target_workout_id: null,
    proposed_changes: changes as unknown as Record<string, unknown>,
    reasoning: reason,
    confidence_score: calculateWeekRecommendationConfidence(metrics),
    evidence_summary: {
      training_load: {
        tsb: metrics.trainingLoad.tsb,
      },
      compliance: {
        hours_percent: analysis.compliance.hoursPercent,
        tss_percent: analysis.compliance.tssPercent,
      },
      readiness: {
        avg_7day: metrics.readiness.avgLast7Days,
      },
    },
    projected_impact: {
      new_weekly_hours: proposedHours,
      change_percent: volumeChangePercent,
    },
    priority,
    expires_at: weekEnd.toISOString(),
    status: 'pending',
    user_notes: null,
    modified_changes: null,
    responded_at: null,
    applied_at: null,
  }
}

/**
 * Generate a compliance alert recommendation
 */
function generateComplianceAlertRecommendation(
  userId: string,
  planId: string,
  analysis: WeekAnalysis,
  metrics: CollectedMetrics
): Omit<PlanRecommendation, 'id' | 'created_at' | 'updated_at'> {
  const triggerData: PerformanceTriggerData = {
    metric: 'compliance',
    threshold: 0.8,
    current_value: analysis.compliance.hoursPercent,
    direction: 'below',
    consecutive_weeks: analysis.compliance.consecutiveLowWeeks,
  }

  const reasoning = `You've completed less than 80% of your planned training for ${analysis.compliance.consecutiveLowWeeks} consecutive weeks. ` +
    `This could indicate that targets are too ambitious, or that life circumstances are making training difficult. ` +
    `Consider either adjusting your weekly targets to be more achievable, or identifying and addressing barriers to training.`

  // Expires in 7 days
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 7)

  return {
    plan_id: planId,
    user_id: userId,
    recommendation_type: 'week_volume_adjust',
    scope: 'week',
    trigger_type: 'performance',
    trigger_date: new Date().toISOString(),
    trigger_data: triggerData,
    target_phase_id: null,
    target_week_id: analysis.weekId,
    target_workout_id: null,
    proposed_changes: {
      alert_type: 'compliance_warning',
      consecutive_low_weeks: analysis.compliance.consecutiveLowWeeks,
      avg_compliance: analysis.compliance.hoursPercent,
    },
    reasoning,
    confidence_score: 0.9, // High confidence - clear data
    evidence_summary: {
      compliance: {
        hours_percent: analysis.compliance.hoursPercent,
        consecutive_low_weeks: analysis.compliance.consecutiveLowWeeks,
      },
    },
    projected_impact: {
      risk: 'Continued low compliance may hinder progress toward goals',
    },
    priority: 3,
    expires_at: expiresAt.toISOString(),
    status: 'pending',
    user_notes: null,
    modified_changes: null,
    responded_at: null,
    applied_at: null,
  }
}

/**
 * Build reasoning for week type change
 */
function buildWeekTypeChangeReasoning(
  analysis: WeekAnalysis,
  metrics: CollectedMetrics
): string {
  const parts: string[] = []

  if (analysis.recovery.tsbStatus === 'very_fatigued') {
    parts.push(`Your Training Stress Balance (TSB) is at ${Math.round(metrics.trainingLoad.tsb)}, indicating significant accumulated fatigue.`)
  } else if (analysis.recovery.tsbStatus === 'fatigued') {
    parts.push(`Your TSB is ${Math.round(metrics.trainingLoad.tsb)}, showing moderate fatigue accumulation.`)
  }

  if (analysis.recovery.readinessTrend === 'declining') {
    parts.push(`Your readiness scores have been declining over the past week, averaging ${analysis.recovery.avgReadiness7Day}/100.`)
  }

  if (metrics.readiness.consecutiveDecliningDays >= 5) {
    parts.push(`You've had ${metrics.readiness.consecutiveDecliningDays} consecutive days of declining readiness.`)
  }

  parts.push(`Converting this week to a recovery week will help your body absorb the training stress and come back stronger.`)
  parts.push(`Recovery weeks typically reduce volume by 40-50% while maintaining some intensity to avoid detraining.`)

  return parts.join(' ')
}

/**
 * Calculate confidence score for week recommendations
 */
function calculateWeekRecommendationConfidence(metrics: CollectedMetrics): number {
  let confidence = 0.5

  // TSB data adds confidence
  if (metrics.trainingLoad.tsb !== 0) {
    confidence += 0.15
  }

  // Multiple weeks of compliance data adds confidence
  if (metrics.compliance.recentWeeks.length >= 2) {
    confidence += 0.1
  }

  // Readiness data adds confidence
  if (metrics.readiness.current !== null) {
    confidence += 0.15
  }

  // Readiness trend calculation adds confidence
  if (metrics.readiness.avgLast7Days > 0) {
    confidence += 0.1
  }

  return Math.min(confidence, 1.0)
}

/**
 * Run end-of-week review analysis
 * Called via cron or manually to analyze completed week
 */
export async function runWeeklyReview(
  userId: string,
  planId: string
): Promise<{
  evaluation: WeekEvaluationResult
  recommendationIds: string[]
}> {
  const adminClient = createAdminClient()

  // Evaluate the week
  const evaluation = await evaluateCurrentWeek(userId, planId)

  const recommendationIds: string[] = []

  // Save any generated recommendations
  for (const rec of evaluation.recommendations) {
    // Check if similar recommendation already exists
    const { data: existing } = await (adminClient as any)
      .from('plan_recommendations')
      .select('id')
      .eq('user_id', userId)
      .eq('plan_id', planId)
      .eq('target_week_id', rec.target_week_id)
      .eq('recommendation_type', rec.recommendation_type)
      .eq('status', 'pending')
      .single()

    if (existing) {
      recommendationIds.push(existing.id)
      continue
    }

    // Create new recommendation
    const { data: created, error } = await (adminClient as any)
      .from('plan_recommendations')
      .insert(rec)
      .select('id')
      .single()

    if (!error && created) {
      recommendationIds.push(created.id)
    }
  }

  // Create evaluation record
  await (adminClient as any)
    .from('adaptation_evaluations')
    .insert({
      plan_id: planId,
      user_id: userId,
      evaluation_type: 'scheduled',
      evaluation_trigger: 'weekly_review',
      metrics_snapshot: {
        training_load: {
          ctl: evaluation.analysis.recovery.avgReadiness7Day,
          tsb: evaluation.analysis.recovery.tsbStatus,
        },
        compliance: evaluation.analysis.compliance,
        readiness: evaluation.analysis.recovery,
      },
      recommendations_generated: recommendationIds.length,
      recommendation_ids: recommendationIds,
    })

  return {
    evaluation,
    recommendationIds,
  }
}
