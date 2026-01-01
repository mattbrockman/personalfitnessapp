-- Migration: Enhanced Full-Text Search with Trigram Similarity
-- Enables fuzzy search like "rdl" -> "Romanian Deadlift"

BEGIN;

-- Step 0: Ensure required columns exist
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS primary_muscle TEXT;
CREATE INDEX IF NOT EXISTS idx_exercises_primary_muscle ON exercises(primary_muscle);

-- Step 1: Enable pg_trgm extension for fuzzy matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Step 2: Create trigram index for fuzzy name matching
CREATE INDEX IF NOT EXISTS exercises_name_trgm_idx ON exercises
  USING gin(name gin_trgm_ops);

-- Step 3: Drop old FTS index and create simpler version
-- Using name only for the GIN index (simpler and immutable)
DROP INDEX IF EXISTS exercises_search_idx;

CREATE INDEX exercises_search_idx ON exercises
  USING gin(to_tsvector('english', COALESCE(name, '')));

-- Step 4: Create search function that handles common abbreviations
CREATE OR REPLACE FUNCTION search_exercises(
  search_term TEXT,
  muscle_filter TEXT DEFAULT NULL,
  equipment_filter TEXT DEFAULT NULL,
  result_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  primary_muscle TEXT,
  secondary_muscles TEXT[],
  equipment TEXT,
  difficulty TEXT,
  instructions TEXT,
  coaching_cues TEXT[],
  common_mistakes TEXT[],
  is_compound BOOLEAN,
  is_unilateral BOOLEAN,
  is_timed BOOLEAN,
  video_url TEXT,
  thumbnail_url TEXT,
  body_part TEXT,
  galpin_adaptations TEXT[],
  external_source TEXT,
  rank REAL
)
LANGUAGE plpgsql
AS $$
DECLARE
  expanded_term TEXT;
  search_query tsquery;
BEGIN
  -- Expand common fitness abbreviations
  expanded_term := search_term;

  -- Romanian Deadlift abbreviations
  expanded_term := REGEXP_REPLACE(expanded_term, '\mrdl\M', 'romanian deadlift', 'gi');
  expanded_term := REGEXP_REPLACE(expanded_term, '\msldl\M', 'stiff leg deadlift', 'gi');

  -- Press abbreviations
  expanded_term := REGEXP_REPLACE(expanded_term, '\mohp\M', 'overhead press', 'gi');
  expanded_term := REGEXP_REPLACE(expanded_term, '\mbp\M', 'bench press', 'gi');

  -- Equipment abbreviations
  expanded_term := REGEXP_REPLACE(expanded_term, '\mbb\M', 'barbell', 'gi');
  expanded_term := REGEXP_REPLACE(expanded_term, '\mdb\M', 'dumbbell', 'gi');
  expanded_term := REGEXP_REPLACE(expanded_term, '\mkb\M', 'kettlebell', 'gi');

  -- Row abbreviations
  expanded_term := REGEXP_REPLACE(expanded_term, '\mbor\M', 'bent over row', 'gi');

  -- Create tsquery for full-text search
  search_query := plainto_tsquery('english', expanded_term);

  RETURN QUERY
  SELECT
    e.id,
    e.name,
    e.description,
    e.primary_muscle,
    e.secondary_muscles,
    e.equipment,
    e.difficulty,
    e.instructions,
    e.coaching_cues,
    e.common_mistakes,
    e.is_compound,
    e.is_unilateral,
    e.is_timed,
    e.video_url,
    e.thumbnail_url,
    e.body_part,
    e.galpin_adaptations,
    e.external_source,
    -- Combine FTS rank with trigram similarity for best results
    (
      COALESCE(ts_rank(
        to_tsvector('english', COALESCE(e.name, '')),
        search_query
      ), 0) * 2 +
      COALESCE(similarity(e.name, expanded_term), 0)
    )::REAL as rank
  FROM exercises e
  WHERE
    -- FTS match on name
    to_tsvector('english', COALESCE(e.name, '')) @@ search_query
    OR
    -- Trigram similarity match (fuzzy)
    similarity(e.name, expanded_term) > 0.15
    OR
    -- Also match on exact original search term
    e.name ILIKE '%' || search_term || '%'
  -- Optional filters
  AND (muscle_filter IS NULL OR e.primary_muscle = muscle_filter)
  AND (equipment_filter IS NULL OR e.equipment = equipment_filter)
  ORDER BY rank DESC
  LIMIT result_limit;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION search_exercises(TEXT, TEXT, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION search_exercises(TEXT, TEXT, TEXT, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION search_exercises(TEXT, TEXT, TEXT, INTEGER) TO service_role;

COMMIT;
