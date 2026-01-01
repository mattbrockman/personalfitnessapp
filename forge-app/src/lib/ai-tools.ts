// AI Tool Definitions for Claude Tool Use
import Anthropic from '@anthropic-ai/sdk'

export const AI_TOOLS: Anthropic.Tool[] = [
  // ============ WORKOUT MODIFICATION TOOLS ============
  {
    name: 'modify_workout_exercise',
    description: 'Modify or swap an exercise in a planned or suggested workout. Use for injury modifications, equipment substitutions, or user preference changes. This auto-executes without confirmation.',
    input_schema: {
      type: 'object' as const,
      properties: {
        workout_id: {
          type: 'string',
          description: 'ID of the workout (suggested_workout or workout) to modify',
        },
        original_exercise: {
          type: 'string',
          description: 'Exact name of the exercise to replace',
        },
        new_exercise: {
          type: 'string',
          description: 'Name of the replacement exercise',
        },
        reason: {
          type: 'string',
          description: 'Reason for the modification (e.g., "knee injury", "no barbell available")',
        },
        sets: {
          type: 'number',
          description: 'New number of sets (optional, keeps original if not specified)',
        },
        reps_min: {
          type: 'number',
          description: 'New minimum reps (optional)',
        },
        reps_max: {
          type: 'number',
          description: 'New maximum reps (optional)',
        },
        notes: {
          type: 'string',
          description: 'Additional notes for the modified exercise',
        },
      },
      required: ['workout_id', 'original_exercise', 'new_exercise', 'reason'],
    },
  },
  {
    name: 'reschedule_workout',
    description: 'Move a workout to a different date. REQUIRES USER CONFIRMATION before execution.',
    input_schema: {
      type: 'object' as const,
      properties: {
        workout_id: {
          type: 'string',
          description: 'ID of the workout to reschedule',
        },
        new_date: {
          type: 'string',
          description: 'New date in YYYY-MM-DD format',
        },
        reason: {
          type: 'string',
          description: 'Reason for rescheduling',
        },
      },
      required: ['workout_id', 'new_date', 'reason'],
    },
  },
  {
    name: 'skip_workout',
    description: 'Mark a planned workout as skipped. Use when user cannot or chooses not to do a workout. Auto-executes.',
    input_schema: {
      type: 'object' as const,
      properties: {
        workout_id: {
          type: 'string',
          description: 'ID of the workout to skip',
        },
        reason: {
          type: 'string',
          description: 'Reason for skipping (e.g., "illness", "travel", "rest day needed")',
        },
      },
      required: ['workout_id', 'reason'],
    },
  },
  {
    name: 'add_workout',
    description: 'Add a new workout to the schedule. This auto-executes. For STRENGTH workouts (category="strength"), include the exercises array with specific exercises, sets, and reps. For CARDIO workouts (bike, run, swim), include duration_minutes instead - no exercises needed.',
    input_schema: {
      type: 'object' as const,
      properties: {
        date: {
          type: 'string',
          description: 'Date for the workout in YYYY-MM-DD format',
        },
        category: {
          type: 'string',
          enum: ['strength', 'cardio', 'other'],
          description: 'Workout category: "strength" for lifting, "cardio" for endurance (bike/run/swim), "other" for flexibility/recovery',
        },
        workout_type: {
          type: 'string',
          description: 'Specific type. For strength: "upper", "lower", "full_body", "push", "pull". For cardio: "bike", "run", "swim". For other: "yoga", "stretch", "recovery"',
        },
        name: {
          type: 'string',
          description: 'Workout name (e.g., "Morning Run", "Upper Body Strength", "Zone 2 Bike")',
        },
        duration_minutes: {
          type: 'number',
          description: 'Planned duration in minutes - important for cardio workouts',
        },
        description: {
          type: 'string',
          description: 'Workout description or notes (e.g., "Easy recovery pace", "Focus on compound movements")',
        },
        exercises: {
          type: 'array',
          description: 'List of exercises - include for strength workouts only. Not needed for cardio.',
          items: {
            type: 'object',
            properties: {
              exercise_name: { type: 'string' },
              sets: { type: 'number' },
              reps_min: { type: 'number' },
              reps_max: { type: 'number' },
              rest_seconds: { type: 'number' },
              notes: { type: 'string' },
            },
            required: ['exercise_name', 'sets', 'reps_min', 'reps_max'],
          },
        },
      },
      required: ['date', 'category', 'workout_type', 'name'],
    },
  },

  // ============ DATA LOGGING TOOLS ============
  {
    name: 'log_sleep',
    description: 'Log sleep data for a specific date. Auto-executes. Use when user tells you about their sleep.',
    input_schema: {
      type: 'object' as const,
      properties: {
        log_date: {
          type: 'string',
          description: 'Date in YYYY-MM-DD format',
        },
        bedtime: {
          type: 'string',
          description: 'Bedtime in HH:MM format (24-hour)',
        },
        wake_time: {
          type: 'string',
          description: 'Wake time in HH:MM format (24-hour)',
        },
        total_sleep_minutes: {
          type: 'number',
          description: 'Total sleep duration in minutes',
        },
        sleep_score: {
          type: 'number',
          description: 'Sleep quality score 0-100',
        },
        hrv_avg: {
          type: 'number',
          description: 'Average HRV in milliseconds',
        },
        resting_hr: {
          type: 'number',
          description: 'Resting heart rate in BPM',
        },
        notes: {
          type: 'string',
          description: 'Additional notes about sleep',
        },
      },
      required: ['log_date'],
    },
  },
  {
    name: 'log_meal',
    description: 'Log a meal with nutrition information. Auto-executes. Use when user tells you what they ate.',
    input_schema: {
      type: 'object' as const,
      properties: {
        log_date: {
          type: 'string',
          description: 'Date in YYYY-MM-DD format',
        },
        meal_type: {
          type: 'string',
          enum: ['breakfast', 'lunch', 'dinner', 'snack'],
          description: 'Type of meal',
        },
        food_name: {
          type: 'string',
          description: 'Name of the food item',
        },
        serving_size: {
          type: 'string',
          description: 'Serving size (e.g., "1 cup", "200g")',
        },
        calories: {
          type: 'number',
          description: 'Calories',
        },
        protein_g: {
          type: 'number',
          description: 'Protein in grams',
        },
        carbs_g: {
          type: 'number',
          description: 'Carbohydrates in grams',
        },
        fat_g: {
          type: 'number',
          description: 'Fat in grams',
        },
        fiber_g: {
          type: 'number',
          description: 'Fiber in grams',
        },
      },
      required: ['log_date', 'meal_type', 'food_name'],
    },
  },
  {
    name: 'log_body_comp',
    description: 'Log body composition measurements. Auto-executes.',
    input_schema: {
      type: 'object' as const,
      properties: {
        log_date: {
          type: 'string',
          description: 'Date in YYYY-MM-DD format',
        },
        weight_lbs: {
          type: 'number',
          description: 'Weight in pounds',
        },
        body_fat_pct: {
          type: 'number',
          description: 'Body fat percentage',
        },
        lean_mass_lbs: {
          type: 'number',
          description: 'Lean mass in pounds',
        },
        muscle_mass_lbs: {
          type: 'number',
          description: 'Muscle mass in pounds',
        },
        source: {
          type: 'string',
          enum: ['manual', 'smart_scale', 'bioimpedance', 'dexa', 'bod_pod'],
          description: 'Measurement source',
        },
        notes: {
          type: 'string',
          description: 'Additional notes',
        },
      },
      required: ['log_date'],
    },
  },
  {
    name: 'log_readiness',
    description: 'Log a readiness assessment. Auto-executes. Use when user describes how they feel.',
    input_schema: {
      type: 'object' as const,
      properties: {
        date: {
          type: 'string',
          description: 'Date in YYYY-MM-DD format',
        },
        subjective_readiness: {
          type: 'number',
          description: 'Overall readiness 1-10 scale',
        },
        sleep_quality: {
          type: 'number',
          description: 'Sleep quality 1-10 scale',
        },
        sleep_hours: {
          type: 'number',
          description: 'Hours of sleep',
        },
        muscle_soreness: {
          type: 'number',
          description: 'Muscle soreness 1-10 (10 = very sore)',
        },
        stress_level: {
          type: 'number',
          description: 'Stress level 1-10 (10 = very stressed)',
        },
        notes: {
          type: 'string',
          description: 'Additional notes',
        },
      },
      required: ['date', 'subjective_readiness'],
    },
  },

  // ============ QUERY TOOLS ============
  {
    name: 'get_workout_details',
    description: 'Get full details of a specific workout including all exercises. Use to see what exercises are in a workout before modifying it.',
    input_schema: {
      type: 'object' as const,
      properties: {
        workout_id: {
          type: 'string',
          description: 'ID of the workout to retrieve',
        },
        date: {
          type: 'string',
          description: 'Alternative: find workouts by date (YYYY-MM-DD)',
        },
      },
    },
  },
  {
    name: 'find_exercise_alternatives',
    description: 'Find alternative exercises for a given exercise, optionally filtered by injury or equipment constraints.',
    input_schema: {
      type: 'object' as const,
      properties: {
        exercise_name: {
          type: 'string',
          description: 'Name of the exercise to find alternatives for',
        },
        constraint: {
          type: 'string',
          description: 'Constraint like "knee injury", "no barbell", "shoulder pain"',
        },
        muscle_group: {
          type: 'string',
          description: 'Target muscle group to maintain (e.g., "quads", "chest")',
        },
      },
      required: ['exercise_name'],
    },
  },
]

// Tools that require user confirmation before execution
// Note: add_workout auto-executes since it's non-destructive (user can delete if unwanted)
export const TOOLS_REQUIRING_CONFIRMATION = [
  'reschedule_workout',
  'delete_workout',
]

// Helper to check if tool requires confirmation
export function requiresConfirmation(toolName: string): boolean {
  return TOOLS_REQUIRING_CONFIRMATION.includes(toolName)
}
