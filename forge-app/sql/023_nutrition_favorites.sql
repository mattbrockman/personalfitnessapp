-- ============================================================================
-- NUTRITION FAVORITES TABLE
-- ============================================================================
-- User's saved favorite foods for quick logging

CREATE TABLE IF NOT EXISTS nutrition_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Food identification
  food_name TEXT NOT NULL,
  brand TEXT,

  -- Serving info
  serving_size DECIMAL(10,2) DEFAULT 1,
  serving_unit TEXT DEFAULT 'serving',

  -- Nutrition per serving
  calories INTEGER,
  protein_g DECIMAL(10,1),
  carbs_g DECIMAL(10,1),
  fat_g DECIMAL(10,1),
  fiber_g DECIMAL(10,1),

  -- Source tracking
  original_source TEXT,  -- 'manual', 'barcode', 'database', 'photo_ai'
  barcode TEXT,          -- Store barcode for quick re-lookup

  -- Usage tracking
  times_logged INTEGER DEFAULT 1,
  last_logged_at TIMESTAMPTZ DEFAULT NOW(),

  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Prevent exact duplicates per user
  UNIQUE(user_id, food_name, brand, serving_unit)
);

-- Enable Row Level Security
ALTER TABLE nutrition_favorites ENABLE ROW LEVEL SECURITY;

-- Users can only manage their own favorites
CREATE POLICY "Users can manage own favorites" ON nutrition_favorites
  FOR ALL USING (auth.uid() = user_id);

-- Index for faster lookups sorted by usage
CREATE INDEX idx_nutrition_favorites_user ON nutrition_favorites(user_id, times_logged DESC);

-- ============================================================================
-- ADD SERVING_UNIT TO NUTRITION_FOODS (if not exists)
-- ============================================================================
ALTER TABLE nutrition_foods ADD COLUMN IF NOT EXISTS serving_unit TEXT DEFAULT 'serving';
ALTER TABLE nutrition_foods ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================================================
-- TRIGGER: Auto-increment times_logged when a favorite is used
-- ============================================================================
CREATE OR REPLACE FUNCTION increment_favorite_usage()
RETURNS TRIGGER AS $$
BEGIN
  -- Try to find and update matching favorite
  UPDATE nutrition_favorites SET
    times_logged = times_logged + 1,
    last_logged_at = NOW()
  WHERE user_id = (
    SELECT user_id FROM nutrition_logs WHERE id = NEW.nutrition_log_id
  )
  AND food_name = NEW.food_name
  AND (brand = NEW.brand OR (brand IS NULL AND NEW.brand IS NULL));

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger (drop first if exists to avoid duplicates)
DROP TRIGGER IF EXISTS nutrition_foods_favorite_usage ON nutrition_foods;
CREATE TRIGGER nutrition_foods_favorite_usage
  AFTER INSERT ON nutrition_foods
  FOR EACH ROW EXECUTE FUNCTION increment_favorite_usage();
