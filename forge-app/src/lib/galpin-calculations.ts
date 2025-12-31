// Andy Galpin Evidence-Based Exercise Physiology Calculations
// Training age, readiness scoring, tempo/TUT, deload triggers, strength standards

import {
  GalpinAdaptation,
  ExperienceLevel,
  TrainingAgeInfo,
  AdaptationProtocol,
  ReadinessAssessment,
  ReadinessBaselines,
  ReadinessResult,
  ReadinessRecommendation,
  ReadinessFactorBreakdown,
  Tempo,
  TimeUnderTension,
  DEFAULT_TEMPOS,
  DeloadRecommendation,
  DeloadTriggerInfo,
  DeloadSeverity,
  DeloadType,
  DELOAD_THRESHOLDS,
  StrengthStandard,
  StrengthClassification,
  UserStrengthPercentile,
  StandardizedLift,
  Sex,
  MALE_WEIGHT_CLASSES,
  FEMALE_WEIGHT_CLASSES,
} from '@/types/galpin'

// ============================================================================
// TRAINING AGE & EXPERIENCE LEVEL
// ============================================================================

/**
 * Calculate training age in years and months from start date
 */
export function calculateTrainingAge(startDate: string | null): TrainingAgeInfo {
  if (!startDate) {
    return {
      startDate: null,
      trainingAgeYears: 0,
      trainingAgeMonths: 0,
      experienceLevel: 'novice',
      volumeToleranceMultiplier: 0.7,
    }
  }

  const start = new Date(startDate)
  const now = new Date()
  const diffMs = now.getTime() - start.getTime()
  const diffDays = diffMs / (1000 * 60 * 60 * 24)

  const trainingAgeYears = Math.floor(diffDays / 365)
  const trainingAgeMonths = Math.floor((diffDays % 365) / 30)
  const totalYears = diffDays / 365

  const experienceLevel = determineExperienceLevel(totalYears)
  const volumeToleranceMultiplier = getVolumeTolerance(experienceLevel)

  return {
    startDate,
    trainingAgeYears,
    trainingAgeMonths,
    experienceLevel,
    volumeToleranceMultiplier,
  }
}

/**
 * Determine experience level from training years
 */
export function determineExperienceLevel(trainingYears: number): ExperienceLevel {
  if (trainingYears < 1) return 'novice'
  if (trainingYears < 3) return 'intermediate'
  return 'advanced'
}

/**
 * Get volume tolerance multiplier based on experience
 * Novices recover slower and need less volume
 */
export function getVolumeTolerance(level: ExperienceLevel): number {
  switch (level) {
    case 'novice': return 0.7      // 70% of standard volume
    case 'intermediate': return 0.85 // 85% of standard volume
    case 'advanced': return 1.0    // Full volume tolerance
    default: return 0.7
  }
}

/**
 * Adjust volume landmarks based on training age
 */
export function adjustVolumeLandmarks(
  mev: number,
  mavLow: number,
  mavHigh: number,
  mrv: number,
  volumeMultiplier: number
): { mev: number; mavLow: number; mavHigh: number; mrv: number } {
  return {
    mev: Math.round(mev * volumeMultiplier),
    mavLow: Math.round(mavLow * volumeMultiplier),
    mavHigh: Math.round(mavHigh * volumeMultiplier),
    mrv: Math.round(mrv * volumeMultiplier),
  }
}

// ============================================================================
// READINESS SCORING
// ============================================================================

/**
 * Calculate readiness score from assessment data
 * Score 0-100, where higher = more ready to train hard
 */
