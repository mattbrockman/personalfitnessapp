#!/usr/bin/env npx tsx
/**
 * Upload ExerciseDB GIFs to Supabase Storage
 *
 * This script:
 * 1. Creates the 'exercise-gifs' storage bucket if it doesn't exist
 * 2. Uploads all GIFs from data/exercisedb/mobile/360/ to Supabase Storage
 * 3. Tracks progress and handles errors with retry logic
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve } from 'path'
import { readdir, readFile } from 'fs/promises'
import { existsSync } from 'fs'

dotenv.config({ path: resolve(process.cwd(), '.env.local') })

const BUCKET_NAME = 'exercise-gifs'
const GIF_DIR = resolve(process.cwd(), 'data/exercisedb/mobile/360')
const BATCH_SIZE = 20 // Upload 20 at a time
const MAX_RETRIES = 3
const RETRY_DELAY_MS = 1000

interface UploadResult {
  uploaded: number
  skipped: number
  failed: string[]
}

async function main() {
  console.log('🎬 ExerciseDB GIF Uploader')
  console.log('==========================\n')

  // Validate environment
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase environment variables')
    process.exit(1)
  }

  // Check GIF directory exists
  if (!existsSync(GIF_DIR)) {
    console.error(`❌ GIF directory not found: ${GIF_DIR}`)
    console.log('   Run: unzip ~/Downloads/mobile.zip -d data/exercisedb/')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
  })

  // Step 1: Create bucket if needed
  console.log('📦 Setting up storage bucket...')
  await ensureBucketExists(supabase)

  // Step 2: Get list of GIFs to upload
  console.log('\n📂 Scanning GIF directory...')
  const files = await readdir(GIF_DIR)
  const gifFiles = files.filter(f => f.endsWith('.gif'))
  console.log(`   Found ${gifFiles.length} GIF files\n`)

  // Step 3: Check which files already exist
  console.log('🔍 Checking existing uploads...')
  const { data: existingFiles } = await supabase.storage
    .from(BUCKET_NAME)
    .list('', { limit: 10000 })

  const existingSet = new Set((existingFiles || []).map(f => f.name))
  const toUpload = gifFiles.filter(f => !existingSet.has(f))

  console.log(`   Already uploaded: ${existingSet.size}`)
  console.log(`   To upload: ${toUpload.length}\n`)

  if (toUpload.length === 0) {
    console.log('✅ All GIFs already uploaded!')
    return
  }

  // Step 4: Upload in batches
  console.log('📤 Uploading GIFs...\n')
  const result: UploadResult = { uploaded: 0, skipped: existingSet.size, failed: [] }

  for (let i = 0; i < toUpload.length; i += BATCH_SIZE) {
    const batch = toUpload.slice(i, i + BATCH_SIZE)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1
    const totalBatches = Math.ceil(toUpload.length / BATCH_SIZE)

    process.stdout.write(`   Batch ${batchNum}/${totalBatches} (${i + 1}-${Math.min(i + BATCH_SIZE, toUpload.length)} of ${toUpload.length})... `)

    const batchResults = await Promise.all(
      batch.map(file => uploadWithRetry(supabase, file))
    )

    const succeeded = batchResults.filter(r => r.success).length
    const failed = batchResults.filter(r => !r.success)

    result.uploaded += succeeded
    result.failed.push(...failed.map(r => r.file))

    console.log(`✅ ${succeeded}/${batch.length}`)

    // Small delay between batches to be nice to API
    if (i + BATCH_SIZE < toUpload.length) {
      await sleep(200)
    }
  }

  // Summary
  console.log('\n==========================')
  console.log('📊 Upload Summary')
  console.log('==========================')
  console.log(`   ✅ Uploaded:   ${result.uploaded}`)
  console.log(`   ⏭️  Skipped:    ${result.skipped}`)
  console.log(`   ❌ Failed:     ${result.failed.length}`)

  if (result.failed.length > 0 && result.failed.length <= 10) {
    console.log('\n   Failed files:')
    result.failed.forEach(f => console.log(`      - ${f}`))
  } else if (result.failed.length > 10) {
    console.log(`\n   First 10 failed files:`)
    result.failed.slice(0, 10).forEach(f => console.log(`      - ${f}`))
    console.log(`   ... and ${result.failed.length - 10} more`)
  }

  // Test a sample URL
  console.log('\n🧪 Testing sample GIF URL...')
  const testFile = gifFiles[0]
  const publicUrl = `${supabaseUrl}/storage/v1/object/public/${BUCKET_NAME}/${testFile}`

  try {
    const resp = await fetch(publicUrl)
    if (resp.ok) {
      console.log(`   ✅ ${publicUrl}`)
    } else {
      console.log(`   ❌ ${resp.status} - ${publicUrl}`)
    }
  } catch (e) {
    console.log(`   ❌ Error fetching test URL`)
  }

  console.log('\n✅ Upload complete!')
}

async function ensureBucketExists(supabase: any) {
  // Check if bucket exists
  const { data: buckets } = await supabase.storage.listBuckets()
  const exists = buckets?.some((b: any) => b.name === BUCKET_NAME)

  if (exists) {
    console.log(`   Bucket '${BUCKET_NAME}' already exists`)
    return
  }

  // Create bucket
  console.log(`   Creating bucket '${BUCKET_NAME}'...`)
  const { error } = await supabase.storage.createBucket(BUCKET_NAME, {
    public: true,
    fileSizeLimit: 10485760, // 10MB max per file
  })

  if (error) {
    if (error.message.includes('already exists')) {
      console.log(`   Bucket already exists`)
    } else {
      throw new Error(`Failed to create bucket: ${error.message}`)
    }
  } else {
    console.log(`   ✅ Bucket created`)
  }
}

async function uploadWithRetry(
  supabase: any,
  filename: string
): Promise<{ success: boolean; file: string }> {
  const filepath = resolve(GIF_DIR, filename)

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const fileBuffer = await readFile(filepath)

      const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filename, fileBuffer, {
          contentType: 'image/gif',
          upsert: false, // Don't overwrite existing
        })

      if (error) {
        if (error.message.includes('already exists') || error.message.includes('Duplicate')) {
          return { success: true, file: filename } // Consider existing as success
        }
        throw error
      }

      return { success: true, file: filename }
    } catch (err: any) {
      if (attempt === MAX_RETRIES) {
        return { success: false, file: filename }
      }
      await sleep(RETRY_DELAY_MS * attempt)
    }
  }

  return { success: false, file: filename }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

main().catch(console.error)
