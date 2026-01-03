// Training Plan Types for Long-term Periodization

export type PlanGoal = 'strength' | 'endurance' | 'weight_loss' | 'general_fitness' | 'event_prep'
export type PlanStatus = 'draft' | 'active' | 'completed' | 'archived'
export type PhaseType = 'base' | 'build' | 'peak' | 'taper' | 'recovery' | 'transition'
export type IntensityFocus = 'volume' | 'intensity' | 'speed' | 'strength' | 'recovery'
export type WeekType = 'normal' | 'build' | 'recovery' | 'deload' | 'test' | 'race'
export type EventType = 'race' | 'competition' | 'vacation' | 'travel' | 'deload' | 'test' | 'milestone'
export type EventPriority = 'A' | 'B' | 'C'
export type ActivityType = 'cycling' | 'running' | 'swimming' | 'lifting' | 'soccer' | 'tennis' | 'skiing' | 'other' | 'rest'
export type BalanceRuleType = 'reduce_when' | 'increase_when' | 'substitute' | 'conflict'

// Phase display configuration
export const PHASE_COLORS: Record<PhaseType, string> = {
  base: 'bg-blue-500',
  build: 'bg-amber-500',
  peak: 'bg-red-500',
  taper: 'bg-purple-500',
  recovery: 'bg-green-500',
  transition: 'bg-gray-500',
}

export const PHASE_LABELS: Record<PhaseType, string> = {
  base: 'Base',
  build: 'Build',
  peak: 'Peak',
  taper: 'Taper',
  recovery: 'Recovery',
  transition: 'Transition',
}

export const EVENT_TYPE_ICONS: Record<EventType, string> = {
  race: '🏁',
  competition: '🏆',
  vacation: '🏖️',
  travel: '✈️',
  deload: '😴',
  test: '📊',
  milestone: '🎯',
}

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  cycling: 'Cycling',
  running: 'Running',
  swimming: 'Swimming',
  lifting: 'Lifting',
  soccer: 'Soccer',
  tennis: 'Tennis',
  skiing: 'Skiing',
  other: 'Other',
  rest: 'Rest',
}

// Database Row Types
export interface TrainingPlan {
  id: string
  user_id: string
  name: string
  description: string | null
  goal: PlanGoal | null
  start_date: string
  end_date: string | null  // null for rolling plans
  primary_sport: string | null
  weekly_hours_target: number | null
  status: PlanStatus
  ai_generated: boolean
  ai_prompt: string | null
  program_philosophy: string | null  // AI-generated program philosophy
  coaching_notes: string | null       // AI-generated coaching notes
  athlete_profile_snapshot: AthleteProfileSnapshot | null  // Athlete metrics at plan creation
  goal_pathway: GoalPathway | null                         // Goal projections
  recovery_protocols: RecoveryProtocols | null             // Recovery guidance
  exercise_substitutions: ExerciseSubstitutions | null     // Exercise alternatives
  created_at: string
  updated_at: string

  // Joined data (when fetched with relations)
  phases?: TrainingPhase[]
  events?: PlanEvent[]
  balance_rules?: ActivityBalanceRule[]
  suggested_workouts?: SuggestedWorkout[]
  assessments?: PlanAssessment[]
}

export interface TrainingPhase {
  id: string
  plan_id: string
  name: string
  phase_type: PhaseType
  order_index: number
  start_date: string
  end_date: string
  intensity_focus: IntensityFocus | null
  volume_modifier: number
  intensity_modifier: number
  activity_distribution: Record<ActivityType, number>
  description: string | null
  notes: string | null
  created_at: string
  updated_at: string

  // Computed
  duration_weeks?: number

  // Joined data
  weekly_targets?: WeeklyTarget[]
}

export interface WeeklyTarget {
  id: string
  phase_id: string
  week_number: number
  week_start_date: string
  target_hours: number | null
  target_tss: number | null
  cycling_hours: number
  running_hours: number
  swimming_hours: number
  lifting_sessions: number
  other_hours: number
  zone_distribution: Record<string, number>
  week_type: WeekType
  daily_structure: Record<string, string>
  notes: string | null
  created_at: string
  updated_at: string
}

