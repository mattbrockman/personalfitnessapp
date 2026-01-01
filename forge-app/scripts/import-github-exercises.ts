#!/usr/bin/env npx tsx
/**
 * GitHub Exercise Import Script (FREE) - Hybrid Approach Step 1
 *
 * Downloads 800+ exercises from free-exercise-db GitHub repository.
 * Includes static images (start/end positions) - GIFs added later via ExerciseDB free tier.
 *
 * Run with: npx tsx scripts/import-github-exercises.ts
 *
 * Environment variables required:
 * - NEXT_PUBLIC_SUPABASE_URL: Supabase project URL
 * - SUPABASE_SERVICE_ROLE_KEY: Supabase service role key
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve } from 'path'

// Load environment variables from .env.local
dotenv.config({ path: resolve(process.cwd(), '.env.local') })

// Configuration
const CONFIG = {
  // Free Exercise DB - 800+ exercises, public domain
  sourceUrl: 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json',

  // Base URL for images
  imageBaseUrl: 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises',

  // Batch size for database inserts
  batchSize: 50,
}

// Equipment normalization
const EQUIPMENT_MAP: Record<string, string> = {
  'barbell': 'barbell',
  'dumbbell': 'dumbbells',
  'dumbbells': 'dumbbells',
  'cable': 'cable',
  'machine': 'machine',
  'body only': 'bodyweight',
  'body weight': 'bodyweight',
  'bodyweight': 'bodyweight',
  'other': 'other',
  'kettlebells': 'kettlebell',
  'kettlebell': 'kettlebell',
  'e-z curl bar': 'ez_bar',
  'medicine ball': 'medicine_ball',
  'exercise ball': 'stability_ball',
  'foam roll': 'foam_roller',
  'bands': 'bands',
  'none': 'bodyweight',
}

// Muscle normalization
const MUSCLE_MAP: Record<string, string> = {
  'abdominals': 'core',
  'abs': 'core',
  'abductors': 'abductors',
  'adductors': 'adductors',
  'biceps': 'biceps',
  'calves': 'calves',
  'chest': 'chest',
  'forearms': 'forearms',
  'glutes': 'glutes',
  'hamstrings': 'hamstrings',
  'lats': 'lats',
  'lower back': 'lower_back',
  'middle back': 'upper_back',
  'neck': 'neck',
  'quadriceps': 'quads',
  'shoulders': 'shoulders',
  'traps': 'traps',
  'triceps': 'triceps',
}

interface FreeExerciseDbEntry {
  name: string
  force?: string
  level?: string
  mechanic?: string
  equipment?: string
  primaryMuscles?: string[]
  secondaryMuscles?: string[]
  instructions?: string[]
  category?: string
  images?: string[]
}

interface ImportStats {
  fetched: number
  imported: number
  skipped: number
  errors: string[]
}

async function main() {
  console.log('🏋️ FORGE Exercise Import (GitHub - FREE)')
  console.log('==========================================\n')

  // Validate environment
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase environment variables')
    console.log('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  const stats: ImportStats = {
    fetched: 0,
    imported: 0,
    skipped: 0,
    errors: [],
  }

  try {
    // Step 1: Fetch from free-exercise-db
    console.log('📥 Fetching exercises from free-exercise-db...')
    const response = await fetch(CONFIG.sourceUrl)

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`)
    }

    const exercises: FreeExerciseDbEntry[] = await response.json()
    stats.fetched = exercises.length
    console.log(`   Found ${exercises.length} exercises\n`)

    // Step 2: Check for existing exercises
    console.log('🔎 Checking for existing exercises...')
    const { data: existingExercises } = await supabase
      .from('exercises')
      .select('name')

    const existingNames = new Set(
      (existingExercises || []).map(e => e.name.toLowerCase())
    )
    console.log(`   Found ${existingNames.size} existing exercises\n`)

    // Step 3: Filter to new exercises only
    const newExercises = exercises.filter(
      ex => !existingNames.has(ex.name.toLowerCase())
    )
    console.log(`   ${newExercises.length} new exercises to import\n`)

    if (newExercises.length === 0) {
      console.log('✅ No new exercises to import. Database is up to date!')
      return
    }

    // Step 4: Transform and import in batches
    console.log('💾 Importing exercises...')

    for (let i = 0; i < newExercises.length; i += CONFIG.batchSize) {
      const batch = newExercises.slice(i, i + CONFIG.batchSize)
      const batchNum = Math.floor(i / CONFIG.batchSize) + 1
      const totalBatches = Math.ceil(newExercises.length / CONFIG.batchSize)

      process.stdout.write(`   Batch ${batchNum}/${totalBatches}... `)

      const transformed = batch.map(ex => transformExercise(ex))

      const { error } = await supabase.from('exercises').insert(transformed)

      if (error) {
        console.log('❌ Error')
        stats.errors.push(`Batch ${batchNum}: ${error.message}`)
        stats.skipped += batch.length
      } else {
        console.log('✅')
        stats.imported += batch.length
      }
    }

    // Print summary
    console.log('\n==========================================')
    console.log('📊 Import Summary')
    console.log('==========================================')
    console.log(`   Total fetched:  ${stats.fetched}`)
    console.log(`   Imported:       ${stats.imported}`)
    console.log(`   Skipped:        ${stats.skipped}`)

    if (stats.errors.length > 0) {
      console.log('\n❌ Errors:')
      stats.errors.forEach(err => console.log(`   - ${err}`))
    }

    console.log('\n✅ Import complete!')
    console.log('\n📌 Next steps:')
    console.log('   1. Run AI enhancement: npx tsx scripts/enhance-exercises.ts')
    console.log('   2. The enhancement will add coaching cues and GIF URLs')

  } catch (error) {
    console.error('\n❌ Fatal error:', error)
    process.exit(1)
  }
}

/**
 * Transform free-exercise-db format to FORGE format
 */
