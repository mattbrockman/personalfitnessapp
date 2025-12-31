/**
 * VO2max Estimation Library
 *
 * Based on validated field test protocols and research-backed formulas.
 * References:
 * - Cooper (1968): 12-minute run test
 * - Jack Daniels VDOT tables
 * - Rockport Walk Test (Kline et al., 1987)
 * - ACSM Guidelines for Exercise Testing and Prescription
 */

import { VO2MAX_PERCENTILES } from '@/types/longevity'

// ============================================================================
// Field Test Estimation Functions
// ============================================================================

/**
 * Cooper 12-Minute Run Test
 * Formula: VO2max = (distance_meters - 504.9) / 44.73
 *
 * @param distanceMeters - Distance covered in 12 minutes
 * @returns Estimated VO2max in ml/kg/min
 */
export function cooperTest(distanceMeters: number): number {
  const vo2max = (distanceMeters - 504.9) / 44.73
  return Math.round(vo2max * 10) / 10
}

/**
 * 1.5 Mile Run Test
 * Formula based on time to complete 1.5 miles (2414 meters)
 * VO2max = 483 / time_minutes + 3.5
 *
 * @param timeSeconds - Time to complete 1.5 miles in seconds
 * @returns Estimated VO2max in ml/kg/min
 */
export function onePointFiveMileTest(timeSeconds: number): number {
  const timeMinutes = timeSeconds / 60
  const vo2max = 483 / timeMinutes + 3.5
  return Math.round(vo2max * 10) / 10
}

/**
 * Rockport Walk Test (1-mile walk)
 * More suitable for less fit individuals
 *
 * @param timeMinutes - Time to complete 1 mile walk
 * @param finalHeartRate - Heart rate at end of walk
 * @param weightKg - Body weight in kg
 * @param age - Age in years
 * @param sex - 'male' (1) or 'female' (0)
 * @returns Estimated VO2max in ml/kg/min
 */
export function rockportWalkTest(
  timeMinutes: number,
  finalHeartRate: number,
  weightKg: number,
  age: number,
  sex: 'male' | 'female'
): number {
  const sexFactor = sex === 'male' ? 1 : 0

  // Kline et al. (1987) equation
  const vo2max = 132.853
    - (0.0769 * (weightKg * 2.20462)) // Convert to lbs for formula
    - (0.3877 * age)
    + (6.315 * sexFactor)
    - (3.2649 * timeMinutes)
    - (0.1565 * finalHeartRate)

  return Math.round(vo2max * 10) / 10
}

/**
 * Step Test (3-minute)
 * Based on McArdle step test protocol
 *
 * @param recoveryHeartRate - Heart rate 1 minute after stepping
 * @param sex - 'male' or 'female'
 * @returns Estimated VO2max in ml/kg/min
 */
export function stepTest(
  recoveryHeartRate: number,
  sex: 'male' | 'female'
): number {
  let vo2max: number

  if (sex === 'male') {
    vo2max = 111.33 - (0.42 * recoveryHeartRate)
  } else {
    vo2max = 65.81 - (0.1847 * recoveryHeartRate)
  }

  return Math.round(vo2max * 10) / 10
}

/**
 * Estimate VO2max from running data using heart rate reserve method
 * Useful for estimating from Strava/GPS watch data
 *
 * @param distanceMeters - Distance of the run
 * @param durationSeconds - Duration of the run
 * @param avgHeartRate - Average heart rate during run
 * @param maxHeartRate - User's maximum heart rate
 * @param restingHeartRate - User's resting heart rate
 * @param elevationGainMeters - Total elevation gain (optional)
 * @returns Estimated VO2max in ml/kg/min
 */