export interface PlanEvent {
  id: string
  plan_id: string
  name: string
  event_type: EventType
  priority: EventPriority
  event_date: string
  end_date: string | null
  sport: ActivityType | null
  distance_miles: number | null
  elevation_ft: number | null
  expected_duration_hours: number | null
  taper_days: number
  recovery_days: number
  blocks_training: boolean
  notes: string | null
  location: string | null
  external_url: string | null
  created_at: string
  updated_at: string
}

export interface ActivityBalanceRule {
  id: string
  plan_id: string
  rule_type: BalanceRuleType
  trigger_activity: ActivityType
  trigger_phase: PhaseType | null
  affected_activity: ActivityType
  modifier: number
  description: string | null
  is_active: boolean
  created_at: string
}

// API Request/Response Types
export interface CreateTrainingPlanRequest {
  name: string
  description?: string
  goal?: PlanGoal
  start_date: string
  end_date?: string
  primary_sport?: string
  weekly_hours_target?: number
  phases?: CreateTrainingPhaseRequest[]
  events?: CreatePlanEventRequest[]
}

export interface CreateTrainingPhaseRequest {
  name: string
  phase_type: PhaseType
  order_index: number
  start_date: string
  end_date: string
  intensity_focus?: IntensityFocus
  volume_modifier?: number
  intensity_modifier?: number
  activity_distribution?: Record<ActivityType, number>
  description?: string
  notes?: string
  weekly_targets?: CreateWeeklyTargetRequest[]
}

export interface CreateWeeklyTargetRequest {
  week_number: number
  week_start_date: string
  target_hours?: number
  target_tss?: number
  cycling_hours?: number
  running_hours?: number
  swimming_hours?: number
  lifting_sessions?: number
  other_hours?: number
  zone_distribution?: Record<string, number>
  week_type?: WeekType
  daily_structure?: Record<string, string>
  notes?: string
}

export interface CreatePlanEventRequest {
  name: string
  event_type: EventType
  priority?: EventPriority
  event_date: string
  end_date?: string
  sport?: ActivityType
  distance_miles?: number
  elevation_ft?: number
  expected_duration_hours?: number
  taper_days?: number
  recovery_days?: number
  blocks_training?: boolean
  notes?: string
  location?: string
  external_url?: string
}

// AI Generation Types
export interface AIGeneratePlanRequest {
  goal: PlanGoal
  primary_activities: ActivityType[]
  weekly_hours_available: number
  start_date: string
  end_date?: string  // Optional for rolling plans

  // Galpin 9 Adaptations (optional, enhances goal specificity)
  primary_adaptation?: 'skill' | 'speed_power' | 'strength' | 'hypertrophy' | 'muscular_endurance' | 'anaerobic_capacity' | 'vo2max' | 'long_duration' | 'body_composition'
  secondary_adaptation?: 'skill' | 'speed_power' | 'strength' | 'hypertrophy' | 'muscular_endurance' | 'anaerobic_capacity' | 'vo2max' | 'long_duration' | 'body_composition'

  // Target events
  events: Array<{
    name: string
    date: string
    event_type: EventType
    priority: EventPriority
    sport?: ActivityType
  }>

  // Constraints
  preferences?: {
    preferred_deload_frequency?: number  // weeks between deloads
    vacation_dates?: Array<{ start: string; end: string; name?: string }>
    existing_commitments?: string  // free-form text about schedule constraints
    strength_priority?: 'maintain' | 'build' | 'peak'  // how to handle strength vs cardio
  }

  custom_prompt?: string
}

