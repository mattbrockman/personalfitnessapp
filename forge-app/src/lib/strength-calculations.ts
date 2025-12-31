// Greg Nuckols Evidence-Based Strength Training Calculations
// 1RM estimation, relative intensity, effective reps, volume analysis, progression

import {
  VolumeLandmarks,
  VolumeLandmarkStatus,
  VolumeStatus,
  OneRMResult,
  OneRMFormula,
  ConfidenceLevel,
  EffectiveRepsResult,
  FrequencyAnalysis,
  ProgressionSuggestion,
  ProgressionModel,
  WeakPointAnalysis,
  LiftBalanceStatus,
  LiftRatios,
  DEFAULT_VOLUME_LANDMARKS,
  DEFAULT_LIFT_RATIOS,
} from '@/types/strength'

// ============================================================================
// 1RM ESTIMATION
// ============================================================================

/**
 * Calculate estimated 1RM using Brzycki formula
 * Best for rep ranges 1-10
 */
export function calculateBrzycki(weight: number, reps: number): number {
  if (reps === 1) return weight
  if (reps <= 0 || weight <= 0) return 0
  return Math.round(weight * (36 / (37 - reps)) * 10) / 10
}

/**
 * Calculate estimated 1RM using Epley formula
 * Better for higher rep ranges (10+)
 */
export function calculateEpley(weight: number, reps: number): number {
  if (reps === 1) return weight
  if (reps <= 0 || weight <= 0) return 0
  return Math.round(weight * (1 + reps / 30) * 10) / 10
}

/**
 * Calculate estimated 1RM using Lombardi formula
 * Middle ground between Brzycki and Epley
 */
export function calculateLombardi(weight: number, reps: number): number {
  if (reps === 1) return weight
  if (reps <= 0 || weight <= 0) return 0
  return Math.round(weight * Math.pow(reps, 0.1) * 10) / 10
}

/**
 * Calculate 1RM with confidence level based on rep range
 * Uses best formula for the rep range and indicates reliability
 */
export function calculate1RM(weight: number, reps: number): OneRMResult {
  if (reps <= 0 || weight <= 0) {
    return { estimated1RM: 0, formula: 'brzycki', confidence: 'low' }
  }

  // Determine confidence based on rep range
  let confidence: ConfidenceLevel
  let formula: OneRMFormula
  let estimated1RM: number

  if (reps <= 5) {
    // Low reps = high confidence, Brzycki is accurate
    confidence = 'high'
    formula = 'brzycki'
    estimated1RM = calculateBrzycki(weight, reps)
  } else if (reps <= 10) {
    // Medium reps = medium confidence, average formulas
    confidence = 'medium'
    formula = 'brzycki'
    // Average Brzycki and Epley for better accuracy
    const brzycki = calculateBrzycki(weight, reps)
    const epley = calculateEpley(weight, reps)
    estimated1RM = Math.round(((brzycki + epley) / 2) * 10) / 10
  } else {
    // High reps = low confidence, Epley is more accurate
    confidence = 'low'
    formula = 'epley'
    estimated1RM = calculateEpley(weight, reps)
  }

  return { estimated1RM, formula, confidence }
}

/**
 * Calculate weight for target reps based on 1RM
 */
export function calculateWeightForReps(e1rm: number, targetReps: number): number {
  if (targetReps <= 0 || e1rm <= 0) return 0
  if (targetReps === 1) return e1rm

  // Reverse Brzycki: weight = e1rm * (37 - reps) / 36
  return Math.round((e1rm * (37 - targetReps)) / 36 / 2.5) * 2.5 // Round to nearest 2.5
}

// ============================================================================
// RELATIVE INTENSITY
// ============================================================================

/**
 * Calculate relative intensity (% of 1RM)
 */
export function calculateRelativeIntensity(weight: number, estimated1RM: number): number {
  if (estimated1RM <= 0) return 0
  return Math.round((weight / estimated1RM) * 100 * 10) / 10
}

/**
 * Get intensity zone description
 */
