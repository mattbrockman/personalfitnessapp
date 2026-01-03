// @ts-nocheck
// Workout Evaluator for Day-of Readiness Adjustments
// Analyzes readiness data and generates workout-level recommendations
// Note: @ts-nocheck is needed until training-plan.ts types are updated to match implementation

import { createClient, createAdminClient } from '@/lib/supabase/server'
import type {
  PlanRecommendation,
  WorkoutIntensityScaleChange,
  ReadinessTriggerData,
  SuggestedWorkout,
  AdaptationSettings,
} from '@/types/training-plan'

export interface WorkoutEvaluationResult {
  hasRecommendation: boolean
  recommendation?: Omit<PlanRecommendation, 'id' | 'created_at' | 'updated_at'>
  workouts: SuggestedWorkout[]
  readinessScore: number | null
  adjustmentFactor: number
  recommendedIntensity: 'reduce' | 'maintain' | 'push'
}

export interface ReadinessData {
  readinessScore: number
  subjectiveReadiness: number
  adjustmentFactor: number
  recommendedIntensity: 'reduce' | 'maintain' | 'push'
  hrvPercentBaseline: number | null
  sleepHours: number | null
  sleepQuality: number | null
  tsb: number | null
  assessmentDate: string
}

/**
 * Evaluate today's workouts based on readiness data
 * This is the primary entry point for day-of workout adjustments
 */
export async function evaluateTodaysWorkouts(
  userId: string,
  planId: string,
  readinessData?: ReadinessData
): Promise<WorkoutEvaluationResult> {
  const supabase = await createClient()
  const adminClient = createAdminClient()
  const today = new Date().toISOString().split('T')[0]

  // Get user's adaptation settings
  const { data: settings } = await (adminClient as ReturnType<typeof createAdminClient>)
    .from('adaptation_settings')
    .select('*')
    .eq('user_id', userId)
    .single()

  const adaptationSettings = settings as AdaptationSettings | null

  // If day-of adjustments are disabled, return early
  if (adaptationSettings && !adaptationSettings.day_of_adjustment_enabled) {
    const { data: workouts } = await (adminClient as ReturnType<typeof createAdminClient>)
      .from('suggested_workouts')
      .select('*')
      .eq('plan_id', planId)
      .eq('suggested_date', today)
      .eq('status', 'suggested')

    return {
      hasRecommendation: false,
      workouts: (workouts || []) as SuggestedWorkout[],
      readinessScore: readinessData?.readinessScore || null,
      adjustmentFactor: 1.0,
      recommendedIntensity: 'maintain',
    }
  }

  // Get or fetch readiness data
  let readiness: ReadinessData | null = readinessData || null

  if (!readiness) {
    readiness = await fetchTodaysReadiness(adminClient as ReturnType<typeof createAdminClient>, userId)
  }

  // Get today's suggested workouts
  const { data: workouts } = await (adminClient as ReturnType<typeof createAdminClient>)
    .from('suggested_workouts')
    .select('*')
    .eq('plan_id', planId)
    .eq('suggested_date', today)
    .eq('status', 'suggested')
    .order('order_in_day', { ascending: true })

  const suggestedWorkouts = (workouts || []) as SuggestedWorkout[]

  // If no readiness data or no workouts, return without recommendation
  if (!readiness || suggestedWorkouts.length === 0) {
    return {
      hasRecommendation: false,
      workouts: suggestedWorkouts,
      readinessScore: readiness?.readinessScore || null,
      adjustmentFactor: readiness?.adjustmentFactor || 1.0,
      recommendedIntensity: readiness?.recommendedIntensity || 'maintain',
    }
  }

  // Determine if we need to generate a recommendation
  const threshold = adaptationSettings?.day_of_readiness_threshold || 50
  const shouldRecommendAdjustment = readiness.readinessScore < threshold

  if (!shouldRecommendAdjustment) {
    return {
      hasRecommendation: false,
      workouts: suggestedWorkouts,
      readinessScore: readiness.readinessScore,
      adjustmentFactor: readiness.adjustmentFactor,
      recommendedIntensity: readiness.recommendedIntensity,
    }
  }

  // Generate recommendation for intensity scaling
  const recommendation = generateWorkoutIntensityRecommendation(
    userId,
    planId,
    suggestedWorkouts,
    readiness
  )

  return {
    hasRecommendation: true,
    recommendation,
    workouts: suggestedWorkouts,
    readinessScore: readiness.readinessScore,
    adjustmentFactor: readiness.adjustmentFactor,
    recommendedIntensity: readiness.recommendedIntensity,
  }
}

/**
 * Fetch today's readiness assessment
 */
