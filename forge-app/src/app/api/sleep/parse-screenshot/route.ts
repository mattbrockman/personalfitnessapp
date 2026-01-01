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
              text: `Extract sleep data from this Eight Sleep app screenshot. This could be a daily report OR a monthly trend view.

LOOK FOR ANY OF THESE:
- DATE: "Dec 29, 2025", "DEC 29, 2025", "Sun, Dec 29" → use 2025 as year (2026 for Jan)
- SLEEP SCORE: Large 0-100 number in a circle
- TOTAL SLEEP: "6h 52m" → convert to minutes (412)
- DEEP SLEEP: "1h 14m" or "30-DAY AVG DEEP: 1h 14m" → 74 minutes
- REM SLEEP: "1h 59m" → 119 minutes
- LIGHT SLEEP: duration → minutes
- AWAKE: duration → minutes
- BEDTIME/ASLEEP: "11:16 PM" or "30-DAY AVG ASLEEP: 11:16 PM" → "23:16"
- WAKE TIME/AWAKE: "7:23 AM" → "07:23"
- HRV: "47 ms" → 47
- RESTING HR: "46 bpm" → 46
- RESPIRATORY/BREATH RATE: "15.2 brpm" → 15.2

For trend views showing "30-DAY AVG", extract those values and use the end date shown (e.g., "Nov 29 - Dec 29, 2025" → log_date: "2025-12-29").

Return ONLY JSON, no markdown:
{"log_date":"2025-12-29","bedtime":"23:16","wake_time":"07:23","total_sleep_minutes":null,"deep_sleep_minutes":74,"rem_sleep_minutes":119,"light_sleep_minutes":null,"awake_minutes":null,"sleep_score":null,"hrv_avg":47,"resting_hr":46,"respiratory_rate":15.2,"recovery_score":null}

Use null for fields not visible.`
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
