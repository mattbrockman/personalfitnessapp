-- Exercise Collections - group exercises by trainer/source/program
-- Examples: Attia (longevity), Galpin (performance), Knees Over Toes (bulletproofing), PT exercises

-- Collections table
CREATE TABLE IF NOT EXISTS exercise_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users, -- NULL for system-wide collections
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  icon TEXT, -- emoji or icon name
  color TEXT, -- hex color for UI (without #)
  is_system BOOLEAN DEFAULT false, -- true for Attia, Galpin, etc.
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, slug) -- unique slug per user (NULL user_id = system)
);

-- Junction table for exercises in collections
CREATE TABLE IF NOT EXISTS exercise_collection_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID REFERENCES exercise_collections ON DELETE CASCADE NOT NULL,
  exercise_id UUID REFERENCES exercises ON DELETE CASCADE NOT NULL,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT, -- optional notes about why this exercise is in collection
  UNIQUE(collection_id, exercise_id)
);

-- Indexes
CREATE INDEX idx_collections_user ON exercise_collections(user_id);
CREATE INDEX idx_collections_slug ON exercise_collections(slug);
CREATE INDEX idx_collections_system ON exercise_collections(is_system) WHERE is_system = true;
CREATE INDEX idx_collection_items_collection ON exercise_collection_items(collection_id);
CREATE INDEX idx_collection_items_exercise ON exercise_collection_items(exercise_id);

-- RLS Policies
ALTER TABLE exercise_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_collection_items ENABLE ROW LEVEL SECURITY;

-- Collections: Users can see system collections + their own
CREATE POLICY "Users can view system collections" ON exercise_collections
  FOR SELECT USING (is_system = true OR user_id = auth.uid());

CREATE POLICY "Users can create own collections" ON exercise_collections
  FOR INSERT WITH CHECK (user_id = auth.uid() AND is_system = false);

CREATE POLICY "Users can update own collections" ON exercise_collections
  FOR UPDATE USING (user_id = auth.uid() AND is_system = false);

CREATE POLICY "Users can delete own collections" ON exercise_collections
  FOR DELETE USING (user_id = auth.uid() AND is_system = false);

-- Collection items: Users can modify items in their collections
CREATE POLICY "Users can view collection items" ON exercise_collection_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM exercise_collections c
      WHERE c.id = collection_id
      AND (c.is_system = true OR c.user_id = auth.uid())
    )
  );

CREATE POLICY "Users can add to own collections" ON exercise_collection_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM exercise_collections c
      WHERE c.id = collection_id
      AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can remove from own collections" ON exercise_collection_items
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM exercise_collections c
      WHERE c.id = collection_id
      AND c.user_id = auth.uid()
    )
  );

-- =====================================================
-- SEED SYSTEM COLLECTIONS
-- =====================================================

-- Peter Attia Collection (Longevity-focused)
INSERT INTO exercise_collections (user_id, name, slug, description, icon, color, is_system)
VALUES (
  NULL,
  'Attia - Longevity',
  'attia',
  'Peter Attia''s recommended exercises for longevity: grip strength, balance, stability, zone 2 capacity, and functional strength',
  'heart',
  '22c55e', -- green-500
  true
);

-- Andy Galpin Collection (Performance-focused)
INSERT INTO exercise_collections (user_id, name, slug, description, icon, color, is_system)
VALUES (
  NULL,
  'Galpin - Performance',
  'galpin',
  'Andy Galpin''s recommended exercises across his 9 adaptations framework: strength, hypertrophy, power, speed, endurance',
  'zap',
  'f59e0b', -- amber-500
  true
);

-- Knees Over Toes Collection (Joint bulletproofing)
INSERT INTO exercise_collections (user_id, name, slug, description, icon, color, is_system)
VALUES (
  NULL,
  'Knees Over Toes',
  'knees-over-toes',
  'Ben Patrick''s ATG program: bulletproof knees, ankles, hips. Backward sled, tibialis raises, split squats, and more',
  'shield',
  '3b82f6', -- blue-500
  true
);