export function estimateFromRunning(
  distanceMeters: number,
  durationSeconds: number,
  avgHeartRate: number,
  maxHeartRate: number,
  restingHeartRate: number,
  elevationGainMeters: number = 0
): number {
  // Calculate pace in min/km
  const paceMinPerKm = (durationSeconds / 60) / (distanceMeters / 1000)

  // Calculate heart rate reserve percentage
  const hrReserve = (avgHeartRate - restingHeartRate) / (maxHeartRate - restingHeartRate)

  // Estimate VO2 at that intensity (% of VO2max ≈ % of HR reserve)
  // Using ACSM running VO2 equation: VO2 = 0.2(speed) + 0.9(speed)(grade) + 3.5
  // Speed in m/min
  const speedMPerMin = distanceMeters / (durationSeconds / 60)

  // Estimate grade from elevation gain
  const avgGrade = elevationGainMeters > 0
    ? (elevationGainMeters / distanceMeters)
    : 0

  // VO2 at current pace (ml/kg/min)
  const vo2AtPace = (0.2 * speedMPerMin) + (0.9 * speedMPerMin * avgGrade) + 3.5

  // If running at X% of HR reserve, assume running at ~X% of VO2max
  // VO2max = VO2_current / %intensity
  const estimatedVO2max = vo2AtPace / hrReserve

  // Cap at reasonable range (15-90 ml/kg/min)
  const capped = Math.max(15, Math.min(90, estimatedVO2max))

  return Math.round(capped * 10) / 10
}

/**
 * Estimate VO2max from cycling power data
 * Based on relationship: ~10.8 ml/kg/min per W/kg at threshold
 *
 * @param normalizedPower - Normalized power (or average power) in watts
 * @param weightKg - Body weight in kg
 * @param avgHeartRate - Average heart rate
 * @param maxHeartRate - Maximum heart rate
 * @param durationMinutes - Duration in minutes
 * @returns Estimated VO2max in ml/kg/min
 */
export function estimateFromCycling(
  normalizedPower: number,
  weightKg: number,
  avgHeartRate: number,
  maxHeartRate: number,
  durationMinutes: number
): number {
  // Calculate W/kg
  const wPerKg = normalizedPower / weightKg

  // Estimate intensity factor based on duration and HR
  // Longer durations = closer to threshold
  let intensityFactor: number

  if (durationMinutes >= 60) {
    // Hour+ efforts are typically at or below threshold
    intensityFactor = 0.85
  } else if (durationMinutes >= 20) {
    // 20-60 min can be at threshold
    intensityFactor = 0.90
  } else {
    // Short efforts are above threshold
    intensityFactor = 0.95 + (20 - durationMinutes) * 0.005
  }

  // Adjust based on heart rate
  const hrPercent = avgHeartRate / maxHeartRate
  if (hrPercent < 0.75) {
    intensityFactor = Math.min(intensityFactor, 0.75)
  } else if (hrPercent > 0.90) {
    intensityFactor = Math.max(intensityFactor, hrPercent)
  }

  // VO2 at threshold ≈ 10.8 * W/kg
  // VO2max ≈ VO2_threshold / 0.85 (threshold is ~85% of VO2max)
  const vo2AtEffort = 10.8 * wPerKg + 3.5
  const estimatedVO2max = vo2AtEffort / intensityFactor

  // Cap at reasonable range
  const capped = Math.max(20, Math.min(90, estimatedVO2max))

  return Math.round(capped * 10) / 10
}

// ============================================================================
// Percentile and Classification Functions
// ============================================================================

/**
 * Get VO2max percentile and classification for age and sex
 * Based on ACSM guidelines and Cooper Institute data
 *
 * @param vo2max - VO2max value in ml/kg/min
 * @param age - Age in years
 * @param sex - 'male' or 'female'
 * @returns Percentile (0-100) and classification string
 */
export function getVO2maxPercentile(
  vo2max: number,
  age: number,
  sex: 'male' | 'female'
): { percentile: number; classification: string; fitnessAge: number } {
  // Get the appropriate age bracket
  const brackets = Object.keys(VO2MAX_PERCENTILES[sex]).sort((a, b) => {
    const [aStart] = a.split('-').map(Number)
    const [bStart] = b.split('-').map(Number)
    return aStart - bStart
  })

  let bracket = brackets[brackets.length - 1] // Default to oldest
  for (const b of brackets) {
    const [start, end] = b.split('-').map(Number)
    if (age >= start && age <= end) {
      bracket = b
      break
    }
  }

  const percentiles = VO2MAX_PERCENTILES[sex][bracket]

  // Interpolate percentile
  let percentile: number
  if (vo2max >= percentiles.p95) {
    percentile = 95 + (vo2max - percentiles.p95) / (percentiles.p95 - percentiles.p75) * 4
    percentile = Math.min(99, percentile)
  } else if (vo2max >= percentiles.p75) {
    percentile = 75 + (vo2max - percentiles.p75) / (percentiles.p95 - percentiles.p75) * 20
  } else if (vo2max >= percentiles.p50) {
    percentile = 50 + (vo2max - percentiles.p50) / (percentiles.p75 - percentiles.p50) * 25
  } else if (vo2max >= percentiles.p25) {
    percentile = 25 + (vo2max - percentiles.p25) / (percentiles.p50 - percentiles.p25) * 25
  } else if (vo2max >= percentiles.p5) {
    percentile = 5 + (vo2max - percentiles.p5) / (percentiles.p25 - percentiles.p5) * 20
  } else {
    percentile = (vo2max / percentiles.p5) * 5
    percentile = Math.max(1, percentile)
  }

  percentile = Math.round(percentile)

  // Classification
  let classification: string
  if (percentile >= 90) {
    classification = 'Superior'
  } else if (percentile >= 75) {
    classification = 'Excellent'
  } else if (percentile >= 50) {
    classification = 'Good'
  } else if (percentile >= 25) {
    classification = 'Fair'
  } else {
    classification = 'Poor'
  }

  // Calculate fitness age
  // Find the age bracket where this VO2max would be at the 50th percentile
  const fitnessAge = calculateFitnessAge(vo2max, sex, age)

  return { percentile, classification, fitnessAge }
}

