import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// Type for detected food item
interface DetectedFood {
  food_name: string
  portion_size: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g?: number
  confidence: number // 0-100
}

interface AnalysisResult {
  detected_foods: DetectedFood[]
  total_calories: number
  total_protein_g: number
  total_carbs_g: number
  total_fat_g: number
  notes?: string
}

// POST /api/nutrition/analyze-photo - Analyze meal photo with AI
export async function POST(request: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'AI service not configured' },
        { status: 503 }
      )
    }

    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse multipart form data
    const formData = await request.formData()
    const photo = formData.get('photo') as File
    const mealType = formData.get('meal_type') as string || 'snack'

    if (!photo) {
      return NextResponse.json(
        { error: 'Photo is required' },
        { status: 400 }
      )
    }

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!validTypes.includes(photo.type)) {
      return NextResponse.json(
        { error: 'Invalid image type. Please use JPEG, PNG, WebP, or GIF.' },
        { status: 400 }
      )
    }

    // Check file size (max 10MB for images)
    const maxSize = 10 * 1024 * 1024
    const photoBuffer = await photo.arrayBuffer()
    if (photoBuffer.byteLength > maxSize) {
      return NextResponse.json(
        { error: 'Image too large. Please use an image under 10MB.' },
        { status: 400 }
      )
    }

    // Convert to base64
    const photoBase64 = Buffer.from(photoBuffer).toString('base64')
    const mediaType = photo.type as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'

    // Build the prompt for Claude
    const systemPrompt = `You are an expert nutritionist and food recognition AI. Your job is to analyze photos of meals and identify each food item with accurate nutritional estimates.

GUIDELINES:
- Identify each distinct food item in the image
- Estimate portion sizes based on visual cues (plate size, utensils, hand for scale)
- Provide realistic calorie and macro estimates based on typical preparation methods
- Be conservative with estimates - slightly underestimate rather than overestimate
- Consider that home-cooked meals typically have fewer calories than restaurant meals
- Account for visible cooking oils, sauces, and dressings
- If you can't clearly identify a food, describe it and estimate based on appearance
- Confidence score should reflect how certain you are about the identification and portion size

COMMON REFERENCE POINTS:
- A typical dinner plate is 10-11 inches diameter
- A fist is roughly 1 cup
- A thumb is roughly 1 tablespoon
- A palm of hand (no fingers) is roughly 3-4 oz of protein`

    const userPrompt = `Analyze this ${mealType} photo and identify all food items with their nutritional information.

Return your analysis as JSON in this exact format:
{
  "detected_foods": [
    {
      "food_name": "Food item name",
      "portion_size": "Estimated portion (e.g., '1 cup', '4 oz', '1 medium')",
      "calories": <number>,
      "protein_g": <number>,
      "carbs_g": <number>,
      "fat_g": <number>,
      "fiber_g": <number>,
      "confidence": <0-100>
    }
  ],
  "total_calories": <sum of all calories>,
  "total_protein_g": <sum>,
  "total_carbs_g": <sum>,
  "total_fat_g": <sum>,
  "notes": "Any relevant notes about the meal or estimation challenges"
}

Be specific about each food item. If you see chicken breast with rice and broccoli, list each as separate items. Include condiments, sauces, and beverages if visible.

Return ONLY the JSON object, no other text.`

    // Call Claude API with vision
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: photoBase64,
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
    let analysis: AnalysisResult
    try {
      // Try to extract JSON from the response
      const jsonMatch = textContent.text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('No JSON found in response')
      }
    } catch (parseError) {
      console.error('Failed to parse Claude response:', textContent.text)
      // Provide a fallback response
      return NextResponse.json(
        {
          error: 'Could not analyze the image. Please try a clearer photo.',
          raw_response: textContent.text,
        },
        { status: 422 }
      )
    }

    // Validate and clean up the response
    if (!analysis.detected_foods || !Array.isArray(analysis.detected_foods)) {
      analysis.detected_foods = []
    }

    // Ensure all numbers are valid
    analysis.detected_foods = analysis.detected_foods.map(food => ({
      food_name: food.food_name || 'Unknown food',
      portion_size: food.portion_size || '1 serving',
      calories: Math.round(food.calories) || 0,
      protein_g: Math.round(food.protein_g * 10) / 10 || 0,
      carbs_g: Math.round(food.carbs_g * 10) / 10 || 0,
      fat_g: Math.round(food.fat_g * 10) / 10 || 0,
      fiber_g: food.fiber_g ? Math.round(food.fiber_g * 10) / 10 : undefined,
      confidence: Math.min(100, Math.max(0, Math.round(food.confidence))) || 70,
    }))

    // Recalculate totals to ensure accuracy
    analysis.total_calories = analysis.detected_foods.reduce((sum, f) => sum + f.calories, 0)
    analysis.total_protein_g = Math.round(analysis.detected_foods.reduce((sum, f) => sum + f.protein_g, 0) * 10) / 10
    analysis.total_carbs_g = Math.round(analysis.detected_foods.reduce((sum, f) => sum + f.carbs_g, 0) * 10) / 10
    analysis.total_fat_g = Math.round(analysis.detected_foods.reduce((sum, f) => sum + f.fat_g, 0) * 10) / 10

    return NextResponse.json({
      success: true,
      analysis,
      meal_type: mealType,
    })
  } catch (error) {
    console.error('Meal photo analysis error:', error)

    if (error instanceof Anthropic.APIError) {
      if (error.status === 400) {
        return NextResponse.json(
          { error: 'Could not process image. Please try a different photo.' },
          { status: 400 }
        )
      }
    }

    return NextResponse.json(
      { error: 'Failed to analyze meal photo. Please try again.' },
      { status: 500 }
    )
  }
}