-- =====================================================
-- SEED ATTIA EXERCISES (Longevity-focused)
-- =====================================================
-- Focus: Grip strength, stability, zone 2, functional movements

INSERT INTO exercise_collection_items (collection_id, exercise_id, notes)
SELECT
  (SELECT id FROM exercise_collections WHERE slug = 'attia'),
  e.id,
  CASE e.name
    WHEN 'Dead Hang' THEN 'Attia''s #1 longevity exercise - grip strength and shoulder health'
    WHEN 'Farmer''s Walk' THEN 'Loaded carry for grip, core, and functional strength'
    WHEN 'Trap Bar Deadlift' THEN 'Safer hip hinge pattern, easier on lower back'
    WHEN 'Goblet Squat' THEN 'Teaches proper squat mechanics, core engagement'
    WHEN 'Turkish Get-Up' THEN 'Full-body stability and mobility in one movement'
    WHEN 'Single Leg Romanian Deadlift' THEN 'Balance, hip stability, posterior chain'
    WHEN 'Pallof Press' THEN 'Anti-rotation core strength'
    WHEN 'Bird Dog' THEN 'Core stability and spinal health'
    WHEN 'Plank' THEN 'Foundational core endurance'
    WHEN 'Side Plank' THEN 'Lateral core stability'
    WHEN 'Step-Up' THEN 'Unilateral leg strength, balance'
    WHEN 'Box Step-Up' THEN 'Functional single-leg strength'
    WHEN 'Split Squat' THEN 'Hip mobility and single-leg strength'
    WHEN 'Bulgarian Split Squat' THEN 'Advanced single-leg strength and balance'
    WHEN 'Hip Thrust' THEN 'Glute strength for hip extension'
    WHEN 'Glute Bridge' THEN 'Hip extension and glute activation'
    WHEN 'Face Pull' THEN 'Posterior shoulder health and posture'
    WHEN 'External Rotation' THEN 'Rotator cuff health'
    WHEN 'Band Pull-Apart' THEN 'Upper back and shoulder health'
    WHEN 'Rowing Machine' THEN 'Zone 2 cardio with low impact'
    WHEN 'Assault Bike' THEN 'Zone 2 training, full body'
    WHEN 'Sled Push' THEN 'Concentric-only, joint-friendly conditioning'
    WHEN 'Pull-Up' THEN 'Upper body pulling strength, grip'
    WHEN 'Inverted Row' THEN 'Horizontal pulling, beginner-friendly'
    WHEN 'Push-Up' THEN 'Foundational pushing strength'
    WHEN 'Dumbbell Row' THEN 'Unilateral back strength'
    WHEN 'Lat Pulldown' THEN 'Vertical pulling pattern'
    WHEN 'Cable Row' THEN 'Horizontal pulling with constant tension'
    ELSE NULL
  END
FROM exercises e
WHERE e.name IN (
  'Dead Hang',
  'Farmer''s Walk',
  'Farmer''s Carry',
  'Trap Bar Deadlift',
  'Hex Bar Deadlift',
  'Goblet Squat',
  'Turkish Get-Up',
  'Single Leg Romanian Deadlift',
  'Single-Leg Romanian Deadlift',
  'Pallof Press',
  'Bird Dog',
  'Plank',
  'Side Plank',
  'Step-Up',
  'Step Up',
  'Box Step-Up',
  'Box Step Up',
  'Split Squat',
  'Bulgarian Split Squat',
  'Hip Thrust',
  'Glute Bridge',
  'Face Pull',
  'Face Pulls',
  'External Rotation',
  'Cable External Rotation',
  'Band Pull-Apart',
  'Band Pull Apart',
  'Rowing Machine',
  'Rowing',
  'Assault Bike',
  'Air Bike',
  'Sled Push',
  'Pull-Up',
  'Pull Up',
  'Pullup',
  'Inverted Row',
  'Push-Up',
  'Push Up',
  'Pushup',
  'Dumbbell Row',
  'DB Row',
  'One Arm Dumbbell Row',
  'Lat Pulldown',
  'Cable Row',
  'Seated Cable Row'
);

