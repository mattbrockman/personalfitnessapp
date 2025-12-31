-- FORGE Exercise Library Seed Data
-- Comprehensive exercise database with coaching cues and muscle targeting

-- Clear existing seed data (if re-running)
-- DELETE FROM public.exercises WHERE user_id IS NULL;

INSERT INTO public.exercises (
  user_id, name, description, instructions, 
  primary_muscle, secondary_muscles, equipment, difficulty,
  video_url, thumbnail_url, cues, common_mistakes,
  is_compound, is_unilateral
) VALUES

-- ============================================
-- CHEST EXERCISES
-- ============================================

(NULL, 'Barbell Bench Press', 
'The king of chest exercises. Builds overall chest mass and pressing strength.',
'Lie on bench with eyes under bar. Grip slightly wider than shoulder width. Unrack, lower to mid-chest, press up.',
'chest', ARRAY['triceps', 'front_delts'], 'barbell', 'intermediate',
NULL, NULL,
ARRAY['Squeeze shoulder blades together', 'Drive feet into floor', 'Bar path: slight diagonal from chest to over shoulders', 'Keep wrists straight'],
ARRAY['Flaring elbows too wide (injury risk)', 'Bouncing bar off chest', 'Lifting hips off bench', 'Inconsistent bar path'],
true, false),

(NULL, 'Dumbbell Bench Press',
'Allows greater range of motion than barbell. Better for muscle balance.',
'Lie on bench, dumbbells at chest level. Press up while slightly arcing the weights together. Lower with control.',
'chest', ARRAY['triceps', 'front_delts'], 'dumbbells', 'beginner',
NULL, NULL,
ARRAY['Start and end position at chest, not shoulders', 'Slight arc inward at top', 'Control the negative', 'Full stretch at bottom'],
ARRAY['Going too heavy and losing control', 'Not going deep enough', 'Dumbbells drifting too far apart'],
true, false),

(NULL, 'Incline Dumbbell Press',
'Targets upper chest. Essential for complete chest development.',
'Set bench to 30-45 degrees. Press dumbbells from upper chest, slight arc together at top.',
'chest', ARRAY['triceps', 'front_delts'], 'dumbbells', 'beginner',
NULL, NULL,
ARRAY['30-45 degree angle optimal', 'Feel stretch in upper chest at bottom', 'Dont let shoulders take over', 'Keep core tight'],
ARRAY['Bench angle too steep (becomes shoulder press)', 'Excessive back arch', 'Rushing the negative'],
true, false),

(NULL, 'Cable Flyes',
'Constant tension throughout movement. Great for chest isolation and mind-muscle connection.',
'Stand between cables set at chest height. Slight bend in elbows. Bring hands together in hugging motion.',
'chest', ARRAY['front_delts'], 'cable', 'beginner',
NULL, NULL,
ARRAY['Think about touching elbows together', 'Slight forward lean', 'Squeeze at peak contraction', 'Constant tension - no rest at top'],
ARRAY['Using too much weight', 'Straightening arms (becomes pressing)', 'Losing the chest squeeze'],
true, false),

(NULL, 'Dips (Chest Focus)',
'Compound movement for lower chest. Also hits triceps heavily.',
'Lean forward 30+ degrees. Lower until upper arms parallel to ground. Press back up.',
'chest', ARRAY['triceps', 'front_delts'], 'bodyweight', 'intermediate',
NULL, NULL,
ARRAY['Forward lean is key for chest', 'Go deep but within comfortable range', 'Dont lock out aggressively', 'Keep shoulders down'],
ARRAY['Staying too upright (shifts to triceps)', 'Going too deep too soon', 'Flaring elbows excessively'],
true, false),

(NULL, 'Push-Ups',
'Foundational movement. Scalable from beginner to advanced.',
'Hands slightly wider than shoulders. Body straight line. Lower chest to floor, push back up.',
'chest', ARRAY['triceps', 'front_delts', 'core'], 'bodyweight', 'beginner',
NULL, NULL,
ARRAY['Body stays rigid like a plank', 'Elbows at 45 degrees, not flared', 'Full range of motion', 'Squeeze chest at top'],
ARRAY['Sagging hips', 'Partial reps', 'Flaring elbows to 90 degrees', 'Looking up (neck strain)'],
true, false),