async function fetchTodaysReadiness(
  adminClient: ReturnType<typeof createAdminClient>,
  userId: string
): Promise<ReadinessData | null> {
  const today = new Date().toISOString().split('T')[0]

  const { data: assessment } = await (adminClient as any)
    .from('readiness_assessments')
    .select('*')
    .eq('user_id', userId)
    .eq('assessment_date', today)
    .single()

  if (!assessment) return null

  const assessmentData = assessment as any

  // Get baselines for HRV comparison
  const { data: baselines } = await (adminClient as any)
    .from('readiness_baselines')
    .select('avg_hrv')
    .eq('user_id', userId)
    .single()

  const baselinesData = baselines as any

  let hrvPercentBaseline: number | null = null
  if (assessmentData.hrv_reading && baselinesData?.avg_hrv) {
    hrvPercentBaseline = Math.round((assessmentData.hrv_reading / baselinesData.avg_hrv) * 100)
  }

  return {
    readinessScore: assessmentData.calculated_readiness_score || 50,
    subjectiveReadiness: assessmentData.subjective_readiness,
    adjustmentFactor: assessmentData.adjustment_factor || 1.0,
    recommendedIntensity: (assessmentData.recommended_intensity as 'reduce' | 'maintain' | 'push') || 'maintain',
    hrvPercentBaseline,
    sleepHours: assessmentData.sleep_hours,
    sleepQuality: assessmentData.sleep_quality,
    tsb: assessmentData.tsb_value,
    assessmentDate: assessmentData.assessment_date,
  }
}

/**
 * Generate a workout intensity scaling recommendation
 */
function generateWorkoutIntensityRecommendation(
  userId: string,
  planId: string,
  workouts: SuggestedWorkout[],
  readiness: ReadinessData
): Omit<PlanRecommendation, 'id' | 'created_at' | 'updated_at'> {
  // Determine which workouts to adjust
  const strengthWorkouts = workouts.filter(w => w.category === 'strength')
  const cardioWorkouts = workouts.filter(w => w.category === 'cardio')

  // Build trigger data
  const triggerData: ReadinessTriggerData = {
    readiness_score: readiness.readinessScore,
    hrv_percent_baseline: readiness.hrvPercentBaseline || undefined,
    sleep_hours: readiness.sleepHours || undefined,
    subjective_readiness: readiness.subjectiveReadiness,
    trend: 'stable', // Could be calculated from history
  }

  // Build proposed changes
  const changes: WorkoutIntensityScaleChange = {
    adjustment_factor: readiness.adjustmentFactor,
    apply_to: strengthWorkouts.length > 0 ? 'strength' : 'all',
    reason: 'readiness_low',
    original_intensity: getOriginalIntensityDescription(workouts),
    scaled_intensity: getScaledIntensityDescription(workouts, readiness.adjustmentFactor),
  }

  // Build reasoning
  const reasoning = buildReadinessReasoning(readiness, workouts)

  // Calculate priority based on readiness score
  // Lower readiness = higher priority (more urgent)
  let priority = 5
  if (readiness.readinessScore < 30) priority = 1
  else if (readiness.readinessScore < 40) priority = 2
  else if (readiness.readinessScore < 50) priority = 3

  // Set expiration to end of day
  const today = new Date()
  today.setHours(23, 59, 59, 999)
  const expiresAt = today.toISOString()

  return {
    plan_id: planId,
    user_id: userId,
    recommendation_type: 'workout_intensity_scale',
    scope: 'workout',
    trigger_type: 'readiness',
    trigger_date: new Date().toISOString(),
    trigger_data: triggerData,
    target_phase_id: null,
    target_week_id: null,
    target_workout_id: workouts[0]?.id || null, // Primary workout
    proposed_changes: changes as unknown as Record<string, unknown>,
    reasoning,
    confidence_score: calculateConfidence(readiness),
    evidence_summary: {
      readiness: {
        current: readiness.readinessScore,
        trend: 'stable',
      },
      recovery_quality: {
        sleep_avg: readiness.sleepHours || undefined,
      },
    },
    projected_impact: {
      affected_workouts: workouts.length,
    },
    priority,
    expires_at: expiresAt,
    status: 'pending',
    user_notes: null,
    modified_changes: null,
    responded_at: null,
    applied_at: null,
  }
}

/**
 * Get a description of the original intensity
 */
function getOriginalIntensityDescription(workouts: SuggestedWorkout[]): string {
  const intensities = workouts
    .map(w => w.primary_intensity)
    .filter(Boolean)
    .join(', ')

  if (!intensities) {
    return 'Standard intensity'
  }

  return `${intensities.toUpperCase()} intensity`
}

/**
 * Get a description of the scaled intensity
 */
function getScaledIntensityDescription(workouts: SuggestedWorkout[], factor: number): string {
  const reductionPercent = Math.round((1 - factor) * 100)

  if (factor >= 1.0) {
    return 'No reduction needed'
  }

  return `Reduce intensity by ${reductionPercent}%`
}

