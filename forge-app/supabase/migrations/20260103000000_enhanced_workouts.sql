-- Enhanced Workout Details Migration
-- Adds warmup/cooldown exercises and enhanced exercise metadata

-- Add warmup and cooldown columns to suggested_workouts
ALTER TABLE suggested_workouts
ADD COLUMN IF NOT EXISTS warmup_exercises JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS cooldown_exercises JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN suggested_workouts.warmup_exercises IS 'Array of warmup exercises with exercise_name, duration_seconds, reps, notes';
COMMENT ON COLUMN suggested_workouts.cooldown_exercises IS 'Array of cooldown/stretching exercises with exercise_name, duration_seconds, notes';

-- The exercises JSONB column already exists, but we're enhancing the schema to support:
-- - load_type: 'percent_1rm' | 'rpe' | 'weight' | 'bodyweight'
-- - load_value: number (e.g., 75 = 75% 1RM or RPE 7)
-- - tempo: string (e.g., "3-1-2-0")
-- - coaching_cues: string[] (array of cue strings)
-- No schema changes needed for JSONB, just document the expected structure

COMMENT ON COLUMN suggested_workouts.exercises IS 'Array of exercises with: exercise_name, sets, reps_min, reps_max, rest_seconds, superset_group, notes, load_type, load_value, tempo, coaching_cues';