-- =====================================================
-- SEED GALPIN EXERCISES (9 Adaptations Performance)
-- =====================================================
-- Covers: strength, hypertrophy, power, speed, muscular endurance

INSERT INTO exercise_collection_items (collection_id, exercise_id, notes)
SELECT
  (SELECT id FROM exercise_collections WHERE slug = 'galpin'),
  e.id,
  CASE
    WHEN e.name ILIKE '%deadlift%' THEN 'Foundational hip hinge - strength & power'
    WHEN e.name ILIKE '%squat%' THEN 'Foundational squat pattern'
    WHEN e.name ILIKE '%bench%' THEN 'Horizontal press - upper body strength'
    WHEN e.name ILIKE '%press%' THEN 'Pressing strength'
    WHEN e.name ILIKE '%row%' THEN 'Horizontal pull - back development'
    WHEN e.name ILIKE '%pull%' THEN 'Vertical pull pattern'
    WHEN e.name ILIKE '%clean%' OR e.name ILIKE '%snatch%' THEN 'Olympic lift - power development'
    WHEN e.name ILIKE '%jump%' THEN 'Plyometric - power & speed'
    WHEN e.name ILIKE '%sprint%' THEN 'Speed development'
    WHEN e.name ILIKE '%carry%' OR e.name ILIKE '%walk%' THEN 'Loaded carry - functional strength'
    ELSE 'Performance training exercise'
  END
FROM exercises e
WHERE e.name IN (
  -- Strength foundation
  'Barbell Deadlift',
  'Deadlift',
  'Conventional Deadlift',
  'Sumo Deadlift',
  'Romanian Deadlift',
  'Barbell Back Squat',
  'Back Squat',
  'Squat',
  'Front Squat',
  'Barbell Front Squat',
  'Bench Press',
  'Barbell Bench Press',
  'Incline Bench Press',
  'Overhead Press',
  'Barbell Overhead Press',
  'Military Press',
  'Barbell Row',
  'Bent Over Row',
  'Pendlay Row',
  'Pull-Up',
  'Weighted Pull-Up',
  'Chin-Up',

  -- Power development
  'Power Clean',
  'Hang Clean',
  'Clean and Jerk',
  'Push Press',
  'Push Jerk',
  'Hang Snatch',
  'Power Snatch',
  'Kettlebell Swing',
  'KB Swing',

  -- Plyometrics
  'Box Jump',
  'Depth Jump',
  'Broad Jump',
  'Vertical Jump',
  'Jump Squat',
  'Medicine Ball Slam',
  'Med Ball Slam',

  -- Speed
  'Sprint',
  'Hill Sprint',
  'Sled Sprint',

  -- Hypertrophy accessory
  'Dumbbell Curl',
  'Bicep Curl',
  'Tricep Pushdown',
  'Cable Tricep Pushdown',
  'Skull Crusher',
  'Lying Tricep Extension',
  'Lateral Raise',
  'Dumbbell Lateral Raise',
  'Rear Delt Fly',
  'Leg Press',
  'Leg Extension',
  'Leg Curl',
  'Hamstring Curl',
  'Calf Raise',
  'Standing Calf Raise',

  -- Carries
  'Farmer''s Walk',
  'Farmer''s Carry',
  'Suitcase Carry',
  'Overhead Carry',
  'Yoke Walk',

  -- Muscular endurance
  'Push-Up',
  'Dip',
  'Bodyweight Squat',
  'Lunge',
  'Walking Lunge'
);

-- =====================================================
-- SEED KNEES OVER TOES EXERCISES (ATG Program)
-- =====================================================
-- Focus: Tibialis, reverse movements, full ROM, joint bulletproofing

