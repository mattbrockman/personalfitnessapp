#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve } from 'path'

dotenv.config({ path: resolve(process.cwd(), '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function check() {
  // Get a few enhanced exercises to review
  const { data, error } = await supabase
    .from('exercises')
    .select('name, coaching_cues, common_mistakes, difficulty, is_compound, galpin_adaptations, description')
    .eq('ai_enhanced', true)
    .in('name', ['Barbell Bench Press', 'Deadlift', 'Pull-Ups', 'Kettlebell Swing'])

  if (error) {
    console.log('Error:', error.message)
    return
  }

  for (const ex of data || []) {
    console.log('\n' + '='.repeat(60))
    console.log('📋 ' + ex.name)
    console.log('='.repeat(60))
    console.log('\nDescription:', ex.description)
    console.log('\nDifficulty:', ex.difficulty)
    console.log('Is Compound:', ex.is_compound)
    console.log('\nGalpin Adaptations:', ex.galpin_adaptations?.join(', '))
    console.log('\nCoaching Cues:')
    ex.coaching_cues?.forEach((c: string, i: number) => console.log('  ' + (i+1) + '. ' + c))
    console.log('\nCommon Mistakes:')
    ex.common_mistakes?.forEach((m: string, i: number) => console.log('  ' + (i+1) + '. ' + m))
  }

  // Count stats
  const { count: enhanced } = await supabase
    .from('exercises')
    .select('id', { count: 'exact', head: true })
    .eq('ai_enhanced', true)

  const { count: total } = await supabase
    .from('exercises')
    .select('id', { count: 'exact', head: true })

  console.log('\n' + '='.repeat(60))
  console.log(`📊 Enhanced: ${enhanced} / ${total} exercises`)
  console.log('='.repeat(60))
}

check()