export function getIntensityZone(relativeIntensity: number): {
  zone: string
  purpose: string
  color: string
} {
  if (relativeIntensity >= 90) {
    return { zone: 'Maximal', purpose: 'Strength/Neural', color: 'red' }
  } else if (relativeIntensity >= 80) {
    return { zone: 'Heavy', purpose: 'Strength', color: 'orange' }
  } else if (relativeIntensity >= 70) {
    return { zone: 'Moderate', purpose: 'Hypertrophy', color: 'amber' }
  } else if (relativeIntensity >= 60) {
    return { zone: 'Light', purpose: 'Volume/Endurance', color: 'green' }
  } else {
    return { zone: 'Very Light', purpose: 'Warmup/Recovery', color: 'blue' }
  }
}

// ============================================================================
// EFFECTIVE REPS (Stimulating Reps)
// ============================================================================

/**
 * Convert RIR (Reps in Reserve) to RPE
 */
export function rirToRpe(rir: number): number {
  return Math.max(1, Math.min(10, 10 - rir))
}

/**
 * Convert RPE to RIR
 */
export function rpeToRir(rpe: number): number {
  return Math.max(0, 10 - rpe)
}

/**
 * Calculate effective/stimulating reps based on proximity to failure
 * Research suggests reps close to failure (last 5 or so) provide most stimulus
 *
 * RPE 10 (failure) = all reps are effective
 * RPE 9 (1 RIR) = last 4-5 reps effective
 * RPE 8 (2 RIR) = last 3-4 reps effective
 * RPE 7 (3 RIR) = last 2-3 reps effective
 * RPE 6 (4 RIR) = last 1-2 reps effective
 * RPE 5 or less = minimal effective reps
 */
export function calculateEffectiveReps(
  reps: number,
  rpe: number | null,
  rir: number | null
): EffectiveRepsResult {
  // Determine effective RPE
  let effectiveRpe: number
  if (rpe !== null) {
    effectiveRpe = rpe
  } else if (rir !== null) {
    effectiveRpe = rirToRpe(rir)
  } else {
    // If no RPE/RIR provided, assume RPE 7-8 (typical working set)
    effectiveRpe = 7.5
  }

  // Calculate effective reps based on RPE
  let effectiveReps: number

  if (effectiveRpe >= 10) {
    // Failure: all reps effective (capped at ~5 due to diminishing returns)
    effectiveReps = Math.min(reps, 5)
  } else if (effectiveRpe >= 9) {
    // 1 RIR: last 4-5 reps
    effectiveReps = Math.min(reps, 5)
  } else if (effectiveRpe >= 8) {
    // 2 RIR: last 3-4 reps
    effectiveReps = Math.min(reps, 4)
  } else if (effectiveRpe >= 7) {
    // 3 RIR: last 2-3 reps
    effectiveReps = Math.min(reps, 3)
  } else if (effectiveRpe >= 6) {
    // 4 RIR: last 1-2 reps
    effectiveReps = Math.min(reps, 2)
  } else {
    // Too far from failure, minimal stimulus
    effectiveReps = Math.min(reps, 1)
  }

  return {
    totalReps: reps,
    effectiveReps,
    rpe: rpe,
    rir: rir ?? (rpe !== null ? rpeToRir(rpe) : null),
  }
}

// ============================================================================
// VOLUME LANDMARKS (MEV/MAV/MRV)
// ============================================================================

/**
 * Get volume landmarks for a muscle group
 */
export function getVolumeLandmarks(
  muscleGroup: string,
  userOverrides?: Partial<VolumeLandmarks>
): VolumeLandmarks {
  const normalizedMuscle = muscleGroup.toLowerCase().replace(/\s+/g, '_')
  const defaults = DEFAULT_VOLUME_LANDMARKS[normalizedMuscle] || {
    mev: 6,
    mavLow: 10,
    mavHigh: 16,
    mrv: 20,
  }

  return {
    mev: userOverrides?.mev ?? defaults.mev,
    mavLow: userOverrides?.mavLow ?? defaults.mavLow,
    mavHigh: userOverrides?.mavHigh ?? defaults.mavHigh,
    mrv: userOverrides?.mrv ?? defaults.mrv,
  }
}

