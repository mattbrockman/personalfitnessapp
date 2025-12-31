-- ============================================================================
-- SUGGESTED WORKOUTS SCHEMA
-- AI-generated workout templates within training plans
-- ============================================================================

CREATE TABLE IF NOT EXISTS suggested_workouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES training_plans(id) ON DELETE CASCADE,
  phase_id UUID REFERENCES training_phases(id) ON DELETE SET NULL,

  -- Scheduling
  suggested_date DATE NOT NULL,
  day_of_week TEXT,  -- 'monday', 'tuesday', etc.

  -- Workout details (same structure as workouts table)
  category TEXT NOT NULL,  -- 'cardio', 'strength', 'other'
  workout_type TEXT NOT NULL,  -- 'bike', 'run', 'upper', 'lower', 'full_body'
  name TEXT NOT NULL,
  description TEXT,

  -- Duration and intensity
  planned_duration_minutes INTEGER,
  primary_intensity TEXT,  -- 'z1', 'z2', 'z3', 'z4', 'z5', 'hit', 'mixed'
  planned_tss INTEGER,

  -- For strength workouts: exercises as JSONB
  -- Format: [{ "exercise_name": "Squat", "sets": 4, "reps_min": 6, "reps_max": 8, "rest_seconds": 180, "notes": "" }]
  exercises JSONB,

  -- For cardio workouts: structured intervals
  -- Format: { "type": "intervals", "warmup_minutes": 10, "main_set": [...], "cooldown_minutes": 10 }
  cardio_structure JSONB,

  -- Status tracking
  status TEXT DEFAULT 'suggested',  -- 'suggested', 'scheduled', 'skipped'
  scheduled_workout_id UUID REFERENCES workouts(id) ON DELETE SET NULL,

  -- Metadata
  week_number INTEGER,
  order_in_day INTEGER DEFAULT 0,  -- for multiple workouts per day

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE suggested_workouts ENABLE ROW LEVEL SECURITY;

-- RLS policy: users can manage suggested workouts in their own plans
CREATE POLICY "Users can manage suggested workouts in own plans" ON suggested_workouts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM training_plans
      WHERE training_plans.id = suggested_workouts.plan_id
      AND training_plans.user_id = auth.uid()
    )
  );

-- Indexes for efficient queries
CREATE INDEX idx_suggested_workouts_plan ON suggested_workouts(plan_id);
CREATE INDEX idx_suggested_workouts_date ON suggested_workouts(plan_id, suggested_date);
CREATE INDEX idx_suggested_workouts_phase ON suggested_workouts(phase_id);
CREATE INDEX idx_suggested_workouts_status ON suggested_workouts(plan_id, status);
CREATE INDEX idx_suggested_workouts_week ON suggested_workouts(plan_id, week_number);

-- Comments
COMMENT ON TABLE suggested_workouts IS 'AI-generated workout templates within training plans';
COMMENT ON COLUMN suggested_workouts.exercises IS 'JSONB array of exercises with sets/reps for strength workouts';
COMMENT ON COLUMN suggested_workouts.cardio_structure IS 'JSONB interval structure for cardio workouts';
COMMENT ON COLUMN suggested_workouts.status IS 'suggested=not yet scheduled, scheduled=created as workout, skipped=user skipped';
