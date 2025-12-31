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

LOOK FOR THESE SPECIFIC UI ELEMENTS:

1. DATE - Usually at the very top, like "Sun, Dec 29" or "December 29". Current year is 2025.

2. SLEEP FITNESS/SCORE - A large prominent number 0-100, often in a circular gauge or ring. This is the main score.

3. TIME ASLEEP - Shows total sleep duration like "6h 52m" or "7h 15m". Convert to minutes.

4. IN BED / TIME IN BED - When you went to bed and woke up, like "11:30 PM - 6:30 AM" or separate "Fell asleep" and "Woke up" times.

5. SLEEP STAGES section showing:
   - Deep sleep (e.g., "1h 14m")
   - REM sleep (e.g., "1h 59m")
   - Light sleep (e.g., "3h 39m")
   - Awake time (e.g., "23m")

6. HEALTH METRICS section showing:
   - HRV: Heart Rate Variability in ms (e.g., "42 ms" or just "42")
   - Resting Heart Rate in bpm (e.g., "52 bpm" or just "52")
   - Respiratory Rate in breaths/min (e.g., "15.2")

7. RECOVERY - Sometimes shown as a percentage

OUTPUT THIS EXACT JSON (no markdown, no backticks):
{"log_date":"YYYY-MM-DD","bedtime":"HH:MM","wake_time":"HH:MM","total_sleep_minutes":number,"deep_sleep_minutes":number,"rem_sleep_minutes":number,"light_sleep_minutes":number,"awake_minutes":number,"sleep_score":number,"hrv_avg":number,"resting_hr":number,"respiratory_rate":number,"recovery_score":number}

CONVERSION RULES:
- Date: "Dec 29" = "2025-12-29", "Jan 2" = "2026-01-02"
- Duration to minutes: "6h 52m" = 412, "1h 14m" = 74, "23m" = 23
- Time to 24hr: "11:30 PM" = "23:30", "6:30 AM" = "06:30"
- Use null only if truly not visible

${dateHint ? `Date context: ${dateHint}` : 'Date context: Late December 2025 / Early January 2026'}`
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
      // Try to extract JSON from the response (in case Claude adds extra text)
      const jsonMatch = textContent.text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        parsedData = JSON.parse(jsonMatch[0])
      } else {
        parsedData = JSON.parse(textContent.text)
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
