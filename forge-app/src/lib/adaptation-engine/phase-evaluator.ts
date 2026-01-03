// @ts-nocheck
// Phase Evaluator for Phase-Level Adaptation Analysis
// Analyzes progress vs projections, generates phase-level recommendations
// TODO: Fix Supabase type generation to include newer tables

import { createAdminClient } from '@/lib/supabase/server'
import { collectMetrics, CollectedMetrics } from './metrics-collector'
import type {
  PlanRecommendation,
  PhaseExtensionChange,
  PhaseShortenChange,
  PhaseInsertChange,
  PerformanceTriggerData,
  TimeTriggerData,
} from '@/types/training-plan'

export interface PhaseEvaluationResult {
  hasRecommendation: boolean
  recommendations: Array<Omit<PlanRecommendation, 'id' | 'created_at' | 'updated_at'>>
  analysis: PhaseAnalysis
}

export interface PhaseAnalysis {
  phaseId: string | null
  phaseName: string
  phaseType: string
  startDate: string
  originalEndDate: string
  projectedEndDate: string
  daysRemaining: number
  percentComplete: number
  progress: {
    status: 'ahead' | 'on_track' | 'behind' | 'at_risk'
    strengthProgressPercent: number
    complianceAvg: number
    weeksCompleted: number
    weeksTotal: number
  }
  recommendations: {
    shouldExtend: boolean
    shouldShorten: boolean
    shouldInsertRecovery: boolean
    extensionDays: number
    reason: string | null
  }
}

/**
 * Evaluate the current phase and generate recommendations
 */
export async function evaluateCurrentPhase(
  userId: string,
  planId: string
): Promise<PhaseEvaluationResult> {
  const adminClient = createAdminClient()

  // Collect all metrics
  const metrics = await collectMetrics(userId, planId)

  // Get current phase info
  const phaseInfo = await getCurrentPhaseInfo(adminClient, planId)

  if (!phaseInfo) {
    return {
      hasRecommendation: false,
      recommendations: [],
      analysis: createEmptyAnalysis(),
    }
  }

  // Analyze the phase
  const analysis = analyzePhase(metrics, phaseInfo)

  // Generate recommendations based on analysis
  const recommendations = generatePhaseRecommendations(
    userId,
    planId,
    analysis,
    metrics,
    phaseInfo
  )

  return {
    hasRecommendation: recommendations.length > 0,
    recommendations,
    analysis,
  }
}

/**
 * Get current phase information
 */
async function getCurrentPhaseInfo(
  adminClient: ReturnType<typeof createAdminClient>,
  planId: string
): Promise<{
  id: string
  name: string
  type: string
  startDate: string
  endDate: string
  originalEndDate: string | null
  weekCount: number
  completedWeeks: number
  totalStrengthProgress: number
} | null> {
  const today = new Date().toISOString().split('T')[0]

  // Find current active phase
  const { data: phase } = await (adminClient as any)
    .from('training_phases')
    .select(`
      id,
      name,
      phase_type,
      start_date,
      end_date,
      original_end_date,
      weekly_targets(count)
    `)
    .eq('plan_id', planId)
    .lte('start_date', today)
    .gte('end_date', today)
    .single()

  if (!phase) {
    // Try to find the next upcoming phase
    const { data: nextPhase } = await (adminClient as any)
      .from('training_phases')
      .select('*')
      .eq('plan_id', planId)
      .gt('start_date', today)
      .order('start_date', { ascending: true })
      .limit(1)
      .single()

    if (nextPhase) {
      return {
        id: nextPhase.id,
        name: nextPhase.name,
        type: nextPhase.phase_type || 'build',
        startDate: nextPhase.start_date,
        endDate: nextPhase.end_date,
        originalEndDate: nextPhase.original_end_date,
        weekCount: 0,
        completedWeeks: 0,
        totalStrengthProgress: 0,
      }
    }
    return null
  }

  // Count completed weeks
  const phaseStart = new Date(phase.start_date)
  const now = new Date()
  const daysSinceStart = Math.floor((now.getTime() - phaseStart.getTime()) / (1000 * 60 * 60 * 24))
  const completedWeeks = Math.floor(daysSinceStart / 7)

  // Calculate total week count
  const phaseEnd = new Date(phase.end_date)
  const totalDays = Math.floor((phaseEnd.getTime() - phaseStart.getTime()) / (1000 * 60 * 60 * 24))
  const weekCount = Math.ceil(totalDays / 7)

  // Get strength progress for the phase
  const { data: strengthData } = await (adminClient as any)
    .from('exercise_progressions')
    .select('progress_percent')
    .eq('phase_id', phase.id)

  const avgStrengthProgress = strengthData && strengthData.length > 0
    ? strengthData.reduce((sum: number, e: any) => sum + (e.progress_percent || 0), 0) / strengthData.length
    : 0

  return {
    id: phase.id,
    name: phase.name,
    type: phase.phase_type || 'build',
    startDate: phase.start_date,
    endDate: phase.end_date,
    originalEndDate: phase.original_end_date,
    weekCount,
    completedWeeks,
    totalStrengthProgress: avgStrengthProgress,
  }
}

