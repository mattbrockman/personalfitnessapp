-- Migration: Strava Integration Enhancements
-- Adds: scopes tracking, webhook support, activity links for bidirectional sync

-- Add columns to integrations table for enhanced Strava tracking
ALTER TABLE integrations ADD COLUMN IF NOT EXISTS scopes TEXT[];
ALTER TABLE integrations ADD COLUMN IF NOT EXISTS strava_athlete_id TEXT;
ALTER TABLE integrations ADD COLUMN IF NOT EXISTS webhook_subscription_id INTEGER;
ALTER TABLE integrations ADD COLUMN IF NOT EXISTS last_webhook_at TIMESTAMPTZ;
ALTER TABLE integrations ADD COLUMN IF NOT EXISTS last_poll_at TIMESTAMPTZ;

-- Track Strava activity links (bidirectional sync between app workouts and Strava activities)
CREATE TABLE IF NOT EXISTS strava_activity_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  workout_id UUID NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  strava_activity_id BIGINT NOT NULL,
  sync_direction TEXT NOT NULL CHECK (sync_direction IN ('pull', 'push')),
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, strava_activity_id),
  UNIQUE(workout_id, sync_direction)
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_strava_links_workout ON strava_activity_links(workout_id);
CREATE INDEX IF NOT EXISTS idx_strava_links_activity ON strava_activity_links(strava_activity_id);

-- Webhook event queue for processing incoming Strava events
CREATE TABLE IF NOT EXISTS strava_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  object_type TEXT NOT NULL,
  object_id BIGINT NOT NULL,
  aspect_type TEXT NOT NULL,
  owner_id BIGINT NOT NULL,
  subscription_id INTEGER,
  updates JSONB,
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient unprocessed event queries
CREATE INDEX IF NOT EXISTS idx_strava_webhook_unprocessed
  ON strava_webhook_events(created_at)
  WHERE processed = FALSE;

-- RLS policies
ALTER TABLE strava_activity_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE strava_webhook_events ENABLE ROW LEVEL SECURITY;

-- Users can only see their own activity links
DROP POLICY IF EXISTS "Users own strava links" ON strava_activity_links;
CREATE POLICY "Users own strava links"
  ON strava_activity_links
  FOR ALL
  USING (auth.uid() = user_id);

-- Webhook events are system-managed (no direct user access via RLS)
-- Service role will be used to insert/update these
DROP POLICY IF EXISTS "Service role manages webhook events" ON strava_webhook_events;
CREATE POLICY "Service role manages webhook events"
  ON strava_webhook_events
  FOR ALL
  USING (false)
  WITH CHECK (false);
