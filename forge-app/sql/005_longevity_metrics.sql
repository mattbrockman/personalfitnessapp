-- Migration: Longevity Metrics (Peter Attia Features)
-- Tables and fields for VO2max, grip strength, body composition, CGM, supplements, and Centenarian Decathlon

-- ============================================================================
-- PROFILE EXTENSIONS - Add longevity baseline fields
-- ============================================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS vo2max_ml_kg_min DECIMAL(4,1);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS vo2max_measured_date DATE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS vo2max_estimation_method TEXT; -- 'lab', 'field_test', 'strava_estimate'
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS grip_strength_left_lbs DECIMAL(5,1);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS grip_strength_right_lbs DECIMAL(5,1);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS grip_strength_date DATE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS resting_hr_baseline INTEGER;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS biological_sex TEXT; -- 'male', 'female' (for percentile calculations)

-- ============================================================================
-- HEALTH METRICS - General time-series health data
-- ============================================================================

CREATE TABLE IF NOT EXISTS health_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL,
  metric_type TEXT NOT NULL, -- 'vo2max', 'grip_strength_left', 'grip_strength_right', 'rhr', 'hrv'
  value DECIMAL NOT NULL,
  unit TEXT NOT NULL, -- 'ml/kg/min', 'lbs', 'kg', 'bpm', 'ms'
  source TEXT, -- 'manual', 'strava', 'field_test', 'lab', 'device'
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_health_metrics_user_date ON health_metrics(user_id, metric_date DESC);
CREATE INDEX IF NOT EXISTS idx_health_metrics_user_type ON health_metrics(user_id, metric_type);

-- Unique constraint per user/date/type (one reading per day per metric type)
CREATE UNIQUE INDEX IF NOT EXISTS idx_health_metrics_unique
  ON health_metrics(user_id, metric_date, metric_type);

-- ============================================================================
-- CGM READINGS - Continuous Glucose Monitor data
-- ============================================================================

CREATE TABLE IF NOT EXISTS cgm_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reading_time TIMESTAMPTZ NOT NULL,
  glucose_mg_dl INTEGER NOT NULL,
  source TEXT, -- 'levels', 'dexcom', 'libre', 'manual'
  meal_context TEXT, -- 'fasting', 'pre_meal', 'post_meal_1hr', 'post_meal_2hr', 'exercise', 'sleep'
  nutrition_log_id UUID REFERENCES nutrition_logs(id) ON DELETE SET NULL, -- Link to meal that caused spike
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for CGM queries
CREATE INDEX IF NOT EXISTS idx_cgm_user_time ON cgm_readings(user_id, reading_time DESC);
CREATE INDEX IF NOT EXISTS idx_cgm_meal_context ON cgm_readings(user_id, meal_context);

-- ============================================================================
-- BODY COMPOSITION LOGS - Detailed body composition tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS body_composition_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,

  -- Core metrics
  weight_lbs DECIMAL(5,1),
  body_fat_pct DECIMAL(4,1),
  lean_mass_lbs DECIMAL(5,1),

  -- Extended metrics (from DEXA or advanced scales)
  visceral_fat_rating INTEGER, -- 1-20 scale (Tanita style)
  bone_mass_lbs DECIMAL(4,1),
  water_pct DECIMAL(4,1),
  muscle_mass_lbs DECIMAL(5,1),

  -- DEXA-specific regional data (optional)
  trunk_fat_pct DECIMAL(4,1),
  arm_fat_pct DECIMAL(4,1),
  leg_fat_pct DECIMAL(4,1),
  android_fat_pct DECIMAL(4,1), -- Belly region
  gynoid_fat_pct DECIMAL(4,1), -- Hip region
  bone_mineral_density DECIMAL(4,3), -- g/cm²

  -- Calculated fields
  ffmi DECIMAL(4,2), -- Fat-Free Mass Index
  almi DECIMAL(4,2), -- Appendicular Lean Mass Index

  source TEXT NOT NULL DEFAULT 'manual', -- 'dexa', 'bioimpedance', 'smart_scale', 'manual', 'bod_pod'
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique per user per day
CREATE UNIQUE INDEX IF NOT EXISTS idx_body_comp_user_date
  ON body_composition_logs(user_id, log_date);

