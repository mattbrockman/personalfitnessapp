-- Intervals.icu Integration Tables
-- Enables workout sync to Zwift/Wahoo via Intervals.icu, activity pull, and RPE collection

-- ============================================================================
-- INTERVALS EVENT LINKS - Track pushed/pulled workouts
-- ============================================================================

CREATE TABLE IF NOT EXISTS intervals_event_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  suggested_workout_id UUID REFERENCES suggested_workouts(id) ON DELETE SET NULL,
  workout_id UUID REFERENCES workouts(id) ON DELETE SET NULL,
  intervals_event_id TEXT NOT NULL,        -- Intervals.icu event ID
  external_id TEXT NOT NULL,               -- Our ID sent to Intervals (forge_{workout_id})
  sync_direction TEXT NOT NULL CHECK (sync_direction IN ('push', 'pull')),
  zwo_content TEXT,                        -- Store generated ZWO for debugging/retry
  scheduled_date DATE,                     -- When the workout is scheduled
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  last_sync_status TEXT DEFAULT 'pending', -- pending, success, failed
  last_sync_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, intervals_event_id),
  UNIQUE(external_id)
);

-- Indexes for intervals_event_links
CREATE INDEX IF NOT EXISTS idx_intervals_links_user ON intervals_event_links(user_id);
CREATE INDEX IF NOT EXISTS idx_intervals_links_workout ON intervals_event_links(workout_id);
CREATE INDEX IF NOT EXISTS idx_intervals_links_suggested ON intervals_event_links(suggested_workout_id);
CREATE INDEX IF NOT EXISTS idx_intervals_links_external ON intervals_event_links(external_id);
CREATE INDEX IF NOT EXISTS idx_intervals_links_status ON intervals_event_links(last_sync_status);
CREATE INDEX IF NOT EXISTS idx_intervals_links_date ON intervals_event_links(user_id, scheduled_date);

-- RLS for intervals_event_links
ALTER TABLE intervals_event_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own intervals links" ON intervals_event_links
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- PUSH SUBSCRIPTIONS - Web Push notification endpoints
-- ============================================================================

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  keys_p256dh TEXT NOT NULL,
  keys_auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  UNIQUE(user_id, endpoint)
);

-- Indexes for push_subscriptions
CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions(user_id);

-- RLS for push_subscriptions
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own push subscriptions" ON push_subscriptions
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- RPE PROMPTS - Track pending RPE collection requests
-- ============================================================================

CREATE TABLE IF NOT EXISTS rpe_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  workout_id UUID NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  suggested_workout_id UUID REFERENCES suggested_workouts(id) ON DELETE SET NULL,
  intervals_activity_id TEXT,              -- Activity ID from Intervals.icu
  source_platform TEXT,                    -- zwift, wahoo, garmin, strava, other
  prompt_type TEXT NOT NULL DEFAULT 'both' CHECK (prompt_type IN ('in_app', 'push', 'both')),
  scheduled_for TIMESTAMPTZ NOT NULL,      -- When to show the prompt
  sent_at TIMESTAMPTZ,                     -- When push notification was sent
  responded_at TIMESTAMPTZ,                -- When user submitted RPE
  rpe_value INTEGER CHECK (rpe_value >= 1 AND rpe_value <= 10),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workout_id)
);

-- Indexes for rpe_prompts
CREATE INDEX IF NOT EXISTS idx_rpe_prompts_user ON rpe_prompts(user_id);
CREATE INDEX IF NOT EXISTS idx_rpe_prompts_pending ON rpe_prompts(user_id, scheduled_for)
  WHERE responded_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_rpe_prompts_workout ON rpe_prompts(workout_id);

-- RLS for rpe_prompts
ALTER TABLE rpe_prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own rpe prompts" ON rpe_prompts
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- PROFILE SETTINGS - Add Intervals.icu and push notification settings
-- ============================================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS intervals_sync_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS push_notifications_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS rpe_prompt_delay_minutes INTEGER DEFAULT 30;

-- ============================================================================
-- INTEGRATIONS TABLE - Add intervals_athlete_id column
-- ============================================================================

ALTER TABLE integrations ADD COLUMN IF NOT EXISTS intervals_athlete_id TEXT;

-- ============================================================================
-- HELPER FUNCTION - Get pending RPE prompts for a user
-- ============================================================================

CREATE OR REPLACE FUNCTION get_pending_rpe_prompts(p_user_id UUID)
RETURNS TABLE (
  prompt_id UUID,
  workout_id UUID,
  workout_name TEXT,
  workout_date DATE,
  completed_at TIMESTAMPTZ,
  source_platform TEXT,
  scheduled_for TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    rp.id as prompt_id,
    rp.workout_id,
    w.name as workout_name,
    w.scheduled_date as workout_date,
    w.completed_at,
    rp.source_platform,
    rp.scheduled_for
  FROM rpe_prompts rp
  JOIN workouts w ON w.id = rp.workout_id
  WHERE rp.user_id = p_user_id
    AND rp.responded_at IS NULL
    AND rp.scheduled_for <= NOW()
  ORDER BY rp.scheduled_for DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
