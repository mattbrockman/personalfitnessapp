-- Migration: Training Load History & Seiler Endurance Metrics
-- Implements CTL/ATL/TSB tracking, threshold history, and polarized training support

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
  session_rpe_avg DECIMAL(3,1),
  training_load DECIMAL(8,1),

  -- Zone distribution (seconds)
  zone_1_seconds INTEGER DEFAULT 0,
  zone_2_seconds INTEGER DEFAULT 0,
  zone_3_seconds INTEGER DEFAULT 0,
  zone_4_seconds INTEGER DEFAULT 0,
  zone_5_seconds INTEGER DEFAULT 0,

  -- Calculated metrics
  ctl DECIMAL(6,1),
  atl DECIMAL(6,1),
  tsb DECIMAL(6,1),

  -- Strain metrics
  monotony DECIMAL(4,2),
  strain DECIMAL(8,1),

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

  -- Threshold values
  ftp_watts INTEGER,
  lthr_bpm INTEGER,
  threshold_pace_min_mile DECIMAL(5,2),
  threshold_pace_min_km DECIMAL(5,2),

  -- Test context
  test_type TEXT,
  source TEXT,
  activity_id TEXT,

  -- Confidence and validation
  confidence_level TEXT DEFAULT 'medium',
  protocol_followed BOOLEAN DEFAULT true,
  conditions TEXT,

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_threshold_user_date ON threshold_history(user_id, test_date DESC);

-- ============================================================================
-- WORKOUT EXTENSIONS
-- ============================================================================

ALTER TABLE workouts ADD COLUMN IF NOT EXISTS session_rpe INTEGER;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS training_load DECIMAL(8,1);

-- ============================================================================
-- PROFILE EXTENSIONS - Polarized training support
-- ============================================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS target_low_intensity_pct INTEGER DEFAULT 80;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS target_high_intensity_pct INTEGER DEFAULT 20;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS polarized_training_enabled BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS threshold_pace_min_mile DECIMAL(5,2);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS resting_hr INTEGER;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS max_hr INTEGER;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE training_load_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE threshold_history ENABLE ROW LEVEL SECURITY;

-- Training load policies
DO $$ BEGIN
  CREATE POLICY "Users can view own training load" ON training_load_history
    FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can insert own training load" ON training_load_history
    FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update own training load" ON training_load_history
    FOR UPDATE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can delete own training load" ON training_load_history
    FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Threshold policies
DO $$ BEGIN
  CREATE POLICY "Users can view own thresholds" ON threshold_history
    FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can insert own thresholds" ON threshold_history
    FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update own thresholds" ON threshold_history
    FOR UPDATE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can delete own thresholds" ON threshold_history
    FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

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
