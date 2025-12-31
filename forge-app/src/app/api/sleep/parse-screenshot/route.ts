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
              text: `This is a screenshot from the Eight Sleep app showing sleep data. Extract ALL visible data.

Eight Sleep screenshots typically show:
- DATE: Look for text like "Dec 30", "December 30", "Mon, Dec 30", or similar at the top
- SLEEP SCORE: A large number (0-100) usually in a circle, labeled "Sleep Score" or "Sleep Fitness"
- TOTAL SLEEP: Shows as "Xh Ym" format (e.g., "7h 15m")
- BEDTIME: Time went to bed (e.g., "10:45 PM" or "22:45")
- WAKE TIME: Time woke up (e.g., "6:30 AM" or "06:30")
- SLEEP STAGES: Deep, REM, Light sleep shown as "Xh Ym" or bars
- HRV: Heart Rate Variability in milliseconds (ms)
- RESTING HR: Heart rate in bpm
- RECOVERY: Percentage (%)

Return a JSON object:
{
  "log_date": "YYYY-MM-DD",
  "bedtime": "HH:MM",
  "wake_time": "HH:MM",
  "total_sleep_minutes": number,
  "deep_sleep_minutes": number,
  "rem_sleep_minutes": number,
  "light_sleep_minutes": number,
  "awake_minutes": number,
  "sleep_score": number,
  "hrv_avg": number,
  "resting_hr": number,
  "respiratory_rate": number,
  "recovery_score": number
}

CRITICAL INSTRUCTIONS:
1. For the DATE: The current year is 2025. If you see "Dec 30", return "2025-12-30". If you see "Jan 2", it's likely "2026-01-02" or based on context.
2. Convert ALL times to minutes: "7h 15m" = 435, "1h 25m" = 85, "45m" = 45
3. Convert bedtime/wake_time to 24-hour format: "10:45 PM" = "22:45", "6:30 AM" = "06:30"
4. The sleep score is the big number in the circle (0-100)
5. HRV is in milliseconds (usually 20-100), HR is in bpm (usually 40-80)
6. Return ONLY the JSON, no other text
7. Use null ONLY if data is truly not visible

${dateHint ? `Context: Screenshots are from around ${dateHint}` : 'Context: Screenshots are from late December 2025'}`
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

    // Add source
    parsedData.source = 'eight_sleep_screenshot'

    return NextResponse.json({
      parsed: parsedData,
      success: true
    })
  } catch (error) {
    console.error('Error parsing sleep screenshot:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