export function calculateReadinessScore(
  assessment: Partial<ReadinessAssessment>,
  baselines: ReadinessBaselines | null
): ReadinessResult {
  const factors: ReadinessFactorBreakdown = {
    subjective: { value: 0, weight: 0, contribution: 0 },
    hrv: null,
    sleep: null,
    tsb: null,
    gripStrength: null,
    verticalJump: null,
  }

  let totalWeight = 0
  let weightedSum = 0
  const suggestions: string[] = []

  // ---- Subjective Readiness (always required, high weight) ----
  const subjectiveValue = assessment.subjective_readiness || 5
  const subjectiveNormalized = (subjectiveValue / 10) * 100
  factors.subjective = {
    value: subjectiveValue,
    weight: 35,
    contribution: subjectiveNormalized * 0.35,
  }
  totalWeight += 35
  weightedSum += subjectiveNormalized * 35

  if (subjectiveValue <= 4) {
    suggestions.push('Consider a lighter session or active recovery')
  }

  // ---- HRV (if available with baselines) ----
  if (assessment.hrv_reading !== null && assessment.hrv_reading !== undefined) {
    let hrvScore = 50 // Default neutral
    let zScore: number | null = null

    if (baselines?.avg_hrv && baselines?.std_hrv && baselines.std_hrv > 0) {
      zScore = (assessment.hrv_reading - baselines.avg_hrv) / baselines.std_hrv

      // Convert z-score to 0-100 scale
      // z > 1 = great (80-100), z 0-1 = good (60-80), z 0 to -1 = fair (40-60), z < -1 = poor (0-40)
      if (zScore >= 1) {
        hrvScore = 80 + Math.min(zScore - 1, 2) * 10 // 80-100
      } else if (zScore >= 0) {
        hrvScore = 60 + zScore * 20 // 60-80
      } else if (zScore >= -1) {
        hrvScore = 40 + (zScore + 1) * 20 // 40-60
      } else {
        hrvScore = Math.max(0, 40 + zScore * 20) // 0-40
      }
    }

    factors.hrv = {
      value: assessment.hrv_reading,
      zScore,
      weight: 20,
      contribution: hrvScore * 0.20,
    }
    totalWeight += 20
    weightedSum += hrvScore * 20

    if (zScore !== null && zScore < -1) {
      suggestions.push('HRV is significantly below baseline - prioritize recovery')
    }
  }

  // ---- Sleep (if available) ----
  if (assessment.sleep_quality !== null && assessment.sleep_quality !== undefined) {
    const sleepQualityScore = (assessment.sleep_quality / 10) * 100

    let sleepHoursScore = 70 // Default
    if (assessment.sleep_hours !== null && assessment.sleep_hours !== undefined) {
      // 7-9 hours optimal, below 6 poor, above 9 diminishing
      if (assessment.sleep_hours >= 7 && assessment.sleep_hours <= 9) {
        sleepHoursScore = 100
      } else if (assessment.sleep_hours >= 6) {
        sleepHoursScore = 60 + (assessment.sleep_hours - 6) * 40
      } else {
        sleepHoursScore = Math.max(0, assessment.sleep_hours * 10)
      }
    }

    const combinedSleepScore = (sleepQualityScore + sleepHoursScore) / 2

    factors.sleep = {
      value: assessment.sleep_quality,
      weight: 20,
      contribution: combinedSleepScore * 0.20,
    }
    totalWeight += 20
    weightedSum += combinedSleepScore * 20

    if (assessment.sleep_hours != null && assessment.sleep_hours < 6) {
      suggestions.push('Sleep was inadequate - consider reducing intensity')
    }
  }

  // ---- TSB (Training Stress Balance) ----
  if (assessment.tsb_value !== null && assessment.tsb_value !== undefined) {
    // TSB interpretation: >15 = peaked, 0-15 = fresh, -10-0 = optimal, -20 to -10 = tired, <-20 = overreached
    let tsbScore: number
    if (assessment.tsb_value > 15) {
      tsbScore = 80 // Well rested but possibly detraining
    } else if (assessment.tsb_value >= 0) {
      tsbScore = 90 + assessment.tsb_value * 0.67 // 90-100
    } else if (assessment.tsb_value >= -10) {
      tsbScore = 70 + assessment.tsb_value * 2 // 50-70
    } else if (assessment.tsb_value >= -20) {
      tsbScore = 30 + (assessment.tsb_value + 20) * 4 // 30-70
    } else {
      tsbScore = Math.max(0, 30 + (assessment.tsb_value + 20) * 2) // 0-30
    }

    factors.tsb = {
      value: assessment.tsb_value,
      weight: 15,
      contribution: tsbScore * 0.15,
    }
    totalWeight += 15
    weightedSum += tsbScore * 15

    if (assessment.tsb_value < -15) {
      suggestions.push('Training stress is high - deload may be needed')
    }
  }

  // ---- Grip Strength (if available with baselines) ----
  if (assessment.grip_strength_lbs !== null && assessment.grip_strength_lbs !== undefined) {
    let gripScore = 50
    let percentOfBaseline: number | null = null

    if (baselines?.avg_grip_strength_lbs && baselines.avg_grip_strength_lbs > 0) {
      percentOfBaseline = (assessment.grip_strength_lbs / baselines.avg_grip_strength_lbs) * 100

      // > 100% = great, 95-100% = good, 90-95% = fair, < 90% = poor
      if (percentOfBaseline >= 100) {
        gripScore = 80 + Math.min((percentOfBaseline - 100), 10) * 2
      } else if (percentOfBaseline >= 95) {
        gripScore = 60 + (percentOfBaseline - 95) * 4
      } else if (percentOfBaseline >= 90) {
        gripScore = 40 + (percentOfBaseline - 90) * 4
      } else {
        gripScore = Math.max(0, percentOfBaseline / 2)
      }
    }

    factors.gripStrength = {
      value: assessment.grip_strength_lbs,
      percentOfBaseline,
      weight: 5,
      contribution: gripScore * 0.05,
    }
    totalWeight += 5
    weightedSum += gripScore * 5

    if (percentOfBaseline !== null && percentOfBaseline < 90) {
      suggestions.push('Grip strength is below baseline - CNS may be fatigued')
    }
  }

  // ---- Vertical Jump (if available with baselines) ----
  if (assessment.vertical_jump_inches !== null && assessment.vertical_jump_inches !== undefined) {
    let jumpScore = 50
    let percentOfBaseline: number | null = null

    if (baselines?.avg_vertical_jump_inches && baselines.avg_vertical_jump_inches > 0) {
      percentOfBaseline = (assessment.vertical_jump_inches / baselines.avg_vertical_jump_inches) * 100

      if (percentOfBaseline >= 100) {
        jumpScore = 80 + Math.min((percentOfBaseline - 100), 10) * 2
      } else if (percentOfBaseline >= 95) {
        jumpScore = 60 + (percentOfBaseline - 95) * 4
      } else if (percentOfBaseline >= 90) {
        jumpScore = 40 + (percentOfBaseline - 90) * 4
      } else {
        jumpScore = Math.max(0, percentOfBaseline / 2)
      }
    }

    factors.verticalJump = {
      value: assessment.vertical_jump_inches,
      percentOfBaseline,
      weight: 5,
      contribution: jumpScore * 0.05,
    }
    totalWeight += 5
    weightedSum += jumpScore * 5

    if (percentOfBaseline !== null && percentOfBaseline < 90) {
      suggestions.push('Jump performance is reduced - consider power-dominant exercises another day')
    }
  }

  // Calculate final score
  const score = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 50

  // Determine recommendation
  let recommendation: ReadinessRecommendation
  let adjustmentFactor: number

  if (score >= 70) {
    recommendation = 'push'
    adjustmentFactor = 1.0 + (score - 70) / 300 // Up to 1.10
  } else if (score >= 40) {
    recommendation = 'maintain'
    adjustmentFactor = 1.0
  } else {
    recommendation = 'reduce'
    adjustmentFactor = 0.70 + (score / 40) * 0.30 // 0.70 to 1.0
  }

  // Add default suggestions if none
  if (suggestions.length === 0) {
    if (score >= 70) {
      suggestions.push('Good readiness - train as planned or push slightly')
    } else if (score >= 40) {
      suggestions.push('Moderate readiness - stick to planned workout')
    }
  }

  return {
    score,
    recommendation,
    adjustmentFactor: Math.round(adjustmentFactor * 100) / 100,
    factors,
    suggestions,
  }
}

