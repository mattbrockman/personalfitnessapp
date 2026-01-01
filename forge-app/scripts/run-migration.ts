#!/usr/bin/env npx tsx
/**
 * Quick migration runner for exercise expansion columns
 */
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve } from 'path'

// Load env
dotenv.config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase env vars')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function runMigration() {
  console.log('🔄 Checking database schema...\n')

  // Check current columns
  const { data, error } = await supabase.from('exercises').select('*').limit(1)
  if (error) {
    console.log('Error checking table:', error.message)
    return
  }

  const existingCols = data && data[0] ? Object.keys(data[0]) : []
  console.log('Existing columns:', existingCols.length)

  const needed = ['external_id', 'external_source', 'body_part', 'galpin_adaptations', 'quality_score', 'import_date', 'ai_enhanced', 'thumbnail_url']
  const missing = needed.filter(c => !existingCols.includes(c))

  if (missing.length === 0) {
    console.log('✅ All columns already exist!')
  } else {
    console.log('⚠️  Missing columns:', missing.join(', '))
    console.log('\nYou need to run this SQL in Supabase Dashboard:')
    console.log('----------------------------------------')
    for (const col of missing) {
      const type = col === 'galpin_adaptations' ? 'TEXT[]'
        : col === 'quality_score' ? 'INTEGER'
        : col === 'import_date' ? 'TIMESTAMPTZ'
        : col === 'ai_enhanced' ? 'BOOLEAN DEFAULT false'
        : col === 'external_source' ? "TEXT DEFAULT 'manual'"
        : 'TEXT'
      console.log(`ALTER TABLE exercises ADD COLUMN IF NOT EXISTS ${col} ${type};`)
    }
    console.log('----------------------------------------')
  }

  // Count exercises
  const { count } = await supabase.from('exercises').select('id', { count: 'exact', head: true })
  console.log(`\n📊 Current exercise count: ${count}`)
}

runMigration().catch(console.error)
