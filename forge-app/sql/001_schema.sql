-- FORGE Database Schema
-- Run this in your Supabase SQL Editor to set up all tables

-- ============================================================================
-- PROFILES (extends Supabase auth.users)
-- ============================================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  
  -- Training zones
  ftp_watts INTEGER,                    -- Functional Threshold Power (cycling)
  lthr_bpm INTEGER,                     -- Lactate Threshold Heart Rate
  max_hr_bpm INTEGER,                   -- Max Heart Rate
  
  -- Nutrition targets
  calorie_target INTEGER DEFAULT 2400,
  protein_target_g INTEGER DEFAULT 180,
  carb_target_g INTEGER DEFAULT 250,
  fat_target_g INTEGER DEFAULT 80,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- ============================================================================
-- INTEGRATIONS (OAuth tokens for Strava, etc.)
-- ============================================================================
CREATE TABLE IF NOT EXISTS integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,               -- 'strava', 'trainerroad', 'whoop', etc.
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  external_user_id TEXT,                -- User ID on the external platform
  metadata JSONB DEFAULT '{}',          -- Provider-specific data
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own integrations" ON integrations FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- EXERCISES (library of exercises)
-- ============================================================================
CREATE TABLE IF NOT EXISTS exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  primary_muscles TEXT[],               -- ['chest', 'triceps']
  secondary_muscles TEXT[],
  equipment TEXT,                       -- 'barbell', 'dumbbell', 'cable', 'bodyweight'
  difficulty TEXT,                      -- 'beginner', 'intermediate', 'advanced'
  instructions TEXT,
  coaching_cues TEXT[],                 -- Array of form cues
  common_mistakes TEXT[],               -- Array of mistakes to avoid
  is_compound BOOLEAN DEFAULT FALSE,
  is_unilateral BOOLEAN DEFAULT FALSE,
  video_url TEXT,
  thumbnail_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Full-text search on exercises
CREATE INDEX IF NOT EXISTS exercises_search_idx ON exercises 
  USING gin(to_tsvector('english', name || ' ' || COALESCE(description, '')));

-- ============================================================================
-- WORKOUTS (cardio, strength, etc.)
-- ============================================================================
CREATE TABLE IF NOT EXISTS workouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Basic info
  workout_type TEXT NOT NULL,           -- 'ride', 'run', 'strength', 'swim', 'yoga', 'class', 'other'
  category TEXT NOT NULL,               -- 'cardio', 'strength', 'flexibility', 'other'
  name TEXT,
  description TEXT,
  
  -- Scheduling
  scheduled_date DATE,
  scheduled_time TIME,
  status TEXT DEFAULT 'planned',        -- 'planned', 'completed', 'skipped'
  
  -- Planned metrics
  planned_duration_minutes INTEGER,
  planned_tss INTEGER,
  planned_intensity TEXT,               -- 'easy', 'moderate', 'hard', 'interval'
  
  -- Actual metrics (filled after completion)
  actual_duration_minutes INTEGER,
  actual_distance_miles DECIMAL(10,2),
  actual_elevation_ft INTEGER,
  actual_calories INTEGER,
  actual_tss INTEGER,
  avg_heart_rate INTEGER,
  max_heart_rate INTEGER,
  avg_power_watts INTEGER,
  max_power_watts INTEGER,
  avg_pace_per_mile TEXT,               -- '8:30' format
  
  -- Source tracking
  source TEXT DEFAULT 'manual',         -- 'manual', 'strava', 'trainerroad', 'garmin'
  external_id TEXT,                     -- ID from external source
  
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own workouts" ON workouts FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS workouts_user_date_idx ON workouts(user_id, scheduled_date);
CREATE INDEX IF NOT EXISTS workouts_external_idx ON workouts(user_id, source, external_id);

-- ============================================================================
-- WORKOUT ZONES (time in each HR/Power/Pace zone)
-- ============================================================================
CREATE TABLE IF NOT EXISTS workout_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id UUID NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  zone_type TEXT NOT NULL,              -- 'heart_rate', 'power', 'pace'
  zone_1_seconds INTEGER DEFAULT 0,
  zone_2_seconds INTEGER DEFAULT 0,
  zone_3_seconds INTEGER DEFAULT 0,
  zone_4_seconds INTEGER DEFAULT 0,
  zone_5_seconds INTEGER DEFAULT 0,
  zone_6_seconds INTEGER DEFAULT 0,     -- For power zones (Z6/Z7)
  zone_7_seconds INTEGER DEFAULT 0
);

ALTER TABLE workout_zones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage workout zones" ON workout_zones FOR ALL 
  USING (EXISTS (SELECT 1 FROM workouts WHERE workouts.id = workout_zones.workout_id AND workouts.user_id = auth.uid()));