/**
 * Get readiness color for UI
 */
export function getReadinessColor(score: number): string {
  if (score >= 70) return 'green'
  if (score >= 40) return 'amber'
  return 'red'
}

// ============================================================================
// TEMPO TRACKING & TIME UNDER TENSION
// ============================================================================

/**
 * Parse tempo string (e.g., "3-1-2-0") into Tempo object
 */
export function parseTempo(tempoString: string | null): Tempo | null {
  if (!tempoString) return null

  const parts = tempoString.split('-')
  if (parts.length !== 4) return null

  const parsePhase = (s: string): number => {
    if (s.toUpperCase() === 'X') return 0.5 // Explosive = ~0.5 seconds
    const num = parseFloat(s)
    return isNaN(num) ? 0 : num
  }

  return {
    eccentric: parsePhase(parts[0]),
    pauseBottom: parsePhase(parts[1]),
    concentric: parsePhase(parts[2]),
    pauseTop: parsePhase(parts[3]),
  }
}

/**
 * Format Tempo object back to string
 */
export function formatTempo(tempo: Tempo): string {
  const formatPhase = (n: number): string => {
    if (n === 0.5) return 'X'
    return String(Math.round(n))
  }

  return `${formatPhase(tempo.eccentric)}-${formatPhase(tempo.pauseBottom)}-${formatPhase(tempo.concentric)}-${formatPhase(tempo.pauseTop)}`
}

