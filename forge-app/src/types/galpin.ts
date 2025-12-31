// Andy Galpin Evidence-Based Exercise Physiology Types
// Implements 9 adaptations, training age, readiness, tempo, deload, and strength standards

// ============================================================================
// GALPIN'S 9 ADAPTATIONS
// ============================================================================

export type GalpinAdaptation =
  | 'skill'             // Skill/Technique acquisition
  | 'speed_power'       // Speed & Power
  | 'strength'          // Maximum Strength
  | 'hypertrophy'       // Muscle Growth
  | 'muscular_endurance' // Muscular Endurance
  | 'anaerobic_capacity' // Anaerobic Capacity (glycolytic)
  | 'vo2max'            // VO2max/Aerobic Power
  | 'long_duration'     // Long Duration Endurance
  | 'body_composition'  // Body Composition (fat loss/gain)

export const ADAPTATION_LABELS: Record<GalpinAdaptation, string> = {
  skill: 'Skill/Technique',
  speed_power: 'Speed & Power',
  strength: 'Strength',
  hypertrophy: 'Hypertrophy',
  muscular_endurance: 'Muscular Endurance',
  anaerobic_capacity: 'Anaerobic Capacity',
  vo2max: 'VO2max',
  long_duration: 'Long Duration Endurance',
  body_composition: 'Body Composition',
}

export const ADAPTATION_DESCRIPTIONS: Record<GalpinAdaptation, string> = {
  skill: 'Movement quality and technical proficiency',
  speed_power: 'Explosive force production and rate of force development',
  strength: 'Maximum force output regardless of time',
  hypertrophy: 'Muscle cross-sectional area and size',
  muscular_endurance: 'Ability to sustain repeated muscular contractions',
  anaerobic_capacity: 'High-intensity work capacity without oxygen (30-120s efforts)',
  vo2max: 'Maximum oxygen uptake and aerobic power',
  long_duration: 'Sustained sub-maximal effort (30+ minutes)',
  body_composition: 'Ratio of lean mass to fat mass',
}

// ============================================================================
// EXPERIENCE LEVEL & TRAINING AGE
// ============================================================================

export type ExperienceLevel = 'novice' | 'intermediate' | 'advanced'

export const EXPERIENCE_THRESHOLDS = {
  novice: { maxYears: 1, label: 'Novice (< 1 year)' },
  intermediate: { maxYears: 3, label: 'Intermediate (1-3 years)' },
  advanced: { maxYears: Infinity, label: 'Advanced (3+ years)' },
}

export interface TrainingAgeInfo {
  startDate: string | null
  trainingAgeYears: number
  trainingAgeMonths: number
  experienceLevel: ExperienceLevel
  volumeToleranceMultiplier: number // 0.7 for novice, 0.85 for intermediate, 1.0 for advanced
}

// ============================================================================
// ADAPTATION PROTOCOLS
// ============================================================================

export interface AdaptationProtocol {
  adaptation_type: GalpinAdaptation
  rep_min: number
  rep_max: number
  sets_min: number
  sets_max: number
  rest_min: number // seconds
  rest_max: number // seconds
  intensity_min: number | null
  intensity_max: number | null
  intensity_unit: '%1RM' | '%HRmax' | '%VO2max' | 'RPE'
  default_tempo: string | null
  sessions_per_week_min: number
  sessions_per_week_max: number
  exercise_selection_notes: string | null
}

export interface UserAdaptationGoals {
  id: string
  user_id: string
  primary_adaptation: GalpinAdaptation
  secondary_adaptation: GalpinAdaptation | null
  tertiary_adaptation: GalpinAdaptation | null
  priorities: Record<GalpinAdaptation, number> | null // 1-9 rankings
  notes: string | null
  created_at: string
  updated_at: string
}

// ============================================================================
// READINESS ASSESSMENT
// ============================================================================

export type ReadinessRecommendation = 'reduce' | 'maintain' | 'push'

export interface ReadinessAssessment {
  id: string
  user_id: string
  assessment_date: string

  // Inputs
  subjective_readiness: number // 1-10
  grip_strength_lbs: number | null
  vertical_jump_inches: number | null
  hrv_reading: number | null // RMSSD
  resting_hr: number | null
  sleep_quality: number | null // 1-10
  sleep_hours: number | null
  tsb_value: number | null
  atl_value: number | null
  ctl_value: number | null

  // Outputs
  calculated_readiness_score: number | null // 0-100
  recommended_intensity: ReadinessRecommendation | null
  adjustment_factor: number | null // 0.70-1.10

  notes: string | null
  created_at: string
}

export interface ReadinessBaselines {
  user_id: string
  avg_grip_strength_lbs: number | null
  avg_vertical_jump_inches: number | null
  avg_hrv: number | null
  avg_resting_hr: number | null
  avg_sleep_hours: number | null
  std_hrv: number | null
  std_grip_strength: number | null
  std_vertical_jump: number | null
  grip_sample_count: number
  jump_sample_count: number
  hrv_sample_count: number
  last_updated: string
}

