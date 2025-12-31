-- ============================================================================
-- TRAINING PLANS SCHEMA
-- Long-term periodization for multi-sport training
-- ============================================================================

-- ============================================================================
-- TRAINING PLANS (top-level plan container)
-- ============================================================================
CREATE TABLE IF NOT EXISTS training_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  description TEXT,
  goal TEXT,                              -- 'strength', 'endurance', 'weight_loss', 'general_fitness', 'event_prep'

  -- Timeline (flexible/rolling - end_date can be NULL for open-ended plans)
  start_date DATE NOT NULL,
  end_date DATE,                          -- NULL for rolling/indefinite plans

  -- Plan configuration
  primary_sport TEXT,                     -- 'cycling', 'running', 'lifting', 'triathlon', 'multi_sport'
  weekly_hours_target DECIMAL(4,1),       -- Target training hours per week

  -- Status
  status TEXT DEFAULT 'active',           -- 'draft', 'active', 'completed', 'archived'

  -- AI generation metadata
  ai_generated BOOLEAN DEFAULT FALSE,
  ai_prompt TEXT,                         -- Original prompt used to generate

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE training_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own training plans" ON training_plans
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_training_plans_user_status ON training_plans(user_id, status);
CREATE INDEX idx_training_plans_dates ON training_plans(user_id, start_date, end_date);

-- ============================================================================
-- TRAINING PHASES (macrocycle-level blocks: base, build, peak, recovery, taper)
-- ============================================================================
CREATE TABLE IF NOT EXISTS training_phases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES training_plans(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  phase_type TEXT NOT NULL,               -- 'base', 'build', 'peak', 'taper', 'recovery', 'transition'
  order_index INTEGER NOT NULL,           -- Order within the plan

  -- Timeline
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,

  -- Training parameters
  intensity_focus TEXT,                   -- 'volume', 'intensity', 'speed', 'strength', 'recovery'
  volume_modifier DECIMAL(3,2) DEFAULT 1.0,  -- 0.5 = 50% volume, 1.2 = 120% volume
  intensity_modifier DECIMAL(3,2) DEFAULT 1.0,

  -- Sport-specific emphasis (percentages, should sum to 100)
  activity_distribution JSONB DEFAULT '{}',  -- {"cycling": 40, "lifting": 30, "running": 20, "rest": 10}

  description TEXT,
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE training_phases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage training phases" ON training_phases
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM training_plans
      WHERE training_plans.id = training_phases.plan_id
      AND training_plans.user_id = auth.uid()
    )
  );

CREATE INDEX idx_training_phases_plan ON training_phases(plan_id, order_index);
CREATE INDEX idx_training_phases_dates ON training_phases(plan_id, start_date, end_date);

-- ============================================================================
-- WEEKLY TARGETS (mesocycle-level: specific week targets)
-- ============================================================================
CREATE TABLE IF NOT EXISTS weekly_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id UUID NOT NULL REFERENCES training_phases(id) ON DELETE CASCADE,

  week_number INTEGER NOT NULL,           -- Week within the phase (1, 2, 3, etc.)
  week_start_date DATE NOT NULL,

  -- Volume targets
  target_hours DECIMAL(4,1),
  target_tss INTEGER,

  -- Activity-specific targets
  cycling_hours DECIMAL(4,1) DEFAULT 0,
  running_hours DECIMAL(4,1) DEFAULT 0,
  swimming_hours DECIMAL(4,1) DEFAULT 0,
  lifting_sessions INTEGER DEFAULT 0,
  other_hours DECIMAL(4,1) DEFAULT 0,

  -- Intensity distribution (percentages)
  zone_distribution JSONB DEFAULT '{}',   -- {"z1": 20, "z2": 50, "z3": 20, "z4": 10}

  -- Week type
  week_type TEXT DEFAULT 'normal',        -- 'normal', 'build', 'recovery', 'deload', 'test', 'race'

  -- Suggested workout types for each day (template)
  daily_structure JSONB DEFAULT '{}',     -- {"monday": "strength", "tuesday": "cycling_z2", ...}

  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(phase_id, week_number)
);

ALTER TABLE weekly_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage weekly targets" ON weekly_targets
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM training_phases tp
      JOIN training_plans p ON p.id = tp.plan_id
      WHERE tp.id = weekly_targets.phase_id
      AND p.user_id = auth.uid()
    )
  );

CREATE INDEX idx_weekly_targets_phase ON weekly_targets(phase_id, week_number);
CREATE INDEX idx_weekly_targets_date ON weekly_targets(week_start_date);

-- ============================================================================
-- PLAN EVENTS (races, competitions, vacations, key dates)
-- ============================================================================
CREATE TABLE IF NOT EXISTS plan_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES training_plans(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  event_type TEXT NOT NULL,               -- 'race', 'competition', 'vacation', 'travel', 'deload', 'test', 'milestone'
  priority TEXT DEFAULT 'B',              -- 'A' (peak for this), 'B' (important), 'C' (low priority)

  -- Timing
  event_date DATE NOT NULL,
  end_date DATE,                          -- For multi-day events like vacations

  -- Event details
  sport TEXT,                             -- 'cycling', 'running', 'triathlon', 'lifting', 'soccer', 'tennis', 'skiing'
  distance_miles DECIMAL(10,2),
  elevation_ft INTEGER,
  expected_duration_hours DECIMAL(4,1),

  -- Impact on training
  taper_days INTEGER DEFAULT 0,           -- Days of reduced volume before event
  recovery_days INTEGER DEFAULT 0,        -- Days of recovery after event
  blocks_training BOOLEAN DEFAULT FALSE,  -- True for vacations that prevent training

  notes TEXT,
  location TEXT,
  external_url TEXT,                      -- Link to race registration, etc.

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE plan_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage plan events" ON plan_events
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM training_plans
      WHERE training_plans.id = plan_events.plan_id
      AND training_plans.user_id = auth.uid()
    )
  );