/**
 * Calculate Time Under Tension
 */
export function calculateTUT(
  tempoString: string | null,
  reps: number,
  sets: number = 1
): TimeUnderTension {
  const tempo = parseTempo(tempoString)

  if (!tempo) {
    // Default tempo: 2-0-1-0 = 3 seconds per rep
    return {
      tempoString: '2-0-1-0',
      perRep: 3,
      perSet: 3 * reps,
      total: 3 * reps * sets,
    }
  }

  const perRep = tempo.eccentric + tempo.pauseBottom + tempo.concentric + tempo.pauseTop

  return {
    tempoString: tempoString || '2-0-1-0',
    perRep: Math.round(perRep * 10) / 10,
    perSet: Math.round(perRep * reps * 10) / 10,
    total: Math.round(perRep * reps * sets * 10) / 10,
  }
}

/**
 * Get recommended tempo for an adaptation
 */
export function getRecommendedTempo(adaptation: GalpinAdaptation): string {
  return DEFAULT_TEMPOS[adaptation] || '2-0-1-0'
}

/**
 * Check if TUT is appropriate for the adaptation
 */
export function assessTUTForAdaptation(
  tut: number, // Total TUT for the set in seconds
  adaptation: GalpinAdaptation
): { isAppropriate: boolean; feedback: string } {
  const ranges: Record<GalpinAdaptation, { min: number; max: number; optimal: string }> = {
    skill: { min: 5, max: 30, optimal: '5-30s per set' },
    speed_power: { min: 3, max: 15, optimal: '3-15s per set' },
    strength: { min: 10, max: 30, optimal: '10-30s per set' },
    hypertrophy: { min: 30, max: 70, optimal: '30-70s per set (40-60 ideal)' },
    muscular_endurance: { min: 40, max: 120, optimal: '40-120s per set' },
    anaerobic_capacity: { min: 30, max: 120, optimal: '30-120s per effort' },
    vo2max: { min: 0, max: 999, optimal: 'N/A for cardio' },
    long_duration: { min: 0, max: 999, optimal: 'N/A for cardio' },
    body_composition: { min: 20, max: 60, optimal: '20-60s per set' },
  }

  const range = ranges[adaptation]

  if (tut >= range.min && tut <= range.max) {
    return {
      isAppropriate: true,
      feedback: `TUT is appropriate for ${adaptation} (${range.optimal})`,
    }
  } else if (tut < range.min) {
    return {
      isAppropriate: false,
      feedback: `TUT (${tut}s) is too short for ${adaptation}. Target: ${range.optimal}`,
    }
  } else {
    return {
      isAppropriate: false,
      feedback: `TUT (${tut}s) is too long for ${adaptation}. Target: ${range.optimal}`,
    }
  }
}

// ============================================================================
// DELOAD EVALUATION
// ============================================================================

/**
 * Evaluate if deload is needed based on multiple factors
 */
