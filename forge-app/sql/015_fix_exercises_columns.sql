-- Migration to add missing columns to exercises table
-- The seed_exercises.sql file uses different column names than the original schema

-- Add primary_muscle column (singular TEXT) for seed file compatibility
-- The API already handles both primary_muscle (singular) and primary_muscles (array)
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS primary_muscle TEXT;

-- Add cues column as alias for coaching_cues
-- The API already handles both cues and coaching_cues
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS cues TEXT[];

-- Create index on primary_muscle for filtering
CREATE INDEX IF NOT EXISTS idx_exercises_primary_muscle ON exercises(primary_muscle);

-- Note: After running this migration, you can re-run seed_exercises.sql to populate the exercises
