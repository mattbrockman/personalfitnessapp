#!/usr/bin/env npx tsx
/**
 * AI Exercise Enhancement Script
 *
 * Uses Claude AI to generate coaching cues, common mistakes, and classifications
 * for exercises imported from ExerciseDB.
 *
 * Run with: npx tsx scripts/enhance-exercises.ts
 *
 * Environment variables required:
 * - ANTHROPIC_API_KEY: Claude API key
 * - NEXT_PUBLIC_SUPABASE_URL: Supabase project URL
 * - SUPABASE_SERVICE_ROLE_KEY: Supabase service role key
 */

import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import * as dotenv from 'dotenv'
import { resolve } from 'path'

// Load environment variables from .env.local
dotenv.config({ path: resolve(process.cwd(), '.env.local') })

// Configuration
const CONFIG = {
  // Number of exercises to process per batch
  batchSize: 10,

  // Delay between API calls (ms)
  rateLimitMs: 500,

  // Max exercises to process per run (for cost control)
  maxPerRun: 100,

  // Model to use
  model: 'claude-sonnet-4-20250514',
}

// Galpin's 9 adaptations
const GALPIN_ADAPTATIONS = [
  'strength',           // Max force production (1-5 reps)
  'hypertrophy',        // Muscle growth (6-15 reps)
  'power',              // Force x velocity (explosive)
  'speed',              // Rate of force development
  'muscular_endurance', // Repeated contractions (15-30+ reps)
  'anaerobic_capacity', // Short high-intensity bursts
  'vo2max',             // Aerobic power
  'long_duration',      // Sustained aerobic work
  'flexibility',        // Range of motion
]

interface Exercise {
  id: string
  name: string
  instructions: string
  primary_muscles: string[]
  secondary_muscles: string[]
  equipment: string
  body_part: string
}

interface EnhancedData {
  coaching_cues: string[]
  common_mistakes: string[]
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  is_compound: boolean
  is_unilateral: boolean
  galpin_adaptations: string[]
  description: string | null
}

async function main() {
  console.log('🤖 FORGE AI Exercise Enhancement Script')
  console.log('========================================\n')

  // Validate environment
  const anthropicKey = process.env.ANTHROPIC_API_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!anthropicKey) {
    console.error('❌ Missing ANTHROPIC_API_KEY environment variable')
    process.exit(1)
  }

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase environment variables')
    process.exit(1)
  }

  // Initialize clients
  const anthropic = new Anthropic({ apiKey: anthropicKey })
  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    // Fetch unenhanced exercises
    console.log('📥 Fetching unenhanced exercises...')
    const { data: exercises, error } = await supabase
      .from('exercises')
      .select('id, name, instructions, primary_muscles, secondary_muscles, equipment, body_part')
      .eq('ai_enhanced', false)
      .limit(CONFIG.maxPerRun)

    if (error) {
      throw new Error(`Database error: ${error.message}`)
    }

    if (!exercises || exercises.length === 0) {
      console.log('✅ All exercises are already enhanced!')
      return
    }

    console.log(`   Found ${exercises.length} exercises to enhance\n`)

    // Process in batches
    let processed = 0
    let errors = 0

    for (let i = 0; i < exercises.length; i += CONFIG.batchSize) {
      const batch = exercises.slice(i, i + CONFIG.batchSize)
      const batchNum = Math.floor(i / CONFIG.batchSize) + 1
      const totalBatches = Math.ceil(exercises.length / CONFIG.batchSize)

      console.log(`\n📦 Processing batch ${batchNum}/${totalBatches}`)

      for (const exercise of batch) {
        process.stdout.write(`   ${exercise.name}... `)

        try {
          const enhanced = await enhanceExercise(anthropic, exercise)

          // Update database
          const { error: updateError } = await supabase
            .from('exercises')
            .update({
              ...enhanced,
              ai_enhanced: true,
            })
            .eq('id', exercise.id)

          if (updateError) {
            console.log('❌ DB Error')
            errors++
          } else {
            console.log('✅')
            processed++
          }

          // Rate limit
          await sleep(CONFIG.rateLimitMs)

        } catch (err: any) {
          console.log(`❌ ${err.message}`)
          errors++
        }
      }
    }

    // Summary
    console.log('\n========================================')
    console.log('📊 Enhancement Summary')
    console.log('========================================')
    console.log(`   Processed: ${processed}`)
    console.log(`   Errors:    ${errors}`)
    console.log(`   Remaining: ${exercises.length - processed - errors}`)

    const remaining = await countUnenhanced(supabase)
    if (remaining > 0) {
      console.log(`\n📌 ${remaining} exercises still need enhancement.`)
      console.log('   Run this script again to continue.')
    } else {
      console.log('\n✅ All exercises have been enhanced!')
    }

  } catch (error) {
    console.error('\n❌ Fatal error:', error)
    process.exit(1)
  }
}