/**
 * Create empty analysis for when there's no active phase
 */
function createEmptyAnalysis(): PhaseAnalysis {
  return {
    phaseId: null,
    phaseName: 'No Active Phase',
    phaseType: 'unknown',
    startDate: '',
    originalEndDate: '',
    projectedEndDate: '',
    daysRemaining: 0,
    percentComplete: 0,
    progress: {
      status: 'on_track',
      strengthProgressPercent: 0,
      complianceAvg: 0,
      weeksCompleted: 0,
      weeksTotal: 0,
    },
    recommendations: {
      shouldExtend: false,
      shouldShorten: false,
      shouldInsertRecovery: false,
      extensionDays: 0,
      reason: null,
    },
  }
}

/**
 * Analyze the current phase based on collected metrics
 */
function analyzePhase(
  metrics: CollectedMetrics,
  phaseInfo: {
    id: string
    name: string
    type: string
    startDate: string
    endDate: string
    originalEndDate: string | null
    weekCount: number
    completedWeeks: number
    totalStrengthProgress: number
  }
): PhaseAnalysis {
  const { phaseProgress, compliance, trainingLoad, readiness, strengthProgress } = metrics

  // Calculate days remaining
  const today = new Date()
  const endDate = new Date(phaseInfo.endDate)
  const daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)))

  // Calculate percent complete
  const startDate = new Date(phaseInfo.startDate)
  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
  const daysCompleted = totalDays - daysRemaining
  const percentComplete = totalDays > 0 ? Math.round((daysCompleted / totalDays) * 100) : 0

  // Determine progress status
  let progressStatus: 'ahead' | 'on_track' | 'behind' | 'at_risk'
  const expectedProgress = percentComplete // Expected progress based on time
  const actualProgress = phaseInfo.totalStrengthProgress // Actual strength progress

  // Compare actual vs expected (with tolerance)
  const progressDelta = actualProgress - expectedProgress

  if (progressDelta > 15) {
    progressStatus = 'ahead'
  } else if (progressDelta < -15 && compliance.overallCompliance < 0.7) {
    progressStatus = 'at_risk'
  } else if (progressDelta < -15) {
    progressStatus = 'behind'
  } else {
    progressStatus = 'on_track'
  }

  // Calculate average compliance
  const avgCompliance = compliance.overallCompliance

  // Determine if phase adjustments are needed
  let shouldExtend = false
  let shouldShorten = false
  let shouldInsertRecovery = false
  let extensionDays = 0
  let reason: string | null = null

  // Extension logic
  if (progressStatus === 'behind' || progressStatus === 'at_risk') {
    // Behind on progress - consider extension
    const progressDeficit = expectedProgress - actualProgress
    if (progressDeficit > 20 && daysRemaining < 14) {
      shouldExtend = true
      // Estimate days needed: (deficit / daily_progress_rate)
      const dailyProgressRate = actualProgress / Math.max(1, daysCompleted)
      extensionDays = Math.ceil(progressDeficit / Math.max(0.5, dailyProgressRate))
      extensionDays = Math.min(extensionDays, 14) // Cap at 2 weeks
      reason = `Progress is ${Math.round(progressDeficit)}% behind schedule. Extension recommended to achieve phase goals.`
    }
  }

  // Shortening logic
  if (progressStatus === 'ahead' && daysRemaining > 7) {
    // Ahead of schedule - could shorten
    const progressSurplus = actualProgress - expectedProgress
    if (progressSurplus > 20 && actualProgress > 90) {
      shouldShorten = true
      // Could cut the remaining time by up to 50%
      extensionDays = -Math.floor(daysRemaining * 0.3) // Negative for shortening
      reason = `Progress is ${Math.round(progressSurplus)}% ahead of schedule. Phase goals nearly achieved.`
    }
  }

  // Recovery insertion logic
  if (trainingLoad.tsb < -25 && readiness.avgLast7Days < 40) {
    // Very fatigued with low readiness - need recovery
    if (phaseInfo.type !== 'recovery' && phaseInfo.type !== 'taper') {
      shouldInsertRecovery = true
      reason = 'Significant fatigue accumulation detected. Recovery phase recommended before continuing.'
    }
  }

  // Projected end date
  let projectedEndDate = phaseInfo.endDate
  if (shouldExtend) {
    const projected = new Date(phaseInfo.endDate)
    projected.setDate(projected.getDate() + Math.abs(extensionDays))
    projectedEndDate = projected.toISOString().split('T')[0]
  } else if (shouldShorten) {
    const projected = new Date(phaseInfo.endDate)
    projected.setDate(projected.getDate() + extensionDays) // extensionDays is negative
    projectedEndDate = projected.toISOString().split('T')[0]
  }

  return {
    phaseId: phaseInfo.id,
    phaseName: phaseInfo.name,
    phaseType: phaseInfo.type,
    startDate: phaseInfo.startDate,
    originalEndDate: phaseInfo.originalEndDate || phaseInfo.endDate,
    projectedEndDate,
    daysRemaining,
    percentComplete,
    progress: {
      status: progressStatus,
      strengthProgressPercent: phaseInfo.totalStrengthProgress,
      complianceAvg: avgCompliance,
      weeksCompleted: phaseInfo.completedWeeks,
      weeksTotal: phaseInfo.weekCount,
    },
    recommendations: {
      shouldExtend,
      shouldShorten,
      shouldInsertRecovery,
      extensionDays,
      reason,
    },
  }
}

