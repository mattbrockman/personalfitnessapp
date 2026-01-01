// AI Tool Types for Claude Tool Use

export type ToolName =
  | 'modify_workout_exercise'
  | 'adjust_workout_volume'
  | 'reschedule_workout'
  | 'skip_workout'
  | 'delete_workout'
  | 'add_workout'
  | 'log_sleep'
  | 'log_meal'
  | 'log_body_comp'
  | 'log_readiness'
  | 'get_workout_details'
  | 'find_exercise_alternatives'

// Tool input types
export interface ModifyWorkoutExerciseInput {
  workout_id: string
  original_exercise: string
  new_exercise: string
  reason: string
  sets?: number
  reps_min?: number
  reps_max?: number
  notes?: string
}

export interface RescheduleWorkoutInput {
  workout_id: string
  new_date: string // YYYY-MM-DD
  reason: string
}

export interface SkipWorkoutInput {
  workout_id: string
  reason: string
}

export interface AddWorkoutInput {
  date: string // YYYY-MM-DD
  category: 'strength' | 'cardio' | 'other'
  workout_type: string
  name: string
  duration_minutes?: number
  description?: string
  exercises: {
    exercise_name: string
    sets: number
    reps_min: number
    reps_max: number
    rest_seconds?: number
    notes?: string
  }[]
}

export interface LogSleepInput {
  log_date: string // YYYY-MM-DD
  bedtime?: string // HH:MM
  wake_time?: string // HH:MM
  total_sleep_minutes?: number
  sleep_score?: number
  hrv_avg?: number
  resting_hr?: number
  notes?: string
}

export interface LogMealInput {
  log_date: string // YYYY-MM-DD
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  food_name: string
  serving_size?: string
  calories?: number
  protein_g?: number
  carbs_g?: number
  fat_g?: number
  fiber_g?: number
}

export interface LogBodyCompInput {
  log_date: string // YYYY-MM-DD
  weight_lbs?: number
  body_fat_pct?: number
  lean_mass_lbs?: number
  muscle_mass_lbs?: number
  source?: 'manual' | 'smart_scale' | 'bioimpedance' | 'dexa' | 'bod_pod'
  notes?: string
}

export interface LogReadinessInput {
  date: string // YYYY-MM-DD
  subjective_readiness: number // 1-10
  sleep_quality?: number // 1-10
  sleep_hours?: number
  muscle_soreness?: number // 1-10
  stress_level?: number // 1-10
  notes?: string
}

export interface GetWorkoutDetailsInput {
  workout_id?: string
  date?: string // YYYY-MM-DD - find workout by date
}

export interface FindExerciseAlternativesInput {
  exercise_name: string
  constraint?: string // e.g., "knee injury", "no barbell"
  muscle_group?: string
}

// Union type of all inputs
export type ToolInput =
  | ModifyWorkoutExerciseInput
  | RescheduleWorkoutInput
  | SkipWorkoutInput
  | AddWorkoutInput
  | LogSleepInput
  | LogMealInput
  | LogBodyCompInput
  | LogReadinessInput
  | GetWorkoutDetailsInput
  | FindExerciseAlternativesInput

// Tool execution result
export interface ToolResult {
  success: boolean
  message: string
  data?: any
  error?: string
}

// Pending action for confirmation UI
export interface PendingAction {
  id: string
  tool_name: ToolName
  tool_input: ToolInput
  description: string
  created_at: string
}

// Chat response with potential tool calls
export interface AIToolCall {
  id: string
  name: ToolName
  input: ToolInput
}

export interface AIChatResponse {
  response: string
  message_id?: string
  tool_calls?: AIToolCall[]
  pending_confirmation?: PendingAction
  executed_tools?: {
    name: ToolName
    result: ToolResult
  }[]
}

// Tools that require user confirmation
export const TOOLS_REQUIRING_CONFIRMATION: ToolName[] = [
  'reschedule_workout',
  'delete_workout',
]
