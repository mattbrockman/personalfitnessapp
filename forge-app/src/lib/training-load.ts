// Training Load Calculations - Seiler/Banister/Foster Methods
// Implements CTL/ATL/TSB, Session RPE, Monotony/Strain, and Polarized Analysis

import {
  ZoneDistribution,
  PolarizedAnalysis,
  TrainingStrain,
  CTLATLTSBPoint,
  STRAIN_THRESHOLDS,
  TSB_RANGES,
} from '@/types/endurance'

// ============================================================================
// CTL / ATL / TSB CALCULATIONS (Banister Impulse-Response Model)
// ============================================================================

/**
 * Calculate Chronic Training Load (CTL) - 42-day exponentially weighted average
 * CTL represents "fitness" - the accumulated training effect
 */
export function calculateCTL(
  tssHistory: { date: string; tss: number }[],
  days: number = 42
): number {
  if (tssHistory.length === 0) return 0

  // Sort by date descending (most recent first)
  const sorted = [...tssHistory].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )

  // Exponential decay constant
  const lambda = 2 / (days + 1)

  let ctl = 0
  let weight = 1

  for (let i = 0; i < Math.min(sorted.length, days * 2); i++) {
    ctl += sorted[i].tss * weight * lambda
    weight *= 1 - lambda
  }

  return Math.round(ctl * 10) / 10
}

/**
 * Calculate Acute Training Load (ATL) - 7-day exponentially weighted average
 * ATL represents "fatigue" - recent training stress
 */
export function calculateATL(
  tssHistory: { date: string; tss: number }[],
  days: number = 7
): number {
  if (tssHistory.length === 0) return 0

  const sorted = [...tssHistory].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )

  const lambda = 2 / (days + 1)

  let atl = 0
  let weight = 1

  for (let i = 0; i < Math.min(sorted.length, days * 2); i++) {
    atl += sorted[i].tss * weight * lambda
    weight *= 1 - lambda
  }

  return Math.round(atl * 10) / 10
}

/**
 * Calculate Training Stress Balance (TSB) - "Form"
 * TSB = CTL - ATL
 * Positive = fresh/rested, Negative = fatigued
 */
export function calculateTSB(ctl: number, atl: number): number {
  return Math.round((ctl - atl) * 10) / 10
}

/**
 * Get TSB range classification
 */
export function getTSBRange(tsb: number): {
  label: string
  color: string
  recommendation: string
} {
  if (tsb >= 25) {
    return {
      label: 'Very Fresh',
      color: 'green',
      recommendation: 'Ready for a big effort or race',
    }
  } else if (tsb >= 10) {
    return {
      label: 'Fresh',
      color: 'blue',
      recommendation: 'Good for quality training',
    }
  } else if (tsb >= -10) {
    return {
      label: 'Optimal',
      color: 'blue',
      recommendation: 'Balanced fitness and freshness',
    }
  } else if (tsb >= -25) {
    return {
      label: 'Tired',
      color: 'amber',
      recommendation: 'Building fitness, monitor recovery',
    }
  } else if (tsb >= -40) {
    return {
      label: 'Fatigued',
      color: 'orange',
      recommendation: 'Consider easier training or rest',
    }
  } else {
    return {
      label: 'Very Fatigued',
      color: 'red',
      recommendation: 'High injury risk - rest recommended',
    }
  }
}

/**
 * Calculate CTL/ATL/TSB for a date range
 */
export function calculateCTLATLTSBHistory(
  tssHistory: { date: string; tss: number }[],
  startDate: string,
  endDate: string
): CTLATLTSBPoint[] {
  const result: CTLATLTSBPoint[] = []
  const start = new Date(startDate)
  const end = new Date(endDate)

  // Build lookup for quick TSS access
  const tssMap = new Map<string, number>()
  for (const entry of tssHistory) {
    tssMap.set(entry.date, entry.tss)
  }

  // For each day in range, calculate CTL/ATL/TSB using all prior history
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0]

    // Get all TSS up to and including this date
    const historyToDate = tssHistory.filter(
      (h) => new Date(h.date) <= d
    )

    const ctl = calculateCTL(historyToDate)
    const atl = calculateATL(historyToDate)
    const tsb = calculateTSB(ctl, atl)

    result.push({ date: dateStr, ctl, atl, tsb })
  }

  return result
}

// ============================================================================
// SESSION RPE & TRAINING LOAD (Foster Method)
// ============================================================================

/**
 * Calculate session training load using Foster's method
 * Training Load = Duration (minutes) × Session RPE
 */
export function calculateSessionLoad(
  durationMinutes: number,
  sessionRPE: number
): number {
  return Math.round(durationMinutes * sessionRPE)
}

