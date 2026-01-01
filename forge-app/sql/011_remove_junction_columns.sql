-- Remove unused Junction/Vital API columns from profiles
-- These were added for the Junction integration which has been replaced by direct Eight Sleep API

ALTER TABLE profiles
DROP COLUMN IF EXISTS junction_user_id,
DROP COLUMN IF EXISTS junction_connected_providers;

DROP INDEX IF EXISTS idx_profiles_junction_user_id;