/**
 * Generate phase-level recommendations based on analysis
 */
function generatePhaseRecommendations(
  userId: string,
  planId: string,
  analysis: PhaseAnalysis,
  metrics: CollectedMetrics,
  phaseInfo: {
    id: string
    name: string
    type: string
    startDate: string
    endDate: string
  }
): Array<Omit<PlanRecommendation, 'id' | 'created_at' | 'updated_at'>> {
  const recommendations: Array<Omit<PlanRecommendation, 'id' | 'created_at' | 'updated_at'>> = []

  // Don't generate recommendations for recovery or taper phases
  if (phaseInfo.type === 'recovery' || phaseInfo.type === 'taper') {
    return recommendations
  }

  // Only generate one recommendation at a time (prioritize)
  if (analysis.recommendations.shouldInsertRecovery) {
    recommendations.push(
      generatePhaseInsertRecommendation(userId, planId, analysis, metrics)
    )
  } else if (analysis.recommendations.shouldExtend && analysis.recommendations.extensionDays > 0) {
    recommendations.push(
      generatePhaseExtensionRecommendation(userId, planId, analysis, metrics)
    )
  } else if (analysis.recommendations.shouldShorten && analysis.recommendations.extensionDays < 0) {
    recommendations.push(
      generatePhaseShortenRecommendation(userId, planId, analysis, metrics)
    )
  }

  return recommendations
}

/**
 * Generate a phase extension recommendation
 */