-- ============================================================================
-- SUPPLEMENTS - Medication and supplement tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS supplements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  brand TEXT,
  dosage TEXT, -- e.g., "500mg", "2 capsules"
  dosage_unit TEXT, -- 'mg', 'g', 'mcg', 'IU', 'capsules', 'tablets', 'ml'
  frequency TEXT NOT NULL DEFAULT 'daily', -- 'daily', 'twice_daily', 'weekly', 'as_needed', 'cycling'
  time_of_day TEXT[], -- Array: ['morning', 'evening', 'with_meals', 'before_bed', 'empty_stomach']

  -- Cycling protocol support (e.g., creatine loading, periodic breaks)
  cycle_on_days INTEGER, -- Days on
  cycle_off_days INTEGER, -- Days off

  is_active BOOLEAN DEFAULT true,
  start_date DATE,
  end_date DATE,

  category TEXT, -- 'vitamin', 'mineral', 'amino_acid', 'herb', 'hormone', 'prescription', 'other'
  reason TEXT, -- Why taking this supplement
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_supplements_user_active ON supplements(user_id, is_active);

-- Supplement compliance log (did you take it today?)
CREATE TABLE IF NOT EXISTS supplement_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  supplement_id UUID NOT NULL REFERENCES supplements(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  taken BOOLEAN NOT NULL DEFAULT true,
  time_taken TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_supplement_logs_unique
  ON supplement_logs(supplement_id, log_date);

-- ============================================================================
-- CENTENARIAN DECATHLON - Long-term functional goals
-- ============================================================================

CREATE TABLE IF NOT EXISTS centenarian_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  goal_name TEXT NOT NULL,
  description TEXT,

  -- Goal specifics
  target_age INTEGER DEFAULT 100, -- Age at which you want to do this
  category TEXT NOT NULL, -- 'strength', 'cardio', 'mobility', 'balance', 'functional', 'cognitive'

  -- Ability tracking
  current_ability TEXT, -- Free-form description of current state
  current_score INTEGER, -- 1-10 self-assessment
  target_ability TEXT, -- What success looks like

  -- Requirements
  required_strength TEXT, -- What strength is needed
  required_cardio TEXT, -- What cardio capacity is needed
  required_mobility TEXT, -- What mobility is needed

  -- Progress
  is_achieved BOOLEAN DEFAULT false,
  achieved_date DATE,
  last_tested_date DATE,

  -- Ordering
  display_order INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_centenarian_goals_user ON centenarian_goals(user_id);

-- ============================================================================
-- MOVEMENT SCREEN - FMS-style assessment tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS movement_screens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  screen_date DATE NOT NULL,

  -- FMS 7 movements (0-3 score each, 0 = pain)
  deep_squat INTEGER CHECK (deep_squat >= 0 AND deep_squat <= 3),
  hurdle_step_left INTEGER CHECK (hurdle_step_left >= 0 AND hurdle_step_left <= 3),
  hurdle_step_right INTEGER CHECK (hurdle_step_right >= 0 AND hurdle_step_right <= 3),
  inline_lunge_left INTEGER CHECK (inline_lunge_left >= 0 AND inline_lunge_left <= 3),
  inline_lunge_right INTEGER CHECK (inline_lunge_right >= 0 AND inline_lunge_right <= 3),
  shoulder_mobility_left INTEGER CHECK (shoulder_mobility_left >= 0 AND shoulder_mobility_left <= 3),
  shoulder_mobility_right INTEGER CHECK (shoulder_mobility_right >= 0 AND shoulder_mobility_right <= 3),
  active_slr_left INTEGER CHECK (active_slr_left >= 0 AND active_slr_left <= 3),
  active_slr_right INTEGER CHECK (active_slr_right >= 0 AND active_slr_right <= 3),
  trunk_stability_pushup INTEGER CHECK (trunk_stability_pushup >= 0 AND trunk_stability_pushup <= 3),
  rotary_stability_left INTEGER CHECK (rotary_stability_left >= 0 AND rotary_stability_left <= 3),
  rotary_stability_right INTEGER CHECK (rotary_stability_right >= 0 AND rotary_stability_right <= 3),

  -- Calculated total (max 21 for bilateral movements taking lower score)
  total_score INTEGER,

  -- Balance tests (seconds)
  single_leg_stand_left_eyes_open INTEGER,
  single_leg_stand_right_eyes_open INTEGER,
  single_leg_stand_left_eyes_closed INTEGER,
  single_leg_stand_right_eyes_closed INTEGER,
  tandem_stance_seconds INTEGER,

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_movement_screens_user_date
  ON movement_screens(user_id, screen_date DESC);

-- ============================================================================
-- VO2MAX TEST RESULTS - Field test tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS vo2max_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  test_date DATE NOT NULL,

  test_type TEXT NOT NULL, -- 'cooper_12min', 'rockport_walk', '1.5_mile_run', 'step_test', 'lab', 'strava_estimate'

  -- Test inputs (varies by test type)
  distance_meters DECIMAL(8,2),
  duration_seconds INTEGER,
  final_heart_rate INTEGER,
  recovery_heart_rate INTEGER, -- For step test
  weight_kg DECIMAL(5,2),
  age_at_test INTEGER,

  -- Result
  estimated_vo2max DECIMAL(4,1) NOT NULL,

  -- Context
  conditions TEXT, -- 'indoor_track', 'outdoor_flat', 'treadmill', 'lab'
  temperature_f INTEGER,
  altitude_ft INTEGER,

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vo2max_tests_user_date
  ON vo2max_tests(user_id, test_date DESC);

-- ============================================================================
-- RLS POLICIES - Enable Row Level Security
-- ============================================================================

ALTER TABLE health_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE cgm_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE body_composition_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplements ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplement_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE centenarian_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE movement_screens ENABLE ROW LEVEL SECURITY;
ALTER TABLE vo2max_tests ENABLE ROW LEVEL SECURITY;

-- Health metrics policies
CREATE POLICY "Users can view own health metrics" ON health_metrics
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own health metrics" ON health_metrics
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own health metrics" ON health_metrics
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own health metrics" ON health_metrics
  FOR DELETE USING (auth.uid() = user_id);

-- CGM policies
CREATE POLICY "Users can view own CGM readings" ON cgm_readings
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own CGM readings" ON cgm_readings
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own CGM readings" ON cgm_readings
  FOR DELETE USING (auth.uid() = user_id);

-- Body composition policies
CREATE POLICY "Users can view own body composition" ON body_composition_logs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own body composition" ON body_composition_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own body composition" ON body_composition_logs
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own body composition" ON body_composition_logs
  FOR DELETE USING (auth.uid() = user_id);

-- Supplements policies
CREATE POLICY "Users can view own supplements" ON supplements
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own supplements" ON supplements
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own supplements" ON supplements
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own supplements" ON supplements
  FOR DELETE USING (auth.uid() = user_id);

-- Supplement logs policies
CREATE POLICY "Users can view own supplement logs" ON supplement_logs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own supplement logs" ON supplement_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own supplement logs" ON supplement_logs
  FOR UPDATE USING (auth.uid() = user_id);

-- Centenarian goals policies
CREATE POLICY "Users can view own centenarian goals" ON centenarian_goals
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own centenarian goals" ON centenarian_goals
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own centenarian goals" ON centenarian_goals
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own centenarian goals" ON centenarian_goals
  FOR DELETE USING (auth.uid() = user_id);

-- Movement screens policies
CREATE POLICY "Users can view own movement screens" ON movement_screens
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own movement screens" ON movement_screens
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own movement screens" ON movement_screens
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own movement screens" ON movement_screens
  FOR DELETE USING (auth.uid() = user_id);

-- VO2max tests policies
CREATE POLICY "Users can view own vo2max tests" ON vo2max_tests
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own vo2max tests" ON vo2max_tests
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own vo2max tests" ON vo2max_tests
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own vo2max tests" ON vo2max_tests
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- SEED DEFAULT CENTENARIAN DECATHLON GOALS
-- ============================================================================

-- These will be copied to new users or can be manually added
-- Usage: INSERT INTO centenarian_goals SELECT * FROM default_centenarian_goals WHERE user_id = <new_user_id>

COMMENT ON TABLE centenarian_goals IS 'Peter Attia Centenarian Decathlon: 10 physical tasks you want to perform at age 100';
COMMENT ON TABLE health_metrics IS 'Time-series health data: VO2max, grip strength, RHR, HRV';
COMMENT ON TABLE cgm_readings IS 'Continuous glucose monitor readings with meal context';
COMMENT ON TABLE body_composition_logs IS 'Detailed body composition from DEXA, scales, etc.';
COMMENT ON TABLE supplements IS 'Supplement and medication tracking with cycling protocols';
COMMENT ON TABLE movement_screens IS 'FMS-style movement quality assessments';
COMMENT ON TABLE vo2max_tests IS 'VO2max field test results (Cooper, Rockport, etc.)';
