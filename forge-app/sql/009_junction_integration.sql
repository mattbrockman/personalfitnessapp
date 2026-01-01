-- Junction API Integration
-- Adds fields to store Junction user mapping and connected providers

-- Add Junction fields to profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS junction_user_id TEXT,
ADD COLUMN IF NOT EXISTS junction_connected_providers JSONB DEFAULT '[]';

-- Index for Junction user lookup
CREATE INDEX IF NOT EXISTS idx_profiles_junction_user_id
ON profiles(junction_user_id) WHERE junction_user_id IS NOT NULL;

-- Comment for documentation
COMMENT ON COLUMN profiles.junction_user_id IS 'Junction (Vital) API user ID for wearable integrations';
COMMENT ON COLUMN profiles.junction_connected_providers IS 'Array of connected provider slugs (e.g., ["eight_sleep", "oura"])';