function generatePhaseExtensionRecommendation(
  userId: string,
  planId: string,
  analysis: PhaseAnalysis,
  metrics: CollectedMetrics
): Omit<PlanRecommendation, 'id' | 'created_at' | 'updated_at'> {
  const triggerData: PerformanceTriggerData = {
    metric: 'phase_progress',
    threshold: 0,
    current_value: analysis.progress.strengthProgressPercent,
    direction: 'below',
  }

  const newEndDate = new Date(analysis.originalEndDate)
  newEndDate.setDate(newEndDate.getDate() + analysis.recommendations.extensionDays)

  const changes: PhaseExtensionChange = {
    original_end_date: analysis.originalEndDate,
    proposed_end_date: newEndDate.toISOString().split('T')[0],
    extension_days: analysis.recommendations.extensionDays,
    reason: 'progress_behind',
    affected_weeks: Math.ceil(analysis.recommendations.extensionDays / 7),
  }

  const reasoning = buildPhaseExtensionReasoning(analysis, metrics)

  return {
    plan_id: planId,
    user_id: userId,
    recommendation_type: 'phase_extension',
    scope: 'phase',
    trigger_type: 'performance',
    trigger_date: new Date().toISOString(),
    trigger_data: triggerData,
    target_phase_id: analysis.phaseId,
    target_week_id: null,
    target_workout_id: null,
    proposed_changes: changes as unknown as Record<string, unknown>,
    reasoning,
    confidence_score: calculatePhaseConfidence(analysis, metrics),
    evidence_summary: {
      phase_progress: {
        current: analysis.progress.strengthProgressPercent,
        expected: analysis.percentComplete,
        status: analysis.progress.status,
      },
      compliance: {
        average: analysis.progress.complianceAvg,
      },
      training_load: {
        tsb: metrics.trainingLoad.tsb,
      },
    },
    projected_impact: {
      new_end_date: newEndDate.toISOString().split('T')[0],
      additional_weeks: Math.ceil(analysis.recommendations.extensionDays / 7),
      goal_achievement: 'Higher likelihood of achieving phase goals',
    },
    priority: 2,
    expires_at: getPhaseRecommendationExpiry(analysis.phaseId ? 7 : 3),
    status: 'pending',
    user_notes: null,
    modified_changes: null,
    responded_at: null,
    applied_at: null,
  }
}

/**
 * Generate a phase shortening recommendation
 */
function generatePhaseShortenRecommendation(
  userId: string,
  planId: string,
  analysis: PhaseAnalysis,
  metrics: CollectedMetrics
): Omit<PlanRecommendation, 'id' | 'created_at' | 'updated_at'> {
  const triggerData: PerformanceTriggerData = {
    metric: 'phase_progress',
    threshold: 100,
    current_value: analysis.progress.strengthProgressPercent,
    direction: 'above',
  }

  const shortenDays = Math.abs(analysis.recommendations.extensionDays)
  const newEndDate = new Date(analysis.originalEndDate)
  newEndDate.setDate(newEndDate.getDate() - shortenDays)

  const changes: PhaseShortenChange = {
    original_end_date: analysis.originalEndDate,
    proposed_end_date: newEndDate.toISOString().split('T')[0],
    shorten_days: shortenDays,
    reason: 'progress_ahead',
  }

  const reasoning = `Your ${analysis.phaseName} phase is progressing ahead of schedule. ` +
    `You've achieved ${Math.round(analysis.progress.strengthProgressPercent)}% of phase goals ` +
    `with ${analysis.daysRemaining} days remaining. ` +
    `Shortening this phase by ${shortenDays} days allows you to move to the next phase while maintaining momentum.`

  return {
    plan_id: planId,
    user_id: userId,
    recommendation_type: 'phase_shorten',
    scope: 'phase',
    trigger_type: 'performance',
    trigger_date: new Date().toISOString(),
    trigger_data: triggerData,
    target_phase_id: analysis.phaseId,
    target_week_id: null,
    target_workout_id: null,
    proposed_changes: changes as unknown as Record<string, unknown>,
    reasoning,
    confidence_score: calculatePhaseConfidence(analysis, metrics),
    evidence_summary: {
      phase_progress: {
        current: analysis.progress.strengthProgressPercent,
        expected: analysis.percentComplete,
        status: analysis.progress.status,
      },
      compliance: {
        average: analysis.progress.complianceAvg,
      },
    },
    projected_impact: {
      new_end_date: newEndDate.toISOString().split('T')[0],
      days_saved: shortenDays,
      benefit: 'Earlier progression to next phase while maintaining gains',
    },
    priority: 4, // Lower priority - nice to have, not urgent
    expires_at: getPhaseRecommendationExpiry(7),
    status: 'pending',
    user_notes: null,
    modified_changes: null,
    responded_at: null,
    applied_at: null,
  }
}

/**
 * Generate a recovery phase insertion recommendation
 */
