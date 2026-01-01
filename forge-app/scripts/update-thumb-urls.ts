#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve } from 'path'

dotenv.config({ path: resolve(process.cwd(), '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const BUCKET_NAME = 'exercise-thumbnails'

  const { data: exercises } = await supabase
    .from('exercises')
    .select('id, external_id')
    .not('video_url', 'is', null)
    .is('thumbnail_url', null)

  console.log('Exercises still needing thumbnails:', exercises?.length || 0)

  let updated = 0
  for (const ex of exercises || []) {
    if (ex.external_id === null || ex.external_id === undefined) continue

    const thumbnailUrl = `${supabaseUrl}/storage/v1/object/public/${BUCKET_NAME}/${ex.external_id}.jpg`

    const { error } = await supabase
      .from('exercises')
      .update({ thumbnail_url: thumbnailUrl })
      .eq('id', ex.id)

    if (!error) updated++
  }

  console.log('Updated:', updated)

  const { count: withThumb } = await supabase
    .from('exercises')
    .select('id', { count: 'exact', head: true })
    .not('thumbnail_url', 'is', null)

  const { count: withGif } = await supabase
    .from('exercises')
    .select('id', { count: 'exact', head: true })
    .not('video_url', 'is', null)

  console.log('\nFinal stats:')
  console.log('  With GIF:', withGif)
  console.log('  With thumbnail:', withThumb)
}

main()