-- ============================================
-- BACK EXERCISES
-- ============================================

(NULL, 'Barbell Row',
'Primary back mass builder. Targets entire back with emphasis on lats and rhomboids.',
'Hinge at hips, back flat, grip just outside knees. Pull bar to lower chest/upper abs.',
'lats', ARRAY['rhomboids', 'rear_delts', 'biceps', 'lower_back'], 'barbell', 'intermediate',
NULL, NULL,
ARRAY['Lead with elbows', 'Squeeze shoulder blades at top', 'Control the negative', 'Maintain flat back throughout'],
ARRAY['Using momentum/body english', 'Rounding lower back', 'Pulling to belly button (less lat engagement)', 'Standing too upright'],
true, false),

(NULL, 'Pull-Ups',
'Best bodyweight back exercise. Builds V-taper and lat width.',
'Hang from bar, hands just outside shoulders. Pull until chin over bar. Lower with control.',
'lats', ARRAY['biceps', 'rhomboids', 'rear_delts'], 'pullup_bar', 'intermediate',
NULL, NULL,
ARRAY['Initiate by depressing shoulder blades', 'Drive elbows down and back', 'Full hang at bottom', 'Chin clearly over bar'],
ARRAY['Kipping/swinging', 'Partial reps', 'Neglecting the negative', 'Shrugging shoulders up'],
true, false),

(NULL, 'Lat Pulldown',
'Machine alternative to pull-ups. Allows for easier load adjustment.',
'Grip wide, lean back slightly. Pull bar to upper chest while squeezing lats.',
'lats', ARRAY['biceps', 'rhomboids'], 'cable', 'beginner',
NULL, NULL,
ARRAY['Slight lean back (15-20 degrees)', 'Pull to upper chest, not behind neck', 'Squeeze lats at bottom', 'Control the return'],
ARRAY['Pulling behind neck (shoulder injury risk)', 'Leaning too far back', 'Using momentum', 'Grip too narrow'],
true, false),

(NULL, 'Seated Cable Row',
'Excellent for mid-back thickness. Constant tension throughout.',
'Sit with knees slightly bent. Pull handle to lower chest, squeezing shoulder blades.',
'rhomboids', ARRAY['lats', 'rear_delts', 'biceps'], 'cable', 'beginner',
NULL, NULL,
ARRAY['Chest up throughout', 'Pull to lower chest/upper abs', 'Squeeze shoulder blades together', 'Dont lean back excessively'],
ARRAY['Excessive forward lean at start', 'Rounding back', 'Using body momentum', 'Not squeezing at contraction'],
true, false),

(NULL, 'Single-Arm Dumbbell Row',
'Unilateral back work. Great for fixing imbalances and mind-muscle connection.',
'One hand and knee on bench. Row dumbbell to hip, elbow close to body.',
'lats', ARRAY['rhomboids', 'rear_delts', 'biceps'], 'dumbbells', 'beginner',
NULL, NULL,
ARRAY['Pull to hip, not chest', 'Keep elbow close to body', 'Full stretch at bottom', 'Rotate slightly at top for extra squeeze'],
ARRAY['Rotating torso too much', 'Using momentum', 'Pulling to shoulder instead of hip', 'Rounding back'],
true, true),

(NULL, 'Face Pulls',
'Essential for shoulder health and rear delt development. Counters all the pressing.',
'Cable at face height. Pull to face, externally rotating at end. Squeeze rear delts.',
'rear_delts', ARRAY['rhomboids', 'rotator_cuff'], 'cable', 'beginner',
NULL, NULL,
ARRAY['Pull apart at face, not just to face', 'External rotation at end', 'Squeeze rear delts', 'Light weight, high reps'],
ARRAY['Going too heavy', 'No external rotation', 'Pulling to chest instead of face', 'Using body momentum'],
false, false),

