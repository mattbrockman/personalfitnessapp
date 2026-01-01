-- Direct Eight Sleep integration
-- Store tokens securely for each user

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS eightsleep_user_id TEXT,
ADD COLUMN IF NOT EXISTS eightsleep_access_token TEXT,
ADD COLUMN IF NOT EXISTS eightsleep_refresh_token TEXT,
ADD COLUMN IF NOT EXISTS eightsleep_token_expires_at TIMESTAMPTZ;

-- Add comment for documentation
COMMENT ON COLUMN profiles.eightsleep_user_id IS 'Eight Sleep user ID from their API';
COMMENT ON COLUMN profiles.eightsleep_access_token IS 'Eight Sleep OAuth access token';
COMMENT ON COLUMN profiles.eightsleep_refresh_token IS 'Eight Sleep OAuth refresh token for renewal';
COMMENT ON COLUMN profiles.eightsleep_token_expires_at IS 'When the access token expires';