/**
 * Calculate "fitness age" based on VO2max
 * The age at which your VO2max would be average (50th percentile)
 *
 * @param vo2max - Current VO2max
 * @param sex - 'male' or 'female'
 * @param chronologicalAge - Actual age
 * @returns Fitness age in years
 */
function calculateFitnessAge(
  vo2max: number,
  sex: 'male' | 'female',
  chronologicalAge: number
): number {
  const brackets = Object.keys(VO2MAX_PERCENTILES[sex]).sort((a, b) => {
    const [aStart] = a.split('-').map(Number)
    const [bStart] = b.split('-').map(Number)
    return aStart - bStart
  })

  // Find which age bracket has a p50 closest to this VO2max
  let closestBracket = brackets[0]
  let closestDiff = Infinity

  for (const bracket of brackets) {
    const p50 = VO2MAX_PERCENTILES[sex][bracket].p50
    const diff = Math.abs(p50 - vo2max)
    if (diff < closestDiff) {
      closestDiff = diff
      closestBracket = bracket
    }
  }

  // Get the midpoint of the closest bracket
  const [start, end] = closestBracket.split('-').map(Number)
  let fitnessAge = (start + end) / 2

  // Fine-tune based on actual p50 value
  const p50 = VO2MAX_PERCENTILES[sex][closestBracket].p50
  const bracketIndex = brackets.indexOf(closestBracket)

  if (vo2max > p50 && bracketIndex > 0) {
    // Better than average for this bracket, interpolate toward younger
    const prevBracket = brackets[bracketIndex - 1]
    const prevP50 = VO2MAX_PERCENTILES[sex][prevBracket].p50
    const [prevStart, prevEnd] = prevBracket.split('-').map(Number)
    const prevMid = (prevStart + prevEnd) / 2
    const currMid = (start + end) / 2

    const ratio = (vo2max - p50) / (prevP50 - p50)
    fitnessAge = currMid - ratio * (currMid - prevMid)
  } else if (vo2max < p50 && bracketIndex < brackets.length - 1) {
    // Worse than average, interpolate toward older
    const nextBracket = brackets[bracketIndex + 1]
    const nextP50 = VO2MAX_PERCENTILES[sex][nextBracket].p50
    const [nextStart, nextEnd] = nextBracket.split('-').map(Number)
    const nextMid = (nextStart + nextEnd) / 2
    const currMid = (start + end) / 2

    const ratio = (p50 - vo2max) / (p50 - nextP50)
    fitnessAge = currMid + ratio * (nextMid - currMid)
  }

  // Clamp to reasonable range
  fitnessAge = Math.max(20, Math.min(90, fitnessAge))

  return Math.round(fitnessAge)
}

// ============================================================================
// Target and Decline Calculations
// ============================================================================

/**
 * Calculate target VO2max to be in top percentile at future age
 * Peter Attia's concept: train now to be in top 10% at 80
 *
 * @param currentAge - Current age
 * @param targetAge - Target age (e.g., 80)
 * @param sex - 'male' or 'female'
 * @param targetPercentile - Target percentile at that age (e.g., 90)
 * @returns Target VO2max needed now
 */
