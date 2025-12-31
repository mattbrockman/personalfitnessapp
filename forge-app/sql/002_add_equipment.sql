-- Add available_equipment field to profiles table
-- This stores the user's gym equipment for AI workout generation

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS available_equipment TEXT[] DEFAULT ARRAY['barbell', 'dumbbell', 'cable', 'machine', 'bodyweight'];

-- Add comment for documentation
COMMENT ON COLUMN profiles.available_equipment IS 'Array of equipment types user has access to: barbell, dumbbell, cable, machine, bodyweight, kettlebell, bands';