export interface AIGeneratePlanResponse {
  plan: {
    name: string
    description: string
    goal: PlanGoal
    start_date: string
    end_date: string | null
    primary_sport: string
    weekly_hours_target: number
  }
  phases: Array<{
    name: string
    phase_type: PhaseType
    order_index: number
    start_date: string
    end_date: string
    intensity_focus: IntensityFocus
    volume_modifier: number
    intensity_modifier: number
    activity_distribution: Record<ActivityType, number>
    description: string
  }>
  weekly_targets: Array<{
    phase_index: number  // Reference to phases array index
    targets: Array<{
      week_number: number
      week_start_date: string
      target_hours: number
      cycling_hours: number
      running_hours: number
      swimming_hours: number
      lifting_sessions: number
      other_hours: number
      zone_distribution: Record<string, number>
      week_type: WeekType
      daily_structure: Record<string, string>
    }>
  }>
  balance_rules: Array<{
    rule_type: BalanceRuleType
    trigger_activity: ActivityType
    trigger_phase: PhaseType | null
    affected_activity: ActivityType
    modifier: number
    description: string
  }>
  reasoning: string
  expert_consensus?: {
    attia_notes: string      // Peter Attia - Zone 2, metabolic health, longevity
    seiler_notes: string     // Stephen Seiler - Polarized training, 80/20 distribution
    galpin_notes: string     // Andy Galpin - Strength adaptation protocols
    nuckols_notes: string    // Greg Nuckols - Evidence-based strength programming
    adjustments_made: string // Summary of changes based on expert review
  }
}

// Hybrid response with narrative + structured data (Galpin persona)
export interface AIHybridPlanResponse {
  plan: TrainingPlan
  program_philosophy: string  // 2-3 paragraphs in Galpin's voice
  coaching_notes: string      // Key focus areas and warnings
}

// UI State Types
export interface PlanViewState {
  selectedPhaseId: string | null
  selectedWeekDate: string | null
  viewMode: 'timeline' | 'calendar' | 'list'
  expandedPhases: string[]
  showEvents: boolean
}

export interface WeeklyComplianceData {
  target_hours: number
  actual_hours: number
  hours_compliance: number
  target_tss: number
  actual_tss: number
  tss_compliance: number
}

// Current Week Target (from database function)
export interface CurrentWeekTarget {
  target_id: string
  plan_name: string
  phase_name: string
  phase_type: PhaseType
  week_type: WeekType
  target_hours: number | null
  target_tss: number | null
  cycling_hours: number
  running_hours: number
  swimming_hours: number
  lifting_sessions: number
  other_hours: number
  zone_distribution: Record<string, number>
  daily_structure: Record<string, string>
}

// Helper functions
export function calculatePhaseDurationWeeks(startDate: string, endDate: string): number {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const diffTime = Math.abs(end.getTime() - start.getTime())
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return Math.ceil(diffDays / 7)
}

export function getWeekStartDate(date: Date, weekStartDay: 'monday' | 'sunday' = 'monday'): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = weekStartDay === 'monday'
    ? (day === 0 ? -6 : 1 - day)
    : -day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

