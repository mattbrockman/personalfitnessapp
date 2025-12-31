// Endurance Training Types - Seiler Polarized Training Features

// ============================================================================
// TRAINING LOAD
// ============================================================================

export interface TrainingLoadDay {
  id: string
  user_id: string
  log_date: string

  // Daily totals
  total_tss: number
  total_duration_minutes: number
  session_rpe_avg: number | null
  training_load: number | null // Duration × RPE

  // Zone distribution (seconds)
  zone_1_seconds: number
  zone_2_seconds: number
  zone_3_seconds: number
  zone_4_seconds: number
  zone_5_seconds: number

  // Calculated metrics
  ctl: number | null // Chronic Training Load (fitness)
  atl: number | null // Acute Training Load (fatigue)
  tsb: number | null // Training Stress Balance (form)

  // Strain metrics
  monotony: number | null
  strain: number | null

  created_at: string
  updated_at: string
}

export interface CTLATLTSBPoint {
  date: string
  ctl: number
  atl: number
  tsb: number
}

export interface TrainingLoadSummary {
  currentCTL: number
  currentATL: number
  currentTSB: number
  ctlTrend: 'rising' | 'falling' | 'stable'
  tsbRange: 'fresh' | 'optimal' | 'fatigued' | 'very_fatigued'
  weeklyTSS: number
  weeklyHours: number
  monotony: number
  strain: number
  injuryRisk: 'low' | 'moderate' | 'high'
}

// ============================================================================
// POLARIZED TRAINING
// ============================================================================

export interface ZoneDistribution {
  zone1Seconds: number
  zone2Seconds: number
  zone3Seconds: number
  zone4Seconds: number
  zone5Seconds: number
  totalSeconds: number
}

export interface PolarizedAnalysis {
  lowIntensityPct: number // Zone 1-2 (should be ~80%)
  midIntensityPct: number // Zone 3 "gray zone" (should be <10%)
  highIntensityPct: number // Zone 4-5 (should be ~20%)
  isPolarized: boolean
  complianceScore: number // 0-100
  recommendation: string
  targetLowPct: number
  targetHighPct: number
}

export interface WeeklyIntensityDistribution {
  weekStart: string
  weekEnd: string
  distribution: ZoneDistribution
  analysis: PolarizedAnalysis
  totalTSS: number
  totalHours: number
  workoutCount: number
}

// ============================================================================
// THRESHOLDS
// ============================================================================

export type ThresholdTestType =
  | 'ftp_test_20min'
  | 'ftp_test_ramp'
  | 'ftp_test_8min'
  | 'lthr_test'
  | 'time_trial'
  | 'race'
  | 'estimated'
  | 'manual'

export type ThresholdSource = 'manual' | 'strava' | 'zwift' | 'garmin' | 'wahoo' | 'trainingpeaks'

export type ConfidenceLevel = 'high' | 'medium' | 'low'

export interface ThresholdTest {
  id: string
  user_id: string
  test_date: string

  // Values
  ftp_watts: number | null
  lthr_bpm: number | null
  threshold_pace_min_mile: number | null
  threshold_pace_min_km: number | null

  // Context
  test_type: ThresholdTestType
  source: ThresholdSource
  activity_id: string | null
  confidence_level: ConfidenceLevel
  protocol_followed: boolean
  conditions: string | null

  notes: string | null
  created_at: string
}

export interface CurrentThresholds {
  ftp_watts: number | null
  lthr_bpm: number | null
  threshold_pace_min_mile: number | null
  resting_hr: number | null
  max_hr: number | null
  last_ftp_test: string | null
  last_lthr_test: string | null
  ftp_trend: 'improving' | 'declining' | 'stable' | null
}

// ============================================================================
// SESSION RPE & TRAINING LOAD
// ============================================================================

export interface SessionRPE {
  workout_id: string
  session_rpe: number // 1-10 scale
  duration_minutes: number
  training_load: number // duration × RPE
  perceived_difficulty: 'very_easy' | 'easy' | 'moderate' | 'hard' | 'very_hard' | 'maximal'
}