/**
 * Analyze volume status against landmarks
 */
export function analyzeVolumeStatus(
  weeklySetCount: number,
  landmarks: VolumeLandmarks,
  muscleGroup: string
): VolumeLandmarkStatus {
  let status: VolumeStatus
  let recommendation: string
  let percentage: number

  const range = landmarks.mrv - landmarks.mev
  percentage = range > 0 ? ((weeklySetCount - landmarks.mev) / range) * 100 : 0

  if (weeklySetCount < landmarks.mev) {
    status = 'below_mev'
    recommendation = `Add ${landmarks.mev - weeklySetCount} more sets for ${muscleGroup} to reach minimum effective volume`
  } else if (weeklySetCount < landmarks.mev + 2) {
    status = 'approaching_mev'
    recommendation = `Just above minimum. Consider adding sets for ${muscleGroup} for better growth`
  } else if (weeklySetCount <= landmarks.mavHigh) {
    status = 'in_mav'
    recommendation = `Good volume for ${muscleGroup}. Optimal range for growth.`
  } else if (weeklySetCount <= landmarks.mrv) {
    status = 'approaching_mrv'
    recommendation = `High volume for ${muscleGroup}. Monitor recovery closely.`
  } else {
    status = 'over_mrv'
    recommendation = `Exceeding maximum recoverable volume for ${muscleGroup}. Consider reducing sets.`
  }

  return {
    muscleGroup,
    currentSets: weeklySetCount,
    landmarks,
    status,
    percentage: Math.round(percentage),
    recommendation,
  }
}

/**
 * Get status color for UI
 */
export function getVolumeStatusColor(status: VolumeStatus): string {
  switch (status) {
    case 'below_mev': return 'red'
    case 'approaching_mev': return 'amber'
    case 'in_mav': return 'green'
    case 'approaching_mrv': return 'amber'
    case 'over_mrv': return 'red'
    default: return 'gray'
  }
}

// ============================================================================
// FREQUENCY ANALYSIS
// ============================================================================

/**
 * Analyze training frequency for a muscle group
 */
export function analyzeFrequency(
  sessionsPerWeek: number,
  muscleGroup: string
): FrequencyAnalysis {
  const isOptimal = sessionsPerWeek >= 2

  let recommendation: string
  if (sessionsPerWeek === 0) {
    recommendation = `${muscleGroup} not trained this week. Add exercises for balanced development.`
  } else if (sessionsPerWeek === 1) {
    recommendation = `Train ${muscleGroup} at least 2x/week for optimal hypertrophy.`
  } else if (sessionsPerWeek <= 3) {
    recommendation = `Good frequency for ${muscleGroup}. 2-3x/week is optimal.`
  } else {
    recommendation = `High frequency for ${muscleGroup}. Ensure adequate recovery.`
  }

  return {
    muscleGroup,
    sessionsPerWeek,
    isOptimal,
    recommendation,
  }
}

// ============================================================================
// PROGRESSION SUGGESTIONS
// ============================================================================

/**
 * Suggest next workout progression based on model
 */
