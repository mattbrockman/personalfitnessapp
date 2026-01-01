import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic()

// POST /api/sleep/parse-screenshot - Parse Eight Sleep screenshot with AI
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const dateHint = formData.get('date') as string | null // Optional date hint from user

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Convert file to base64
    const bytes = await file.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')

    // Determine media type
    const mediaType = file.type as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
    if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(mediaType)) {
      return NextResponse.json({ error: 'Invalid image type. Use JPEG, PNG, GIF, or WebP.' }, { status: 400 })
    }

    // Call Claude to parse the screenshot
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64,
              },
            },
            {
              type: 'text',
              text: `Extract sleep data from this Eight Sleep app screenshot.

LOOK FOR THESE VALUES:

1. DATE: "Monday, Dec 29" or "Dec 29, 2025" → "2025-12-29" (use 2025, or 2026 for January)

2. SLEEP SCORE: The BIG number (like 92) with "SLEEP FITNESS SCORE" label. This is 0-100.

3. TIME SLEPT / TOTAL SLEEP: Look for "Time slept: 8h 18m" or similar → convert to minutes (8*60+18=498)

4. SLEEP STAGES (convert durations to minutes):
   - Deep: "1h 14m" → 74
   - REM: "1h 59m" → 119
   - Light: "3h 5m" → 185
   - Awake: "23m" → 23

5. BED/WAKE TIMES: Convert to 24-hour format
   - "11:16 PM" → "23:16"
   - "7:23 AM" → "07:23"

6. HEALTH METRICS:
   - HRV: "47 ms" → 47
   - Resting HR: "46 bpm" → 46
   - Respiratory: "15.2 brpm" → 15.2

Return ONLY this JSON object (no markdown, no backticks, no explanation):
{"log_date":"2025-12-29","bedtime":null,"wake_time":null,"total_sleep_minutes":498,"deep_sleep_minutes":74,"rem_sleep_minutes":119,"light_sleep_minutes":185,"awake_minutes":23,"sleep_score":92,"hrv_avg":47,"resting_hr":46,"respiratory_rate":15.2,"recovery_score":null}

Use null ONLY for fields not visible in the image.`
            }
          ],
        }
      ],
    })

    // Extract the text response
    const textContent = response.content.find(c => c.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      return NextResponse.json({ error: 'Failed to parse screenshot' }, { status: 500 })
    }

    // Parse the JSON from Claude's response
    let parsedData
    try {
      let jsonText = textContent.text.trim()

      // Remove markdown code block if present
      if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '')
      }

      // Try to extract JSON object from the response
      const jsonMatch = jsonText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        parsedData = JSON.parse(jsonMatch[0])
      } else {
        parsedData = JSON.parse(jsonText)
      }
    } catch (parseError) {
      console.error('Failed to parse Claude response:', textContent.text)
      return NextResponse.json({
        error: 'Failed to parse AI response',
        raw_response: textContent.text
      }, { status: 500 })
    }

    // Log what was extracted for debugging
    console.log('Parsed sleep data from screenshot:', JSON.stringify(parsedData, null, 2))

    // Add source
    parsedData.source = 'eight_sleep_screenshot'

    // Count non-null fields for quality indication
    const nonNullFields = Object.entries(parsedData).filter(([k, v]) => v !== null && k !== 'source').length
    const totalFields = 13 // Total expected fields

    return NextResponse.json({
      parsed: parsedData,
      success: true,
      extraction_quality: `${nonNullFields}/${totalFields} fields extracted`
    })
  } catch (error) {
    console.error('Error parsing sleep screenshot:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