export function evaluateDeloadNeed(
  tsb: number | null,
  musclesOverMRV: string[],
  plateauedExercises: { exerciseId: string; weeksWithoutProgress: number }[],
  recentRecoveryScores: number[], // Last 7 days
  daysSinceLastDeload: number | null
): DeloadRecommendation {
  const triggers: DeloadTriggerInfo[] = []

  // Check TSB
  if (tsb !== null && tsb < DELOAD_THRESHOLDS.tsb) {
    triggers.push({
      type: 'tsb',
      reason: `TSB is ${tsb}, below threshold of ${DELOAD_THRESHOLDS.tsb}`,
      data: { tsb, threshold: DELOAD_THRESHOLDS.tsb },
    })
  }

  // Check muscles over MRV
  if (musclesOverMRV.length >= DELOAD_THRESHOLDS.musclesOverMRV) {
    triggers.push({
      type: 'volume',
      reason: `${musclesOverMRV.length} muscles over MRV: ${musclesOverMRV.join(', ')}`,
      data: { muscles: musclesOverMRV, threshold: DELOAD_THRESHOLDS.musclesOverMRV },
    })
  }

  // Check plateaued exercises
  const significantPlateaus = plateauedExercises.filter(
    e => e.weeksWithoutProgress >= DELOAD_THRESHOLDS.plateauWeeks
  )
  if (significantPlateaus.length >= 3) {
    triggers.push({
      type: 'plateau',
      reason: `${significantPlateaus.length} exercises plateaued for 2+ weeks`,
      data: { exercises: significantPlateaus, threshold: DELOAD_THRESHOLDS.plateauWeeks },
    })
  }

  // Check recovery scores
  const lowRecoveryDays = recentRecoveryScores.filter(
    s => s < DELOAD_THRESHOLDS.lowRecoveryThreshold
  ).length
  if (lowRecoveryDays >= DELOAD_THRESHOLDS.lowRecoveryStreak) {
    triggers.push({
      type: 'recovery',
      reason: `${lowRecoveryDays} of last 7 days had low recovery scores (<${DELOAD_THRESHOLDS.lowRecoveryThreshold})`,
      data: { lowDays: lowRecoveryDays, threshold: DELOAD_THRESHOLDS.lowRecoveryStreak },
    })
  }

  // Determine if deload is needed
  const shouldDeload = triggers.length > 0

  if (!shouldDeload) {
    return {
      shouldDeload: false,
      triggers: [],
      severity: 'mild',
      deloadType: 'volume',
      durationDays: 0,
      volumeReduction: 0,
      intensityReduction: 0,
      message: 'No deload needed - continue training as planned',
      suggestions: [],
    }
  }

  // Determine severity based on number and type of triggers
  let severity: DeloadSeverity
  if (triggers.length >= 3 || triggers.some(t => t.type === 'tsb' && (t.data.tsb as number) < -25)) {
    severity = 'severe'
  } else if (triggers.length >= 2) {
    severity = 'moderate'
  } else {
    severity = 'mild'
  }

  // Determine deload type based on triggers
  let deloadType: DeloadType
  let volumeReduction: number
  let intensityReduction: number
  let durationDays: number

  if (severity === 'severe') {
    deloadType = 'full'
    volumeReduction = 0.5 // 50% reduction
    intensityReduction = 0.15 // 15% reduction
    durationDays = 7
  } else if (triggers.some(t => t.type === 'volume')) {
    deloadType = 'volume'
    volumeReduction = 0.4 // 40% reduction
    intensityReduction = 0
    durationDays = 5
  } else if (triggers.some(t => t.type === 'plateau')) {
    deloadType = 'intensity'
    volumeReduction = 0
    intensityReduction = 0.1 // 10% reduction
    durationDays = 5
  } else {
    deloadType = 'volume'
    volumeReduction = 0.3
    intensityReduction = 0
    durationDays = 5
  }

  // Generate message
  const message = `Deload recommended: ${severity} fatigue detected from ${triggers.map(t => t.type).join(', ')}`

  // Generate suggestions
  const suggestions: string[] = [
    `Reduce training volume by ${Math.round(volumeReduction * 100)}%`,
  ]
  if (intensityReduction > 0) {
    suggestions.push(`Reduce weights by ${Math.round(intensityReduction * 100)}%`)
  }
  suggestions.push(`Duration: ${durationDays} days`)
  suggestions.push('Focus on mobility, sleep, and nutrition during deload')

  return {
    shouldDeload,
    triggers,
    severity,
    deloadType,
    durationDays,
    volumeReduction,
    intensityReduction,
    message,
    suggestions,
  }
}