export function suggestProgression(
  model: ProgressionModel,
  currentWeight: number,
  currentReps: number,
  targetRepLow: number,
  targetRepHigh: number,
  weightIncrement: number,
  rpeTarget?: { low: number; high: number },
  currentRpe?: number
): ProgressionSuggestion {
  let suggestedWeight = currentWeight
  let suggestedReps = currentReps
  let reasoning = ''

  switch (model) {
    case 'linear':
      // Linear: Add weight each session
      suggestedWeight = currentWeight + weightIncrement
      suggestedReps = targetRepLow
      reasoning = `Linear progression: Add ${weightIncrement} lbs and work back up from ${targetRepLow} reps`
      break

    case 'double':
      // Double progression: Add reps until hitting top of range, then add weight
      if (currentReps >= targetRepHigh) {
        suggestedWeight = currentWeight + weightIncrement
        suggestedReps = targetRepLow
        reasoning = `You hit ${currentReps} reps! Add ${weightIncrement} lbs and start at ${targetRepLow} reps`
      } else {
        suggestedWeight = currentWeight
        suggestedReps = currentReps + 1
        reasoning = `Try for ${currentReps + 1} reps at ${currentWeight} lbs (target: ${targetRepHigh} before adding weight)`
      }
      break

    case 'rpe_based':
      // RPE-based: Adjust based on RPE feedback
      if (rpeTarget && currentRpe !== undefined) {
        if (currentRpe < rpeTarget.low) {
          suggestedWeight = currentWeight + weightIncrement
          suggestedReps = currentReps
          reasoning = `RPE ${currentRpe} was below target (${rpeTarget.low}-${rpeTarget.high}). Add ${weightIncrement} lbs`
        } else if (currentRpe > rpeTarget.high) {
          suggestedWeight = currentWeight
          suggestedReps = currentReps
          reasoning = `RPE ${currentRpe} was above target. Keep weight same and focus on technique`
        } else {
          suggestedWeight = currentWeight + weightIncrement * 0.5
          suggestedReps = currentReps
          reasoning = `RPE ${currentRpe} in target range. Small increase of ${weightIncrement * 0.5} lbs`
        }
      } else {
        suggestedWeight = currentWeight
        suggestedReps = currentReps
        reasoning = 'Log RPE to get personalized suggestions'
      }
      break
  }

  // Round weight to nearest 2.5
  suggestedWeight = Math.round(suggestedWeight / 2.5) * 2.5

  return {
    model,
    currentWeight,
    currentReps,
    suggestedWeight,
    suggestedReps,
    reasoning,
  }
}

/**
 * Detect plateau (3+ weeks without progress)
 */
export function detectPlateau(
  progressionHistory: { week: string; best_e1rm: number }[],
  windowWeeks: number = 3
): { plateau: boolean; weeksStagnant: number } {
  if (progressionHistory.length < windowWeeks) {
    return { plateau: false, weeksStagnant: 0 }
  }

  // Sort by week descending
  const sorted = [...progressionHistory].sort((a, b) => b.week.localeCompare(a.week))

  // Find max e1rm in the window
  const recentMax = Math.max(...sorted.slice(0, windowWeeks).map(p => p.best_e1rm))

  // Find overall max before the window
  const overallMax = sorted.length > windowWeeks
    ? Math.max(...sorted.slice(windowWeeks).map(p => p.best_e1rm))
    : 0

  // If recent max isn't better than overall max, potential plateau
  const plateau = recentMax <= overallMax && overallMax > 0

  // Count consecutive weeks without improvement
  let weeksStagnant = 0
  let currentBest = sorted[0]?.best_e1rm || 0

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].best_e1rm >= currentBest) {
      weeksStagnant++
    } else {
      break
    }
  }

  return { plateau, weeksStagnant }
}

// ============================================================================
// WEAK POINT ANALYSIS
// ============================================================================

/**
 * Analyze weak points based on lift ratios
 * Uses squat as the reference lift
 */
