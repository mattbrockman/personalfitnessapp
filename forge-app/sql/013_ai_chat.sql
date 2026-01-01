-- AI Chat Integration
-- Creates chat_messages table for conversation history
-- Adds AI coach settings to profiles

-- 1. Create chat_messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  context_type TEXT, -- 'workout', 'sleep', 'plan', 'readiness', etc.
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_created ON chat_messages(user_id, created_at DESC);

-- RLS policies
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own messages" ON chat_messages
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own messages" ON chat_messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own messages" ON chat_messages
  FOR DELETE USING (auth.uid() = user_id);

-- 2. Add AI coach settings to profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS ai_coach_model TEXT DEFAULT 'claude-opus-4-20250514',
ADD COLUMN IF NOT EXISTS ai_coach_personality TEXT DEFAULT 'coach';

-- Add comment for documentation
COMMENT ON COLUMN profiles.ai_coach_model IS 'Claude model for AI coach: claude-opus-4-20250514, claude-sonnet-4-20250514, claude-3-5-haiku-20241022';
COMMENT ON COLUMN profiles.ai_coach_personality IS 'AI coach personality: coach, scientist, friend';