(NULL, 'Deadlift',
'The ultimate strength builder. Works entire posterior chain.',
'Bar over mid-foot. Hinge to grip bar. Flat back, drive through floor, lockout with glutes.',
'lower_back', ARRAY['glutes', 'hamstrings', 'traps', 'forearms'], 'barbell', 'advanced',
NULL, NULL,
ARRAY['Bar stays close to body entire lift', 'Push floor away', 'Lock out with glutes, not lower back', 'Brace core hard'],
ARRAY['Rounding lower back', 'Bar drifting forward', 'Hyperextending at top', 'Jerking the weight'],
true, false),

-- ============================================
-- SHOULDER EXERCISES
-- ============================================

(NULL, 'Overhead Press',
'Primary shoulder mass builder. Also hits triceps and core.',
'Bar at collarbone, grip just outside shoulders. Press overhead, finish with bar over mid-foot.',
'front_delts', ARRAY['side_delts', 'triceps', 'core'], 'barbell', 'intermediate',
NULL, NULL,
ARRAY['Squeeze glutes and brace core', 'Bar path: around face then straight up', 'Full lockout overhead', 'Head through at top'],
ARRAY['Excessive back arch', 'Pressing in front of body', 'Not locking out', 'Flaring ribs'],
true, false),

(NULL, 'Dumbbell Lateral Raise',
'Primary side delt isolator. Builds shoulder width.',
'Slight bend in elbows. Raise to sides until arms parallel to floor. Control down.',
'side_delts', ARRAY['traps'], 'dumbbells', 'beginner',
NULL, NULL,
ARRAY['Lead with elbows, not hands', 'Slight forward lean', 'Pinky up at top (pour water)', 'Control the negative'],
ARRAY['Going too heavy', 'Swinging/using momentum', 'Raising too high (traps take over)', 'Shrugging'],
false, false),

(NULL, 'Arnold Press',
'Hits all three delt heads. Named after Arnold Schwarzenegger.',
'Start with palms facing you. Press up while rotating palms forward. Reverse on the way down.',
'front_delts', ARRAY['side_delts', 'rear_delts', 'triceps'], 'dumbbells', 'intermediate',
NULL, NULL,
ARRAY['Smooth rotation throughout press', 'Full range of motion', 'Control the rotation on negative', 'Dont rush'],
ARRAY['Rushing the rotation', 'Using too much weight', 'Not going through full ROM', 'Losing control at bottom'],
true, false),

(NULL, 'Rear Delt Fly',
'Isolates rear delts. Important for shoulder balance and posture.',
'Hinged over, slight bend in elbows. Raise arms to sides, squeezing rear delts.',
'rear_delts', ARRAY['rhomboids'], 'dumbbells', 'beginner',
NULL, NULL,
ARRAY['Keep slight elbow bend', 'Lead with elbows', 'Squeeze at top', 'Dont swing'],
ARRAY['Using too much weight', 'Rounding back', 'Straightening arms', 'Using momentum'],
false, false),

-- ============================================
-- ARM EXERCISES
-- ============================================

(NULL, 'Barbell Curl',
'Classic bicep mass builder.',
'Grip shoulder width. Curl up keeping elbows pinned. Lower with control.',
'biceps', ARRAY['forearms'], 'barbell', 'beginner',
NULL, NULL,
ARRAY['Elbows stay at sides', 'Full extension at bottom', 'Squeeze at top', 'Control the negative'],
ARRAY['Swinging body', 'Elbows drifting forward', 'Partial reps', 'Going too heavy'],
false, false),

(NULL, 'Hammer Curls',
'Targets brachialis and forearms. Builds arm thickness.',
'Neutral grip (palms facing each other). Curl up, squeeze, lower with control.',
'biceps', ARRAY['brachialis', 'forearms'], 'dumbbells', 'beginner',
NULL, NULL,
ARRAY['Keep wrists neutral throughout', 'Elbows stay pinned', 'Full range of motion', 'Can alternate or simultaneous'],
ARRAY['Swinging body', 'Rotating wrists', 'Using momentum', 'Partial reps'],
false, false),

