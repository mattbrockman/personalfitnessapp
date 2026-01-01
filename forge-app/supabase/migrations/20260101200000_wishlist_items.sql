-- Migration: Create wishlist_items table for AI coach feature requests and bug reports

CREATE TABLE IF NOT EXISTS wishlist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'wishlist' CHECK (category IN ('wishlist', 'bug', 'in_progress', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Index for user lookups
CREATE INDEX idx_wishlist_items_user_id ON wishlist_items(user_id);
CREATE INDEX idx_wishlist_items_category ON wishlist_items(category);

-- RLS policies
ALTER TABLE wishlist_items ENABLE ROW LEVEL SECURITY;

-- Users can view all wishlist items (shared across users for visibility)
CREATE POLICY "Users can view all wishlist items"
  ON wishlist_items FOR SELECT
  TO authenticated
  USING (true);

-- Users can insert their own wishlist items
CREATE POLICY "Users can insert own wishlist items"
  ON wishlist_items FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own wishlist items
CREATE POLICY "Users can update own wishlist items"
  ON wishlist_items FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can delete their own wishlist items
CREATE POLICY "Users can delete own wishlist items"
  ON wishlist_items FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Grant service role full access
GRANT ALL ON wishlist_items TO service_role;
