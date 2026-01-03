-- Add program_philosophy and coaching_notes to training_plans table
-- These store the AI-generated narrative content from Dr. Galpin persona

ALTER TABLE training_plans
ADD COLUMN IF NOT EXISTS program_philosophy TEXT,
ADD COLUMN IF NOT EXISTS coaching_notes TEXT;

COMMENT ON COLUMN training_plans.program_philosophy IS 'AI-generated program philosophy explaining the overall approach';
COMMENT ON COLUMN training_plans.coaching_notes IS 'AI-generated coaching notes with key focus areas and warnings';
