#!/usr/bin/env npx tsx
import * as dotenv from 'dotenv'
import { resolve } from 'path'

dotenv.config({ path: resolve(process.cwd(), '.env.local') })

async function test() {
  const apiKey = process.env.EXERCISEDB_API_KEY!

  // Try the /exercises endpoint WITHOUT the RapidAPI headers
  // to see if images are embedded differently
  console.log('Checking exercises with image info...\n')

  // Try various image-related endpoints that might exist
  const endpoints = [
    '/exercises?limit=1&offset=0',  // base exercises
    '/exercises/exercise/0001',      // single exercise
  ]

  for (const endpoint of endpoints) {
    const url = `https://exercisedb.p.rapidapi.com${endpoint}`
    console.log(`GET ${endpoint}`)

    const resp = await fetch(url, {
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': 'exercisedb.p.rapidapi.com',
      },
    })

    const data = await resp.json()
    const exercise = Array.isArray(data) ? data[0] : data

    // Log ALL fields to see if we're missing something
    console.log('All fields:')
    for (const [key, value] of Object.entries(exercise)) {
      const val = typeof value === 'string' ? value.substring(0, 100) : JSON.stringify(value).substring(0, 100)
      console.log(`  ${key}: ${val}`)
    }
    console.log('')
  }

  // Also try a direct image URL that I found referenced online
  console.log('Testing known image patterns from old API docs:')
  const oldPatterns = [
    'https://api.exercisedb.io/image/JxdCvU1cfrTMlg',
    'https://v2.exercisedb.io/image/JxdCvU1cfrTMlg',
  ]

  for (const url of oldPatterns) {
    try {
      const resp = await fetch(url)
      console.log(`${url} -> ${resp.status} ${resp.headers.get('content-type')}`)
    } catch (e) {
      console.log(`${url} -> Error`)
    }
  }
}

test()
