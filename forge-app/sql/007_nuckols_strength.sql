-- Migration: Greg Nuckols Evidence-Based Strength Training Features
-- Implements relative intensity, volume landmarks, effective reps, progression tracking

-- ============================================================================
-- USER EXERCISE ESTIMATES - Current 1RM per exercise
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_exercise_estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,

  -- Estimated 1RM (auto-calculated or user-entered)
  estimated_1rm_lbs DECIMAL(10,2),
  source TEXT NOT NULL DEFAULT 'calculated', -- 'calculated', 'tested', 'manual'

  -- If tested, store test details
  test_type TEXT, -- '1rm', '3rm', '5rm', 'amrap'
  test_weight_lbs DECIMAL(10,2),
  test_reps INTEGER,

  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, exercise_id)
);

CREATE INDEX IF NOT EXISTS idx_user_estimates_user ON user_exercise_estimates(user_id);
CREATE INDEX IF NOT EXISTS idx_user_estimates_exercise ON user_exercise_estimates(exercise_id);

-- ============================================================================
-- VOLUME LANDMARKS - MEV/MAV/MRV per muscle group (user-customizable)
-- ============================================================================

CREATE TABLE IF NOT EXISTS volume_landmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  muscle_group TEXT NOT NULL,

  -- Evidence-based defaults with user customization
  mev_sets INTEGER NOT NULL DEFAULT 6,    -- Minimum Effective Volume
  mav_low INTEGER NOT NULL DEFAULT 12,    -- MAV lower bound
  mav_high INTEGER NOT NULL DEFAULT 18,   -- MAV upper bound
  mrv_sets INTEGER NOT NULL DEFAULT 22,   -- Maximum Recoverable Volume

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, muscle_group)
);

CREATE INDEX IF NOT EXISTS idx_volume_landmarks_user ON volume_landmarks(user_id);

-- ============================================================================
-- STRENGTH PREFERENCES - User's progression model settings
-- ============================================================================

CREATE TABLE IF NOT EXISTS strength_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Progression Model
  progression_model TEXT NOT NULL DEFAULT 'double', -- 'linear', 'double', 'rpe_based'

  -- Linear progression settings
  linear_increment_lbs DECIMAL(5,2) DEFAULT 5.0,
  linear_increment_upper_lbs DECIMAL(5,2) DEFAULT 2.5, -- Smaller increments for upper body

  -- Double progression settings
  double_rep_target_low INTEGER DEFAULT 8,
  double_rep_target_high INTEGER DEFAULT 12,
  double_weight_increase_lbs DECIMAL(5,2) DEFAULT 5.0,

  -- RPE-based settings
  rpe_target_low DECIMAL(3,1) DEFAULT 7.0,
  rpe_target_high DECIMAL(3,1) DEFAULT 9.0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id)
);

-- ============================================================================
-- WEEKLY VOLUME STATS - Computed/cached weekly volume per muscle
-- ============================================================================

CREATE TABLE IF NOT EXISTS weekly_volume_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  week_start_date DATE NOT NULL,
  muscle_group TEXT NOT NULL,

  -- Hard sets count (working sets only, not warmups)
  hard_sets INTEGER NOT NULL DEFAULT 0,

  -- Effective reps (based on RPE/RIR proximity to failure)
  effective_reps INTEGER NOT NULL DEFAULT 0,

  -- Total volume (weight × reps)
  total_volume_lbs DECIMAL(12,2) NOT NULL DEFAULT 0,

  -- Average relative intensity (% of 1RM)
  avg_relative_intensity DECIMAL(5,2),

  -- Training frequency
  sessions_count INTEGER NOT NULL DEFAULT 0,

  -- Computed status
  volume_status TEXT, -- 'below_mev', 'approaching_mev', 'in_mav', 'approaching_mrv', 'over_mrv'

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, week_start_date, muscle_group)
);

CREATE INDEX IF NOT EXISTS idx_weekly_volume_user_date ON weekly_volume_stats(user_id, week_start_date DESC);
CREATE INDEX IF NOT EXISTS idx_weekly_volume_muscle ON weekly_volume_stats(muscle_group);

-- ============================================================================
-- STRENGTH TESTS - History of 1RM/3RM/5RM tests
-- ============================================================================

