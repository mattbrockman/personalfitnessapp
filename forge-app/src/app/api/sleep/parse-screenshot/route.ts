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
              text: `Analyze this Eight Sleep app screenshot and extract the sleep data. Return a JSON object with ONLY these fields (use null for any data not visible):

{
  "log_date": "YYYY-MM-DD",  // The date shown on the screenshot (the night of sleep)
  "bedtime": "HH:MM",        // 24-hour format, e.g., "22:45"
  "wake_time": "HH:MM",      // 24-hour format, e.g., "06:30"
  "total_sleep_minutes": number,  // Total sleep time in minutes
  "deep_sleep_minutes": number,   // Deep sleep in minutes
  "rem_sleep_minutes": number,    // REM sleep in minutes
  "light_sleep_minutes": number,  // Light sleep in minutes
  "awake_minutes": number,        // Time awake in minutes
  "sleep_score": number,          // Sleep score (0-100)
  "hrv_avg": number,              // HRV in milliseconds
  "resting_hr": number,           // Resting heart rate in bpm
  "respiratory_rate": number,     // Breaths per minute (if shown)
  "recovery_score": number        // Recovery percentage (if shown)
}

${dateHint ? `Hint: The user indicated this might be from around ${dateHint}` : ''}

Important:
- For times like "7h 15m", convert to minutes (435)
- For deep/REM/light sleep shown as "1h 25m", convert to minutes (85)
- Return ONLY the JSON object, no other text
- If you cannot determine the date from the screenshot, use null for log_date`
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