(NULL, 'Incline Dumbbell Curl',
'Stretches long head of biceps. Great for peak development.',
'Bench at 45-60 degrees. Let arms hang. Curl up, squeeze, lower fully.',
'biceps', ARRAY['forearms'], 'dumbbells', 'intermediate',
NULL, NULL,
ARRAY['Let arms hang straight down', 'Full stretch at bottom', 'Supinate as you curl', 'Dont let elbows drift forward'],
ARRAY['Not getting full stretch', 'Elbows moving forward', 'Rushing reps', 'Using too much weight'],
false, false),

(NULL, 'Tricep Pushdown',
'Primary tricep isolator. Good for all three heads.',
'Elbows pinned to sides. Push down until full extension. Control the return.',
'triceps', NULL, 'cable', 'beginner',
NULL, NULL,
ARRAY['Elbows stay at sides', 'Full lockout at bottom', 'Squeeze triceps hard', 'Control the negative'],
ARRAY['Elbows flaring out', 'Leaning forward too much', 'Using momentum', 'Partial reps'],
false, false),

(NULL, 'Skull Crushers',
'Excellent for long head of triceps. Builds arm mass.',
'Lie on bench. Lower weight to forehead/behind head. Extend arms fully.',
'triceps', NULL, 'barbell', 'intermediate',
NULL, NULL,
ARRAY['Keep elbows pointed up', 'Lower to forehead or behind', 'Full extension at top', 'Upper arms stay still'],
ARRAY['Flaring elbows', 'Moving upper arms', 'Going too heavy', 'Not going deep enough'],
false, false),

(NULL, 'Close-Grip Bench Press',
'Compound tricep movement. Also hits chest.',
'Grip just inside shoulder width. Lower bar to lower chest. Press up.',
'triceps', ARRAY['chest', 'front_delts'], 'barbell', 'intermediate',
NULL, NULL,
ARRAY['Grip just inside shoulders (not too narrow)', 'Elbows stay close to body', 'Full lockout', 'Touch lower chest'],
ARRAY['Grip too narrow (wrist strain)', 'Flaring elbows (becomes chest press)', 'Bouncing off chest'],
true, false),

-- ============================================
-- LEG EXERCISES
-- ============================================

(NULL, 'Barbell Back Squat',
'The king of leg exercises. Builds overall leg mass and strength.',
'Bar on upper back. Feet shoulder width. Squat to parallel or below. Drive up through heels.',
'quads', ARRAY['glutes', 'hamstrings', 'core', 'lower_back'], 'barbell', 'intermediate',
NULL, NULL,
ARRAY['Brace core before descent', 'Knees track over toes', 'Drive through whole foot', 'Chest up throughout'],
ARRAY['Knees caving in', 'Forward lean/good morning squat', 'Not hitting depth', 'Heels rising'],
true, false),

(NULL, 'Romanian Deadlift',
'Primary hamstring and glute builder. Essential for posterior chain.',
'Slight knee bend. Hinge at hips, pushing butt back. Lower until hamstring stretch. Return by squeezing glutes.',
'hamstrings', ARRAY['glutes', 'lower_back'], 'barbell', 'intermediate',
NULL, NULL,
ARRAY['Push hips BACK, not just down', 'Feel hamstring stretch', 'Bar stays close to legs', 'Squeeze glutes at top'],
ARRAY['Bending knees too much (becomes squat)', 'Rounding lower back', 'Not pushing hips back enough', 'Going too heavy'],
true, false),

(NULL, 'Leg Press',
'Machine alternative to squats. Allows heavy loading with less technical demand.',
'Feet shoulder width on platform. Lower until 90 degrees. Press without locking knees.',
'quads', ARRAY['glutes', 'hamstrings'], 'machine', 'beginner',
NULL, NULL,
ARRAY['Dont lock knees at top', 'Full range of motion', 'Keep lower back on pad', 'Different foot positions = different emphasis'],
ARRAY['Locking knees', 'Lower back lifting off pad', 'Half reps', 'Feet too high or low'],
true, false),

