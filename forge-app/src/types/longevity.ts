// Longevity Types - Peter Attia Features

// ============================================================================
// HEALTH METRICS
// ============================================================================

export type MetricType = 'vo2max' | 'grip_strength_left' | 'grip_strength_right' | 'rhr' | 'hrv'

export interface HealthMetric {
  id: string
  user_id: string
  metric_date: string
  metric_type: MetricType
  value: number
  unit: string
  source: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

// ============================================================================
// VO2MAX
// ============================================================================

export type VO2maxTestType =
  | 'cooper_12min'
  | 'rockport_walk'
  | '1.5_mile_run'
  | 'step_test'
  | 'lab'
  | 'strava_estimate'

export interface VO2maxTest {
  id: string
  user_id: string
  test_date: string
  test_type: VO2maxTestType
  distance_meters: number | null
  duration_seconds: number | null
  final_heart_rate: number | null
  recovery_heart_rate: number | null
  weight_kg: number | null
  age_at_test: number | null
  estimated_vo2max: number
  conditions: string | null
  temperature_f: number | null
  altitude_ft: number | null
  notes: string | null
  created_at: string
}

export type VO2maxCategory = 'very_poor' | 'poor' | 'fair' | 'good' | 'excellent' | 'superior'

export interface VO2maxPercentile {
  percentile: number
  category: VO2maxCategory
  fitnessAge: number
}

// Reference data for VO2max percentiles by age/sex
export const VO2MAX_PERCENTILES: Record<'male' | 'female', Record<string, Record<number, number>>> = {
  male: {
    '20-29': { 10: 33, 25: 38, 50: 44, 75: 51, 90: 56 },
    '30-39': { 10: 31, 25: 36, 50: 42, 75: 49, 90: 54 },
    '40-49': { 10: 28, 25: 33, 50: 39, 75: 45, 90: 51 },
    '50-59': { 10: 25, 25: 30, 50: 35, 75: 41, 90: 46 },
    '60-69': { 10: 22, 25: 26, 50: 31, 75: 37, 90: 42 },
    '70-79': { 10: 19, 25: 23, 50: 27, 75: 32, 90: 37 },
  },
  female: {
    '20-29': { 10: 28, 25: 33, 50: 39, 75: 45, 90: 50 },
    '30-39': { 10: 26, 25: 31, 50: 36, 75: 42, 90: 47 },
    '40-49': { 10: 24, 25: 28, 50: 33, 75: 39, 90: 44 },
    '50-59': { 10: 21, 25: 25, 50: 30, 75: 35, 90: 40 },
    '60-69': { 10: 18, 25: 22, 50: 26, 75: 31, 90: 36 },
    '70-79': { 10: 15, 25: 19, 50: 23, 75: 27, 90: 32 },
  },
}

// ============================================================================
// GRIP STRENGTH
// ============================================================================

export interface GripStrengthReading {
  left: number
  right: number
  date: string
  source: string
}

// Grip strength percentiles by age/sex (values in lbs)
export const GRIP_PERCENTILES: Record<'male' | 'female', Record<string, Record<number, number>>> = {
  male: {
    '20-29': { 10: 95, 25: 105, 50: 115, 75: 125, 90: 135 },
    '30-39': { 10: 93, 25: 103, 50: 113, 75: 123, 90: 133 },
    '40-49': { 10: 88, 25: 98, 50: 108, 75: 118, 90: 128 },
    '50-59': { 10: 80, 25: 90, 50: 100, 75: 110, 90: 120 },
    '60-69': { 10: 70, 25: 80, 50: 90, 75: 100, 90: 110 },
    '70-79': { 10: 60, 25: 70, 50: 80, 75: 90, 90: 100 },
  },
  female: {
    '20-29': { 10: 55, 25: 63, 50: 70, 75: 78, 90: 85 },
    '30-39': { 10: 53, 25: 61, 50: 68, 75: 76, 90: 83 },
    '40-49': { 10: 50, 25: 58, 50: 65, 75: 73, 90: 80 },
    '50-59': { 10: 45, 25: 53, 50: 60, 75: 68, 90: 75 },
    '60-69': { 10: 40, 25: 48, 50: 55, 75: 63, 90: 70 },
    '70-79': { 10: 35, 25: 43, 50: 50, 75: 58, 90: 65 },
  },
}

// ============================================================================
// BODY COMPOSITION
// ============================================================================

export type BodyCompSource = 'dexa' | 'bioimpedance' | 'smart_scale' | 'manual' | 'bod_pod'

export interface BodyCompositionLog {
  id: string
  user_id: string
  log_date: string

