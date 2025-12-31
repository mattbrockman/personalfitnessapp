// Greg Nuckols Evidence-Based Strength Training Types
// Implements relative intensity, volume landmarks, effective reps, progression tracking

// ============================================================================
// ENUMS & BASIC TYPES
// ============================================================================

export type ProgressionModel = 'linear' | 'double' | 'rpe_based';
export type VolumeStatus = 'below_mev' | 'approaching_mev' | 'in_mav' | 'approaching_mrv' | 'over_mrv';
export type TestType = '1rm' | '3rm' | '5rm' | 'amrap';
export type EstimateSource = 'calculated' | 'tested' | 'manual';
export type LiftBalanceStatus = 'strong' | 'balanced' | 'weak';
export type OneRMFormula = 'brzycki' | 'epley' | 'lombardi';
export type ConfidenceLevel = 'high' | 'medium' | 'low';

// ============================================================================
// VOLUME LANDMARKS
// ============================================================================

export interface VolumeLandmarks {
  mev: number      // Minimum Effective Volume
  mavLow: number   // MAV lower bound
  mavHigh: number  // MAV upper bound
  mrv: number      // Maximum Recoverable Volume
}

export interface VolumeLandmarkRecord {
  id: string
  user_id: string
  muscle_group: string
  mev_sets: number
  mav_low: number
  mav_high: number
  mrv_sets: number
  created_at: string
  updated_at: string
}

export interface VolumeLandmarkStatus {
  muscleGroup: string
  currentSets: number
  landmarks: VolumeLandmarks
  status: VolumeStatus
  percentage: number // Position within MEV->MRV range (0-100+)
  recommendation: string
}

// ============================================================================
// USER EXERCISE ESTIMATES
// ============================================================================

export interface UserExerciseEstimate {
  id: string
  user_id: string
  exercise_id: string
  estimated_1rm_lbs: number
  source: EstimateSource
  test_type?: TestType
  test_weight_lbs?: number
  test_reps?: number
  last_updated: string
  created_at: string
}

export interface ExerciseEstimateWithName extends UserExerciseEstimate {
  exercise_name: string
}

// ============================================================================
// STRENGTH PREFERENCES
// ============================================================================

export interface StrengthPreferences {
  id: string
  user_id: string
  progression_model: ProgressionModel
  linear_increment_lbs: number
  linear_increment_upper_lbs: number
  double_rep_target_low: number
  double_rep_target_high: number
  double_weight_increase_lbs: number
  rpe_target_low: number
  rpe_target_high: number
  created_at: string
  updated_at: string
}

// ============================================================================
// WEEKLY VOLUME STATS
// ============================================================================

export interface WeeklyVolumeStats {
  id: string
  user_id: string
  week_start_date: string
  muscle_group: string
  hard_sets: number
  effective_reps: number
  total_volume_lbs: number
  avg_relative_intensity: number | null
  sessions_count: number
  volume_status: VolumeStatus | null
  created_at: string
  updated_at: string
}

export interface WeeklyVolumeAnalysis {
  week_start_date: string
  muscles: MuscleVolumeAnalysis[]
  alerts: VolumeAlert[]
  summary: {
    total_hard_sets: number
    total_effective_reps: number
    total_volume_lbs: number
    muscles_below_mev: number
    muscles_over_mrv: number
  }
}

export interface MuscleVolumeAnalysis {
  muscle_group: string
  hard_sets: number
  effective_reps: number
  total_volume_lbs: number
  avg_relative_intensity: number | null
  sessions_count: number
  volume_status: VolumeLandmarkStatus
  frequency_status: FrequencyAnalysis
}

// ============================================================================
// STRENGTH TESTS
// ============================================================================

export interface StrengthTest {
  id: string
  user_id: string
  workout_id?: string
  exercise_id: string
  test_date: string
  test_type: TestType
  weight_lbs: number
  reps_achieved: number
  rpe?: number
  estimated_1rm_lbs: number
  previous_1rm_lbs?: number
  improvement_percent?: number
  notes?: string
  created_at: string
}

export interface StrengthTestWithName extends StrengthTest {
  exercise_name: string
}

// ============================================================================
// PROGRESSION
// ============================================================================

