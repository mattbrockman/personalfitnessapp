-- Recovery Protocols and Exercise Substitutions Migration
-- Adds personalized recovery guidance and exercise alternatives

-- Add recovery protocols and exercise substitutions to training_plans
ALTER TABLE training_plans
ADD COLUMN IF NOT EXISTS recovery_protocols JSONB,
ADD COLUMN IF NOT EXISTS exercise_substitutions JSONB;

COMMENT ON COLUMN training_plans.recovery_protocols IS 'Personalized recovery guidance: sleep, nutrition, mobility, pain_management sections';
COMMENT ON COLUMN training_plans.exercise_substitutions IS 'Exercise alternatives mapped by exercise name to substitution categories (knee_pain, back_pain, equipment, etc)';
