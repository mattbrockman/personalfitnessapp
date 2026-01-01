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
              text: `You are extracting sleep data from an Eight Sleep app screenshot.

Look at the image carefully and find:
- DATE: Look for day/month at top (e.g., "Sun, Dec 29", "Dec 30"). Year is 2025 (or 2026 for January).
- SLEEP SCORE: Large number 0-100, often in a circular ring labeled "Sleep Fitness"
- TOTAL SLEEP: Duration like "6h 52m" - convert to total minutes (6*60+52=412)
- BED/WAKE TIMES: When fell asleep and woke up (convert to 24hr format)
- SLEEP STAGES: Deep, REM, Light, Awake times - convert each to minutes
- HRV: Heart rate variability in ms (number like 42)
- RESTING HR: Heart rate in bpm (number like 52)
- RESPIRATORY RATE: Breaths per minute (number like 15.2)

Return ONLY a JSON object with these exact keys. No markdown, no explanation, just the JSON:

{"log_date":"2025-12-29","bedtime":"23:30","wake_time":"06:30","total_sleep_minutes":412,"deep_sleep_minutes":74,"rem_sleep_minutes":119,"light_sleep_minutes":219,"awake_minutes":23,"sleep_score":85,"hrv_avg":42,"resting_hr":52,"respiratory_rate":15.2,"recovery_score":null}

Use null for any field not visible in the image. Convert all durations to minutes.`
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
