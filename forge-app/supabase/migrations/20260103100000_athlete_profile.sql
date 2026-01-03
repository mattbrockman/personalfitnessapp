-- Athlete Profile, Goal Pathway, and Assessments Migration
-- Adds comprehensive athlete tracking for AI-generated plans

-- Add athlete profile and goal pathway to training_plans
ALTER TABLE training_plans
ADD COLUMN IF NOT EXISTS athlete_profile_snapshot JSONB,
ADD COLUMN IF NOT EXISTS goal_pathway JSONB;

COMMENT ON COLUMN training_plans.athlete_profile_snapshot IS 'Snapshot of athlete metrics at plan creation: age, weight, height, vo2max, max_hr, 1RMs, injury_notes';
COMMENT ON COLUMN training_plans.goal_pathway IS 'Goal projections with current, target, and realistic estimates for each metric';

-- Create plan_assessments table for scheduled checkpoints
CREATE TABLE IF NOT EXISTS plan_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES training_plans(id) ON DELETE CASCADE,
  assessment_week INTEGER NOT NULL,
  assessment_date DATE NOT NULL,
  assessment_type TEXT NOT NULL CHECK (assessment_type IN ('mid_phase', 'end_phase', 'deload', 'final')),
  tests JSONB NOT NULL DEFAULT '[]'::jsonb,
  results JSONB,
  completed BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_plan_assessments_plan_id ON plan_assessments(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_assessments_date ON plan_assessments(assessment_date);

COMMENT ON TABLE plan_assessments IS 'Scheduled assessment checkpoints for training plans (weeks 4, 8, 12, 16 etc)';
COMMENT ON COLUMN plan_assessments.tests IS 'Array of tests: test_name, protocol, target_value';
COMMENT ON COLUMN plan_assessments.results IS 'Recorded results after assessment completion';
