import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// POST /api/form-coaching - Analyze exercise form from video
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse multipart form data
    const formData = await request.formData()
    const video = formData.get('video') as File
    const exerciseName = formData.get('exercise_name') as string
    const exerciseId = formData.get('exercise_id') as string

    if (!video || !exerciseName) {
      return NextResponse.json(
        { error: 'Video and exercise name are required' },
        { status: 400 }
      )
    }

    // Convert video to base64 for Claude vision API
    // Note: Claude can analyze images extracted from video or video frames
    // For now, we'll work with the video directly if it's small enough
    // In production, you might want to extract key frames
    const videoBuffer = await video.arrayBuffer()
    const videoBase64 = Buffer.from(videoBuffer).toString('base64')
    const videoMediaType = video.type || 'video/webm'

    // Check file size (Claude has limits)
    const maxSize = 20 * 1024 * 1024 // 20MB
    if (videoBuffer.byteLength > maxSize) {
      return NextResponse.json(
        { error: 'Video too large. Please record a shorter clip (under 20MB).' },
        { status: 400 }
      )
    }

    // Build the prompt for Claude
    const systemPrompt = `You are an expert strength and conditioning coach with extensive knowledge of proper exercise form and biomechanics. You are analyzing a video of someone performing an exercise to provide form feedback.

Your analysis should be:
- Specific and actionable
- Encouraging but honest about form issues
- Safety-focused (prioritize injury prevention)
- Based on evidence-based biomechanics

For each exercise, consider:
- Joint alignment and positioning
- Range of motion
- Muscle engagement cues
- Common mistakes for this specific exercise
- Tempo and control`

    const userPrompt = `Please analyze the form in this video of a ${exerciseName}.

Provide your feedback in the following JSON format:
{
  "overall_score": <number from 0-100>,
  "form_issues": [<list of specific form issues observed>],
  "positive_points": [<list of things done well>],
  "recommendations": [<list of specific recommendations to improve>]
}

Be specific about what you observe. If you cannot clearly see certain aspects of the form, mention that. Focus on safety-critical issues first, then optimization.

Return ONLY the JSON object, no other text.`

    // Call Claude API with vision
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: videoMediaType as any,
                data: videoBase64,
              },
            },
            {
              type: 'text',
              text: userPrompt,
            },
          ],
        },
      ],
    })

    // Extract text response
    const textContent = response.content.find(c => c.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from Claude')
    }

    // Parse JSON from response
    let feedback
    try {
      // Try to extract JSON from the response
      const jsonMatch = textContent.text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        feedback = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('No JSON found in response')
      }
    } catch (parseError) {
      console.error('Failed to parse Claude response:', textContent.text)
      // Provide a fallback response
      feedback = {
        overall_score: 70,
        form_issues: ['Could not fully analyze the video. Please ensure good lighting and camera angle.'],
        positive_points: ['Attempted the exercise'],
        recommendations: ['Try recording from a side angle for better analysis', 'Ensure your full body is visible in frame'],
      }
    }

    // Validate feedback structure
    if (!feedback.overall_score || !Array.isArray(feedback.form_issues) ||
        !Array.isArray(feedback.positive_points) || !Array.isArray(feedback.recommendations)) {
      feedback = {
        overall_score: feedback.overall_score || 70,
        form_issues: feedback.form_issues || [],
        positive_points: feedback.positive_points || [],
        recommendations: feedback.recommendations || ['Please try recording again with better lighting'],
      }
    }

    return NextResponse.json({ feedback })
  } catch (error) {
    console.error('Form coaching error:', error)

    // Handle specific API errors
    if (error instanceof Anthropic.APIError) {
      if (error.status === 400) {
        return NextResponse.json(
          {
            error: 'Could not analyze video format. Please try recording again.',
            feedback: {
              overall_score: 0,
              form_issues: ['Video could not be processed'],
              positive_points: [],
              recommendations: ['Try recording a shorter clip', 'Ensure good lighting', 'Use a different camera angle'],
            }
          },
          { status: 200 } // Return 200 with fallback feedback
        )
      }
    }

    return NextResponse.json(
      { error: 'Failed to analyze form. Please try again.' },
      { status: 500 }
    )
  }
}