// ============================================================================
// STRENGTH STANDARDS
// ============================================================================

/**
 * Get weight class for a given body weight
 */
export function getWeightClass(bodyWeight: number, sex: Sex): string {
  const classes = sex === 'male' ? MALE_WEIGHT_CLASSES : FEMALE_WEIGHT_CLASSES

  for (const cls of classes) {
    if (cls.endsWith('+')) continue
    const threshold = parseInt(cls)
    if (bodyWeight <= threshold) return cls
  }

  return classes[classes.length - 1] // Highest class (xxx+)
}

/**
 * Calculate Wilks score (powerlifting benchmark)
 */
export function calculateWilksScore(
  totalLbs: number,
  bodyWeightLbs: number,
  sex: Sex
): number {
  // Convert to kg for Wilks formula
  const totalKg = totalLbs * 0.453592
  const bwKg = bodyWeightLbs * 0.453592

  // Wilks coefficients
  const coefficients = sex === 'male'
    ? { a: -216.0475144, b: 16.2606339, c: -0.002388645, d: -0.00113732, e: 7.01863e-6, f: -1.291e-8 }
    : { a: 594.31747775582, b: -27.23842536447, c: 0.82112226871, d: -0.00930733913, e: 0.00004731582, f: -0.00000009054 }

  const x = bwKg
  const denominator = coefficients.a +
    coefficients.b * x +
    coefficients.c * Math.pow(x, 2) +
    coefficients.d * Math.pow(x, 3) +
    coefficients.e * Math.pow(x, 4) +
    coefficients.f * Math.pow(x, 5)

  const wilks = (500 / denominator) * totalKg

  return Math.round(wilks * 100) / 100
}

/**
 * Calculate DOTS score (modern powerlifting benchmark)
 */
export function calculateDOTSScore(
  totalLbs: number,
  bodyWeightLbs: number,
  sex: Sex
): number {
  // Convert to kg
  const totalKg = totalLbs * 0.453592
  const bwKg = bodyWeightLbs * 0.453592

  // DOTS coefficients
  const coefficients = sex === 'male'
    ? { a: -307.75076, b: 24.0900756, c: -0.1918759221, d: 0.0007391293, e: -0.000001093 }
    : { a: -57.96288, b: 13.6175032, c: -0.1126655495, d: 0.0005158568, e: -0.0000010706 }

  const x = bwKg
  const denominator = coefficients.a +
    coefficients.b * x +
    coefficients.c * Math.pow(x, 2) +
    coefficients.d * Math.pow(x, 3) +
    coefficients.e * Math.pow(x, 4)

  const dots = (500 / denominator) * totalKg

  return Math.round(dots * 100) / 100
}

/**
 * Classify strength level based on lift and thresholds
 */
export function classifyStrength(
  liftOneRM: number,
  standards: StrengthStandard
): StrengthClassification {
  if (liftOneRM >= standards.elite_threshold) return 'elite'
  if (liftOneRM >= standards.advanced_threshold) return 'advanced'
  if (liftOneRM >= standards.intermediate_threshold) return 'intermediate'
  if (liftOneRM >= standards.novice_threshold) return 'novice'
  if (liftOneRM >= standards.beginner_threshold) return 'beginner'
  return 'untrained'
}

/**
 * Calculate percentile from 1RM and standards
 */
export function calculatePercentile(
  liftOneRM: number,
  standards: StrengthStandard
): number {
  // Interpolate between known percentiles
  if (liftOneRM >= standards.percentile_99) return 99
  if (liftOneRM >= standards.percentile_95) {
    const ratio = (liftOneRM - standards.percentile_95) / (standards.percentile_99 - standards.percentile_95)
    return Math.round(95 + ratio * 4)
  }
  if (liftOneRM >= standards.percentile_90) {
    const ratio = (liftOneRM - standards.percentile_90) / (standards.percentile_95 - standards.percentile_90)
    return Math.round(90 + ratio * 5)
  }
  if (liftOneRM >= standards.percentile_75) {
    const ratio = (liftOneRM - standards.percentile_75) / (standards.percentile_90 - standards.percentile_75)
    return Math.round(75 + ratio * 15)
  }
  if (liftOneRM >= standards.percentile_50) {
    const ratio = (liftOneRM - standards.percentile_50) / (standards.percentile_75 - standards.percentile_50)
    return Math.round(50 + ratio * 25)
  }

  // Below median - estimate based on beginner threshold
  const ratio = liftOneRM / standards.percentile_50
  return Math.max(1, Math.round(ratio * 50))
}