export interface ProgressionRecord {
  id: string
  user_id: string
  exercise_id: string
  week_start_date: string
  best_weight_lbs: number
  best_reps: number
  best_e1rm: number
  weeks_without_progress: number
  plateau_detected: boolean
  plateau_start_date?: string
  created_at: string
}

export interface ProgressionSuggestion {
  model: ProgressionModel
  currentWeight: number
  currentReps: number
  suggestedWeight: number
  suggestedReps: number
  reasoning: string
}

export interface PlateauInfo {
  exercise_id: string
  exercise_name: string
  plateau_detected: boolean
  weeks_without_progress: number
  last_pr_date?: string
  last_pr_e1rm?: number
  suggestion: string
}

// ============================================================================
// FREQUENCY ANALYSIS
// ============================================================================

export interface FrequencyAnalysis {
  muscleGroup: string
  sessionsPerWeek: number
  isOptimal: boolean // 2+ times per week is optimal for hypertrophy
  recommendation: string
}

// ============================================================================
// 1RM CALCULATION
// ============================================================================

export interface OneRMResult {
  estimated1RM: number
  formula: OneRMFormula
  confidence: ConfidenceLevel // Based on rep range
}

export interface EffectiveRepsResult {
  totalReps: number
  effectiveReps: number
  rpe: number | null
  rir: number | null
}

// ============================================================================
// WEAK POINT ANALYSIS
// ============================================================================

export interface WeakPointAnalysis {
  lift: string
  current1RM: number
  expectedRatio: number
  actualRatio: number
  status: LiftBalanceStatus
  recommendation: string
}

export interface LiftRatios {
  benchToSquat: number    // typically 0.75
  deadliftToSquat: number // typically 1.25
  ohpToSquat: number      // typically 0.50
  rowToSquat: number      // typically 0.65
}

// ============================================================================
// ALERTS
// ============================================================================

export interface VolumeAlert {
  id: string
  type: 'volume' | 'frequency' | 'plateau'
  severity: 'info' | 'warning' | 'critical'
  muscle_group?: string
  exercise_id?: string
  message: string
  recommendation: string
}

// ============================================================================
// SET-LEVEL CALCULATIONS
// ============================================================================

export interface SetWithCalculations {
  set_id: string
  weight_lbs: number
  reps: number
  rpe?: number
  rir?: number
  relative_intensity?: number // % of 1RM
  effective_reps?: number
  estimated_1rm?: number
}

// ============================================================================
// DEFAULT VOLUME LANDMARKS (Evidence-based from Nuckols/Israetel research)
// ============================================================================

export const DEFAULT_VOLUME_LANDMARKS: Record<string, VolumeLandmarks> = {
  chest: { mev: 8, mavLow: 12, mavHigh: 20, mrv: 22 },
  back: { mev: 8, mavLow: 12, mavHigh: 20, mrv: 25 },
  shoulders: { mev: 8, mavLow: 12, mavHigh: 20, mrv: 22 },
  biceps: { mev: 6, mavLow: 10, mavHigh: 16, mrv: 20 },
  triceps: { mev: 6, mavLow: 10, mavHigh: 16, mrv: 20 },
  quads: { mev: 8, mavLow: 12, mavHigh: 18, mrv: 22 },
  hamstrings: { mev: 6, mavLow: 10, mavHigh: 16, mrv: 20 },
  glutes: { mev: 6, mavLow: 10, mavHigh: 16, mrv: 20 },
  calves: { mev: 8, mavLow: 12, mavHigh: 16, mrv: 20 },
  abs: { mev: 6, mavLow: 12, mavHigh: 20, mrv: 25 },
  traps: { mev: 6, mavLow: 10, mavHigh: 16, mrv: 20 },
  forearms: { mev: 4, mavLow: 8, mavHigh: 14, mrv: 18 },
  lats: { mev: 8, mavLow: 12, mavHigh: 20, mrv: 25 },
  lower_back: { mev: 4, mavLow: 8, mavHigh: 12, mrv: 16 },
}

// ============================================================================
// DEFAULT LIFT RATIOS (Based on balanced development)
// ============================================================================

export const DEFAULT_LIFT_RATIOS: LiftRatios = {
  benchToSquat: 0.75,     // Bench should be ~75% of squat
  deadliftToSquat: 1.25,  // Deadlift should be ~125% of squat
  ohpToSquat: 0.50,       // OHP should be ~50% of squat
  rowToSquat: 0.65,       // Row should be ~65% of squat
}