export interface ReadinessResult {
  score: number // 0-100
  recommendation: ReadinessRecommendation
  adjustmentFactor: number
  factors: ReadinessFactorBreakdown
  suggestions: string[]
}

export interface ReadinessFactorBreakdown {
  subjective: { value: number; weight: number; contribution: number }
  hrv: { value: number | null; zScore: number | null; weight: number; contribution: number } | null
  sleep: { value: number | null; weight: number; contribution: number } | null
  tsb: { value: number | null; weight: number; contribution: number } | null
  gripStrength: { value: number | null; percentOfBaseline: number | null; weight: number; contribution: number } | null
  verticalJump: { value: number | null; percentOfBaseline: number | null; weight: number; contribution: number } | null
}

// ============================================================================
// TEMPO TRACKING
// ============================================================================

export interface Tempo {
  eccentric: number  // Lowering phase (seconds)
  pauseBottom: number // Pause at stretched position
  concentric: number  // Lifting phase (seconds, 'X' = explosive)
  pauseTop: number    // Pause at contracted position
}

export interface TimeUnderTension {
  tempoString: string
  perRep: number // seconds per rep
  perSet: number // seconds per set
  total: number  // total TUT for all sets
}

export const DEFAULT_TEMPOS: Record<GalpinAdaptation, string> = {
  skill: '1-0-1-0',      // Controlled but not slow
  speed_power: '1-0-X-0', // Explosive concentric
  strength: '2-1-1-0',   // Controlled with brief pause
  hypertrophy: '3-0-1-0', // Slow eccentric
  muscular_endurance: '2-0-1-0', // Moderate pace
  anaerobic_capacity: '1-0-1-0', // Quick turnover
  vo2max: '1-0-1-0',     // N/A for cardio but default
  long_duration: '1-0-1-0', // N/A for cardio but default
  body_composition: '2-0-1-0', // Similar to hypertrophy
}

// ============================================================================
// POWER TESTS
// ============================================================================

export interface PowerTest {
  id: string
  user_id: string
  test_date: string

  // Jump tests
  vertical_jump_inches: number | null
  broad_jump_inches: number | null
  reactive_strength_index: number | null

  // Sprint tests
  sprint_10m_seconds: number | null
  sprint_20m_seconds: number | null
  sprint_40m_seconds: number | null

  // VBT benchmarks
  squat_mean_velocity_mps: number | null
  bench_mean_velocity_mps: number | null

  test_conditions: string | null
  equipment_used: string | null
  notes: string | null
  created_at: string
}

export interface PowerProfile {
  latestTest: PowerTest | null
  verticalJumpPR: number | null
  broadJumpPR: number | null
  sprint40mPR: number | null
  trend: 'improving' | 'stable' | 'declining' | 'insufficient_data'
}

// ============================================================================
// TECHNIQUE ASSESSMENT
// ============================================================================

export type TechniqueRating = 1 | 2 | 3 | 4 | 5

export const TECHNIQUE_RATING_LABELS: Record<TechniqueRating, string> = {
  1: 'Major form issues, injury risk',
  2: 'Multiple form issues needing work',
  3: 'Acceptable form, minor issues',
  4: 'Good form, small refinements possible',
  5: 'Excellent form, competition-ready',
}

export type TechniqueAssessor = 'self' | 'coach' | 'ai'

export interface TechniqueAssessment {
  id: string
  user_id: string
  exercise_id: string | null
  exercise_name: string
  assessment_date: string
  technique_rating: TechniqueRating
  video_url: string | null
  strengths: string[] | null
  areas_for_improvement: string[] | null
  cues_to_focus: string[] | null
  assessed_by: TechniqueAssessor | null
  coach_notes: string | null
  created_at: string
}

export interface TechniqueProgress {
  exercise_name: string
  assessments: TechniqueAssessment[]
  currentRating: TechniqueRating
  trend: 'improving' | 'stable' | 'declining'
  priorityCues: string[]
}

// ============================================================================
// DELOAD TRIGGERS
// ============================================================================

export type DeloadTriggerType = 'tsb' | 'volume' | 'plateau' | 'recovery' | 'scheduled' | 'manual'
export type DeloadSeverity = 'mild' | 'moderate' | 'severe'
export type DeloadType = 'volume' | 'intensity' | 'full' | 'active_recovery'
export type DeloadResponse = 'accepted' | 'modified' | 'dismissed' | 'pending'

export interface DeloadTrigger {
  id: string
  user_id: string
  triggered_at: string
  trigger_type: DeloadTriggerType
  trigger_data: Record<string, unknown> | null
  severity: DeloadSeverity | null
  recommended_deload_type: DeloadType | null
  recommended_duration_days: number
  user_response: DeloadResponse | null
  response_notes: string | null
  responded_at: string | null
  created_at: string
}

