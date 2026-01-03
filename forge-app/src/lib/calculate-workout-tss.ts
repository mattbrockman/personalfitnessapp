// Centralized TSS Calculation Helper
// Uses priority: Power → HR → Strava Suffer Score → RPE → Default fallback

import { calculatePowerTSS, calculateHRTSS, estimateTSSFromRPE } from './training-load'

export interface TSSCalculationInput {
  category: 'cardio' | 'strength' | 'flexibility' | 'other'
  durationMinutes: number
  avgHR?: number | null
  np?: number | null  // Normalized power
  avgPower?: number | null
  perceivedExertion?: number | null  // 1-10 scale
  lthr?: number | null  // Lactate threshold heart rate
  ftp?: number | null  // Functional threshold power
  sufferScore?: number | null  // Strava relative effort
  restingHR?: number | null
  maxHR?: number | null
}

/**
 * Calculate TSS for any workout type using the best available data
 *
 * Priority order:
 * 1. Power-based TSS (most accurate for cycling)
 * 2. HR-based TSS (good for running/cardio)
 * 3. Strava suffer score (if available)
 * 4. RPE-based TSS (when user provides perceived exertion)
 * 5. Default fallback based on category and duration
 */
export function calculateWorkoutTSS(input: TSSCalculationInput): number {
  const {
    category,
    durationMinutes,
    avgHR,
    np,
    avgPower,
    perceivedExertion,
    lthr,
    ftp,
    sufferScore,
    restingHR = 50,
    maxHR = 190,
  } = input

  // Early exit for no duration
  if (!durationMinutes || durationMinutes <= 0) {
    return 0
  }

  // Priority 1: Power-based TSS (cycling with power meter)
  const normalizedPower = np || avgPower
  if (normalizedPower && ftp && ftp > 0) {
    return calculatePowerTSS(normalizedPower, durationMinutes, ftp)
  }

  // Priority 2: HR-based TSS (cardio with HR monitor)
  if (avgHR && lthr && lthr > 0) {
    return calculateHRTSS(avgHR, durationMinutes, lthr, restingHR || 50, maxHR || 190)
  }

  // Priority 3: Strava suffer score (relative effort)
  if (sufferScore && sufferScore > 0) {
    return Math.round(sufferScore)
  }

  // Priority 4: RPE-based TSS (user-provided perceived exertion)
  if (perceivedExertion && perceivedExertion > 0) {
    return estimateTSSFromRPE(durationMinutes, perceivedExertion)
  }

  // Priority 5: Default fallback based on category
  // Strength workouts are typically lower cardiovascular stress
  // Cardio workouts default to moderate intensity
  const defaultRPE = getDefaultRPE(category)
  return estimateTSSFromRPE(durationMinutes, defaultRPE)
}

/**
 * Get default RPE based on workout category
 * Used when no other intensity data is available
 */
function getDefaultRPE(category: string): number {
  switch (category) {
    case 'strength':
      return 5  // Moderate muscular effort, lower cardiovascular demand
    case 'cardio':
      return 6  // Moderate cardio effort
    case 'flexibility':
      return 3  // Low intensity (yoga, stretching)
    case 'other':
    default:
      return 5  // Moderate default
  }
}

/**
 * Estimate TSS for a Strava activity
 * Prioritizes power data, falls back to suffer score, then HR, then default
 */
export function estimateStravaActivityTSS(
  activity: {
    moving_time: number  // seconds
    weighted_average_watts?: number | null
    average_watts?: number | null
    average_heartrate?: number | null
    suffer_score?: number | null
    sport_type?: string
  },
  userProfile: {
    ftp_watts?: number | null
    lthr_bpm?: number | null
    resting_hr?: number | null
    max_hr_bpm?: number | null
  }
): number {
  const durationMinutes = Math.round(activity.moving_time / 60)

  // Priority 1: Power-based
  const np = activity.weighted_average_watts || activity.average_watts
  if (np && userProfile.ftp_watts && userProfile.ftp_watts > 0) {
    return calculatePowerTSS(np, durationMinutes, userProfile.ftp_watts)
  }

  // Priority 2: Strava suffer score
  if (activity.suffer_score && activity.suffer_score > 0) {
    return Math.round(activity.suffer_score)
  }

  // Priority 3: HR-based
  if (activity.average_heartrate && userProfile.lthr_bpm && userProfile.lthr_bpm > 0) {
    return calculateHRTSS(
      activity.average_heartrate,
      durationMinutes,
      userProfile.lthr_bpm,
      userProfile.resting_hr || 50,
      userProfile.max_hr_bpm || 190
    )
  }

  // Priority 4: Default based on duration (assume moderate cardio)
  return estimateTSSFromRPE(durationMinutes, 6)
}
