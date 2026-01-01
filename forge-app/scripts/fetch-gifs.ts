#!/usr/bin/env npx tsx
/**
 * ExerciseDB GIF Fetcher (FREE TIER) - Hybrid Approach Step 2
 *
 * Fetches animated GIFs from ExerciseDB free tier for priority exercises.
 * Free tier allows ~500 requests/month, so this script processes in batches.
 *
 * Run weekly: npx tsx scripts/fetch-gifs.ts
 *
 * Environment variables required:
 * - EXERCISEDB_API_KEY: RapidAPI key (free tier)
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
  // ExerciseDB API (RapidAPI)
  apiHost: 'exercisedb.p.rapidapi.com',

  // How many exercises to process per run (stay under free tier limit)
  // Free tier: ~500/month, so ~100-125 per week is safe
  exercisesPerRun: 100,

  // Rate limit between API calls (ms) - be nice to free tier
  rateLimitMs: 500,

  // Priority order for fetching GIFs
  priorityEquipment: ['barbell', 'dumbbells', 'bodyweight', 'cable'],
  priorityMuscles: ['chest', 'lats', 'quads', 'glutes', 'shoulders'],
}

interface ExerciseDBResult {
  id: string
  name: string
  gifUrl: string
  bodyPart: string
  equipment: string
  target: string
}

interface Exercise {
  id: string
  name: string
  equipment: string
  primary_muscles: string[]
  quality_score: number | null
}

async function main() {
  console.log('🎬 FORGE GIF Fetcher (ExerciseDB Free Tier)')
  console.log('============================================\n')

  // Validate environment
  const apiKey = process.env.EXERCISEDB_API_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!apiKey) {
    console.error('❌ Missing EXERCISEDB_API_KEY environment variable')
    console.log('\nTo get a FREE API key:')
    console.log('1. Go to https://rapidapi.com/justin-WFnsXH_t6/api/exercisedb')
    console.log('2. Sign up for FREE (no credit card required)')
    console.log('3. Subscribe to the Basic (Free) plan')
    console.log('4. Copy your API key from the dashboard')
    console.log('\n5. Run: EXERCISEDB_API_KEY=your_key npx tsx scripts/fetch-gifs.ts')
    process.exit(1)
  }

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase environment variables')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  let fetched = 0
  let updated = 0
  let notFound = 0
  let errors = 0

  try {
    // Step 1: Get exercises without GIFs, ordered by priority
    console.log('📋 Finding exercises that need GIFs...')
    const { data: exercises, error } = await supabase
      .from('exercises')
      .select('id, name, equipment, primary_muscles, quality_score')
      .is('video_url', null)
      .order('quality_score', { ascending: false, nullsFirst: false })
      .order('is_compound', { ascending: false })
      .limit(CONFIG.exercisesPerRun)

    if (error) {
      throw new Error(`Database error: ${error.message}`)
    }

    if (!exercises || exercises.length === 0) {
      console.log('✅ All exercises already have GIFs!')
      return
    }

    console.log(`   Found ${exercises.length} exercises without GIFs`)

    // Count remaining
    const { count: remaining } = await supabase
      .from('exercises')
      .select('id', { count: 'exact', head: true })
      .is('video_url', null)

    console.log(`   Total remaining after this run: ${(remaining || 0) - exercises.length}\n`)

    // Step 2: Fetch GIFs from ExerciseDB
    console.log('🔍 Searching ExerciseDB for matching exercises...\n')

    for (const exercise of exercises) {
      process.stdout.write(`   ${exercise.name.substring(0, 40).padEnd(40)}... `)

      try {
        const gif = await searchExerciseDB(apiKey, exercise.name)
        fetched++

        if (gif) {
          // Update database with GIF URL
          const { error: updateError } = await supabase
            .from('exercises')
            .update({
              video_url: gif.gifUrl,
              external_id: gif.id,
            })
            .eq('id', exercise.id)

          if (updateError) {
            console.log('❌ DB error')
            errors++
          } else {
            console.log('✅ GIF found')
            updated++
          }
        } else {
          console.log('⚪ No match')
          notFound++

          // Mark as searched so we don't keep trying
          await supabase
            .from('exercises')
            .update({ quality_score: -1 })
            .eq('id', exercise.id)
        }

        // Rate limit
        await sleep(CONFIG.rateLimitMs)

      } catch (err: any) {
        if (err.message.includes('429') || err.message.includes('rate limit')) {
          console.log('\n\n⚠️  Rate limit reached! Try again later or tomorrow.')
          break
        }
        console.log(`❌ ${err.message.substring(0, 30)}`)
        errors++
      }
    }

    // Summary
    console.log('\n============================================')
    console.log('📊 Summary')
    console.log('============================================')
    console.log(`   API calls made:  ${fetched}`)
    console.log(`   GIFs added:      ${updated}`)
    console.log(`   Not found:       ${notFound}`)
    console.log(`   Errors:          ${errors}`)

    const { count: stillRemaining } = await supabase
      .from('exercises')
      .select('id', { count: 'exact', head: true })
      .is('video_url', null)
      .gt('quality_score', -1)

    if (stillRemaining && stillRemaining > 0) {
      console.log(`\n📌 ${stillRemaining} exercises still need GIFs.`)
      console.log('   Run this script again next week to continue.')
    } else {
      console.log('\n✅ All matchable exercises now have GIFs!')
    }

  } catch (error) {
    console.error('\n❌ Fatal error:', error)
    process.exit(1)
  }
}

/**
 * Search ExerciseDB for an exercise by name
 */
async function searchExerciseDB(
  apiKey: string,
  exerciseName: string
): Promise<ExerciseDBResult | null> {
  // Clean up the name for searching
  const searchName = exerciseName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()

  const response = await fetch(
    `https://${CONFIG.apiHost}/exercises/name/${encodeURIComponent(searchName)}?limit=5`,
    {
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': CONFIG.apiHost,
      },
    }
  )

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error('429 rate limit exceeded')
    }
    throw new Error(`API error: ${response.status}`)
  }

  const results: ExerciseDBResult[] = await response.json()

  if (!results || results.length === 0) {
    return null
  }

  // Find best match (exact name match preferred)
  const exactMatch = results.find(
    r => r.name.toLowerCase() === searchName
  )

  return exactMatch || results[0]
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Run
main().catch(console.error)