/**
 * Estimate session RPE from average heart rate and LTHR
 */
export function estimateSessionRPE(
  avgHR: number,
  lthr: number,
  maxHR: number = 190
): number {
  const hrReserve = maxHR - 50 // Assuming 50 bpm resting
  const lthrPct = (lthr - 50) / hrReserve
  const avgHRPct = (avgHR - 50) / hrReserve

  // Map HR percentage to RPE
  const intensityRatio = avgHRPct / lthrPct

  if (intensityRatio < 0.6) return 2
  if (intensityRatio < 0.7) return 3
  if (intensityRatio < 0.8) return 4
  if (intensityRatio < 0.9) return 5
  if (intensityRatio < 0.95) return 6
  if (intensityRatio < 1.0) return 7
  if (intensityRatio < 1.05) return 8
  if (intensityRatio < 1.1) return 9
  return 10
}

// ============================================================================
// TRAINING MONOTONY & STRAIN (Foster et al.)
// ============================================================================

/**
 * Calculate training monotony
 * Monotony = Mean daily load / SD of daily loads
 * High monotony (>2.0) + high load = injury risk
 */
export function calculateMonotony(dailyLoads: number[]): number {
  if (dailyLoads.length < 2) return 0

  const mean = dailyLoads.reduce((a, b) => a + b, 0) / dailyLoads.length
  const variance =
    dailyLoads.reduce((sum, load) => sum + Math.pow(load - mean, 2), 0) /
    dailyLoads.length
  const sd = Math.sqrt(variance)

  if (sd === 0) return dailyLoads[0] > 0 ? 10 : 0 // Very monotonous if all same non-zero value

  return Math.round((mean / sd) * 100) / 100
}

/**
 * Calculate training strain
 * Strain = Weekly load × Monotony
 */
export function calculateStrain(weeklyLoad: number, monotony: number): number {
  return Math.round(weeklyLoad * monotony)
}

/**
 * Calculate Acute:Chronic Workload Ratio (ACWR)
 * ACWR = ATL / CTL (or acute week load / chronic 4-week avg)
 * Sweet spot: 0.8-1.3, >1.5 = high injury risk
 */
export function calculateACWR(atl: number, ctl: number): number {
  if (ctl === 0) return 0
  return Math.round((atl / ctl) * 100) / 100
}

/**
 * Full training strain analysis
 */
export function analyzeTrainingStrain(
  dailyLoads: number[],
  atl: number,
  ctl: number
): TrainingStrain {
  const weeklyLoad = dailyLoads.reduce((a, b) => a + b, 0)
  const monotony = calculateMonotony(dailyLoads)
  const strain = calculateStrain(weeklyLoad, monotony)
  const acwr = calculateACWR(atl, ctl)

  // Determine risk level
  let riskLevel: TrainingStrain['riskLevel'] = 'low'
  let recommendation = 'Training load is appropriate'

  if (monotony > STRAIN_THRESHOLDS.monotony.high || strain > STRAIN_THRESHOLDS.strain.high) {
    riskLevel = 'very_high'
    recommendation = 'High injury risk - reduce load and add variety'
  } else if (
    monotony > STRAIN_THRESHOLDS.monotony.moderate ||
    strain > STRAIN_THRESHOLDS.strain.moderate ||
    acwr > 1.5
  ) {
    riskLevel = 'high'
    recommendation = 'Elevated risk - consider reducing load'
  } else if (
    monotony > STRAIN_THRESHOLDS.monotony.low ||
    strain > STRAIN_THRESHOLDS.strain.low ||
    acwr > 1.3
  ) {
    riskLevel = 'moderate'
    recommendation = 'Monitor fatigue and recovery closely'
  }

  if (acwr < 0.8 && ctl > 20) {
    recommendation = 'Training load may be too low to maintain fitness'
  }

  return {
    weeklyLoad,
    monotony,
    strain,
    acwr,
    riskLevel,
    recommendation,
  }
}

// ============================================================================
// POLARIZED TRAINING ANALYSIS
// ============================================================================

/**
 * Analyze zone distribution for polarized training compliance
 * Target: 80% Zone 1-2, <10% Zone 3, 20% Zone 4-5
 */