CREATE TABLE IF NOT EXISTS strength_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  workout_id UUID REFERENCES workouts(id) ON DELETE SET NULL,
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,

  test_date DATE NOT NULL,
  test_type TEXT NOT NULL, -- '1rm', '3rm', '5rm', 'amrap'

  weight_lbs DECIMAL(10,2) NOT NULL,
  reps_achieved INTEGER NOT NULL,
  rpe DECIMAL(3,1),

  -- Calculated result
  estimated_1rm_lbs DECIMAL(10,2) NOT NULL,

  -- Previous test comparison
  previous_1rm_lbs DECIMAL(10,2),
  improvement_percent DECIMAL(5,2),

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_strength_tests_user ON strength_tests(user_id, test_date DESC);
CREATE INDEX IF NOT EXISTS idx_strength_tests_exercise ON strength_tests(exercise_id);

-- ============================================================================
-- PROGRESSION HISTORY - For plateau detection
-- ============================================================================

CREATE TABLE IF NOT EXISTS progression_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,

  week_start_date DATE NOT NULL,

  -- Best set of the week
  best_weight_lbs DECIMAL(10,2),
  best_reps INTEGER,
  best_e1rm DECIMAL(10,2),

  -- Progression tracking
  weeks_without_progress INTEGER DEFAULT 0,
  plateau_detected BOOLEAN DEFAULT FALSE,
  plateau_start_date DATE,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, exercise_id, week_start_date)
);

CREATE INDEX IF NOT EXISTS idx_progression_user_exercise ON progression_history(user_id, exercise_id, week_start_date DESC);

-- ============================================================================
-- EXTEND EXERCISE_SETS - Add effective_reps and relative_intensity
-- ============================================================================

ALTER TABLE exercise_sets
ADD COLUMN IF NOT EXISTS effective_reps INTEGER,
ADD COLUMN IF NOT EXISTS relative_intensity DECIMAL(5,2);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE user_exercise_estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE volume_landmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE strength_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_volume_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE strength_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE progression_history ENABLE ROW LEVEL SECURITY;

-- User exercise estimates policies
CREATE POLICY "Users can view own estimates" ON user_exercise_estimates
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own estimates" ON user_exercise_estimates
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own estimates" ON user_exercise_estimates
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own estimates" ON user_exercise_estimates
  FOR DELETE USING (auth.uid() = user_id);

-- Volume landmarks policies
CREATE POLICY "Users can view own landmarks" ON volume_landmarks
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own landmarks" ON volume_landmarks
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own landmarks" ON volume_landmarks
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own landmarks" ON volume_landmarks
  FOR DELETE USING (auth.uid() = user_id);

-- Strength preferences policies
CREATE POLICY "Users can view own preferences" ON strength_preferences
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own preferences" ON strength_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own preferences" ON strength_preferences
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own preferences" ON strength_preferences
  FOR DELETE USING (auth.uid() = user_id);

-- Weekly volume stats policies
CREATE POLICY "Users can view own volume stats" ON weekly_volume_stats
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own volume stats" ON weekly_volume_stats
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own volume stats" ON weekly_volume_stats
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own volume stats" ON weekly_volume_stats
  FOR DELETE USING (auth.uid() = user_id);

-- Strength tests policies
CREATE POLICY "Users can view own tests" ON strength_tests
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own tests" ON strength_tests
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tests" ON strength_tests
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own tests" ON strength_tests
  FOR DELETE USING (auth.uid() = user_id);

-- Progression history policies
CREATE POLICY "Users can view own progression" ON progression_history
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own progression" ON progression_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own progression" ON progression_history
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own progression" ON progression_history
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE user_exercise_estimates IS 'Current estimated 1RM per exercise per user';
COMMENT ON TABLE volume_landmarks IS 'MEV/MAV/MRV volume landmarks per muscle (user-customizable)';
COMMENT ON TABLE strength_preferences IS 'User preferences for progression model and settings';
COMMENT ON TABLE weekly_volume_stats IS 'Computed weekly volume statistics per muscle group';
COMMENT ON TABLE strength_tests IS 'History of strength tests (1RM, 3RM, 5RM)';
COMMENT ON TABLE progression_history IS 'Weekly best performance for plateau detection';

COMMENT ON COLUMN exercise_sets.effective_reps IS 'Stimulating reps based on proximity to failure (RPE/RIR)';
COMMENT ON COLUMN exercise_sets.relative_intensity IS 'Weight as percentage of estimated 1RM';
