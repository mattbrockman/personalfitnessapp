#!/usr/bin/env npx tsx
/**
 * Generate static thumbnails from GIF first frames
 *
 * Extracts the first frame of each GIF and uploads as a static image
 * for use as thumbnails when not hovering.
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve } from 'path'
import { readdir, readFile, mkdir, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import sharp from 'sharp'

dotenv.config({ path: resolve(process.cwd(), '.env.local') })

const GIF_DIR = resolve(process.cwd(), 'data/exercisedb/mobile/360')
const THUMB_DIR = resolve(process.cwd(), 'data/exercisedb/thumbnails')
const BUCKET_NAME = 'exercise-thumbnails'
const BATCH_SIZE = 50

async function main() {
  console.log('🖼️  Generate Static Thumbnails from GIFs')
  console.log('=========================================\n')

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase environment variables')
    process.exit(1)
  }

  if (!existsSync(GIF_DIR)) {
    console.error(`❌ GIF directory not found: ${GIF_DIR}`)
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
  })

  // Step 1: Ensure bucket exists
  console.log('📦 Setting up storage bucket...')
  await ensureBucketExists(supabase)

  // Step 2: Create local thumbnails directory
  if (!existsSync(THUMB_DIR)) {
    await mkdir(THUMB_DIR, { recursive: true })
  }

  // Step 3: Get list of GIFs
  console.log('\n📂 Scanning GIF directory...')
  const files = await readdir(GIF_DIR)
  const gifFiles = files.filter(f => f.endsWith('.gif'))
  console.log(`   Found ${gifFiles.length} GIF files`)

  // Step 4: Check which thumbnails already exist in storage
  console.log('\n🔍 Checking existing thumbnails...')
  const { data: existingFiles } = await supabase.storage
    .from(BUCKET_NAME)
    .list('', { limit: 10000 })

  const existingSet = new Set((existingFiles || []).map(f => f.name))
  const toProcess = gifFiles.filter(f => !existingSet.has(f.replace('.gif', '.jpg')))

  console.log(`   Already uploaded: ${existingSet.size}`)
  console.log(`   To process: ${toProcess.length}\n`)

  if (toProcess.length === 0) {
    console.log('✅ All thumbnails already generated!')
    await updateDatabase(supabase, supabaseUrl)
    return
  }

  // Step 5: Process GIFs in batches
  console.log('🔄 Extracting first frames and uploading...\n')

  let processed = 0
  let failed = 0

  for (let i = 0; i < toProcess.length; i += BATCH_SIZE) {
    const batch = toProcess.slice(i, i + BATCH_SIZE)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1
    const totalBatches = Math.ceil(toProcess.length / BATCH_SIZE)

    process.stdout.write(`   Batch ${batchNum}/${totalBatches} (${i + 1}-${Math.min(i + BATCH_SIZE, toProcess.length)})... `)

    const results = await Promise.all(
      batch.map(async (gifFile) => {
        try {
          const gifPath = resolve(GIF_DIR, gifFile)
          const thumbName = gifFile.replace('.gif', '.jpg')

          // Read GIF and extract first frame
          const gifBuffer = await readFile(gifPath)

          // Sharp extracts first frame by default for animated images
          const thumbBuffer = await sharp(gifBuffer, { animated: false, pages: 1 })
            .jpeg({ quality: 80 })
            .toBuffer()

          // Upload to Supabase
          const { error } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(thumbName, thumbBuffer, {
              contentType: 'image/jpeg',
              upsert: true
            })

          if (error) throw error
          return { success: true }
        } catch (err) {
          return { success: false, file: gifFile }
        }
      })
    )

    const succeeded = results.filter(r => r.success).length
    failed += results.filter(r => !r.success).length
    processed += succeeded

    console.log(`✅ ${succeeded}/${batch.length}`)
  }

  // Step 6: Update database
  console.log('\n📝 Updating database with thumbnail URLs...')
  await updateDatabase(supabase, supabaseUrl)

  // Summary
  console.log('\n=========================================')
  console.log('📊 Summary')
  console.log('=========================================')
  console.log(`   ✅ Thumbnails created: ${processed}`)
  console.log(`   ❌ Failed: ${failed}`)
}

async function ensureBucketExists(supabase: any) {
  const { data: buckets } = await supabase.storage.listBuckets()
  const exists = buckets?.some((b: any) => b.name === BUCKET_NAME)

  if (exists) {
    console.log(`   Bucket '${BUCKET_NAME}' already exists`)
    return
  }

  console.log(`   Creating bucket '${BUCKET_NAME}'...`)
  const { error } = await supabase.storage.createBucket(BUCKET_NAME, {
    public: true,
    fileSizeLimit: 5242880, // 5MB
  })

  if (error && !error.message.includes('already exists')) {
    throw new Error(`Failed to create bucket: ${error.message}`)
  }
  console.log(`   ✅ Bucket created`)
}

async function updateDatabase(supabase: any, supabaseUrl: string) {
  // Get all exercises with video_url but no thumbnail_url
  const { data: exercises, error } = await supabase
    .from('exercises')
    .select('id, external_id')
    .not('video_url', 'is', null)
    .is('thumbnail_url', null)

  if (error) {
    console.error('   ❌ Failed to fetch exercises:', error.message)
    return
  }

  console.log(`   Found ${exercises?.length || 0} exercises needing thumbnail URLs`)

  let updated = 0
  for (const ex of exercises || []) {
    if (!ex.external_id) continue

    const thumbnailUrl = `${supabaseUrl}/storage/v1/object/public/${BUCKET_NAME}/${ex.external_id}.jpg`

    const { error: updateError } = await supabase
      .from('exercises')
      .update({ thumbnail_url: thumbnailUrl })
      .eq('id', ex.id)

    if (!updateError) updated++
  }

  console.log(`   ✅ Updated ${updated} exercises with thumbnail URLs`)
}

main().catch(console.error)