function generatePhaseInsertRecommendation(
  userId: string,
  planId: string,
  analysis: PhaseAnalysis,
  metrics: CollectedMetrics
): Omit<PlanRecommendation, 'id' | 'created_at' | 'updated_at'> {
  const triggerData: PerformanceTriggerData = {
    metric: 'tsb',
    threshold: -25,
    current_value: metrics.trainingLoad.tsb,
    direction: 'below',
  }

  // Calculate recovery phase dates
  const startDate = new Date()
  startDate.setDate(startDate.getDate() + 1) // Start tomorrow
  const endDate = new Date(startDate)
  endDate.setDate(endDate.getDate() + 6) // 1 week recovery

  const changes: PhaseInsertChange = {
    insert_after_phase_id: analysis.phaseId,
    phase_type: 'recovery',
    duration_days: 7,
    start_date: startDate.toISOString().split('T')[0],
    end_date: endDate.toISOString().split('T')[0],
    reason: 'fatigue_accumulation',
    shifts_remaining_phases: true,
  }

  const reasoning = `Your body is showing significant signs of accumulated fatigue. ` +
    `TSB is at ${Math.round(metrics.trainingLoad.tsb)} (very fatigued) and ` +
    `your average readiness over the past week is ${Math.round(metrics.readiness.avgLast7Days)}/100. ` +
    `Inserting a recovery week now will help you absorb the training stress and come back stronger. ` +
    `Without recovery, you risk overtraining, injury, or prolonged performance decline.`

  return {
    plan_id: planId,
    user_id: userId,
    recommendation_type: 'phase_insert',
    scope: 'phase',
    trigger_type: 'performance',
    trigger_date: new Date().toISOString(),
    trigger_data: triggerData,
    target_phase_id: analysis.phaseId,
    target_week_id: null,
    target_workout_id: null,
    proposed_changes: changes as unknown as Record<string, unknown>,
    reasoning,
    confidence_score: 0.9, // High confidence for fatigue-based recommendations
    evidence_summary: {
      training_load: {
        tsb: metrics.trainingLoad.tsb,
        tsb_trend: metrics.trainingLoad.tsbTrend,
        ctl: metrics.trainingLoad.ctl,
      },
      readiness: {
        current: metrics.readiness.current,
        avg_7day: metrics.readiness.avgLast7Days,
        trend: metrics.readiness.trend,
        consecutive_declining_days: metrics.readiness.consecutiveDecliningDays,
      },
    },
    projected_impact: {
      recovery_benefit: 'Critical for preventing overtraining',
      timeline_impact: 'Shifts remaining phases by 1 week',
      expected_tsb_improvement: '+15 to +25 TSB after recovery week',
    },
    priority: 1, // Highest priority - recovery is urgent
    expires_at: getPhaseRecommendationExpiry(3), // Short expiry - urgent
    status: 'pending',
    user_notes: null,
    modified_changes: null,
    responded_at: null,
    applied_at: null,
  }
}

/**
 * Build reasoning for phase extension
 */
function buildPhaseExtensionReasoning(
  analysis: PhaseAnalysis,
  metrics: CollectedMetrics
): string {
  const parts: string[] = []

  parts.push(`Your ${analysis.phaseName} phase is ${analysis.progress.status === 'at_risk' ? 'at risk' : 'behind schedule'}.`)

  const progressDelta = analysis.percentComplete - analysis.progress.strengthProgressPercent
  if (progressDelta > 0) {
    parts.push(`You're at ${Math.round(analysis.progress.strengthProgressPercent)}% of phase goals, ` +
      `but ${Math.round(analysis.percentComplete)}% of the phase time has passed.`)
  }

  if (analysis.progress.complianceAvg < 0.8) {
    parts.push(`Average compliance has been ${Math.round(analysis.progress.complianceAvg * 100)}%, ` +
      `which may have contributed to slower progress.`)
  }

  parts.push(`Extending the phase by ${analysis.recommendations.extensionDays} days ` +
    `gives you more time to achieve your goals without rushing.`)

  return parts.join(' ')
}

/**
 * Calculate confidence score for phase recommendations
 */
function calculatePhaseConfidence(
  analysis: PhaseAnalysis,
  metrics: CollectedMetrics
): number {
  let confidence = 0.5

  // More weeks of data = higher confidence
  if (analysis.progress.weeksCompleted >= 3) {
    confidence += 0.15
  } else if (analysis.progress.weeksCompleted >= 2) {
    confidence += 0.1
  }

  // Consistent compliance data adds confidence
  if (metrics.compliance.recentWeeks.length >= 2) {
    confidence += 0.1
  }

  // Strength progress tracking adds confidence
  if (metrics.strengthProgress.exercisesTracked > 3) {
    confidence += 0.1
  }

  // Clear progress status (not borderline) adds confidence
  if (analysis.progress.status === 'ahead' || analysis.progress.status === 'at_risk') {
    confidence += 0.1
  }

  return Math.min(confidence, 1.0)
}