export interface DeloadRecommendation {
  shouldDeload: boolean
  triggers: DeloadTriggerInfo[]
  severity: DeloadSeverity
  deloadType: DeloadType
  durationDays: number
  volumeReduction: number // e.g., 0.5 = 50% reduction
  intensityReduction: number // e.g., 0.1 = 10% reduction
  message: string
  suggestions: string[]
}

export interface DeloadTriggerInfo {
  type: DeloadTriggerType
  reason: string
  data: Record<string, unknown>
}

// Deload thresholds
export const DELOAD_THRESHOLDS = {
  tsb: -15, // TSB below this triggers deload
  musclesOverMRV: 3, // Number of muscles over MRV to trigger
  plateauWeeks: 2, // Weeks without progress to trigger
  lowRecoveryStreak: 3, // Days of low recovery scores
  lowRecoveryThreshold: 50, // Recovery score below this is "low"
}

// ============================================================================
// STRENGTH STANDARDS
// ============================================================================

export type StrengthClassification = 'untrained' | 'beginner' | 'novice' | 'intermediate' | 'advanced' | 'elite'
export type StandardizedLift = 'squat' | 'bench_press' | 'deadlift' | 'overhead_press' | 'barbell_row'
export type Sex = 'male' | 'female'

export interface StrengthStandard {
  exercise_name: StandardizedLift
  sex: Sex
  body_weight_class: string

  // Percentiles
  percentile_50: number
  percentile_75: number
  percentile_90: number
  percentile_95: number
  percentile_99: number

  // Classification thresholds
  beginner_threshold: number
  novice_threshold: number
  intermediate_threshold: number
  advanced_threshold: number
  elite_threshold: number

  data_source: string
}

export interface UserStrengthPercentile {
  exercise_name: StandardizedLift
  current1RM: number
  bodyWeight: number
  sex: Sex
  percentile: number
  classification: StrengthClassification
  nextLevelThreshold: number
  toNextLevel: number // lbs needed to reach next level
}

export interface StrengthProfile {
  lifts: UserStrengthPercentile[]
  wilksScore: number | null
  dotsScore: number | null
  overallClassification: StrengthClassification
  strongestLift: StandardizedLift | null
  weakestLift: StandardizedLift | null
}

// ============================================================================
// WEIGHT CLASSES
// ============================================================================

export const MALE_WEIGHT_CLASSES = ['132', '148', '165', '181', '198', '220', '242', '275', '308', '308+'] as const
export const FEMALE_WEIGHT_CLASSES = ['97', '105', '114', '123', '132', '148', '165', '181', '198', '198+'] as const

export type MaleWeightClass = typeof MALE_WEIGHT_CLASSES[number]
export type FemaleWeightClass = typeof FEMALE_WEIGHT_CLASSES[number]

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

// Adaptations
export interface SetAdaptationGoalsRequest {
  primary_adaptation: GalpinAdaptation
  secondary_adaptation?: GalpinAdaptation
  tertiary_adaptation?: GalpinAdaptation
  priorities?: Record<GalpinAdaptation, number>
  notes?: string
}

// Readiness
export interface LogReadinessRequest {
  assessment_date?: string
  subjective_readiness: number
  grip_strength_lbs?: number
  vertical_jump_inches?: number
  hrv_reading?: number
  resting_hr?: number
  sleep_quality?: number
  sleep_hours?: number
  notes?: string
}

export interface ReadinessResponse {
  assessment: ReadinessAssessment
  result: ReadinessResult
  baselines: ReadinessBaselines | null
}

// Power Tests
export interface LogPowerTestRequest {
  test_date?: string
  vertical_jump_inches?: number
  broad_jump_inches?: number
  reactive_strength_index?: number
  sprint_10m_seconds?: number
  sprint_20m_seconds?: number
  sprint_40m_seconds?: number
  squat_mean_velocity_mps?: number
  bench_mean_velocity_mps?: number
  test_conditions?: string
  equipment_used?: string
  notes?: string
}

// Technique
export interface LogTechniqueRequest {
  exercise_id?: string
  exercise_name: string
  assessment_date?: string
  technique_rating: TechniqueRating
  video_url?: string
  strengths?: string[]
  areas_for_improvement?: string[]
  cues_to_focus?: string[]
  assessed_by?: TechniqueAssessor
  coach_notes?: string
}

// Deload
export interface RespondToDeloadRequest {
  trigger_id: string
  response: DeloadResponse
  notes?: string
}

// Strength Standards
export interface GetStrengthProfileRequest {
  body_weight_lbs: number
  sex: Sex
  lifts: {
    exercise_name: StandardizedLift
    current_1rm_lbs: number
  }[]
}