(NULL, 'Walking Lunges',
'Unilateral leg work. Great for balance and stability.',
'Step forward, lower back knee to floor. Push through front foot to step forward.',
'quads', ARRAY['glutes', 'hamstrings'], 'bodyweight', 'beginner',
NULL, NULL,
ARRAY['Front knee tracks over toes', 'Torso stays upright', 'Push through front heel', 'Control the movement'],
ARRAY['Front knee caving in', 'Leaning forward', 'Short steps', 'Rushing'],
true, true),

(NULL, 'Leg Curl',
'Isolates hamstrings. Good for knee health and hamstring development.',
'Lie on machine. Curl heels toward butt. Squeeze at top. Control down.',
'hamstrings', NULL, 'machine', 'beginner',
NULL, NULL,
ARRAY['Full range of motion', 'Squeeze at top', 'Dont lift hips', 'Control the negative'],
ARRAY['Using momentum', 'Lifting hips', 'Partial reps', 'Going too heavy'],
false, false),

(NULL, 'Leg Extension',
'Quad isolation. Good for warming up or finishing leg workouts.',
'Extend legs until straight. Squeeze quads at top. Lower with control.',
'quads', NULL, 'machine', 'beginner',
NULL, NULL,
ARRAY['Full extension at top', 'Squeeze quads hard', 'Control the negative', 'Dont swing'],
ARRAY['Using momentum', 'Partial reps', 'Going too heavy', 'Lifting off seat'],
false, false),

(NULL, 'Calf Raises',
'Primary calf builder. Can be done standing or seated.',
'Rise up on toes. Full contraction at top. Lower until full stretch.',
'calves', NULL, 'machine', 'beginner',
NULL, NULL,
ARRAY['Full range of motion', 'Pause at top', 'Slow negative', 'Dont bounce'],
ARRAY['Bouncing at bottom', 'Partial reps', 'Going too heavy', 'Rushing'],
false, false),

(NULL, 'Hip Thrust',
'Best glute isolation exercise. Builds strong glutes.',
'Upper back on bench. Bar across hips. Drive hips up, squeeze glutes at top.',
'glutes', ARRAY['hamstrings'], 'barbell', 'intermediate',
NULL, NULL,
ARRAY['Chin tucked throughout', 'Squeeze glutes at top', 'Feet flat, knees 90 degrees at top', 'Dont hyperextend'],
ARRAY['Hyperextending lower back', 'Chin jutting forward', 'Feet too far out', 'Using lower back instead of glutes'],
false, false),

-- ============================================
-- CORE EXERCISES
-- ============================================

(NULL, 'Plank',
'Foundational core stability exercise.',
'Forearms on ground. Body straight line from head to heels. Hold position.',
'core', ARRAY['shoulders'], 'bodyweight', 'beginner',
NULL, NULL,
ARRAY['Squeeze glutes', 'Draw belly button in', 'Dont let hips sag', 'Breathe normally'],
ARRAY['Hips sagging', 'Hips too high', 'Holding breath', 'Looking up'],
false, false),

(NULL, 'Cable Woodchop',
'Rotational core strength. Important for athletics and daily life.',
'Cable at high or low position. Rotate torso, pulling cable across body. Control return.',
'obliques', ARRAY['core'], 'cable', 'intermediate',
NULL, NULL,
ARRAY['Power comes from hips', 'Arms stay straight', 'Control the rotation', 'Full range of motion'],
ARRAY['All arms, no rotation', 'Rushing', 'Using too much weight', 'Rounding back'],
false, false),

