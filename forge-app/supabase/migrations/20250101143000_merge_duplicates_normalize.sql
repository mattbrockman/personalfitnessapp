-- Migration: Merge duplicate exercises and normalize names to Title Case
-- Run this migration to clean up duplicate exercises and standardize naming

BEGIN;

-- Step 1: Normalize all exercise names to Title Case
-- This ensures consistent capitalization across all exercises
UPDATE exercises
SET name = INITCAP(name)
WHERE name != INITCAP(name);

-- Step 2: Create temp table to identify duplicates
-- Duplicates are exercises with same normalized name AND same equipment
CREATE TEMP TABLE duplicate_groups AS
WITH normalized_exercises AS (
  SELECT
    id,
    name,
    equipment,
    external_source,
    description,
    coaching_cues,
    video_url,
    -- Calculate quality score: manual seed data is higher quality
    (CASE WHEN external_source = 'manual' OR external_source IS NULL THEN 10 ELSE 0 END +
     CASE WHEN description IS NOT NULL AND description != '' THEN 3 ELSE 0 END +
     CASE WHEN coaching_cues IS NOT NULL AND array_length(coaching_cues, 1) > 0 THEN 3 ELSE 0 END +
     CASE WHEN video_url IS NOT NULL THEN 2 ELSE 0 END) as quality_score,
    -- Normalize name: lowercase, remove version suffixes like "v. 2", "v. 3"
    LOWER(TRIM(REGEXP_REPLACE(name, '\s+v\.\s*\d+$', '', 'i'))) as normalized_name
  FROM exercises
),
ranked AS (
  SELECT
    *,
    ROW_NUMBER() OVER (
      PARTITION BY normalized_name, equipment
      ORDER BY quality_score DESC, id
    ) as rank
  FROM normalized_exercises
)
SELECT
  r1.id as keep_id,
  r1.name as keep_name,
  r2.id as delete_id,
  r2.name as delete_name,
  r1.equipment
FROM ranked r1
JOIN ranked r2 ON r1.normalized_name = r2.normalized_name
  AND COALESCE(r1.equipment, '') = COALESCE(r2.equipment, '')
  AND r1.rank = 1
  AND r2.rank > 1;

-- Step 3: Log what will be merged (for review)
DO $$
DECLARE
  merge_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO merge_count FROM duplicate_groups;
  RAISE NOTICE 'Found % duplicate exercises to merge', merge_count;
END $$;

-- Step 4: Update workout_exercises to point to the kept exercise
UPDATE workout_exercises we
SET exercise_id = dg.keep_id
FROM duplicate_groups dg
WHERE we.exercise_id = dg.delete_id;

-- Step 5: Update user_exercise_settings to point to kept exercise
-- (if the table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_exercise_settings') THEN
    UPDATE user_exercise_settings ues
    SET exercise_id = dg.keep_id
    FROM duplicate_groups dg
    WHERE ues.exercise_id = dg.delete_id;
  END IF;
END $$;

-- Step 6: Delete the duplicate exercises
DELETE FROM exercises
WHERE id IN (SELECT delete_id FROM duplicate_groups);

-- Step 7: Clean up exercises with version suffixes in names
-- "Barbell Upright Row V. 2" -> "Barbell Upright Row"
UPDATE exercises
SET name = TRIM(REGEXP_REPLACE(name, '\s+V\.\s*\d+$', '', 'i'))
WHERE name ~ '\s+V\.\s*\d+$';

-- Step 8: Final count
DO $$
DECLARE
  final_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO final_count FROM exercises;
  RAISE NOTICE 'Final exercise count: %', final_count;
END $$;

COMMIT;
