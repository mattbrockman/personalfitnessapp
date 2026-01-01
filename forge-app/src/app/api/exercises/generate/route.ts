import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic()

// POST /api/exercises/generate - Generate exercise details using AI
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name } = body

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Exercise name is required' }, { status: 400 })
    }

    // Use Claude to generate exercise details
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `Generate exercise details for "${name}". Respond with ONLY valid JSON, no other text.

The JSON should have these fields:
{
  "name": "Properly capitalized exercise name",
  "primary_muscle": "single main muscle (lowercase, use underscore for spaces, e.g., quadriceps, hamstrings, chest, back, shoulders, biceps, triceps, core, glutes, calves)",
  "secondary_muscles": ["array of secondary muscles involved"],
  "equipment": "one of: barbell, dumbbell, bodyweight, cable, machine, kettlebell, bands, medicine_ball",
  "is_compound": true or false,
  "is_unilateral": true or false,
  "is_timed": true or false,
  "difficulty": "beginner, intermediate, or advanced",
  "cues": ["3-5 short coaching cues for proper form"]
}

is_timed should be true for exercises measured by duration rather than reps, including:
- Planks (all variations)
- Wall sits
- Dead hangs
- L-sits, hollow holds, superman holds
- Isometric/static holds
- Farmer's walks/carries
- Any exercise with "hold" in the name

Be accurate about muscle groups and equipment. If unsure about the exercise, make reasonable assumptions based on the name.`
        }
      ]
    })

    // Extract text content
    const textContent = message.content.find(block => block.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from AI')
    }

    // Parse the JSON response
    let exercise
    try {
      // Try to extract JSON from the response (handle markdown code blocks)
      let jsonStr = textContent.text.trim()
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
      }
      exercise = JSON.parse(jsonStr)
    } catch (parseError) {
      console.error('Failed to parse AI response:', textContent.text)
      throw new Error('Failed to parse exercise details from AI')
    }

    // Validate required fields
    if (!exercise.name || !exercise.primary_muscle || !exercise.equipment) {
      throw new Error('AI response missing required fields')
    }

    // Ensure cues is an array
    if (!Array.isArray(exercise.cues)) {
      exercise.cues = []
    }

    // Ensure secondary_muscles is an array
    if (!Array.isArray(exercise.secondary_muscles)) {
      exercise.secondary_muscles = []
    }

    // Ensure is_timed is a boolean
    if (typeof exercise.is_timed !== 'boolean') {
      exercise.is_timed = false
    }

    return NextResponse.json({ exercise })
  } catch (error) {
    console.error('Exercise generation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate exercise' },
      { status: 500 }
    )
  }
}