(NULL, 'Hanging Leg Raise',
'Advanced core exercise. Builds lower ab strength.',
'Hang from bar. Raise legs to 90 degrees or higher. Lower with control.',
'core', ARRAY['hip_flexors'], 'pullup_bar', 'advanced',
NULL, NULL,
ARRAY['Minimize swing', 'Control the negative', 'Keep legs straight if possible', 'Exhale as you raise'],
ARRAY['Swinging', 'Using momentum', 'Bending knees (unless intentional)', 'Not controlling negative'],
false, false),

(NULL, 'Ab Wheel Rollout',
'Advanced core exercise. Builds anti-extension strength.',
'Kneel on floor. Roll wheel out as far as possible. Pull back using core.',
'core', ARRAY['lats'], 'ab_wheel', 'advanced',
NULL, NULL,
ARRAY['Keep core tight throughout', 'Squeeze glutes', 'Go as far as you can control', 'Dont let hips sag'],
ARRAY['Going too far (losing tension)', 'Hips sagging', 'Using arms to pull back', 'Holding breath'],
false, false),

-- ============================================
-- FUNCTIONAL / COMPOUND
-- ============================================

(NULL, 'Farmers Walk',
'Total body conditioning. Builds grip, core, and work capacity.',
'Pick up heavy weights. Walk with good posture. Dont let weights swing.',
'forearms', ARRAY['traps', 'core', 'glutes'], 'dumbbells', 'beginner',
NULL, NULL,
ARRAY['Shoulders back and down', 'Short quick steps', 'Dont let weights swing', 'Breathe steadily'],
ARRAY['Rounding shoulders', 'Taking too long steps', 'Letting weights swing', 'Holding breath'],
true, false),

(NULL, 'Turkish Get-Up',
'Full body mobility and stability. Great for shoulder health.',
'Lie down with weight overhead. Stand up while keeping weight stable. Reverse to return.',
'core', ARRAY['shoulders', 'glutes', 'quads'], 'kettlebell', 'advanced',
NULL, NULL,
ARRAY['Eyes on weight at all times', 'Move slowly and deliberately', 'Each position is a checkpoint', 'Start light'],
ARRAY['Rushing', 'Losing sight of weight', 'Not learning each position', 'Going too heavy too soon'],
true, true),

(NULL, 'Kettlebell Swing',
'Explosive hip hinge. Builds power and conditioning.',
'Hinge at hips. Snap hips forward to swing weight. Let it float, dont lift with arms.',
'glutes', ARRAY['hamstrings', 'core', 'shoulders'], 'kettlebell', 'intermediate',
NULL, NULL,
ARRAY['Power from hip snap', 'Arms are just hooks', 'Squeeze glutes at top', 'Breathe out at top'],
ARRAY['Squatting instead of hinging', 'Lifting with arms', 'Rounding back', 'Not using hips'],
true, false),

(NULL, 'Battle Ropes',
'Metabolic conditioning. Builds work capacity and grip endurance.',
'Hold rope ends. Create waves through alternating arm movements.',
'shoulders', ARRAY['core', 'forearms'], 'battle_ropes', 'beginner',
NULL, NULL,
ARRAY['Keep core tight', 'Maintain athletic stance', 'Create waves to the anchor', 'Vary patterns'],
ARRAY['Standing too upright', 'Small waves', 'Holding breath', 'Stopping when tired'],
false, false),

(NULL, 'Box Jumps',
'Plyometric power exercise. Builds explosive leg strength.',
'Stand in front of box. Jump and land softly on top. Step down.',
'quads', ARRAY['glutes', 'calves'], 'plyo_box', 'intermediate',
NULL, NULL,
ARRAY['Land softly', 'Full hip extension before jump', 'Step down, dont jump', 'Focus on quality'],
ARRAY['Landing hard', 'Rebounding jumps (for beginners)', 'Not opening hips', 'Box too high'],
true, false);

-- Add more sport-specific exercises Matt might use

INSERT INTO public.exercises (
  user_id, name, description, instructions, 
  primary_muscle, secondary_muscles, equipment, difficulty,
  cues, common_mistakes, is_compound, is_unilateral
) VALUES