function transformExercise(ex: FreeExerciseDbEntry) {
  const primaryMuscle = ex.primaryMuscles?.[0]?.toLowerCase() || ''

  // Build image URL from the exercise directory structure
  // Format: exercises/{exercise-name}/images/0.jpg
  const exerciseDir = ex.images?.[0]?.split('/')[0] || ''
  const imageUrl = exerciseDir
    ? `${CONFIG.imageBaseUrl}/${exerciseDir}/images/0.jpg`
    : null

  return {
    external_id: exerciseDir || slugify(ex.name),
    external_source: 'free-exercise-db',
    name: titleCase(ex.name),
    description: null, // Will be enhanced by AI
    instructions: ex.instructions?.join(' ') || null,
    primary_muscles: [MUSCLE_MAP[primaryMuscle] || primaryMuscle.replace(/\s+/g, '_')],
    secondary_muscles: (ex.secondaryMuscles || []).map(m =>
      MUSCLE_MAP[m.toLowerCase()] || m.toLowerCase().replace(/\s+/g, '_')
    ),
    equipment: EQUIPMENT_MAP[ex.equipment?.toLowerCase() || ''] || ex.equipment?.toLowerCase().replace(/\s+/g, '_') || 'bodyweight',
    difficulty: mapDifficulty(ex.level),
    is_compound: ex.mechanic === 'compound',
    is_unilateral: ex.name.toLowerCase().includes('single') ||
                   ex.name.toLowerCase().includes('one-') ||
                   ex.name.toLowerCase().includes('unilateral'),
    body_part: mapBodyPart(ex.primaryMuscles?.[0] || ''),
    // Static image from free-exercise-db (GIF will be added later via ExerciseDB)
    video_url: null, // Reserved for GIF - will be populated by fetch-gifs script
    thumbnail_url: imageUrl, // Static image for thumbnail
    // These will be filled by AI enhancement
    coaching_cues: [],
    common_mistakes: [],
    galpin_adaptations: [],
    import_date: new Date().toISOString(),
    ai_enhanced: false,
    // Priority score for GIF fetching (compound exercises get priority)
    quality_score: ex.mechanic === 'compound' ? 80 : 50,
  }
}

/**
 * Map difficulty levels
 */
function mapDifficulty(level?: string): 'beginner' | 'intermediate' | 'advanced' | null {
  if (!level) return null
  const l = level.toLowerCase()
  if (l === 'beginner' || l === 'easy') return 'beginner'
  if (l === 'intermediate' || l === 'medium') return 'intermediate'
  if (l === 'advanced' || l === 'expert' || l === 'hard') return 'advanced'
  return 'intermediate'
}

/**
 * Map muscle to body part
 */
function mapBodyPart(muscle: string): string {
  const m = muscle.toLowerCase()
  if (['chest'].includes(m)) return 'chest'
  if (['lats', 'middle back', 'lower back', 'traps'].includes(m)) return 'back'
  if (['shoulders'].includes(m)) return 'shoulders'
  if (['biceps', 'triceps', 'forearms'].includes(m)) return 'upper arms'
  if (['quadriceps', 'hamstrings', 'glutes', 'adductors', 'abductors'].includes(m)) return 'upper legs'
  if (['calves'].includes(m)) return 'lower legs'
  if (['abdominals'].includes(m)) return 'waist'
  return 'other'
}

/**
 * Convert string to URL-friendly slug
 */
function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

/**
 * Convert string to title case
 */
function titleCase(str: string): string {
  return str
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

// Run the script
main().catch(console.error)