CREATE INDEX idx_plan_events_plan ON plan_events(plan_id, event_date);
CREATE INDEX idx_plan_events_type ON plan_events(plan_id, event_type);

-- ============================================================================
-- ACTIVITY BALANCE RULES (how activities interact)
-- ============================================================================
CREATE TABLE IF NOT EXISTS activity_balance_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES training_plans(id) ON DELETE CASCADE,

  rule_type TEXT NOT NULL,                -- 'reduce_when', 'increase_when', 'substitute', 'conflict'

  -- Trigger conditions
  trigger_activity TEXT NOT NULL,         -- e.g., 'lifting'
  trigger_phase TEXT,                     -- e.g., 'build' - when in this phase type

  -- Action
  affected_activity TEXT NOT NULL,        -- e.g., 'cycling'
  modifier DECIMAL(3,2),                  -- e.g., 0.7 = reduce to 70%

  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE activity_balance_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage activity balance rules" ON activity_balance_rules
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM training_plans
      WHERE training_plans.id = activity_balance_rules.plan_id
      AND training_plans.user_id = auth.uid()
    )
  );

CREATE INDEX idx_activity_balance_rules_plan ON activity_balance_rules(plan_id);

-- ============================================================================
-- Update profiles table foreign key for active_program_id
-- ============================================================================
-- Note: active_program_id column already exists in profiles table
-- This adds the foreign key constraint to training_plans

DO $$
BEGIN
  -- Drop existing constraint if it exists
  ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_active_program_id_fkey;

  -- Add new constraint
  ALTER TABLE profiles
    ADD CONSTRAINT profiles_active_program_id_fkey
    FOREIGN KEY (active_program_id)
    REFERENCES training_plans(id)
    ON DELETE SET NULL;
EXCEPTION
  WHEN others THEN
    -- Constraint might not exist or column might not exist, that's ok
    NULL;
END $$;

-- ============================================================================
-- FUNCTION: Get current week's target for a user
-- ============================================================================
CREATE OR REPLACE FUNCTION get_current_weekly_target(p_user_id UUID)
RETURNS TABLE (
  target_id UUID,
  plan_name TEXT,
  phase_name TEXT,
  phase_type TEXT,
  week_type TEXT,
  target_hours DECIMAL,
  target_tss INTEGER,
  cycling_hours DECIMAL,
  running_hours DECIMAL,
  swimming_hours DECIMAL,
  lifting_sessions INTEGER,
  other_hours DECIMAL,
  zone_distribution JSONB,
  daily_structure JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    wt.id as target_id,
    tp.name as plan_name,
    tph.name as phase_name,
    tph.phase_type,
    wt.week_type,
    wt.target_hours,
    wt.target_tss,
    wt.cycling_hours,
    wt.running_hours,
    wt.swimming_hours,
    wt.lifting_sessions,
    wt.other_hours,
    wt.zone_distribution,
    wt.daily_structure
  FROM weekly_targets wt
  JOIN training_phases tph ON tph.id = wt.phase_id
  JOIN training_plans tp ON tp.id = tph.plan_id
  WHERE tp.user_id = p_user_id
    AND tp.status = 'active'
    AND wt.week_start_date <= CURRENT_DATE
    AND wt.week_start_date + INTERVAL '6 days' >= CURRENT_DATE
  ORDER BY tp.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FUNCTION: Calculate weekly compliance
-- ============================================================================
CREATE OR REPLACE FUNCTION get_weekly_compliance(
  p_user_id UUID,
  p_week_start DATE
) RETURNS JSONB AS $$
DECLARE
  result JSONB;
  target_hours DECIMAL;
  target_tss INTEGER;
  actual_hours DECIMAL;
  actual_tss INTEGER;
BEGIN
  -- Get the weekly target for this week
  SELECT wt.target_hours, wt.target_tss
  INTO target_hours, target_tss
  FROM weekly_targets wt
  JOIN training_phases tp ON tp.id = wt.phase_id
  JOIN training_plans p ON p.id = tp.plan_id
  WHERE p.user_id = p_user_id
    AND p.status = 'active'
    AND wt.week_start_date = p_week_start;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Calculate actual hours and TSS from workouts
  SELECT
    COALESCE(SUM(actual_duration_minutes) / 60.0, 0),
    COALESCE(SUM(actual_tss), 0)
  INTO actual_hours, actual_tss
  FROM workouts
  WHERE user_id = p_user_id
    AND status = 'completed'
    AND scheduled_date >= p_week_start
    AND scheduled_date < p_week_start + INTERVAL '7 days';

  result := jsonb_build_object(
    'target_hours', target_hours,
    'actual_hours', actual_hours,
    'hours_compliance', CASE WHEN target_hours > 0 THEN ROUND((actual_hours / target_hours * 100)::numeric, 1) ELSE 0 END,
    'target_tss', target_tss,
    'actual_tss', actual_tss,
    'tss_compliance', CASE WHEN target_tss > 0 THEN ROUND((actual_tss::decimal / target_tss * 100)::numeric, 1) ELSE 0 END
  );

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Comments for documentation
-- ============================================================================
COMMENT ON TABLE training_plans IS 'Top-level training plan container for periodization';
COMMENT ON TABLE training_phases IS 'Macrocycle phases within a training plan (base, build, peak, etc.)';
COMMENT ON TABLE weekly_targets IS 'Mesocycle weekly targets within a training phase';
COMMENT ON TABLE plan_events IS 'Key events (races, vacations) that influence training structure';
COMMENT ON TABLE activity_balance_rules IS 'Rules for balancing multiple activities (reduce cycling during strength phases, etc.)';