-- ============================================================================
-- WORKOUT EXERCISES (exercises within a strength workout)
-- ============================================================================
CREATE TABLE IF NOT EXISTS workout_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id UUID NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  exercise_id UUID REFERENCES exercises(id),
  exercise_name TEXT,                   -- Denormalized for quick display
  order_index INTEGER NOT NULL,
  superset_group TEXT,                  -- 'A', 'B', 'C' for supersets
  rest_seconds INTEGER DEFAULT 90,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE workout_exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage workout exercises" ON workout_exercises FOR ALL 
  USING (EXISTS (SELECT 1 FROM workouts WHERE workouts.id = workout_exercises.workout_id AND workouts.user_id = auth.uid()));

-- ============================================================================
-- EXERCISE SETS (individual sets within an exercise)
-- ============================================================================
CREATE TABLE IF NOT EXISTS exercise_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_exercise_id UUID NOT NULL REFERENCES workout_exercises(id) ON DELETE CASCADE,
  set_number INTEGER NOT NULL,
  set_type TEXT DEFAULT 'working',      -- 'warmup', 'working', 'dropset', 'failure', 'amrap'
  
  -- Targets
  target_reps INTEGER,
  target_weight_lbs DECIMAL(10,2),
  target_rpe DECIMAL(3,1),
  
  -- Actuals
  actual_reps INTEGER,
  actual_weight_lbs DECIMAL(10,2),
  actual_rpe DECIMAL(3,1),
  
  completed BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE exercise_sets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage exercise sets" ON exercise_sets FOR ALL 
  USING (EXISTS (
    SELECT 1 FROM workout_exercises we 
    JOIN workouts w ON w.id = we.workout_id 
    WHERE we.id = exercise_sets.workout_exercise_id AND w.user_id = auth.uid()
  ));

-- ============================================================================
-- NUTRITION LOGS (daily nutrition summary)
-- ============================================================================
CREATE TABLE IF NOT EXISTS nutrition_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  
  -- Totals (calculated from foods)
  total_calories INTEGER DEFAULT 0,
  total_protein_g DECIMAL(10,1) DEFAULT 0,
  total_carbs_g DECIMAL(10,1) DEFAULT 0,
  total_fat_g DECIMAL(10,1) DEFAULT 0,
  total_fiber_g DECIMAL(10,1) DEFAULT 0,
  total_sodium_mg INTEGER DEFAULT 0,
  
  water_oz INTEGER DEFAULT 0,
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, log_date)
);

ALTER TABLE nutrition_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own nutrition logs" ON nutrition_logs FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- NUTRITION FOODS (individual food entries)
-- ============================================================================
CREATE TABLE IF NOT EXISTS nutrition_foods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nutrition_log_id UUID NOT NULL REFERENCES nutrition_logs(id) ON DELETE CASCADE,
  
  meal_type TEXT NOT NULL,              -- 'breakfast', 'lunch', 'dinner', 'snack'
  food_name TEXT NOT NULL,
  brand TEXT,
  serving_size DECIMAL(10,2),
  serving_unit TEXT,                    -- 'g', 'oz', 'cup', 'piece'
  
  calories INTEGER,
  protein_g DECIMAL(10,1),
  carbs_g DECIMAL(10,1),
  fat_g DECIMAL(10,1),
  fiber_g DECIMAL(10,1),
  sodium_mg INTEGER,
  
  source TEXT DEFAULT 'manual',         -- 'manual', 'photo_ai', 'barcode', 'database', 'favorite'
  photo_url TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE nutrition_foods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage nutrition foods" ON nutrition_foods FOR ALL 
  USING (EXISTS (SELECT 1 FROM nutrition_logs WHERE nutrition_logs.id = nutrition_foods.nutrition_log_id AND nutrition_logs.user_id = auth.uid()));

-- ============================================================================
-- SLEEP LOGS
-- ============================================================================
CREATE TABLE IF NOT EXISTS sleep_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  
  -- Times
  bedtime TIMESTAMPTZ,
  wake_time TIMESTAMPTZ,
  
  -- Duration
  total_sleep_minutes INTEGER,
  time_in_bed_minutes INTEGER,
  
  -- Stages (in minutes)
  deep_sleep_minutes INTEGER,
  rem_sleep_minutes INTEGER,
  light_sleep_minutes INTEGER,
  awake_minutes INTEGER,
  
  -- Scores and vitals
  sleep_score INTEGER,                  -- 0-100
  hrv_avg INTEGER,                      -- ms
  resting_hr INTEGER,                   -- bpm
  respiratory_rate DECIMAL(4,1),        -- breaths/min
  recovery_score INTEGER,               -- 0-100
  
  source TEXT DEFAULT 'manual',         -- 'manual', 'eight_sleep_screenshot', 'apple_health', 'whoop', 'oura'
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, log_date)
);

