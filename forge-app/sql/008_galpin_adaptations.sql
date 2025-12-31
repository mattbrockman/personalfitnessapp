-- Migration: Andy Galpin Evidence-Based Exercise Physiology Features
-- Implements 9 adaptations framework, training age, readiness, tempo, deload triggers, strength standards

-- ============================================================================
-- PROFILE EXTENSIONS - Training age and experience level
-- ============================================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS training_start_date DATE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS experience_level TEXT DEFAULT 'novice'; -- 'novice', 'intermediate', 'advanced'

-- ============================================================================
-- EXERCISE EXTENSIONS - Power and plyometric flags
-- ============================================================================

ALTER TABLE exercises ADD COLUMN IF NOT EXISTS is_plyometric BOOLEAN DEFAULT FALSE;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS is_power BOOLEAN DEFAULT FALSE;

-- ============================================================================
-- EXERCISE_SETS EXTENSIONS - Tempo and velocity tracking
-- ============================================================================

ALTER TABLE exercise_sets ADD COLUMN IF NOT EXISTS tempo TEXT; -- e.g., "3-1-2-0" (eccentric-pause-concentric-pause)
ALTER TABLE exercise_sets ADD COLUMN IF NOT EXISTS mean_velocity_mps DECIMAL(4,2); -- VBT: mean velocity in m/s

-- ============================================================================
-- USER ADAPTATION GOALS - Galpin's 9 adaptations prioritization
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_adaptation_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Primary focus (required)
  primary_adaptation TEXT NOT NULL, -- skill, speed_power, strength, hypertrophy, muscular_endurance, anaerobic_capacity, vo2max, long_duration, body_composition

  -- Secondary/tertiary goals (optional)
  secondary_adaptation TEXT,
  tertiary_adaptation TEXT,

  -- Full prioritization (1-9 rankings for all adaptations)
  priorities JSONB, -- {"skill": 1, "speed_power": 2, "strength": 3, ...}

  -- Notes on goals
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_adaptation_goals_user ON user_adaptation_goals(user_id);

-- ============================================================================
-- ADAPTATION PROTOCOLS - Evidence-based training parameters per adaptation
-- ============================================================================

CREATE TABLE IF NOT EXISTS adaptation_protocols (
  adaptation_type TEXT PRIMARY KEY, -- matches primary_adaptation values

  -- Rep ranges
  rep_min INTEGER NOT NULL,
  rep_max INTEGER NOT NULL,

  -- Set ranges per exercise per session
  sets_min INTEGER NOT NULL,
  sets_max INTEGER NOT NULL,

  -- Rest periods (seconds)
  rest_min INTEGER NOT NULL,
  rest_max INTEGER NOT NULL,

  -- Intensity ranges
  intensity_min DECIMAL(5,2), -- % of 1RM or HR max
  intensity_max DECIMAL(5,2),
  intensity_unit TEXT NOT NULL DEFAULT '%1RM', -- '%1RM', '%HRmax', '%VO2max', 'RPE'

  -- Default tempo
  default_tempo TEXT, -- e.g., "3-0-1-0"

  -- Weekly frequency
  sessions_per_week_min INTEGER NOT NULL,
  sessions_per_week_max INTEGER NOT NULL,

  -- Exercise selection guidance
  exercise_selection_notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- READINESS ASSESSMENTS - Pre-workout readiness scoring
-- ============================================================================

CREATE TABLE IF NOT EXISTS readiness_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assessment_date DATE NOT NULL,

  -- Subjective readiness (required)
  subjective_readiness INTEGER NOT NULL CHECK (subjective_readiness >= 1 AND subjective_readiness <= 10),

  -- Optional objective measures
  grip_strength_lbs DECIMAL(6,1),
  vertical_jump_inches DECIMAL(5,1),
  hrv_reading INTEGER, -- ms (RMSSD)
  resting_hr INTEGER, -- bpm
  sleep_quality INTEGER CHECK (sleep_quality >= 1 AND sleep_quality <= 10),
  sleep_hours DECIMAL(3,1),

  -- Training load context (from Seiler metrics if available)
  tsb_value DECIMAL(6,1), -- Training Stress Balance
  atl_value DECIMAL(6,1), -- Acute Training Load
  ctl_value DECIMAL(6,1), -- Chronic Training Load

  -- Calculated outputs
  calculated_readiness_score INTEGER CHECK (calculated_readiness_score >= 0 AND calculated_readiness_score <= 100),
  recommended_intensity TEXT CHECK (recommended_intensity IN ('reduce', 'maintain', 'push')),
  adjustment_factor DECIMAL(3,2), -- 0.70 = reduce 30%, 1.0 = maintain, 1.10 = push 10%

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, assessment_date)
);