/**
 * Build human-readable reasoning for the recommendation
 */
function buildReadinessReasoning(readiness: ReadinessData, workouts: SuggestedWorkout[]): string {
  const parts: string[] = []

  parts.push(`Your readiness score is ${readiness.readinessScore}/100 this morning, which is below the threshold for normal training.`)

  // Add specific factors
  const factors: string[] = []

  if (readiness.subjectiveReadiness <= 4) {
    factors.push(`subjective readiness of ${readiness.subjectiveReadiness}/10`)
  }

  if (readiness.sleepHours && readiness.sleepHours < 6) {
    factors.push(`only ${readiness.sleepHours} hours of sleep`)
  }

  if (readiness.hrvPercentBaseline && readiness.hrvPercentBaseline < 85) {
    factors.push(`HRV at ${readiness.hrvPercentBaseline}% of baseline`)
  }

  if (readiness.tsb && readiness.tsb < -15) {
    factors.push(`TSB of ${readiness.tsb} (fatigued)`)
  }

  if (factors.length > 0) {
    parts.push(`Contributing factors: ${factors.join(', ')}.`)
  }

  // Recommendation
  const reductionPercent = Math.round((1 - readiness.adjustmentFactor) * 100)
  const workoutTypes = Array.from(new Set(workouts.map(w => w.category))).join(' and ')

  if (reductionPercent > 0) {
    parts.push(`I recommend reducing today's ${workoutTypes} workout intensity by ${reductionPercent}%. This allows you to maintain training consistency while respecting your body's recovery state.`)
  } else {
    parts.push(`Consider taking today easier or focusing on technique rather than intensity.`)
  }

  parts.push(`You can push harder when your readiness improves.`)

  return parts.join(' ')
}

/**
 * Calculate confidence score based on data completeness
 */
function calculateConfidence(readiness: ReadinessData): number {
  let confidence = 0.5 // Base confidence

  // Subjective readiness (always present, high weight)
  confidence += 0.2

  // HRV data adds confidence
  if (readiness.hrvPercentBaseline !== null) {
    confidence += 0.15
  }

  // Sleep data adds confidence
  if (readiness.sleepHours !== null) {
    confidence += 0.1
  }

  // TSB data adds confidence
  if (readiness.tsb !== null) {
    confidence += 0.05
  }

  return Math.min(confidence, 1.0)
}

/**
 * Create and save a workout recommendation
 * Returns the created recommendation ID
 */
export async function createWorkoutRecommendation(
  userId: string,
  planId: string,
  readinessData?: ReadinessData
): Promise<{ recommendationId: string | null; result: WorkoutEvaluationResult }> {
  const result = await evaluateTodaysWorkouts(userId, planId, readinessData)

  if (!result.hasRecommendation || !result.recommendation) {
    return { recommendationId: null, result }
  }

  const adminClient = createAdminClient()

  // Check if there's already a pending workout recommendation for today
  const today = new Date().toISOString().split('T')[0]
  const { data: existing } = await (adminClient as ReturnType<typeof createAdminClient>)
    .from('plan_recommendations')
    .select('id')
    .eq('user_id', userId)
    .eq('plan_id', planId)
    .eq('recommendation_type', 'workout_intensity_scale')
    .eq('status', 'pending')
    .gte('trigger_date', `${today}T00:00:00`)
    .single()

  if (existing) {
    // Already have a recommendation for today
    return { recommendationId: existing.id, result }
  }

  // Create the recommendation
  const { data: recommendation, error } = await (adminClient as ReturnType<typeof createAdminClient>)
    .from('plan_recommendations')
    .insert(result.recommendation)
    .select('id')
    .single()

  if (error) {
    console.error('Error creating workout recommendation:', error)
    return { recommendationId: null, result }
  }

  return { recommendationId: recommendation.id, result }
}

/**
 * Quick check if user needs a workout adjustment today
 * Lighter weight than full evaluation
 */
export async function needsWorkoutAdjustment(
  userId: string
): Promise<{ needsAdjustment: boolean; readinessScore: number | null }> {
  const adminClient = createAdminClient()
  const today = new Date().toISOString().split('T')[0]

  // Get today's readiness
  const { data: assessment } = await (adminClient as ReturnType<typeof createAdminClient>)
    .from('readiness_assessments')
    .select('calculated_readiness_score, recommended_intensity')
    .eq('user_id', userId)
    .eq('assessment_date', today)
    .single()

  if (!assessment) {
    return { needsAdjustment: false, readinessScore: null }
  }

  const readinessScore = assessment.calculated_readiness_score || 50
  const needsAdjustment = readinessScore < 50 || assessment.recommended_intensity === 'reduce'

  return { needsAdjustment, readinessScore }
}