export function calculateTargetVO2max(
  currentAge: number,
  targetAge: number,
  sex: 'male' | 'female',
  targetPercentile: number = 90
): number {
  // Get VO2max needed at target age for target percentile
  const brackets = Object.keys(VO2MAX_PERCENTILES[sex])
  let targetBracket = brackets[brackets.length - 1]

  for (const bracket of brackets) {
    const [start, end] = bracket.split('-').map(Number)
    if (targetAge >= start && targetAge <= end) {
      targetBracket = bracket
      break
    }
  }

  const percentiles = VO2MAX_PERCENTILES[sex][targetBracket]

  // Get VO2max for target percentile
  let targetVO2max: number
  if (targetPercentile >= 95) {
    targetVO2max = percentiles.p95
  } else if (targetPercentile >= 75) {
    targetVO2max = percentiles.p75 + (targetPercentile - 75) / 20 * (percentiles.p95 - percentiles.p75)
  } else if (targetPercentile >= 50) {
    targetVO2max = percentiles.p50 + (targetPercentile - 50) / 25 * (percentiles.p75 - percentiles.p50)
  } else if (targetPercentile >= 25) {
    targetVO2max = percentiles.p25 + (targetPercentile - 25) / 25 * (percentiles.p50 - percentiles.p25)
  } else {
    targetVO2max = percentiles.p5 + (targetPercentile - 5) / 20 * (percentiles.p25 - percentiles.p5)
  }

  // Account for expected decline
  // VO2max declines ~1% per year after 30 without training
  // With training, can reduce to ~0.5% per year
  const yearsUntilTarget = targetAge - currentAge
  const expectedDeclineRate = 0.005 // 0.5% per year with training

  // Work backwards: what VO2max now would result in target VO2max at target age
  // targetVO2max = currentVO2max * (1 - declineRate)^years
  // currentVO2max = targetVO2max / (1 - declineRate)^years
  const currentTarget = targetVO2max / Math.pow(1 - expectedDeclineRate, yearsUntilTarget)

  return Math.round(currentTarget * 10) / 10
}

/**
 * Calculate expected VO2max decline over years
 *
 * @param currentVO2max - Current VO2max
 * @param years - Years to project
 * @param training - Whether actively training (reduces decline rate)
 * @returns Projected VO2max
 */
export function projectVO2max(
  currentVO2max: number,
  years: number,
  training: boolean = true
): number {
  // Decline rate: ~1% untrained, ~0.5% trained per year
  const declineRate = training ? 0.005 : 0.01
  const projected = currentVO2max * Math.pow(1 - declineRate, years)

  return Math.round(projected * 10) / 10
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Convert between common distance/time units
 */
export const conversions = {
  metersToMiles: (m: number) => m / 1609.34,
  milesToMeters: (mi: number) => mi * 1609.34,
  kgToLbs: (kg: number) => kg * 2.20462,
  lbsToKg: (lbs: number) => lbs / 2.20462,
  secondsToMinutes: (s: number) => s / 60,
  minutesToSeconds: (m: number) => m * 60,
}

/**
 * Validate VO2max value is within reasonable range
 */
export function isValidVO2max(vo2max: number): boolean {
  return vo2max >= 10 && vo2max <= 100
}

/**
 * Get mortality risk reduction info based on VO2max percentile
 * Based on Mandsager et al. (2018) JAMA study
 *
 * @param percentile - VO2max percentile
 * @returns Risk reduction info
 */
export function getMortalityRiskInfo(percentile: number): {
  category: string
  riskReduction: string
  description: string
} {
  if (percentile >= 97.7) {
    return {
      category: 'Elite',
      riskReduction: '80%',
      description: 'Elite fitness is associated with 80% lower all-cause mortality vs. low fitness.'
    }
  } else if (percentile >= 75) {
    return {
      category: 'High',
      riskReduction: '60-70%',
      description: 'High fitness associated with 60-70% lower mortality risk vs. low fitness.'
    }
  } else if (percentile >= 50) {
    return {
      category: 'Above Average',
      riskReduction: '40-50%',
      description: 'Above average fitness associated with significant mortality reduction.'
    }
  } else if (percentile >= 25) {
    return {
      category: 'Below Average',
      riskReduction: '20-30%',
      description: 'Some fitness benefit, but significant room for improvement.'
    }
  } else {
    return {
      category: 'Low',
      riskReduction: 'Baseline',
      description: 'Low fitness is the strongest predictor of death. Focus on improving VO2max.'
    }
  }
}