CREATE INDEX IF NOT EXISTS idx_readiness_user_date ON readiness_assessments(user_id, assessment_date DESC);

-- ============================================================================
-- READINESS BASELINES - Rolling averages for comparison
-- ============================================================================

CREATE TABLE IF NOT EXISTS readiness_baselines (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,

  -- 30-day rolling averages
  avg_grip_strength_lbs DECIMAL(6,1),
  avg_vertical_jump_inches DECIMAL(5,1),
  avg_hrv INTEGER,
  avg_resting_hr INTEGER,
  avg_sleep_hours DECIMAL(3,1),

  -- Standard deviations (for z-score calculations)
  std_hrv DECIMAL(6,2),
  std_grip_strength DECIMAL(6,2),
  std_vertical_jump DECIMAL(5,2),

  -- Sample sizes
  grip_sample_count INTEGER DEFAULT 0,
  jump_sample_count INTEGER DEFAULT 0,
  hrv_sample_count INTEGER DEFAULT 0,

  last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- POWER TESTS - Jump and sprint performance tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS power_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  test_date DATE NOT NULL,

  -- Jump tests
  vertical_jump_inches DECIMAL(5,1),
  broad_jump_inches DECIMAL(6,1),
  reactive_strength_index DECIMAL(4,2), -- RSI = jump height / contact time

  -- Sprint tests
  sprint_10m_seconds DECIMAL(5,2),
  sprint_20m_seconds DECIMAL(5,2),
  sprint_40m_seconds DECIMAL(5,2),

  -- Optional VBT benchmarks
  squat_mean_velocity_mps DECIMAL(4,2), -- At a standard load
  bench_mean_velocity_mps DECIMAL(4,2),

  -- Context
  test_conditions TEXT, -- 'indoor', 'outdoor', 'track'
  equipment_used TEXT, -- 'just jump mat', 'force plate', 'timing gates'

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_power_tests_user_date ON power_tests(user_id, test_date DESC);

-- ============================================================================
-- TECHNIQUE ASSESSMENTS - Movement quality tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS technique_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  exercise_id UUID REFERENCES exercises(id) ON DELETE SET NULL,
  exercise_name TEXT NOT NULL, -- Denormalized for display

  assessment_date DATE NOT NULL,

  -- Overall rating
  technique_rating INTEGER NOT NULL CHECK (technique_rating >= 1 AND technique_rating <= 5),
  -- 1 = Major form issues, injury risk
  -- 2 = Multiple form issues needing work
  -- 3 = Acceptable form, minor issues
  -- 4 = Good form, small refinements possible
  -- 5 = Excellent form, competition-ready

  -- Video reference
  video_url TEXT,

  -- Qualitative feedback
  strengths TEXT[],
  areas_for_improvement TEXT[],
  cues_to_focus TEXT[],

  -- Coach feedback (if applicable)
  assessed_by TEXT, -- 'self', 'coach', 'ai'
  coach_notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_technique_user_exercise ON technique_assessments(user_id, exercise_id);
CREATE INDEX IF NOT EXISTS idx_technique_user_date ON technique_assessments(user_id, assessment_date DESC);

-- ============================================================================
-- DELOAD TRIGGERS - Automatic deload recommendations
-- ============================================================================

CREATE TABLE IF NOT EXISTS deload_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  triggered_at TIMESTAMPTZ DEFAULT NOW(),

  -- Type of trigger
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('tsb', 'volume', 'plateau', 'recovery', 'scheduled', 'manual')),
  -- tsb: TSB fell below threshold
  -- volume: Multiple muscles over MRV
  -- plateau: Multiple exercises plateaued
  -- recovery: Consistently low recovery scores
  -- scheduled: Planned deload (e.g., every 4th week)
  -- manual: User-initiated

  -- Trigger details
  trigger_data JSONB, -- {"tsb": -18, "threshold": -15} or {"muscles_over_mrv": ["chest", "triceps", "shoulders"]}

  -- Severity assessment
  severity TEXT CHECK (severity IN ('mild', 'moderate', 'severe')),
  -- mild: Slight overreach, minor adjustment needed
  -- moderate: Meaningful fatigue, week-long deload suggested
  -- severe: High overreach, extended recovery needed

  -- Recommendation
  recommended_deload_type TEXT CHECK (recommended_deload_type IN ('volume', 'intensity', 'full', 'active_recovery')),
  -- volume: Reduce sets by 40-50%, maintain intensity
  -- intensity: Reduce weight by 10-20%, maintain volume
  -- full: Reduce both by 40-50%
  -- active_recovery: Light movement only, no structured training

  recommended_duration_days INTEGER DEFAULT 7,

  -- User response
  user_response TEXT CHECK (user_response IN ('accepted', 'modified', 'dismissed', 'pending')),
  response_notes TEXT,
  responded_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deload_triggers_user ON deload_triggers(user_id, triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_deload_triggers_pending ON deload_triggers(user_id, user_response) WHERE user_response = 'pending';

-- ============================================================================
-- STRENGTH STANDARDS - Population percentiles by lift, sex, bodyweight
-- ============================================================================

CREATE TABLE IF NOT EXISTS strength_standards (
  exercise_name TEXT NOT NULL, -- 'squat', 'bench_press', 'deadlift', 'overhead_press', 'barbell_row'
  sex TEXT NOT NULL CHECK (sex IN ('male', 'female')),
  body_weight_class TEXT NOT NULL, -- '132', '148', '165', '181', '198', '220', '242', '275', '308', '308+'

  -- Percentile thresholds (in lbs)
  percentile_50 DECIMAL(6,1), -- Median
  percentile_75 DECIMAL(6,1),
  percentile_90 DECIMAL(6,1),
  percentile_95 DECIMAL(6,1),
  percentile_99 DECIMAL(6,1),

  -- Classification thresholds (in lbs)
  beginner_threshold DECIMAL(6,1),     -- Can perform with basic form
  novice_threshold DECIMAL(6,1),       -- 6+ months training
  intermediate_threshold DECIMAL(6,1), -- 1-3 years training
  advanced_threshold DECIMAL(6,1),     -- 3-5 years training
  elite_threshold DECIMAL(6,1),        -- Competition-level

  -- Source/version
  data_source TEXT DEFAULT 'symmetric_strength', -- 'symmetric_strength', 'strengthlevel', 'custom'

  PRIMARY KEY (exercise_name, sex, body_weight_class)
);

-- ============================================================================
-- SEED ADAPTATION PROTOCOLS - Evidence-based defaults from Galpin
-- ============================================================================

INSERT INTO adaptation_protocols (adaptation_type, rep_min, rep_max, sets_min, sets_max, rest_min, rest_max, intensity_min, intensity_max, intensity_unit, default_tempo, sessions_per_week_min, sessions_per_week_max, exercise_selection_notes) VALUES
('skill', 1, 5, 3, 6, 120, 300, NULL, NULL, 'RPE', '1-0-1-0', 3, 6, 'Focus on technical practice. Low fatigue, high quality reps. Use variations and drills.'),
('speed_power', 1, 5, 3, 6, 180, 300, 30, 70, '%1RM', '1-0-X-0', 2, 4, 'Explosive intent required. Plyometrics, Olympic lifts, jumps. Stop when velocity drops.'),
('strength', 1, 6, 3, 5, 180, 300, 80, 100, '%1RM', '2-1-1-0', 2, 4, 'Heavy compound movements. Full recovery between sets. Progressive overload priority.'),
('hypertrophy', 6, 12, 3, 5, 60, 120, 65, 85, '%1RM', '3-0-1-0', 3, 6, 'Moderate loads, controlled tempo. Time under tension matters. Variety of angles.'),
('muscular_endurance', 12, 30, 2, 4, 30, 60, 40, 65, '%1RM', '2-0-1-0', 2, 4, 'Higher reps, shorter rest. Circuits and supersets work well. Build work capacity.'),
('anaerobic_capacity', 15, 30, 1, 3, 60, 180, NULL, NULL, '%HRmax', NULL, 2, 3, 'High-intensity intervals 30-120 seconds. Near-maximal effort. Full or partial recovery.'),
('vo2max', 8, 15, 3, 6, 180, 300, 90, 100, '%HRmax', NULL, 2, 3, 'Intervals at 90-100% HRmax for 3-8 minutes. 1:1 or 2:1 work:rest ratio.'),
('long_duration', 1, 1, 1, 2, 0, 0, 60, 75, '%HRmax', NULL, 2, 4, 'Zone 2 cardio 30-90+ minutes. Maintain conversation pace. Build aerobic base.'),
('body_composition', 8, 15, 3, 5, 60, 90, 60, 80, '%1RM', '2-0-1-0', 3, 5, 'Combination of strength and hypertrophy protocols. Caloric deficit/surplus is primary driver.')
ON CONFLICT (adaptation_type) DO UPDATE SET
  rep_min = EXCLUDED.rep_min,
  rep_max = EXCLUDED.rep_max,
  sets_min = EXCLUDED.sets_min,
  sets_max = EXCLUDED.sets_max,
  rest_min = EXCLUDED.rest_min,
  rest_max = EXCLUDED.rest_max,
  intensity_min = EXCLUDED.intensity_min,
  intensity_max = EXCLUDED.intensity_max,
  intensity_unit = EXCLUDED.intensity_unit,
  default_tempo = EXCLUDED.default_tempo,
  sessions_per_week_min = EXCLUDED.sessions_per_week_min,
  sessions_per_week_max = EXCLUDED.sessions_per_week_max,
  exercise_selection_notes = EXCLUDED.exercise_selection_notes;

-- ============================================================================
-- SEED STRENGTH STANDARDS - Male bench press example (add more in production)
-- ============================================================================

-- Male Bench Press Standards (lbs)
INSERT INTO strength_standards (exercise_name, sex, body_weight_class, percentile_50, percentile_75, percentile_90, percentile_95, percentile_99, beginner_threshold, novice_threshold, intermediate_threshold, advanced_threshold, elite_threshold) VALUES
('bench_press', 'male', '132', 115, 145, 180, 205, 250, 85, 110, 155, 205, 260),
('bench_press', 'male', '148', 130, 165, 205, 235, 285, 95, 125, 175, 230, 295),
('bench_press', 'male', '165', 145, 185, 230, 265, 320, 110, 145, 200, 260, 335),
('bench_press', 'male', '181', 160, 205, 255, 295, 355, 120, 160, 220, 290, 370),
('bench_press', 'male', '198', 175, 220, 275, 320, 385, 135, 175, 245, 320, 410),
('bench_press', 'male', '220', 190, 240, 300, 350, 420, 145, 190, 265, 350, 445),
('bench_press', 'male', '242', 200, 255, 320, 370, 445, 155, 205, 285, 375, 480),
('bench_press', 'male', '275', 210, 270, 335, 390, 470, 165, 215, 300, 395, 505)
ON CONFLICT (exercise_name, sex, body_weight_class) DO NOTHING;

-- Male Squat Standards (lbs)
INSERT INTO strength_standards (exercise_name, sex, body_weight_class, percentile_50, percentile_75, percentile_90, percentile_95, percentile_99, beginner_threshold, novice_threshold, intermediate_threshold, advanced_threshold, elite_threshold) VALUES
('squat', 'male', '132', 155, 195, 245, 280, 340, 110, 145, 205, 270, 345),
('squat', 'male', '148', 175, 220, 275, 315, 385, 125, 165, 235, 305, 390),
('squat', 'male', '165', 195, 245, 310, 355, 430, 145, 190, 265, 350, 445),
('squat', 'male', '181', 215, 270, 340, 390, 475, 160, 210, 295, 385, 495),
('squat', 'male', '198', 230, 295, 370, 425, 515, 175, 230, 320, 420, 540),
('squat', 'male', '220', 250, 320, 400, 460, 560, 190, 250, 350, 460, 590),
('squat', 'male', '242', 265, 340, 425, 490, 595, 205, 265, 375, 490, 630),
('squat', 'male', '275', 280, 355, 445, 510, 625, 215, 280, 395, 515, 665)
ON CONFLICT (exercise_name, sex, body_weight_class) DO NOTHING;

-- Male Deadlift Standards (lbs)
INSERT INTO strength_standards (exercise_name, sex, body_weight_class, percentile_50, percentile_75, percentile_90, percentile_95, percentile_99, beginner_threshold, novice_threshold, intermediate_threshold, advanced_threshold, elite_threshold) VALUES
('deadlift', 'male', '132', 180, 225, 285, 325, 395, 135, 175, 250, 325, 415),
('deadlift', 'male', '148', 205, 260, 325, 375, 455, 155, 200, 285, 370, 475),
('deadlift', 'male', '165', 230, 290, 365, 420, 510, 175, 230, 320, 420, 535),
('deadlift', 'male', '181', 250, 320, 400, 460, 560, 195, 255, 355, 465, 595),
('deadlift', 'male', '198', 275, 350, 435, 505, 610, 210, 280, 390, 510, 655),
('deadlift', 'male', '220', 295, 375, 470, 545, 660, 230, 305, 425, 555, 715),
('deadlift', 'male', '242', 315, 400, 500, 580, 705, 245, 320, 450, 590, 760),
('deadlift', 'male', '275', 330, 420, 530, 610, 740, 260, 340, 475, 625, 800)
ON CONFLICT (exercise_name, sex, body_weight_class) DO NOTHING;

-- Female Bench Press Standards (lbs) - Example subset
INSERT INTO strength_standards (exercise_name, sex, body_weight_class, percentile_50, percentile_75, percentile_90, percentile_95, percentile_99, beginner_threshold, novice_threshold, intermediate_threshold, advanced_threshold, elite_threshold) VALUES
('bench_press', 'female', '97', 45, 60, 75, 90, 110, 35, 45, 65, 85, 110),
('bench_press', 'female', '105', 50, 65, 85, 100, 120, 40, 50, 70, 95, 120),
('bench_press', 'female', '114', 55, 75, 95, 110, 135, 45, 55, 80, 105, 135),
('bench_press', 'female', '123', 60, 80, 105, 120, 150, 50, 65, 90, 115, 150),
('bench_press', 'female', '132', 70, 90, 115, 135, 165, 55, 70, 100, 130, 165),
('bench_press', 'female', '148', 80, 105, 130, 155, 190, 60, 80, 115, 150, 190),
('bench_press', 'female', '165', 90, 115, 145, 170, 210, 70, 90, 125, 165, 210),
('bench_press', 'female', '181', 100, 125, 160, 185, 230, 75, 100, 140, 180, 230)
ON CONFLICT (exercise_name, sex, body_weight_class) DO NOTHING;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE user_adaptation_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE readiness_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE readiness_baselines ENABLE ROW LEVEL SECURITY;
ALTER TABLE power_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE technique_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE deload_triggers ENABLE ROW LEVEL SECURITY;

-- User adaptation goals policies
CREATE POLICY "Users can view own adaptation goals" ON user_adaptation_goals
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own adaptation goals" ON user_adaptation_goals
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own adaptation goals" ON user_adaptation_goals
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own adaptation goals" ON user_adaptation_goals
  FOR DELETE USING (auth.uid() = user_id);

-- Adaptation protocols - read-only for all authenticated users
CREATE POLICY "Anyone can read protocols" ON adaptation_protocols
  FOR SELECT USING (true);

-- Readiness assessments policies
CREATE POLICY "Users can view own readiness" ON readiness_assessments
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own readiness" ON readiness_assessments
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own readiness" ON readiness_assessments
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own readiness" ON readiness_assessments
  FOR DELETE USING (auth.uid() = user_id);

-- Readiness baselines policies
CREATE POLICY "Users can view own baselines" ON readiness_baselines
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own baselines" ON readiness_baselines
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own baselines" ON readiness_baselines
  FOR UPDATE USING (auth.uid() = user_id);

-- Power tests policies
CREATE POLICY "Users can view own power tests" ON power_tests
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own power tests" ON power_tests
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own power tests" ON power_tests
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own power tests" ON power_tests
  FOR DELETE USING (auth.uid() = user_id);

-- Technique assessments policies
CREATE POLICY "Users can view own technique" ON technique_assessments
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own technique" ON technique_assessments
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own technique" ON technique_assessments
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own technique" ON technique_assessments
  FOR DELETE USING (auth.uid() = user_id);

-- Deload triggers policies
CREATE POLICY "Users can view own deloads" ON deload_triggers
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own deloads" ON deload_triggers
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own deloads" ON deload_triggers
  FOR UPDATE USING (auth.uid() = user_id);

-- Strength standards - read-only for all authenticated users
CREATE POLICY "Anyone can read standards" ON strength_standards
  FOR SELECT USING (true);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE user_adaptation_goals IS 'User prioritization of Galpin 9 physiological adaptations';
COMMENT ON TABLE adaptation_protocols IS 'Evidence-based training parameters per adaptation type';
COMMENT ON TABLE readiness_assessments IS 'Daily pre-workout readiness scores and recommendations';
COMMENT ON TABLE readiness_baselines IS 'Rolling 30-day averages for readiness baseline comparisons';
COMMENT ON TABLE power_tests IS 'Jump and sprint performance tests for power tracking';
COMMENT ON TABLE technique_assessments IS 'Movement quality ratings and improvement tracking';
COMMENT ON TABLE deload_triggers IS 'Automatic and manual deload recommendations';
COMMENT ON TABLE strength_standards IS 'Population percentiles for strength classification';

COMMENT ON COLUMN profiles.training_start_date IS 'Date user began structured resistance training (for training age calculation)';
COMMENT ON COLUMN profiles.experience_level IS 'Auto-calculated from training_start_date: novice (<1yr), intermediate (1-3yr), advanced (>3yr)';
COMMENT ON COLUMN exercises.is_plyometric IS 'True for jump-based explosive exercises';
COMMENT ON COLUMN exercises.is_power IS 'True for velocity-dependent exercises (Olympic lifts, throws)';
COMMENT ON COLUMN exercise_sets.tempo IS 'Time under tension format: eccentric-pause-concentric-pause (e.g., 3-1-2-0)';
COMMENT ON COLUMN exercise_sets.mean_velocity_mps IS 'Velocity-based training: mean concentric velocity in meters/second';