export function formatDateRange(startDate: string, endDate: string): string {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const startMonth = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const endMonth = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${startMonth} - ${endMonth}`
}

// ============================================================================
// SUGGESTED WORKOUTS - AI-generated workout templates
// ============================================================================

export type SuggestedWorkoutStatus = 'suggested' | 'scheduled' | 'skipped'
export type CardioStructureType = 'steady' | 'tempo' | 'intervals' | 'long'
export type PrimaryIntensity = 'z1' | 'z2' | 'z3' | 'z4' | 'z5' | 'hit' | 'mixed'

// Exercise definition for strength workouts
export interface SuggestedExercise {
  exercise_name: string
  exercise_id?: string  // Reference to exercises table
  sets: number
  reps_min: number
  reps_max: number
  rest_seconds: number
  superset_group?: string | null
  notes?: string
}

// Interval definition for cardio workouts
export interface CardioInterval {
  duration_minutes: number
  intensity: PrimaryIntensity
  repeats?: number  // For interval sets
}

// Cardio structure (intervals, tempo, steady, long)
export interface CardioStructure {
  type: CardioStructureType
  warmup_minutes: number
  main_set: CardioInterval[]
  cooldown_minutes: number
}

// Linked workout info from workouts table (for showing completion status)
export interface LinkedWorkoutInfo {
  id: string
  status: string
  completed_at: string | null
}

// Main suggested workout interface
export interface SuggestedWorkout {
  id: string
  plan_id: string
  phase_id: string | null

  // Scheduling
  suggested_date: string
  day_of_week: string

  // Workout details
  category: 'cardio' | 'strength' | 'other'
  workout_type: string  // 'bike', 'run', 'upper', 'lower', 'full_body', etc.
  name: string
  description: string | null

  // Duration and intensity
  planned_duration_minutes: number | null
  primary_intensity: PrimaryIntensity | null
  planned_tss: number | null

  // Content
  exercises: SuggestedExercise[] | null  // For strength
  cardio_structure: CardioStructure | null  // For cardio

  // Status
  status: SuggestedWorkoutStatus
  scheduled_workout_id: string | null  // Link to actual workout once scheduled
  linked_workout?: LinkedWorkoutInfo | null  // Joined workout data for completion status

  // Metadata
  week_number: number | null
  order_in_day: number

  created_at: string
  updated_at: string
}

// AI-generated suggested workout (before saving to DB)
export interface AISuggestedWorkout {
  phase_index: number
  week_number: number
  day_of_week: string
  suggested_date: string
  category: 'cardio' | 'strength' | 'other'
  workout_type: string
  name: string
  description: string
  planned_duration_minutes: number
  primary_intensity: PrimaryIntensity | null
  planned_tss?: number
  exercises?: SuggestedExercise[]
  cardio_structure?: CardioStructure
}

// Extended AI response with suggested workouts
export interface AIGeneratePlanResponseWithWorkouts extends AIGeneratePlanResponse {
  suggested_workouts: AISuggestedWorkout[]
}

// Request to generate workouts for specific weeks
export interface GenerateWorkoutsRequest {
  plan_id: string
  start_date: string
  end_date: string
  regenerate?: boolean  // If true, replace existing suggested workouts
}

// Schedule workout request
export interface ScheduleWorkoutRequest {
  suggested_workout_id: string
  scheduled_date?: string  // Override the suggested date
  scheduled_time?: string
}

// Bulk schedule request
export interface BulkScheduleRequest {
  suggested_workout_ids: string[]
  skip_existing?: boolean  // Skip if already scheduled on that date
}

// Cardio type labels for display
export const CARDIO_TYPE_LABELS: Record<CardioStructureType, string> = {
  steady: 'Steady State',
  tempo: 'Tempo',
  intervals: 'Intervals',
  long: 'Long Ride/Run',
}

// Intensity zone colors
export const INTENSITY_COLORS: Record<PrimaryIntensity, string> = {
  z1: 'bg-blue-400',
  z2: 'bg-green-400',
  z3: 'bg-yellow-400',
  z4: 'bg-orange-400',
  z5: 'bg-red-500',
  hit: 'bg-red-600',
  mixed: 'bg-purple-400',
}

// ============================================================================
// P0: ENHANCED WORKOUT DETAILS
// ============================================================================

// Warmup/cooldown exercise definition
export interface WarmupExercise {
  exercise_name: string
  duration_seconds?: number
  reps?: number
  notes?: string
}

// Load type for exercises
export type LoadType = 'percent_1rm' | 'rpe' | 'weight' | 'bodyweight'

// Enhanced exercise with load, tempo, and coaching cues
export interface EnhancedSuggestedExercise extends SuggestedExercise {
  load_type?: LoadType
  load_value?: number           // e.g., 75 = 75% 1RM or RPE 7 or 55 lbs
  calculated_weight_lbs?: number
  tempo?: string               // e.g., "3-1-2-0"
  coaching_cues?: string[]
}

// Extended suggested workout with warmup/cooldown
export interface EnhancedSuggestedWorkout extends Omit<SuggestedWorkout, 'exercises'> {
  warmup_exercises?: WarmupExercise[]
  exercises: EnhancedSuggestedExercise[] | null
  cooldown_exercises?: WarmupExercise[]
}

// ============================================================================
// P1: ATHLETE PROFILE & ASSESSMENTS
// ============================================================================

// Snapshot of athlete metrics at plan creation
export interface AthleteProfileSnapshot {
  age?: number
  weight_lbs?: number
  height_inches?: number
  vo2max?: number
  max_hr?: number
  resting_hr?: number
  squat_1rm?: number
  bench_1rm?: number
  deadlift_1rm?: number
  ohp_1rm?: number
  total_1rm?: number
  injury_notes?: string
  training_history?: string
}

// Goal breakdown for a specific metric
export interface GoalBreakdown {
  current: number
  target: number
  realistic_end?: number  // Realistic projection by end of plan
  gain?: number
}

// Goal pathway with projections
export interface GoalPathway {
  [goalName: string]: {
    current_total?: number
    target?: number
    realistic_end?: number
    breakdown?: Record<string, GoalBreakdown>
  } | GoalBreakdown
}

// Assessment test definition
export interface AssessmentTest {
  test_name: string
  protocol: string
  target_value?: string | number
}

// Assessment result entry
export interface AssessmentResult {
  test_name: string
  value: string | number
  notes?: string
  recorded_at?: string
}

// Plan assessment checkpoint
export interface PlanAssessment {
  id: string
  plan_id: string
  assessment_week: number
  assessment_date: string
  assessment_type: 'mid_phase' | 'end_phase' | 'deload' | 'final'
  tests: AssessmentTest[]
  results?: AssessmentResult[]
  completed: boolean
  notes?: string
  created_at: string
  updated_at: string
}

// AI-generated assessment (before saving to DB)
export interface AIAssessment {
  assessment_week: number
  assessment_type: 'mid_phase' | 'end_phase' | 'deload' | 'final'
  tests: AssessmentTest[]
}

// Training parameters for a phase
export interface TrainingParameters {
  sets_per_muscle_per_week?: string
  rep_range?: string
  intensity_percent?: string
  tempo?: string
  rest_seconds?: string
}

// ============================================================================
// P2: RECOVERY PROTOCOLS & SUBSTITUTIONS
// ============================================================================

// Sleep recovery protocol
export interface SleepProtocol {
  target_hours: number
  recommendations: string[]
}

// Nutrition protocol
export interface NutritionProtocol {
  protein_g_per_lb?: number
  carb_timing?: string
  recommendations: string[]
}

// Mobility protocol
export interface MobilityProtocol {
  daily_minutes?: number
  focus_areas?: string[]
  recommendations: string[]
}

// Pain management protocol for a specific area
export interface PainManagementProtocol {
  morning_routine?: string[]
  pre_workout?: string[]
  post_workout?: string[]
  avoid?: string[]
  modifications?: string[]
}

// Complete recovery protocols
export interface RecoveryProtocols {
  sleep?: SleepProtocol
  nutrition?: NutritionProtocol
  mobility?: MobilityProtocol
  pain_management?: Record<string, PainManagementProtocol>  // e.g., { "lower_back": {...}, "shoulder": {...} }
}

// Substitution reason type
export type SubstitutionReason = 'knee_pain' | 'back_pain' | 'shoulder_pain' | 'hip_pain' | 'equipment' | 'preference'

// Exercise substitution mapping
export interface ExerciseSubstitutions {
  [exerciseName: string]: {
    [reason in SubstitutionReason]?: string[]
  }
}

// ============================================================================
// EXTENDED TRAINING PLAN WITH NEW FIELDS
// ============================================================================

// Extended TrainingPhase with training parameters
export interface EnhancedTrainingPhase extends TrainingPhase {
  training_parameters?: TrainingParameters
}

// Extended AI-generated suggested workout
export interface AIEnhancedSuggestedWorkout extends AISuggestedWorkout {
  warmup_exercises?: WarmupExercise[]
  cooldown_exercises?: WarmupExercise[]
  exercises?: EnhancedSuggestedExercise[]
}

// Extended AI response with all enhancements
export interface AIEnhancedPlanResponse extends AIGeneratePlanResponse {
  program_philosophy: string
  coaching_notes: string
  athlete_profile_snapshot?: AthleteProfileSnapshot
  goal_pathway?: GoalPathway
  assessments?: AIAssessment[]
  recovery_protocols?: RecoveryProtocols
  exercise_substitutions?: ExerciseSubstitutions
  suggested_workouts: AIEnhancedSuggestedWorkout[]
  phases: Array<AIGeneratePlanResponse['phases'][0] & {
    training_parameters?: TrainingParameters
  }>
}