/**
 * Get next level threshold
 */
export function getNextLevelThreshold(
  classification: StrengthClassification,
  standards: StrengthStandard
): number {
  switch (classification) {
    case 'untrained': return standards.beginner_threshold
    case 'beginner': return standards.novice_threshold
    case 'novice': return standards.intermediate_threshold
    case 'intermediate': return standards.advanced_threshold
    case 'advanced': return standards.elite_threshold
    case 'elite': return standards.elite_threshold
    default: return standards.beginner_threshold
  }
}

/**
 * Calculate user's strength percentile for a single lift
 */
export function calculateUserStrengthPercentile(
  exerciseName: StandardizedLift,
  currentOneRM: number,
  bodyWeight: number,
  sex: Sex,
  standards: StrengthStandard
): UserStrengthPercentile {
  const classification = classifyStrength(currentOneRM, standards)
  const percentile = calculatePercentile(currentOneRM, standards)
  const nextThreshold = getNextLevelThreshold(classification, standards)
  const toNextLevel = Math.max(0, nextThreshold - currentOneRM)

  return {
    exercise_name: exerciseName,
    current1RM: currentOneRM,
    bodyWeight,
    sex,
    percentile,
    classification,
    nextLevelThreshold: nextThreshold,
    toNextLevel: Math.round(toNextLevel * 10) / 10,
  }
}

// ============================================================================
// ADAPTATION PROTOCOL HELPERS
// ============================================================================

/**
 * Adjust protocol parameters based on experience level
 */
export function adjustProtocolForExperience(
  protocol: AdaptationProtocol,
  level: ExperienceLevel
): AdaptationProtocol {
  const volumeMultiplier = getVolumeTolerance(level)

  return {
    ...protocol,
    sets_min: Math.round(protocol.sets_min * volumeMultiplier),
    sets_max: Math.round(protocol.sets_max * volumeMultiplier),
    sessions_per_week_min: level === 'novice' ? Math.max(2, protocol.sessions_per_week_min - 1) : protocol.sessions_per_week_min,
    sessions_per_week_max: level === 'novice' ? Math.max(3, protocol.sessions_per_week_max - 1) : protocol.sessions_per_week_max,
  }
}

/**
 * Format protocol parameters for display
 */
export function formatProtocolSummary(protocol: AdaptationProtocol): string {
  const parts: string[] = []

  parts.push(`${protocol.rep_min}-${protocol.rep_max} reps`)
  parts.push(`${protocol.sets_min}-${protocol.sets_max} sets`)
  parts.push(`${Math.round(protocol.rest_min / 60)}-${Math.round(protocol.rest_max / 60)} min rest`)

  if (protocol.intensity_min && protocol.intensity_max) {
    parts.push(`${protocol.intensity_min}-${protocol.intensity_max}${protocol.intensity_unit}`)
  }

  if (protocol.default_tempo) {
    parts.push(`tempo: ${protocol.default_tempo}`)
  }

  return parts.join(' | ')
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Format experience level for display
 */
export function formatExperienceLevel(level: ExperienceLevel): string {
  switch (level) {
    case 'novice': return 'Novice (< 1 year)'
    case 'intermediate': return 'Intermediate (1-3 years)'
    case 'advanced': return 'Advanced (3+ years)'
    default: return level
  }
}

/**
 * Format training age for display
 */
export function formatTrainingAge(years: number, months: number): string {
  if (years === 0 && months === 0) return 'Just started'
  if (years === 0) return `${months} months`
  if (months === 0) return `${years} years`
  return `${years} years, ${months} months`
}
