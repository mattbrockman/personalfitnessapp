-- Add weather location columns to profiles
-- Used for fetching weather forecasts for calendar display

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS weather_zip_code TEXT,
ADD COLUMN IF NOT EXISTS weather_lat DECIMAL(9,6),
ADD COLUMN IF NOT EXISTS weather_lon DECIMAL(9,6),
ADD COLUMN IF NOT EXISTS weather_location_name TEXT;

-- Add comment for documentation
COMMENT ON COLUMN profiles.weather_zip_code IS 'User zip code for weather lookup';
COMMENT ON COLUMN profiles.weather_lat IS 'Latitude for weather API (from zip or geolocation)';
COMMENT ON COLUMN profiles.weather_lon IS 'Longitude for weather API (from zip or geolocation)';
COMMENT ON COLUMN profiles.weather_location_name IS 'Human-readable location name (e.g., Austin, TX)';