INSERT INTO exercise_collection_items (collection_id, exercise_id, notes)
SELECT
  (SELECT id FROM exercise_collections WHERE slug = 'knees-over-toes'),
  e.id,
  CASE e.name
    WHEN 'Tibialis Raise' THEN 'Ben''s #1 - bulletproof shins and knees'
    WHEN 'Tib Raise' THEN 'Foundational ATG movement'
    WHEN 'Backward Sled Drag' THEN 'Zero impact knee strengthening'
    WHEN 'Sled Drag' THEN 'Backwards = knee rehab gold'
    WHEN 'Reverse Sled Drag' THEN 'Key ATG movement for knee health'
    WHEN 'ATG Split Squat' THEN 'Full ROM split squat, knees over toes'
    WHEN 'Poliquin Step-Up' THEN 'Petersen step-up variation'
    WHEN 'Peterson Step-Up' THEN 'VMO builder, knee health'
    WHEN 'Nordic Curl' THEN 'Hamstring eccentric strength, injury prevention'
    WHEN 'Nordic Hamstring Curl' THEN 'Gold standard for hamstring bulletproofing'
    WHEN 'Reverse Nordic' THEN 'Quad eccentric strength'
    WHEN 'Reverse Nordic Curl' THEN 'Complements Nordic curl'
    WHEN 'Sissy Squat' THEN 'Full knee flexion under load'
    WHEN 'Heel Elevated Squat' THEN 'Knees over toes squat pattern'
    WHEN 'ATG Squat' THEN 'Ass to grass - full ROM'
    WHEN 'Deep Squat' THEN 'Full depth for mobility'
    WHEN 'Jefferson Curl' THEN 'Spinal flexion mobility'
    WHEN 'Elephant Walk' THEN 'Hamstring and calf flexibility'
    WHEN 'Calf Raise' THEN 'Full ROM calf strength'
    WHEN 'Seated Calf Raise' THEN 'Soleus strength'
    WHEN 'L-Sit' THEN 'Hip flexor and core strength'
    WHEN 'Couch Stretch' THEN 'Hip flexor mobility'
    WHEN 'Hip Flexor Stretch' THEN 'Essential mobility'
    WHEN 'VMO Squat' THEN 'Targets inner quad'
    ELSE 'ATG program exercise'
  END
FROM exercises e
WHERE e.name ILIKE ANY(ARRAY[
  '%tibialis%',
  '%tib raise%',
  'backward sled%',
  'reverse sled%',
  '%sled drag%',
  '%atg split%',
  '%poliquin%',
  '%peterson%',
  '%petersen%',
  'nordic%',
  'reverse nordic%',
  'sissy squat%',
  '%heel elevated%',
  'atg squat%',
  'deep squat%',
  'jefferson curl%',
  'elephant walk%',
  '%calf raise%',
  'l-sit%',
  'l sit%',
  'couch stretch%',
  'hip flexor stretch%',
  'vmo squat%',
  '%split squat%',
  '%step up%',
  '%step-up%'
]);

-- Also add some common exercises that are part of ATG
INSERT INTO exercise_collection_items (collection_id, exercise_id, notes)
SELECT
  (SELECT id FROM exercise_collections WHERE slug = 'knees-over-toes'),
  e.id,
  'ATG standard exercise'
FROM exercises e
WHERE e.name IN (
  'Walking Lunge',
  'Lunge',
  'Reverse Lunge',
  'Step-Up',
  'Box Step-Up',
  'Bulgarian Split Squat',
  'Single Leg Squat',
  'Pistol Squat',
  'Wall Sit',
  'Horse Stance',
  'Glute Ham Raise',
  'GHD',
  'Good Morning',
  'Romanian Deadlift',
  'Single Leg Romanian Deadlift'
)
AND NOT EXISTS (
  SELECT 1 FROM exercise_collection_items eci
  WHERE eci.collection_id = (SELECT id FROM exercise_collections WHERE slug = 'knees-over-toes')
  AND eci.exercise_id = e.id
);