  // Core metrics
  weight_lbs: number | null
  body_fat_pct: number | null
  lean_mass_lbs: number | null

  // Extended metrics
  visceral_fat_rating: number | null
  bone_mass_lbs: number | null
  water_pct: number | null
  muscle_mass_lbs: number | null

  // DEXA regional data
  trunk_fat_pct: number | null
  arm_fat_pct: number | null
  leg_fat_pct: number | null
  android_fat_pct: number | null
  gynoid_fat_pct: number | null
  bone_mineral_density: number | null

  // Calculated
  ffmi: number | null
  almi: number | null

  source: BodyCompSource
  notes: string | null
  created_at: string
  updated_at: string
}

// ============================================================================
// CGM (Continuous Glucose Monitor)
// ============================================================================

export type MealContext =
  | 'fasting'
  | 'pre_meal'
  | 'post_meal_1hr'
  | 'post_meal_2hr'
  | 'exercise'
  | 'sleep'

export type CGMSource = 'levels' | 'dexcom' | 'libre' | 'manual'

export interface CGMReading {
  id: string
  user_id: string
  reading_time: string
  glucose_mg_dl: number
  source: CGMSource | null
  meal_context: MealContext | null
  nutrition_log_id: string | null
  notes: string | null
  created_at: string
}

export interface GlucoseStats {
  avgFasting: number | null
  avgOverall: number
  timeInRange: number // Percentage 70-140 mg/dL
  variability: number // Standard deviation
  highestReading: number
  lowestReading: number
}

// ============================================================================
// SUPPLEMENTS
// ============================================================================

export type SupplementFrequency = 'daily' | 'twice_daily' | 'weekly' | 'as_needed' | 'cycling'
export type TimeOfDay = 'morning' | 'evening' | 'with_meals' | 'before_bed' | 'empty_stomach'
export type SupplementCategory =
  | 'vitamin'
  | 'mineral'
  | 'amino_acid'
  | 'herb'
  | 'hormone'
  | 'prescription'
  | 'other'

export interface Supplement {
  id: string
  user_id: string
  name: string
  brand: string | null
  dosage: string | null
  dosage_unit: string | null
  frequency: SupplementFrequency
  time_of_day: TimeOfDay[]
  cycle_on_days: number | null
  cycle_off_days: number | null
  is_active: boolean
  start_date: string | null
  end_date: string | null
  category: SupplementCategory | null
  reason: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface SupplementLog {
  id: string
  user_id: string
  supplement_id: string
  log_date: string
  taken: boolean
  time_taken: string | null
  notes: string | null
  created_at: string
}

// ============================================================================
// CENTENARIAN DECATHLON
// ============================================================================

export type DecathlonCategory = 'strength' | 'cardio' | 'mobility' | 'balance' | 'functional' | 'cognitive'
export type GoalCategory = DecathlonCategory // Alias for convenience

export interface CentenarianGoal {
  id: string
  user_id: string
  goal_name: string
  description: string | null
  target_age: number
  category: DecathlonCategory
  current_ability: string | null
  current_score: number | null
  target_ability: string | null
  required_strength: string | null
  required_cardio: string | null
  required_mobility: string | null
  is_achieved: boolean
  achieved_date: string | null
  last_tested_date: string | null
  display_order: number
  created_at: string
  updated_at: string
}

// Default Centenarian Decathlon goals (Peter Attia's examples)
export const DEFAULT_CENTENARIAN_GOALS: Omit<CentenarianGoal, 'id' | 'user_id' | 'created_at' | 'updated_at'>[] = [
  {
    goal_name: 'Hike with Grandchildren',
    description: 'Hike 1.5 miles on a pointed trail with 1,000 feet of elevation gain',
    target_age: 100,
    category: 'cardio',
    current_ability: null,
    current_score: null,
    target_ability: 'Complete hike without stopping, maintaining conversation',
    required_strength: 'Strong legs and core for uphill climbing',
    required_cardio: 'VO2max sufficient for sustained uphill effort',
    required_mobility: 'Hip and ankle mobility for uneven terrain',
    is_achieved: false,
    achieved_date: null,
    last_tested_date: null,
    display_order: 1,
  },
  {
    goal_name: 'Get Off the Floor',
    description: 'Get up off the floor without using your hands',
    target_age: 100,
    category: 'mobility',
    current_ability: null,
    current_score: null,
    target_ability: 'Stand up from floor without any hand support',
    required_strength: 'Leg strength for single-leg push',
    required_cardio: null,
    required_mobility: 'Hip flexor and quad flexibility',
    is_achieved: false,
    achieved_date: null,
    last_tested_date: null,
    display_order: 2,
  },
  {
    goal_name: 'Pick Up a Child',
    description: 'Pick up a young child from the floor',
    target_age: 100,
    category: 'strength',
    current_ability: null,
    current_score: null,
    target_ability: 'Safely lift 30lbs from floor to chest height',
    required_strength: 'Deadlift and squat strength, grip strength',
    required_cardio: null,
    required_mobility: 'Hip hinge pattern, thoracic extension',
    is_achieved: false,
    achieved_date: null,
    last_tested_date: null,
    display_order: 3,
  },
  {
    goal_name: 'Carry Groceries',
    description: 'Carry two 5-lb bags of groceries for 5 blocks',
    target_age: 100,
    category: 'functional',
    current_ability: null,
    current_score: null,
    target_ability: 'Walk 5 blocks (~0.25 miles) with 10lbs total',
    required_strength: 'Grip endurance, shoulder stability',
    required_cardio: 'Basic walking endurance',
    required_mobility: null,
    is_achieved: false,
    achieved_date: null,
    last_tested_date: null,
    display_order: 4,
  },
  {
    goal_name: 'Overhead Bin',
    description: 'Put a carry-on bag in an overhead airplane bin',
    target_age: 100,
    category: 'strength',
    current_ability: null,
    current_score: null,
    target_ability: 'Lift 25lbs overhead from chest to 5.5 feet',
    required_strength: 'Overhead press strength, core stability',
    required_cardio: null,
    required_mobility: 'Full shoulder flexion, thoracic extension',
    is_achieved: false,
    achieved_date: null,
    last_tested_date: null,
    display_order: 5,
  },
  {
    goal_name: 'Single Leg Balance',
    description: 'Balance on one foot for 30 seconds with eyes closed',
    target_age: 100,
    category: 'balance',
    current_ability: null,
    current_score: null,
    target_ability: '30 seconds each leg, eyes closed',
    required_strength: 'Foot and ankle stability',
    required_cardio: null,
    required_mobility: 'Ankle mobility',
    is_achieved: false,
    achieved_date: null,
    last_tested_date: null,
    display_order: 6,
  },
  {
    goal_name: 'Climb Stairs',
    description: 'Climb 4 flights of stairs in under 3 minutes',
    target_age: 100,
    category: 'cardio',
    current_ability: null,
    current_score: null,
    target_ability: 'Complete 4 flights without excessive breathlessness',
    required_strength: 'Quad and glute strength',
    required_cardio: 'VO2max for repeated stepping',
    required_mobility: 'Knee and hip flexion',
    is_achieved: false,
    achieved_date: null,
    last_tested_date: null,
    display_order: 7,
  },
  {
    goal_name: 'Open a Jar',
    description: 'Open a sealed jar without assistance',
    target_age: 100,
    category: 'strength',
    current_ability: null,
    current_score: null,
    target_ability: 'Open standard sealed jars independently',
    required_strength: 'Grip strength, wrist strength',
    required_cardio: null,
    required_mobility: 'Wrist rotation',
    is_achieved: false,
    achieved_date: null,
    last_tested_date: null,
    display_order: 8,
  },
  {
    goal_name: 'Play with Grandchildren',
    description: 'Throw a ball back and forth with grandchildren',
    target_age: 100,
    category: 'functional',
    current_ability: null,
    current_score: null,
    target_ability: 'Throw and catch a ball for 10+ minutes',
    required_strength: 'Rotational core strength, shoulder stability',
    required_cardio: 'Light activity endurance',
    required_mobility: 'Shoulder external rotation, hip rotation',
    is_achieved: false,
    achieved_date: null,
    last_tested_date: null,
    display_order: 9,
  },
  {
    goal_name: 'Pull Yourself Up',
    description: 'Pull yourself out of a pool without using a ladder',
    target_age: 100,
    category: 'strength',
    current_ability: null,
    current_score: null,
    target_ability: 'Exit pool using arms to push up on edge',
    required_strength: 'Tricep and chest pressing strength, core',
    required_cardio: null,
    required_mobility: 'Shoulder extension',
    is_achieved: false,
    achieved_date: null,
    last_tested_date: null,
    display_order: 10,
  },
]

// ============================================================================
// MOVEMENT SCREEN
// ============================================================================

export interface MovementScreen {
  id: string
  user_id: string
  screen_date: string

