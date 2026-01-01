#!/usr/bin/env npx tsx
/**
 * Integrate ExerciseDB data with FORGE exercise library
 *
 * This script:
 * 1. Loads exerciseData_complete.json from the purchased ExerciseDB package
 * 2. Matches exercises by normalized name with existing FORGE exercises
 * 3. Updates matched exercises with GIF URLs
 * 4. Imports new exercises from ExerciseDB that don't exist
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve } from 'path'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'

dotenv.config({ path: resolve(process.cwd(), '.env.local') })

const DATA_PATH = resolve(process.cwd(), 'data/exercisedb/mobile/exerciseData_complete.json')
const BUCKET_NAME = 'exercise-gifs'

interface ExerciseDBEntry {
  id: string
  name: string
  bodyPart: string
  equipment: string
  target: string
  secondaryMuscles: string[]
  instructions: string[]
  description: string
  difficulty: string
  category: string
}

interface ExistingExercise {
  id: string
  name: string
  external_id: string | null
}

// Map ExerciseDB body parts to our schema
const BODY_PART_MAP: Record<string, string> = {
  'waist': 'core',
  'upper legs': 'legs',
  'lower legs': 'legs',
  'upper arms': 'arms',
  'lower arms': 'arms',
  'back': 'back',
  'chest': 'chest',
  'shoulders': 'shoulders',
  'cardio': 'full_body',
  'neck': 'other',
}

// Map ExerciseDB equipment to our schema
const EQUIPMENT_MAP: Record<string, string> = {
  'body weight': 'bodyweight',
  'barbell': 'barbell',
  'dumbbell': 'dumbbells',
  'cable': 'cable',
  'machine': 'machine',
  'kettlebell': 'kettlebell',
  'band': 'resistance_band',
  'resistance band': 'resistance_band',
  'medicine ball': 'medicine_ball',
  'stability ball': 'stability_ball',
  'ez barbell': 'ez_bar',
  'olympic barbell': 'barbell',
  'smith machine': 'smith_machine',
  'trap bar': 'trap_bar',
  'rope': 'cable',
  'weighted': 'other',
  'assisted': 'machine',
  'leverage machine': 'machine',
  'sled machine': 'machine',
  'upper body ergometer': 'cardio',
  'elliptical machine': 'cardio',
  'stationary bike': 'cardio',
  'stepmill machine': 'cardio',
  'skierg machine': 'cardio',
  'roller': 'foam_roller',
  'bosu ball': 'other',
  'wheel roller': 'other',
  'hammer': 'other',
  'tire': 'other',
}

// Map difficulty levels
const DIFFICULTY_MAP: Record<string, string> = {
  'beginner': 'beginner',
  'intermediate': 'intermediate',
  'expert': 'advanced',
}

async function main() {
  console.log('🔗 ExerciseDB Integration')
  console.log('=========================\n')

  // Validate environment
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase environment variables')
    process.exit(1)
  }

  // Check data file exists
  if (!existsSync(DATA_PATH)) {
    console.error(`❌ Data file not found: ${DATA_PATH}`)
    console.log('   Run: unzip ~/Downloads/mobile.zip -d data/exercisedb/')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
  })

  // Step 1: Load ExerciseDB data
  console.log('📂 Loading ExerciseDB data...')
  const rawData = await readFile(DATA_PATH, 'utf-8')
  const exerciseDbData: ExerciseDBEntry[] = JSON.parse(rawData)
  console.log(`   Found ${exerciseDbData.length} exercises\n`)

  // Step 2: Get existing exercises from database
  console.log('📋 Fetching existing exercises...')
  const { data: existingExercises, error: fetchError } = await supabase
    .from('exercises')
    .select('id, name, external_id')

  if (fetchError) {
    throw new Error(`Failed to fetch exercises: ${fetchError.message}`)
  }

  console.log(`   Found ${existingExercises?.length || 0} existing exercises\n`)

  // Build lookup map by normalized name
  const existingByName = new Map<string, ExistingExercise>()
  const existingByExternalId = new Map<string, ExistingExercise>()

  for (const ex of existingExercises || []) {
    existingByName.set(normalizeForMatch(ex.name), ex)
    if (ex.external_id) {
      existingByExternalId.set(ex.external_id, ex)
    }
  }

  // Step 3: Process ExerciseDB entries
  console.log('🔄 Processing exercises...\n')

  let matched = 0
  let updated = 0
  let inserted = 0
  let skipped = 0
  let errors: string[] = []

  for (const entry of exerciseDbData) {
    const normalizedName = normalizeForMatch(entry.name)
    const gifUrl = `${supabaseUrl}/storage/v1/object/public/${BUCKET_NAME}/${entry.id}.gif`

    // Check if already matched by external_id
    if (existingByExternalId.has(entry.id)) {
      skipped++
      continue
    }

    // Try to match by name
    const existingMatch = existingByName.get(normalizedName)

    if (existingMatch) {
      // Update existing exercise with GIF URL
      matched++
      const { error: updateError } = await supabase
        .from('exercises')
        .update({
          video_url: gifUrl,
          external_id: entry.id,
          external_source: 'exercisedb',
          // Also update instructions if we have them and existing doesn't
          ...(entry.instructions.length > 0 ? {
            instructions: entry.instructions.join('\n\n')
          } : {}),
          // Update description if provided
          ...(entry.description ? { description: entry.description } : {}),
        })
        .eq('id', existingMatch.id)

      if (updateError) {
        errors.push(`Update ${entry.name}: ${updateError.message}`)
      } else {
        updated++
      }
    } else {
      // Insert new exercise
      const newExercise = {
        name: entry.name,
        description: entry.description || null,
        instructions: entry.instructions.join('\n\n') || null,
        body_part: BODY_PART_MAP[entry.bodyPart] || 'other',
        equipment: EQUIPMENT_MAP[entry.equipment] || 'other',
        difficulty: DIFFICULTY_MAP[entry.difficulty] || 'intermediate',
        primary_muscles: [entry.target],
        secondary_muscles: entry.secondaryMuscles || [],
        video_url: gifUrl,
        external_id: entry.id,
        external_source: 'exercisedb',
        is_compound: isCompoundExercise(entry.target, entry.secondaryMuscles),
        quality_score: 70, // Good quality from ExerciseDB
      }

      const { error: insertError } = await supabase
        .from('exercises')
        .insert(newExercise)

      if (insertError) {
        // Might be duplicate or constraint error
        if (!insertError.message.includes('duplicate')) {
          errors.push(`Insert ${entry.name}: ${insertError.message}`)
        }
      } else {
        inserted++
      }
    }
  }

  // Summary
  console.log('=========================')
  console.log('📊 Integration Summary')
  console.log('=========================')
  console.log(`   🔗 Matched:    ${matched}`)
  console.log(`   ✅ Updated:    ${updated}`)
  console.log(`   ➕ Inserted:   ${inserted}`)
  console.log(`   ⏭️  Skipped:    ${skipped}`)
  console.log(`   ❌ Errors:     ${errors.length}`)

  if (errors.length > 0 && errors.length <= 10) {
    console.log('\n   Errors:')
    errors.forEach(e => console.log(`      - ${e}`))
  } else if (errors.length > 10) {
    console.log('\n   First 10 errors:')
    errors.slice(0, 10).forEach(e => console.log(`      - ${e}`))
  }

  // Final count
  const { count: totalCount } = await supabase
    .from('exercises')
    .select('id', { count: 'exact', head: true })

  const { count: withGifCount } = await supabase
    .from('exercises')
    .select('id', { count: 'exact', head: true })
    .not('video_url', 'is', null)

  console.log('\n📈 Final Stats')
  console.log('=========================')
  console.log(`   Total exercises:     ${totalCount}`)
  console.log(`   With animated GIFs:  ${withGifCount}`)

  // Test a sample GIF URL
  console.log('\n🧪 Testing sample exercise...')
  const { data: sample } = await supabase
    .from('exercises')
    .select('name, video_url')
    .not('video_url', 'is', null)
    .limit(1)
    .single()

  if (sample?.video_url) {
    const resp = await fetch(sample.video_url)
    console.log(`   ${sample.name}: ${resp.ok ? '✅' : '❌'} ${sample.video_url}`)
  }

  console.log('\n✅ Integration complete!')
}

/**
 * Normalize exercise name for matching
 */
function normalizeForMatch(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '') // Remove all non-alphanumeric
    .trim()
}

/**
 * Determine if exercise is compound based on muscles involved
 */
function isCompoundExercise(target: string, secondary: string[]): boolean {
  // Compound if targets major muscle groups and has multiple secondaries
  const compoundIndicators = ['quads', 'glutes', 'lats', 'pectorals', 'traps']
  return compoundIndicators.includes(target) && secondary.length >= 2
}

main().catch(console.error)
