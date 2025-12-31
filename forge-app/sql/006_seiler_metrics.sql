-- Migration: Seiler Endurance Training Metrics
-- Implements polarized training, CTL/ATL/TSB, session RPE, and threshold tracking

-- ============================================================================
-- TRAINING LOAD HISTORY - Daily aggregated training metrics for CTL/ATL/TSB
-- ============================================================================

CREATE TABLE IF NOT EXISTS training_load_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,

  -- Daily totals
  total_tss DECIMAL(6,1) DEFAULT 0,
  total_duration_minutes INTEGER DEFAULT 0,
  session_rpe_avg DECIMAL(3,1), -- Average session RPE for day
  training_load DECIMAL(8,1), -- Duration × RPE (Foster's method)

  -- Zone distribution (seconds) - aggregated from all workouts
  zone_1_seconds INTEGER DEFAULT 0,
  zone_2_seconds INTEGER DEFAULT 0,
  zone_3_seconds INTEGER DEFAULT 0,
  zone_4_seconds INTEGER DEFAULT 0,
  zone_5_seconds INTEGER DEFAULT 0,

  -- Calculated metrics (updated daily via background job or on-demand)
  ctl DECIMAL(6,1), -- Chronic Training Load (42-day exponential avg)
  atl DECIMAL(6,1), -- Acute Training Load (7-day exponential avg)
  tsb DECIMAL(6,1), -- Training Stress Balance (CTL - ATL = Form)

  -- Strain metrics (weekly rolling)
  monotony DECIMAL(4,2), -- Mean load / SD of load (higher = more monotonous)
  strain DECIMAL(8,1), -- Weekly load × monotony (injury risk indicator)

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, log_date)
);

CREATE INDEX IF NOT EXISTS idx_training_load_user_date ON training_load_history(user_id, log_date DESC);

-- ============================================================================
-- THRESHOLD HISTORY - FTP, LTHR, and threshold pace tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS threshold_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  test_date DATE NOT NULL,

  -- Threshold values (all optional - user may only track some)
  ftp_watts INTEGER, -- Functional Threshold Power (cycling)
  lthr_bpm INTEGER, -- Lactate Threshold Heart Rate
  threshold_pace_min_mile DECIMAL(5,2), -- Threshold running pace (min/mile)
  threshold_pace_min_km DECIMAL(5,2), -- Threshold running pace (min/km)

  -- Test context
  test_type TEXT, -- 'ftp_test_20min', 'ftp_test_ramp', 'lthr_test', 'time_trial', 'race', 'estimated'
  source TEXT, -- 'manual', 'strava', 'zwift', 'garmin', 'wahoo', 'trainingpeaks'
  activity_id TEXT, -- Reference to source activity if applicable

  -- Confidence and validation
  confidence_level TEXT DEFAULT 'medium', -- 'high', 'medium', 'low'
  protocol_followed BOOLEAN DEFAULT true, -- Whether standard protocol was followed
  conditions TEXT, -- 'indoor', 'outdoor_flat', 'outdoor_hilly', 'heat', 'altitude'

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_threshold_user_date ON threshold_history(user_id, test_date DESC);

-- ============================================================================
-- PROFILE EXTENSIONS - Add endurance-related fields
-- ============================================================================

-- Session RPE field on workouts (different from set-level perceived_exertion)
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS session_rpe INTEGER CHECK (session_rpe >= 1 AND session_rpe <= 10);
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS training_load DECIMAL(8,1); -- Duration × session_rpe

-- Polarized training targets on profile
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS target_low_intensity_pct INTEGER DEFAULT 80;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS target_high_intensity_pct INTEGER DEFAULT 20;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS polarized_training_enabled BOOLEAN DEFAULT false;

-- Current threshold values on profile (latest values for quick access)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ftp_watts INTEGER;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS lthr_bpm INTEGER;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS threshold_pace_min_mile DECIMAL(5,2);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS resting_hr INTEGER;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS max_hr INTEGER;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE training_load_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE threshold_history ENABLE ROW LEVEL SECURITY;

-- Training load policies
CREATE POLICY "Users can view own training load" ON training_load_history
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own training load" ON training_load_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own training load" ON training_load_history
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own training load" ON training_load_history
  FOR DELETE USING (auth.uid() = user_id);

-- Threshold policies
CREATE POLICY "Users can view own thresholds" ON threshold_history
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own thresholds" ON threshold_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own thresholds" ON threshold_history
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own thresholds" ON threshold_history
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE training_load_history IS 'Daily aggregated training load for CTL/ATL/TSB calculation (Banister model)';
COMMENT ON TABLE threshold_history IS 'Historical record of threshold tests (FTP, LTHR, pace)';

COMMENT ON COLUMN training_load_history.ctl IS 'Chronic Training Load - 42-day exponentially weighted TSS average (fitness)';
COMMENT ON COLUMN training_load_history.atl IS 'Acute Training Load - 7-day exponentially weighted TSS average (fatigue)';
COMMENT ON COLUMN training_load_history.tsb IS 'Training Stress Balance - CTL minus ATL (form/freshness)';
COMMENT ON COLUMN training_load_history.monotony IS 'Training monotony - mean daily load / SD of daily load over 7 days';
COMMENT ON COLUMN training_load_history.strain IS 'Training strain - weekly load × monotony (injury risk when high)';

COMMENT ON COLUMN workouts.session_rpe IS 'Overall session RPE (1-10) - Foster method for training load calculation';
COMMENT ON COLUMN workouts.training_load IS 'Session training load = duration_minutes × session_rpe';
