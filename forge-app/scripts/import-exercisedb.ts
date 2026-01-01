#!/usr/bin/env npx tsx
/**
 * ExerciseDB Import Script
 *
 * Fetches exercises from ExerciseDB API and imports them into FORGE database.
 * Run with: npx tsx scripts/import-exercisedb.ts
 *
 * Environment variables required:
 * - EXERCISEDB_API_KEY: RapidAPI key for ExerciseDB
 * - NEXT_PUBLIC_SUPABASE_URL: Supabase project URL
 * - SUPABASE_SERVICE_ROLE_KEY: Supabase service role key (admin access)
 */

import { createClient } from '@supabase/supabase-js'
import {
  ExerciseDBClient,
  ExerciseDBExercise,
  transformExercise,
  isEquipmentIncluded,
} from '../src/lib/exercisedb-client'

// Configuration
const CONFIG = {
  // Minimum exercises to import
  targetCount: 800,

  // Batch size for database inserts
  batchSize: 50,

  // Rate limit between API calls (ms)
  rateLimitMs: 100,

  // Priority equipment (exercises using these get priority)
  priorityEquipment: ['barbell', 'dumbbell', 'body weight', 'cable'],
}

interface ImportStats {
  fetched: number
  filtered: number
  imported: number
  skipped: number
  errors: string[]
}