(NULL, 'Cyclists Squat',
'Quad-dominant squat variation. Mimics cycling position.',
'Heels elevated. Narrow stance. Squat deep with upright torso.',
'quads', ARRAY['glutes'], 'barbell', 'intermediate',
ARRAY['Heels on plates or wedge', 'Stay upright', 'Go deep', 'Drive through quads'],
ARRAY['Leaning forward', 'Not going deep', 'Too wide stance'],
true, false),

(NULL, 'Single-Leg Romanian Deadlift',
'Unilateral hip hinge. Great for balance and hamstring strength.',
'Stand on one leg. Hinge forward while extending other leg back. Return by squeezing glute.',
'hamstrings', ARRAY['glutes', 'core'], 'dumbbells', 'intermediate',
ARRAY['Hips stay square', 'Reach back with rear leg', 'Slight knee bend in standing leg', 'Core tight'],
ARRAY['Hips rotating open', 'Rounding back', 'Losing balance', 'Not hinging deep enough'],
true, true),

(NULL, 'Copenhagen Plank',
'Adductor strengthening. Important for injury prevention.',
'Side plank position. Top leg on bench. Lift body using adductor.',
'adductors', ARRAY['core', 'obliques'], 'bench', 'advanced',
ARRAY['Keep body straight', 'Squeeze inner thigh', 'Dont let hips drop', 'Start with short holds'],
ARRAY['Hips dropping', 'Rotating torso', 'Holding breath'],
false, true),

(NULL, 'Reverse Nordic Curl',
'Quad lengthening exercise. Great for cyclists and knee health.',
'Kneel on pad. Slowly lean back, controlling with quads. Return to upright.',
'quads', ARRAY['hip_flexors'], 'bodyweight', 'advanced',
ARRAY['Squeeze glutes to protect lower back', 'Control the descent', 'Dont go too far back initially', 'Keep hips extended'],
ARRAY['Bending at hips', 'Going too deep too soon', 'Using momentum'],
false, false),

(NULL, 'Pallof Press',
'Anti-rotation core exercise. Builds functional core stability.',
'Cable at chest height. Press out and hold. Resist rotation.',
'core', ARRAY['obliques'], 'cable', 'beginner',
ARRAY['Resist the rotation', 'Press straight out', 'Breathe normally', 'Squeeze core'],
ARRAY['Allowing rotation', 'Holding breath', 'Using too much weight'],
false, false),

(NULL, 'Glute Bridge',
'Glute activation exercise. Good warm-up or rehab movement.',
'Lie on back, feet flat. Drive hips up by squeezing glutes. Hold at top.',
'glutes', ARRAY['hamstrings'], 'bodyweight', 'beginner',
ARRAY['Drive through heels', 'Squeeze glutes hard at top', 'Dont hyperextend', 'Feet flat throughout'],
ARRAY['Pushing through toes', 'Hyperextending lower back', 'Not squeezing glutes'],
false, false),

(NULL, 'Dead Bug',
'Core stability exercise. Safe for lower back.',
'Lie on back, arms and legs up. Lower opposite arm and leg while maintaining back position.',
'core', ARRAY['hip_flexors'], 'bodyweight', 'beginner',
ARRAY['Press lower back into floor', 'Exhale as you extend', 'Move slowly', 'Keep non-moving limbs still'],
ARRAY['Lower back arching', 'Moving too fast', 'Holding breath'],
false, false),

(NULL, 'Bird Dog',
'Core and back stability. Great for warm-ups.',
'On hands and knees. Extend opposite arm and leg. Return and switch.',
'core', ARRAY['lower_back', 'glutes'], 'bodyweight', 'beginner',
ARRAY['Keep hips level', 'Reach long', 'Dont rotate', 'Move with control'],
ARRAY['Rotating hips', 'Arching back', 'Moving too fast'],
false, true);

-- Create index for faster exercise searches
CREATE INDEX IF NOT EXISTS idx_exercises_search ON public.exercises USING gin(to_tsvector('english', name || ' ' || COALESCE(description, '')));
