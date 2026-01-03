-- Add missing workout columns that the UI expects
-- These columns are used in WorkoutDetailModal.tsx

-- Add perceived_exertion for RPE tracking (1-10 scale)
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS perceived_exertion INTEGER;
COMMENT ON COLUMN workouts.perceived_exertion IS 'Rating of Perceived Exertion (1-10) after completing workout';

-- Add external_url for links to Strava activity page, etc.
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS external_url TEXT;
COMMENT ON COLUMN workouts.external_url IS 'URL to the workout on the source platform (Strava, Garmin, etc.)';

-- completed_at is needed for completion tracking (may already exist)
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
COMMENT ON COLUMN workouts.completed_at IS 'When the workout was marked as completed';