async function main() {
  console.log('🏋️ FORGE Exercise Import Script')
  console.log('================================\n')

  // Validate environment
  const apiKey = process.env.EXERCISEDB_API_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!apiKey) {
    console.error('❌ Missing EXERCISEDB_API_KEY environment variable')
    console.log('\nTo get an API key:')
    console.log('1. Go to https://rapidapi.com/justin-WFnsXH_t6/api/exercisedb')
    console.log('2. Subscribe to a plan (free tier available)')
    console.log('3. Copy your API key')
    console.log('4. Run: EXERCISEDB_API_KEY=your_key npx tsx scripts/import-exercisedb.ts')
    process.exit(1)
  }

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase environment variables')
    console.log('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  // Initialize clients
  const exerciseDB = new ExerciseDBClient({
    apiKey,
    rateLimitMs: CONFIG.rateLimitMs,
  })

  const supabase = createClient(supabaseUrl, supabaseKey)

  const stats: ImportStats = {
    fetched: 0,
    filtered: 0,
    imported: 0,
    skipped: 0,
    errors: [],
  }

  try {
    // Step 1: Fetch all exercises from ExerciseDB
    console.log('📥 Fetching exercises from ExerciseDB...')
    const allExercises = await fetchAllExercises(exerciseDB)
    stats.fetched = allExercises.length
    console.log(`   Found ${allExercises.length} total exercises\n`)

    // Step 2: Filter to included equipment only
    console.log('🔍 Filtering by equipment...')
    const filteredExercises = allExercises.filter(ex => isEquipmentIncluded(ex.equipment))
    stats.filtered = filteredExercises.length
    console.log(`   ${filteredExercises.length} exercises with included equipment\n`)

    // Step 3: Sort by priority (priority equipment first)
    console.log('📊 Sorting by priority...')
    const sortedExercises = sortByPriority(filteredExercises)

    // Step 4: Take top N exercises
    const exercisesToImport = sortedExercises.slice(0, CONFIG.targetCount)
    console.log(`   Selected ${exercisesToImport.length} exercises for import\n`)

    // Step 5: Check for existing exercises
    console.log('🔎 Checking for existing exercises...')
    const { data: existingExercises } = await supabase
      .from('exercises')
      .select('external_id')
      .eq('external_source', 'exercisedb')

    const existingIds = new Set(existingExercises?.map(e => e.external_id) || [])
    console.log(`   Found ${existingIds.size} existing ExerciseDB exercises\n`)

    // Step 6: Import in batches
    console.log('💾 Importing exercises...')
    const newExercises = exercisesToImport.filter(ex => !existingIds.has(ex.id))
    console.log(`   ${newExercises.length} new exercises to import\n`)

    if (newExercises.length === 0) {
      console.log('✅ No new exercises to import. Database is up to date!')
      return
    }

    for (let i = 0; i < newExercises.length; i += CONFIG.batchSize) {
      const batch = newExercises.slice(i, i + CONFIG.batchSize)
      const batchNum = Math.floor(i / CONFIG.batchSize) + 1
      const totalBatches = Math.ceil(newExercises.length / CONFIG.batchSize)

      process.stdout.write(`   Batch ${batchNum}/${totalBatches}... `)

      const transformed = batch.map(ex => ({
        ...transformExercise(ex),
        import_date: new Date().toISOString(),
        ai_enhanced: false,
        // These will be filled by AI enhancement script
        cues: [],
        coaching_cues: [],
        common_mistakes: [],
        difficulty: null,
        is_compound: null,
        is_unilateral: null,
        galpin_adaptations: [],
      }))

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
    console.log('\n================================')
    console.log('📊 Import Summary')
    console.log('================================')
    console.log(`   Total fetched:  ${stats.fetched}`)
    console.log(`   After filter:   ${stats.filtered}`)
    console.log(`   Imported:       ${stats.imported}`)
    console.log(`   Skipped:        ${stats.skipped}`)

    if (stats.errors.length > 0) {
      console.log('\n❌ Errors:')
      stats.errors.forEach(err => console.log(`   - ${err}`))
    }

    console.log('\n✅ Import complete!')
    console.log('\n📌 Next steps:')
    console.log('   1. Run the AI enhancement script: npx tsx scripts/enhance-exercises.ts')
    console.log('   2. Review exercises in the database')
    console.log('   3. Update the UI to display GIFs')

  } catch (error) {
    console.error('\n❌ Fatal error:', error)
    process.exit(1)
  }
}

/**
 * Fetch all exercises from ExerciseDB API
 */
async function fetchAllExercises(client: ExerciseDBClient): Promise<ExerciseDBExercise[]> {
  const allExercises: ExerciseDBExercise[] = []

  // Fetch in batches of 1000 (API limit)
  let offset = 0
  const limit = 1000

  while (true) {
    process.stdout.write(`   Fetching offset ${offset}... `)
    const batch = await client.getAllExercises(limit, offset)

    if (batch.length === 0) {
      console.log('done')
      break
    }

    allExercises.push(...batch)
    console.log(`got ${batch.length}`)

    if (batch.length < limit) {
      break
    }

    offset += limit
  }

  return allExercises
}

/**
 * Sort exercises by priority (priority equipment first, then by name)
 */
function sortByPriority(exercises: ExerciseDBExercise[]): ExerciseDBExercise[] {
  return exercises.sort((a, b) => {
    const aIsPriority = CONFIG.priorityEquipment.some(eq =>
      a.equipment.toLowerCase().includes(eq)
    )
    const bIsPriority = CONFIG.priorityEquipment.some(eq =>
      b.equipment.toLowerCase().includes(eq)
    )

    // Priority equipment first
    if (aIsPriority && !bIsPriority) return -1
    if (!aIsPriority && bIsPriority) return 1

    // Then by name
    return a.name.localeCompare(b.name)
  })
}

// Print equipment distribution
async function printEquipmentStats(exercises: ExerciseDBExercise[]) {
  const equipmentCounts = new Map<string, number>()

  for (const ex of exercises) {
    const eq = ex.equipment.toLowerCase()
    equipmentCounts.set(eq, (equipmentCounts.get(eq) || 0) + 1)
  }

  console.log('\n📊 Equipment Distribution:')
  const sorted = [...equipmentCounts.entries()].sort((a, b) => b[1] - a[1])
  for (const [equipment, count] of sorted.slice(0, 15)) {
    const included = isEquipmentIncluded(equipment) ? '✓' : '✗'
    console.log(`   ${included} ${equipment}: ${count}`)
  }
}

// Run the script
main().catch(console.error)