/**
 * Get expiration date for phase recommendations
 */
function getPhaseRecommendationExpiry(days: number): string {
  const expiry = new Date()
  expiry.setDate(expiry.getDate() + days)
  expiry.setHours(23, 59, 59, 999)
  return expiry.toISOString()
}

/**
 * Run end-of-phase review
 * Called when approaching phase end to evaluate progress and recommend next steps
 */
export async function runPhaseEndReview(
  userId: string,
  planId: string
): Promise<{
  evaluation: PhaseEvaluationResult
  recommendationIds: string[]
}> {
  const adminClient = createAdminClient()

  // Evaluate the phase
  const evaluation = await evaluateCurrentPhase(userId, planId)

  const recommendationIds: string[] = []

  // Save any generated recommendations
  for (const rec of evaluation.recommendations) {
    // Check if similar recommendation already exists
    const { data: existing } = await (adminClient as any)
      .from('plan_recommendations')
      .select('id')
      .eq('user_id', userId)
      .eq('plan_id', planId)
      .eq('target_phase_id', rec.target_phase_id)
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
      evaluation_trigger: 'phase_end',
      metrics_snapshot: {
        phase: {
          id: evaluation.analysis.phaseId,
          name: evaluation.analysis.phaseName,
          progress: evaluation.analysis.progress,
        },
        training_load: {
          tsb: 0, // Would come from metrics
        },
      },
      recommendations_generated: recommendationIds.length,
      recommendation_ids: recommendationIds,
    })

  return {
    evaluation,
    recommendationIds,
  }
}

/**
 * Get phase timeline with projections
 * Returns current phase status and projected timeline
 */
export async function getPhaseTimeline(
  userId: string,
  planId: string
): Promise<{
  phases: Array<{
    id: string
    name: string
    type: string
    startDate: string
    endDate: string
    originalEndDate: string | null
    projectedEndDate: string
    status: 'completed' | 'current' | 'upcoming'
    progressPercent: number
  }>
  currentPhaseAnalysis: PhaseAnalysis | null
}> {
  const adminClient = createAdminClient()
  const today = new Date().toISOString().split('T')[0]

  // Get all phases
  const { data: phases } = await (adminClient as any)
    .from('training_phases')
    .select('*')
    .eq('plan_id', planId)
    .order('start_date', { ascending: true })

  if (!phases || phases.length === 0) {
    return {
      phases: [],
      currentPhaseAnalysis: null,
    }
  }

  // Get current phase analysis
  const evaluation = await evaluateCurrentPhase(userId, planId)

  // Map phases with status and projections
  const phaseTimeline = phases.map((phase: any) => {
    let status: 'completed' | 'current' | 'upcoming'
    let progressPercent = 0

    if (phase.end_date < today) {
      status = 'completed'
      progressPercent = 100
    } else if (phase.start_date <= today && phase.end_date >= today) {
      status = 'current'
      // Use analysis progress if available
      if (evaluation.analysis.phaseId === phase.id) {
        progressPercent = evaluation.analysis.percentComplete
      } else {
        // Calculate basic progress
        const start = new Date(phase.start_date)
        const end = new Date(phase.end_date)
        const now = new Date()
        const total = end.getTime() - start.getTime()
        const elapsed = now.getTime() - start.getTime()
        progressPercent = Math.round((elapsed / total) * 100)
      }
    } else {
      status = 'upcoming'
      progressPercent = 0
    }

    // Calculate projected end date based on analysis
    let projectedEndDate = phase.end_date
    if (status === 'current' && evaluation.analysis.phaseId === phase.id) {
      projectedEndDate = evaluation.analysis.projectedEndDate
    }

    return {
      id: phase.id,
      name: phase.name,
      type: phase.phase_type || 'build',
      startDate: phase.start_date,
      endDate: phase.end_date,
      originalEndDate: phase.original_end_date,
      projectedEndDate,
      status,
      progressPercent,
    }
  })

  return {
    phases: phaseTimeline,
    currentPhaseAnalysis: evaluation.analysis.phaseId ? evaluation.analysis : null,
  }
}