export const SESSION_RPE_DESCRIPTIONS: Record<number, { label: string; description: string }> = {
  1: { label: 'Very Light', description: 'Barely any exertion' },
  2: { label: 'Light', description: 'Easy effort, can talk easily' },
  3: { label: 'Light-Moderate', description: 'Comfortable, sustainable' },
  4: { label: 'Moderate', description: 'Starting to breathe harder' },
  5: { label: 'Moderate-Hard', description: 'Challenging but manageable' },
  6: { label: 'Hard', description: 'Difficult, limited talking' },
  7: { label: 'Very Hard', description: 'Very challenging, short sentences only' },
  8: { label: 'Very Very Hard', description: 'Extremely difficult' },
  9: { label: 'Near Maximal', description: 'Almost all-out effort' },
  10: { label: 'Maximal', description: 'Absolute maximum effort' },
}

// ============================================================================
// TRAINING STRAIN (Foster Method)
// ============================================================================

export interface TrainingStrain {
  weeklyLoad: number // Sum of daily training loads
  monotony: number // Mean daily load / SD of daily load
  strain: number // Weekly load × monotony
  acwr: number // Acute:Chronic Workload Ratio
  riskLevel: 'low' | 'moderate' | 'high' | 'very_high'
  recommendation: string
}

export const STRAIN_THRESHOLDS = {
  monotony: {
    low: 1.5,
    moderate: 2.0,
    high: 2.5,
  },
  strain: {
    low: 3000,
    moderate: 5000,
    high: 7000,
  },
  acwr: {
    lowRisk: { min: 0.8, max: 1.3 },
    moderateRisk: { min: 0.5, max: 1.5 },
    highRisk: { min: 0, max: 2.0 },
  },
}

// ============================================================================
// TSB RANGES (Training Stress Balance / Form)
// ============================================================================

export const TSB_RANGES = {
  veryFresh: { min: 25, max: Infinity, label: 'Very Fresh', color: 'green' },
  fresh: { min: 10, max: 25, label: 'Fresh', color: 'blue' },
  optimal: { min: -10, max: 10, label: 'Optimal', color: 'blue' },
  tired: { min: -25, max: -10, label: 'Tired', color: 'amber' },
  fatigued: { min: -40, max: -25, label: 'Fatigued', color: 'orange' },
  veryFatigued: { min: -Infinity, max: -40, label: 'Very Fatigued', color: 'red' },
}

// ============================================================================
// TALK TEST / ZONE GUIDANCE
// ============================================================================

export const ZONE_GUIDANCE = {
  zone1: {
    name: 'Recovery',
    hrPct: '50-60%',
    talkTest: 'Can easily hold a conversation',
    rpe: '1-2',
    purpose: 'Active recovery, warmup',
  },
  zone2: {
    name: 'Endurance',
    hrPct: '60-70%',
    talkTest: 'Can speak in full sentences',
    rpe: '3-4',
    purpose: 'Aerobic base, fat oxidation, mitochondrial development',
  },
  zone3: {
    name: 'Tempo',
    hrPct: '70-80%',
    talkTest: 'Can speak in short sentences',
    rpe: '5-6',
    purpose: 'Moderate intensity - often "gray zone", minimize time here',
  },
  zone4: {
    name: 'Threshold',
    hrPct: '80-90%',
    talkTest: 'Can only speak a few words',
    rpe: '7-8',
    purpose: 'Lactate threshold, time trial pace',
  },
  zone5: {
    name: 'VO2max',
    hrPct: '90-100%',
    talkTest: 'Cannot speak',
    rpe: '9-10',
    purpose: 'Maximum aerobic capacity, intervals',
  },
}

// ============================================================================
// TRAINING SUMMARY (for coaches)
// ============================================================================

export interface TrainingSummary {
  periodStart: string
  periodEnd: string
  periodWeeks: number

  // Volume
  totalHours: number
  avgWeeklyHours: number
  totalWorkouts: number
  avgWorkoutsPerWeek: number

  // Load
  totalTSS: number
  avgWeeklyTSS: number
  avgSessionRPE: number

  // Distribution
  zoneDistribution: ZoneDistribution
  polarizedAnalysis: PolarizedAnalysis
  hoursPerZone: {
    zone1: number
    zone2: number
    zone3: number
    zone4: number
    zone5: number
  }

  // Fitness progression
  ctlStart: number
  ctlEnd: number
  ctlChange: number

  // Thresholds
  ftpStart: number | null
  ftpEnd: number | null
  ftpChange: number | null
}