/**
 * Enhance a single exercise using Claude AI
 */
async function enhanceExercise(
  anthropic: Anthropic,
  exercise: Exercise
): Promise<EnhancedData> {
  const prompt = `You are an elite strength & conditioning coach with expertise in evidence-based training.

Enhance this exercise with coaching cues and classifications based on principles from:
- **Greg Nuckols (Stronger By Science)**: Evidence-based technique cues, emphasis on compounds
- **Peter Attia (Longevity)**: Safety, functional movement, stability
- **Andy Galpin (9 Adaptations)**: Classify which training adaptations this exercise supports
- **Steven Seiler (Polarized Training)**: Consider intensity and zone compatibility

Exercise: ${exercise.name}
Equipment: ${exercise.equipment}
Body Part: ${exercise.body_part}
Target Muscle: ${exercise.primary_muscles?.join(', ') || 'Unknown'}
Secondary Muscles: ${exercise.secondary_muscles?.join(', ') || 'None'}
Instructions: ${exercise.instructions || 'No instructions provided'}

Generate the following in JSON format:

{
  "coaching_cues": ["4-6 concise, actionable cues focusing on feel, breathing, and body position"],
  "common_mistakes": ["3-5 typical errors, injury risks first"],
  "difficulty": "beginner | intermediate | advanced",
  "is_compound": true/false (multi-joint = compound),
  "is_unilateral": true/false (single-limb or asymmetric),
  "galpin_adaptations": ["array of applicable adaptations from: ${GALPIN_ADAPTATIONS.join(', ')}"],
  "description": "1-2 sentence description of the exercise and its primary benefits"
}

Return ONLY the JSON object, no other text.`

  const response = await anthropic.messages.create({
    model: CONFIG.model,
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })

  const textContent = response.content.find(c => c.type === 'text')
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude')
  }

  // Parse JSON from response
  const jsonMatch = textContent.text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('No JSON found in response')
  }

  const data = JSON.parse(jsonMatch[0]) as EnhancedData

  // Validate and normalize
  return {
    coaching_cues: data.coaching_cues?.slice(0, 6) || [],
    common_mistakes: data.common_mistakes?.slice(0, 5) || [],
    difficulty: validateDifficulty(data.difficulty),
    is_compound: Boolean(data.is_compound),
    is_unilateral: Boolean(data.is_unilateral),
    galpin_adaptations: validateAdaptations(data.galpin_adaptations || []),
    description: data.description || null,
  }
}

/**
 * Validate difficulty level
 */
function validateDifficulty(
  difficulty: string | undefined
): 'beginner' | 'intermediate' | 'advanced' {
  const valid = ['beginner', 'intermediate', 'advanced']
  const normalized = difficulty?.toLowerCase()
  return valid.includes(normalized!) ? (normalized as any) : 'intermediate'
}

/**
 * Validate Galpin adaptations
 */
function validateAdaptations(adaptations: string[]): string[] {
  return adaptations
    .map(a => a.toLowerCase().replace(/\s+/g, '_'))
    .filter(a => GALPIN_ADAPTATIONS.includes(a))
}

/**
 * Count remaining unenhanced exercises
 */
async function countUnenhanced(supabase: any): Promise<number> {
  const { count } = await supabase
    .from('exercises')
    .select('id', { count: 'exact', head: true })
    .eq('ai_enhanced', false)

  return count || 0
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Run the script
main().catch(console.error)
