-- Migration: Add time-based exercise support
-- Adds is_timed flag to exercises and duration columns to exercise_sets

BEGIN;

-- Step 1: Add is_timed column to exercises table
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS is_timed BOOLEAN DEFAULT false;

-- Step 2: Add duration columns to exercise_sets table
ALTER TABLE exercise_sets ADD COLUMN IF NOT EXISTS is_timed BOOLEAN DEFAULT false;
ALTER TABLE exercise_sets ADD COLUMN IF NOT EXISTS target_duration_seconds INTEGER;
ALTER TABLE exercise_sets ADD COLUMN IF NOT EXISTS actual_duration_seconds INTEGER;

-- Step 3: Mark known timed exercises
-- Planks
UPDATE exercises SET is_timed = true WHERE LOWER(name) LIKE '%plank%';

-- Wall exercises
UPDATE exercises SET is_timed = true WHERE LOWER(name) LIKE '%wall sit%';
UPDATE exercises SET is_timed = true WHERE LOWER(name) LIKE '%wall hold%';

-- Hanging exercises
UPDATE exercises SET is_timed = true WHERE LOWER(name) LIKE '%dead hang%';
UPDATE exercises SET is_timed = true WHERE LOWER(name) LIKE '%hang%hold%';
UPDATE exercises SET is_timed = true WHERE LOWER(name) = 'hang';

-- Gymnastics holds
UPDATE exercises SET is_timed = true WHERE LOWER(name) LIKE '%l-sit%';
UPDATE exercises SET is_timed = true WHERE LOWER(name) LIKE '%l sit%';
UPDATE exercises SET is_timed = true WHERE LOWER(name) LIKE '%hollow hold%';
UPDATE exercises SET is_timed = true WHERE LOWER(name) LIKE '%hollow body%';
UPDATE exercises SET is_timed = true WHERE LOWER(name) LIKE '%superman hold%';
UPDATE exercises SET is_timed = true WHERE LOWER(name) LIKE '%arch hold%';
UPDATE exercises SET is_timed = true WHERE LOWER(name) LIKE '%handstand%hold%';
UPDATE exercises SET is_timed = true WHERE LOWER(name) LIKE '%handstand%';

-- Isometric exercises
UPDATE exercises SET is_timed = true WHERE LOWER(name) LIKE '%isometric%';
UPDATE exercises SET is_timed = true WHERE LOWER(name) LIKE '%iso hold%';
UPDATE exercises SET is_timed = true WHERE LOWER(name) LIKE '%static hold%';
UPDATE exercises SET is_timed = true WHERE LOWER(name) LIKE '%pause%hold%';

-- Carries (typically timed or distance-based)
UPDATE exercises SET is_timed = true WHERE LOWER(name) LIKE '%farmer%walk%';
UPDATE exercises SET is_timed = true WHERE LOWER(name) LIKE '%farmer%carry%';
UPDATE exercises SET is_timed = true WHERE LOWER(name) LIKE '%suitcase carry%';
UPDATE exercises SET is_timed = true WHERE LOWER(name) LIKE '%waiter%carry%';
UPDATE exercises SET is_timed = true WHERE LOWER(name) LIKE '%overhead carry%';

-- Specific exercises
UPDATE exercises SET is_timed = true WHERE LOWER(name) = 'wall sit';
UPDATE exercises SET is_timed = true WHERE LOWER(name) = 'dead hang';
UPDATE exercises SET is_timed = true WHERE LOWER(name) = 'plank';
UPDATE exercises SET is_timed = true WHERE LOWER(name) = 'side plank';

-- Step 4: Create index for filtering timed exercises
CREATE INDEX IF NOT EXISTS idx_exercises_is_timed ON exercises(is_timed) WHERE is_timed = true;

-- Step 5: Log results
DO $$
DECLARE
  timed_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO timed_count FROM exercises WHERE is_timed = true;
  RAISE NOTICE 'Marked % exercises as timed', timed_count;
END $$;

COMMIT;
