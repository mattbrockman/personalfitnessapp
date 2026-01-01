-- FORGE Exercise Library Expansion Migration
-- Adds columns and indexes for ExerciseDB integration and expert-based curation

-- Add ExerciseDB integration columns
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS external_id TEXT;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS external_source TEXT DEFAULT 'manual';
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS body_part TEXT;

-- Add expert curation columns (Galpin's 9 adaptations framework)
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS galpin_adaptations TEXT[];

-- Add quality tracking
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS quality_score INTEGER;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS import_date TIMESTAMPTZ;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS ai_enhanced BOOLEAN DEFAULT false;

-- Create indexes for new filtering capabilities
CREATE INDEX IF NOT EXISTS idx_exercises_external_id ON exercises(external_id);
CREATE INDEX IF NOT EXISTS idx_exercises_external_source ON exercises(external_source);
CREATE INDEX IF NOT EXISTS idx_exercises_body_part ON exercises(body_part);
CREATE INDEX IF NOT EXISTS idx_exercises_galpin_adaptations ON exercises USING GIN(galpin_adaptations);
CREATE INDEX IF NOT EXISTS idx_exercises_equipment ON exercises(equipment);
CREATE INDEX IF NOT EXISTS idx_exercises_difficulty ON exercises(difficulty);
CREATE INDEX IF NOT EXISTS idx_exercises_compound ON exercises(is_compound);
CREATE INDEX IF NOT EXISTS idx_exercises_ai_enhanced ON exercises(ai_enhanced);

-- Note: Full-text search index skipped (requires immutable functions)
-- Basic name index for searching
CREATE INDEX IF NOT EXISTS idx_exercises_name ON exercises(name);

-- Comment documenting the Galpin adaptations
COMMENT ON COLUMN exercises.galpin_adaptations IS 'Andy Galpin 9 adaptations: strength, hypertrophy, power, speed, muscular_endurance, anaerobic_capacity, vo2max, long_duration, flexibility';