export function analyzeWeakPoints(
  lifts: {
    squat?: number
    bench?: number
    deadlift?: number
    ohp?: number
    row?: number
  },
  targetRatios: LiftRatios = DEFAULT_LIFT_RATIOS
): WeakPointAnalysis[] {
  const results: WeakPointAnalysis[] = []
  const squat = lifts.squat

  if (!squat || squat <= 0) {
    return results
  }

  const analyzeLift = (
    name: string,
    current1RM: number | undefined,
    expectedRatio: number
  ): WeakPointAnalysis | null => {
    if (!current1RM) return null

    const actualRatio = current1RM / squat
    let status: LiftBalanceStatus
    let recommendation: string

    const deviation = (actualRatio - expectedRatio) / expectedRatio

    if (deviation > 0.1) {
      status = 'strong'
      recommendation = `${name} is strong relative to squat. Consider more squat focus.`
    } else if (deviation < -0.1) {
      status = 'weak'
      recommendation = `${name} is lagging. Consider prioritizing ${name} training.`
    } else {
      status = 'balanced'
      recommendation = `${name} is well-balanced relative to squat.`
    }

    return {
      lift: name,
      current1RM,
      expectedRatio,
      actualRatio: Math.round(actualRatio * 100) / 100,
      status,
      recommendation,
    }
  }

  const bench = analyzeLift('Bench Press', lifts.bench, targetRatios.benchToSquat)
  const deadlift = analyzeLift('Deadlift', lifts.deadlift, targetRatios.deadliftToSquat)
  const ohp = analyzeLift('Overhead Press', lifts.ohp, targetRatios.ohpToSquat)
  const row = analyzeLift('Barbell Row', lifts.row, targetRatios.rowToSquat)

  if (bench) results.push(bench)
  if (deadlift) results.push(deadlift)
  if (ohp) results.push(ohp)
  if (row) results.push(row)

  return results
}

// ============================================================================
// WEEKLY MUSCLE GROUP AGGREGATION
// ============================================================================

interface ExerciseData {
  id: string
  primary_muscles: string[]
  secondary_muscles: string[]
}

interface WorkoutSetData {
  exercise_id: string
  set_type: string
  completed: boolean
  actual_reps?: number
  actual_weight?: number
  actual_rpe?: number
}

/**
 * Calculate weekly sets per muscle group from workout data
 */
export function calculateWeeklySetsPerMuscle(
  sets: WorkoutSetData[],
  exercises: Map<string, ExerciseData>
): Map<string, { sets: number; effectiveReps: number; volume: number }> {
  const muscleStats = new Map<string, { sets: number; effectiveReps: number; volume: number }>()

  for (const set of sets) {
    // Only count completed working sets (not warmups)
    if (!set.completed || set.set_type === 'warmup') continue

    const exercise = exercises.get(set.exercise_id)
    if (!exercise) continue

    // Calculate effective reps for this set
    const { effectiveReps } = calculateEffectiveReps(
      set.actual_reps || 0,
      set.actual_rpe || null,
      null
    )

    const volume = (set.actual_weight || 0) * (set.actual_reps || 0)

    // Add to primary muscles (full set credit)
    for (const muscle of exercise.primary_muscles) {
      const normalized = muscle.toLowerCase().replace(/\s+/g, '_')
      const current = muscleStats.get(normalized) || { sets: 0, effectiveReps: 0, volume: 0 }
      muscleStats.set(normalized, {
        sets: current.sets + 1,
        effectiveReps: current.effectiveReps + effectiveReps,
        volume: current.volume + volume,
      })
    }

    // Add to secondary muscles (half set credit - common convention)
    for (const muscle of exercise.secondary_muscles) {
      const normalized = muscle.toLowerCase().replace(/\s+/g, '_')
      const current = muscleStats.get(normalized) || { sets: 0, effectiveReps: 0, volume: 0 }
      muscleStats.set(normalized, {
        sets: current.sets + 0.5,
        effectiveReps: current.effectiveReps + Math.floor(effectiveReps / 2),
        volume: current.volume + volume * 0.5,
      })
    }
  }

  return muscleStats
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Round weight to nearest increment (typically 2.5 or 5 lbs)
 */
export function roundToIncrement(weight: number, increment: number = 2.5): number {
  return Math.round(weight / increment) * increment
}

/**
 * Get week start date (Monday) for a given date
 */
export function getWeekStart(date: Date): string {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(d.setDate(diff)).toISOString().split('T')[0]
}

/**
 * Format relative intensity for display
 */
export function formatRelativeIntensity(ri: number): string {
  return `${Math.round(ri)}%`
}

/**
 * Format weight with unit
 */
export function formatWeight(weight: number, unit: 'lbs' | 'kg' = 'lbs'): string {
  return `${Math.round(weight * 10) / 10} ${unit}`
}
