#!/usr/bin/env npx tsx
/**
 * Fix thumbnail URLs for imported exercises
 */
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve } from 'path'

dotenv.config({ path: resolve(process.cwd(), '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const BASE_URL = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises'

interface GitHubExercise {
  name: string
  images?: string[]
}

async function main() {
  console.log('🔧 Fixing thumbnail URLs...\n')

  // Fetch the original GitHub data
  console.log('📥 Fetching exercise data from GitHub...')
  const response = await fetch(
    'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json'
  )
  const exercises: GitHubExercise[] = await response.json()
  console.log(`   Found ${exercises.length} exercises\n`)

  // Create a map of name -> image URL
  const imageMap = new Map<string, string>()
  for (const ex of exercises) {
    if (ex.images && ex.images.length > 0) {
      const imageUrl = `${BASE_URL}/${ex.images[0]}`
      // Normalize name for matching
      const normalizedName = ex.name.toLowerCase().trim()
      imageMap.set(normalizedName, imageUrl)
    }
  }

  // Update exercises in batches
  console.log('📝 Updating database...')
  let updated = 0
  let notFound = 0

  const { data: dbExercises } = await supabase
    .from('exercises')
    .select('id, name')
    .eq('external_source', 'free-exercise-db')

  for (const ex of dbExercises || []) {
    const normalizedName = ex.name.toLowerCase().trim()
    const imageUrl = imageMap.get(normalizedName)

    if (imageUrl) {
      await supabase
        .from('exercises')
        .update({ thumbnail_url: imageUrl })
        .eq('id', ex.id)
      updated++
    } else {
      notFound++
    }
  }

  console.log(`\n✅ Updated: ${updated}`)
  console.log(`⚪ Not found: ${notFound}`)

  // Test a sample
  console.log('\n🧪 Testing sample URLs:')
  const { data: samples } = await supabase
    .from('exercises')
    .select('name, thumbnail_url')
    .not('thumbnail_url', 'is', null)
    .limit(3)

  for (const s of samples || []) {
    const resp = await fetch(s.thumbnail_url!)
    console.log(`   ${s.name}: ${resp.status === 200 ? '✅' : '❌'} ${s.thumbnail_url}`)
  }
}

main().catch(console.error)
