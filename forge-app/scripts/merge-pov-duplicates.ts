#!/usr/bin/env npx tsx
/**
 * Merge duplicate POV exercises
 *
 * ExerciseDB has multiple GIFs for some exercises with different angles:
 * - "barbell full squat (back pov)"
 * - "barbell full squat (side pov)"
 *
 * These should be one exercise. This script:
 * 1. Finds exercises with POV suffixes
 * 2. Groups by base name
 * 3. Keeps the best one (side pov preferred)
 * 4. Deletes duplicates
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve } from 'path'

dotenv.config({ path: resolve(process.cwd(), '.env.local') })

// POV patterns to detect
const POV_PATTERNS = [
  /\s*\(back pov\)\s*$/i,
  /\s*\(side pov\)\s*$/i,
  /\s*\(front pov\)\s*$/i,
  /\s*\(top pov\)\s*$/i,
  /\s*\(pov\)\s*$/i,
]

// Preference order (first found is kept)
const POV_PREFERENCE = ['(side pov)', '(front pov)', '(back pov)', '(top pov)', '(pov)']

interface Exercise {
  id: string
  name: string
  video_url: string | null
}

async function main() {
  console.log('🔄 Merge POV Duplicate Exercises')
  console.log('=================================\n')

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase environment variables')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
  })

  // Step 1: Find all exercises with POV suffixes
  console.log('📋 Finding exercises with POV suffixes...')
  const { data: exercises, error } = await supabase
    .from('exercises')
    .select('id, name, video_url')
    .or(POV_PATTERNS.map(p => `name.ilike.%pov%`).join(','))

  if (error) {
    throw new Error(`Database error: ${error.message}`)
  }

  // Filter to only those matching POV patterns
  const povExercises = (exercises || []).filter(ex =>
    POV_PATTERNS.some(p => p.test(ex.name))
  )

  console.log(`   Found ${povExercises.length} exercises with POV suffixes\n`)

  if (povExercises.length === 0) {
    console.log('✅ No POV duplicates to merge!')
    return
  }

  // Step 2: Group by base name
  const groups = new Map<string, Exercise[]>()

  for (const ex of povExercises) {
    // Extract base name by removing POV suffix
    let baseName = ex.name
    for (const pattern of POV_PATTERNS) {
      baseName = baseName.replace(pattern, '').trim()
    }
    baseName = baseName.toLowerCase()

    if (!groups.has(baseName)) {
      groups.set(baseName, [])
    }
    groups.get(baseName)!.push(ex)
  }

  // Filter to only groups with duplicates
  const duplicateGroups = Array.from(groups.entries())
    .filter(([, exs]) => exs.length > 1)

  console.log(`📊 Found ${duplicateGroups.length} exercise groups with duplicates\n`)

  if (duplicateGroups.length === 0) {
    console.log('✅ No duplicate groups to merge!')
    return
  }

  // Step 3: Process each group
  let merged = 0
  let deleted = 0

  for (const [baseName, exs] of duplicateGroups) {
    // Sort by POV preference
    exs.sort((a, b) => {
      const aIndex = POV_PREFERENCE.findIndex(p => a.name.toLowerCase().includes(p))
      const bIndex = POV_PREFERENCE.findIndex(p => b.name.toLowerCase().includes(p))
      return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex)
    })

    const keep = exs[0]
    const toDelete = exs.slice(1)

    console.log(`   ${baseName}:`)
    console.log(`      Keep: ${keep.name}`)
    toDelete.forEach(ex => console.log(`      Delete: ${ex.name}`))

    // Rename the kept exercise to remove POV suffix
    let cleanName = keep.name
    for (const pattern of POV_PATTERNS) {
      cleanName = cleanName.replace(pattern, '').trim()
    }

    // Update the kept exercise with clean name
    const { error: updateError } = await supabase
      .from('exercises')
      .update({ name: cleanName })
      .eq('id', keep.id)

    if (updateError) {
      console.log(`      ❌ Failed to rename: ${updateError.message}`)
    } else {
      merged++
    }

    // Delete the duplicates
    for (const ex of toDelete) {
      const { error: deleteError } = await supabase
        .from('exercises')
        .delete()
        .eq('id', ex.id)

      if (deleteError) {
        console.log(`      ❌ Failed to delete ${ex.name}: ${deleteError.message}`)
      } else {
        deleted++
      }
    }

    console.log('')
  }

  // Summary
  console.log('=================================')
  console.log('📊 Summary')
  console.log('=================================')
  console.log(`   ✅ Exercises renamed: ${merged}`)
  console.log(`   🗑️  Duplicates deleted: ${deleted}`)

  // Final count
  const { count: totalCount } = await supabase
    .from('exercises')
    .select('id', { count: 'exact', head: true })

  console.log(`\n   Total exercises now: ${totalCount}`)
}

main().catch(console.error)