ALTER TABLE sleep_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own sleep logs" ON sleep_logs FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- JOURNAL ENTRIES (notes, injuries, goals)
-- ============================================================================
CREATE TABLE IF NOT EXISTS journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  entry_type TEXT NOT NULL,             -- 'general', 'injury', 'recovery', 'goal', 'milestone', 'technique'
  title TEXT,
  content TEXT NOT NULL,
  tags TEXT[],                          -- ['knee', 'squat', 'form']
  
  -- Injury-specific fields
  body_part TEXT,                       -- 'knee', 'shoulder', 'lower_back', etc.
  body_side TEXT,                       -- 'left', 'right', 'both'
  severity INTEGER,                     -- 1-5 scale
  injury_status TEXT,                   -- 'active', 'recovering', 'resolved'
  
  -- Linked workout (optional)
  workout_id UUID REFERENCES workouts(id) ON DELETE SET NULL,
  
  entry_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own journal entries" ON journal_entries FOR ALL USING (auth.uid() = user_id);

-- Full-text search on journal
CREATE INDEX IF NOT EXISTS journal_search_idx ON journal_entries 
  USING gin(to_tsvector('english', COALESCE(title, '') || ' ' || content || ' ' || COALESCE(body_part, '')));

-- ============================================================================
-- WORKOUT TEMPLATES
-- ============================================================================
CREATE TABLE IF NOT EXISTS workout_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,  -- NULL for system templates
  
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,               -- 'push', 'pull', 'legs', 'upper', 'lower', 'full_body', 'cardio', 'custom'
  estimated_duration_min INTEGER,
  
  exercises JSONB NOT NULL,             -- Array of exercise configs
  
  is_system BOOLEAN DEFAULT FALSE,      -- Built-in templates
  is_favorite BOOLEAN DEFAULT FALSE,
  times_used INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE workout_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view system templates" ON workout_templates FOR SELECT USING (is_system = TRUE OR user_id = auth.uid());
CREATE POLICY "Users can manage own templates" ON workout_templates FOR ALL USING (user_id = auth.uid());

-- ============================================================================
-- WEIGHT LOGS (body weight tracking)
-- ============================================================================
CREATE TABLE IF NOT EXISTS weight_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  weight_lbs DECIMAL(5,1) NOT NULL,
  body_fat_pct DECIMAL(4,1),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, log_date)
);

ALTER TABLE weight_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own weight logs" ON weight_logs FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- COACH ACCESS (read-only sharing)
-- ============================================================================
CREATE TABLE IF NOT EXISTS coach_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  access_pin TEXT NOT NULL,             -- 6-digit PIN
  access_name TEXT,                     -- 'Coach Mike', 'Dr. Smith'
  permissions JSONB DEFAULT '{"workouts": true, "nutrition": false, "sleep": false, "journal": false}',
  expires_at TIMESTAMPTZ,
  last_accessed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE coach_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own coach access" ON coach_access FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- FUNCTION: Auto-create profile on signup
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create profile
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- FUNCTION: Update nutrition log totals
-- ============================================================================
CREATE OR REPLACE FUNCTION update_nutrition_totals()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE nutrition_logs SET
    total_calories = (SELECT COALESCE(SUM(calories), 0) FROM nutrition_foods WHERE nutrition_log_id = COALESCE(NEW.nutrition_log_id, OLD.nutrition_log_id)),
    total_protein_g = (SELECT COALESCE(SUM(protein_g), 0) FROM nutrition_foods WHERE nutrition_log_id = COALESCE(NEW.nutrition_log_id, OLD.nutrition_log_id)),
    total_carbs_g = (SELECT COALESCE(SUM(carbs_g), 0) FROM nutrition_foods WHERE nutrition_log_id = COALESCE(NEW.nutrition_log_id, OLD.nutrition_log_id)),
    total_fat_g = (SELECT COALESCE(SUM(fat_g), 0) FROM nutrition_foods WHERE nutrition_log_id = COALESCE(NEW.nutrition_log_id, OLD.nutrition_log_id)),
    total_fiber_g = (SELECT COALESCE(SUM(fiber_g), 0) FROM nutrition_foods WHERE nutrition_log_id = COALESCE(NEW.nutrition_log_id, OLD.nutrition_log_id)),
    total_sodium_mg = (SELECT COALESCE(SUM(sodium_mg), 0) FROM nutrition_foods WHERE nutrition_log_id = COALESCE(NEW.nutrition_log_id, OLD.nutrition_log_id)),
    updated_at = NOW()
  WHERE id = COALESCE(NEW.nutrition_log_id, OLD.nutrition_log_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS nutrition_foods_trigger ON nutrition_foods;
CREATE TRIGGER nutrition_foods_trigger
  AFTER INSERT OR UPDATE OR DELETE ON nutrition_foods
  FOR EACH ROW EXECUTE FUNCTION update_nutrition_totals();

-- ============================================================================
-- Done! Your database is ready.
-- ============================================================================