export function analyzePolarizedDistribution(
  zoneSeconds: ZoneDistribution,
  targetLowPct: number = 80,
  targetHighPct: number = 20
): PolarizedAnalysis {
  const total = zoneSeconds.totalSeconds || (
    zoneSeconds.zone1Seconds +
    zoneSeconds.zone2Seconds +
    zoneSeconds.zone3Seconds +
    zoneSeconds.zone4Seconds +
    zoneSeconds.zone5Seconds
  )

  if (total === 0) {
    return {
      lowIntensityPct: 0,
      midIntensityPct: 0,
      highIntensityPct: 0,
      isPolarized: false,
      complianceScore: 0,
      recommendation: 'No training data available',
      targetLowPct,
      targetHighPct,
    }
  }

  const lowIntensity = zoneSeconds.zone1Seconds + zoneSeconds.zone2Seconds
  const midIntensity = zoneSeconds.zone3Seconds
  const highIntensity = zoneSeconds.zone4Seconds + zoneSeconds.zone5Seconds

  const lowPct = (lowIntensity / total) * 100
  const midPct = (midIntensity / total) * 100
  const highPct = (highIntensity / total) * 100

  // Calculate compliance score (0-100)
  // Perfect score: lowPct = targetLowPct, highPct = targetHighPct, midPct < 10
  const lowDeviation = Math.abs(lowPct - targetLowPct)
  const highDeviation = Math.abs(highPct - targetHighPct)
  const midPenalty = Math.max(0, midPct - 10) * 2 // Extra penalty for gray zone

  const complianceScore = Math.max(0, 100 - lowDeviation - highDeviation - midPenalty)

  // Is it polarized?
  const isPolarized = lowPct >= 75 && midPct <= 15 && highPct >= 10

  // Generate recommendation
  let recommendation: string
  if (midPct > 20) {
    recommendation = `Too much Zone 3 "gray zone" training (${midPct.toFixed(0)}%). Reduce tempo work and focus on truly easy or truly hard efforts.`
  } else if (lowPct < 70) {
    recommendation = `Not enough easy training (${lowPct.toFixed(0)}%). Add more Zone 1-2 volume for better recovery and adaptation.`
  } else if (highPct < 10) {
    recommendation = `Not enough high-intensity work (${highPct.toFixed(0)}%). Add interval sessions for fitness gains.`
  } else if (isPolarized) {
    recommendation = 'Excellent polarized distribution! Keep it up.'
  } else {
    recommendation = 'Good distribution. Minor adjustments could optimize your training.'
  }

  return {
    lowIntensityPct: Math.round(lowPct * 10) / 10,
    midIntensityPct: Math.round(midPct * 10) / 10,
    highIntensityPct: Math.round(highPct * 10) / 10,
    isPolarized,
    complianceScore: Math.round(complianceScore),
    recommendation,
    targetLowPct,
    targetHighPct,
  }
}

// ============================================================================
// TSS FROM HEART RATE (hrTSS)
// ============================================================================

/**
 * Calculate TSS from heart rate data (when power not available)
 * Uses Coggan/TrainingPeaks hrTSS formula
 */
export function calculateHRTSS(
  avgHR: number,
  durationMinutes: number,
  lthr: number,
  restingHR: number = 50,
  maxHR: number = 190
): number {
  if (!lthr || !avgHR || durationMinutes <= 0) return 0

  // Heart Rate Reserve method
  const hrReserve = maxHR - restingHR
  const lthrReserve = lthr - restingHR
  const avgHRReserve = Math.max(0, avgHR - restingHR)

  // Intensity Factor based on HR
  const intensityFactor = avgHRReserve / lthrReserve

  // hrTSS formula: (duration in hours) × IF² × 100
  const durationHours = durationMinutes / 60
  const hrTSS = durationHours * Math.pow(intensityFactor, 2) * 100

  return Math.round(hrTSS)
}

/**
 * Calculate TSS from power data (cycling)
 */
export function calculatePowerTSS(
  normalizedPower: number,
  durationMinutes: number,
  ftp: number
): number {
  if (!ftp || !normalizedPower || durationMinutes <= 0) return 0

  const intensityFactor = normalizedPower / ftp
  const durationHours = durationMinutes / 60

  // TSS = (duration in hours) × IF² × 100
  const tss = durationHours * Math.pow(intensityFactor, 2) * 100

  return Math.round(tss)
}

/**
 * Estimate TSS when no HR or power data available
 * Uses session RPE as proxy
 */
export function estimateTSSFromRPE(
  durationMinutes: number,
  sessionRPE: number
): number {
  // Rough mapping: RPE 5 ≈ 0.7 TSS/min, RPE 10 ≈ 1.5 TSS/min
  const tssPerMin = 0.3 + (sessionRPE / 10) * 1.2
  return Math.round(durationMinutes * tssPerMin)
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Convert zone seconds to hours for display
 */
export function zoneSecondsToHours(seconds: number): number {
  return Math.round((seconds / 3600) * 10) / 10
}

/**
 * Format duration for display
 */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours === 0) return `${mins}m`
  if (mins === 0) return `${hours}h`
  return `${hours}h ${mins}m`
}

/**
 * Get week number for a date (ISO week)
 */
export function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}
