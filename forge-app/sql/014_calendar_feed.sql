-- Calendar Feed Integration
-- Adds calendar token for iCal feed subscription

-- Add calendar columns to profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS calendar_token UUID DEFAULT gen_random_uuid(),
ADD COLUMN IF NOT EXISTS calendar_enabled BOOLEAN DEFAULT false;

-- Create unique index for fast token lookup
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_calendar_token ON profiles(calendar_token);

-- Add comment for documentation
COMMENT ON COLUMN profiles.calendar_token IS 'Unique token for iCal calendar feed URL';
COMMENT ON COLUMN profiles.calendar_enabled IS 'Whether the calendar feed is enabled';