  // FMS scores (0-3)
  deep_squat: number | null
  hurdle_step_left: number | null
  hurdle_step_right: number | null
  inline_lunge_left: number | null
  inline_lunge_right: number | null
  shoulder_mobility_left: number | null
  shoulder_mobility_right: number | null
  active_slr_left: number | null
  active_slr_right: number | null
  trunk_stability_pushup: number | null
  rotary_stability_left: number | null
  rotary_stability_right: number | null

  total_score: number | null

  // Balance tests (seconds)
  single_leg_stand_left_eyes_open: number | null
  single_leg_stand_right_eyes_open: number | null
  single_leg_stand_left_eyes_closed: number | null
  single_leg_stand_right_eyes_closed: number | null
  tandem_stance_seconds: number | null

  notes: string | null
  created_at: string
}

// ============================================================================
// MINIMUM EFFECTIVE DOSE
// ============================================================================

export interface MEDCompliance {
  cardio: {
    target_minutes: number
    actual_minutes: number
    met: boolean
  }
  strength: {
    target_sessions: number
    actual_sessions: number
    met: boolean
  }
  sleep: {
    target_hours: number
    avg_hours: number
    met: boolean
  }
  protein: {
    target_days: number
    days_met: number
    met: boolean
  }
  stability: {
    target_sessions: number
    actual_sessions: number
    met: boolean
  }
}

// ============================================================================
// LONGEVITY DASHBOARD SUMMARY
// ============================================================================

export interface LongevitySummary {
  vo2max: {
    current: number | null
    percentile: number | null
    category: VO2maxCategory | null
    trend: 'up' | 'down' | 'stable' | null
    lastTestDate: string | null
  }
  gripStrength: {
    left: number | null
    right: number | null
    percentile: number | null
    asymmetry: number | null // Percentage difference
    lastTestDate: string | null
  }
  bodyComp: {
    weight: number | null
    leanMass: number | null
    bodyFatPct: number | null
    leanMassTrend: 'up' | 'down' | 'stable' | null
    lastLogDate: string | null
  }
  glucose: {
    avgFasting: number | null
    timeInRange: number | null
    lastReadingDate: string | null
  }
  rhr: {
    current: number | null
    trend: 'up' | 'down' | 'stable' | null
  }
  movementScreen: {
    totalScore: number | null
    lastScreenDate: string | null
  }
  med: MEDCompliance
  decathlon: {
    goalsAchieved: number
    totalGoals: number
  }
}
