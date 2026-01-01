import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import { format, differenceInYears } from 'date-fns'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

interface VisualAnalysis {
  body_type: 'ectomorph' | 'mesomorph' | 'endomorph' | 'mixed'
  visible_muscle_definition: 'very_lean' | 'lean' | 'moderate' | 'low' | 'none'
  estimated_body_fat_range: { min: number; max: number }
  waist_to_hip_ratio_estimate: 'low' | 'moderate' | 'high'
  shoulder_to_waist_ratio: 'narrow' | 'moderate' | 'wide'
  confidence: number
  notes: string
}

interface ScanResult {
  body_fat_pct: number
  body_fat_range: { min: number; max: number }
  lean_mass_lbs: number
  fat_mass_lbs: number
  ffmi: number | null
  confidence: 'high' | 'medium' | 'low'
  confidence_factors: string[]
  visual_analysis: VisualAnalysis
  data_sources: string[]
  recommendation: string
}

// POST /api/body-composition/scan - AI body composition scan from photos
export async function POST(request: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'AI service not configured' }, { status: 503 })
    }

    const supabase = await createClient()
    const adminClient = createAdminClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse multipart form data
    const formData = await request.formData()
    const frontPhoto = formData.get('front_photo') as File
    const sidePhoto = formData.get('side_photo') as File | null
    const sex = formData.get('sex') as string | null // 'male' or 'female'
    const manualWeight = formData.get('weight_lbs') as string | null

    if (!frontPhoto) {
      return NextResponse.json({ error: 'Front photo is required' }, { status: 400 })
    }

    // Validate file types
    const validTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!validTypes.includes(frontPhoto.type)) {
      return NextResponse.json({ error: 'Invalid image type. Use JPEG, PNG, or WebP.' }, { status: 400 })
    }

    // 1. Gather user data
    const { data: profile } = await (adminClient as any)
      .from('profiles')
      .select('height_inches, date_of_birth')
      .eq('id', user.id)
      .single()

    // Calculate age
    let age: number | null = null
    if (profile?.date_of_birth) {
      age = differenceInYears(new Date(), new Date(profile.date_of_birth))
    }

    const heightInches = profile?.height_inches

    // 2. Get recent weight
    let weightLbs: number | null = manualWeight ? parseFloat(manualWeight) : null

    if (!weightLbs) {
      // Try body_composition_logs first
      const { data: recentBodyComp } = await (adminClient as any)
        .from('body_composition_logs')
        .select('weight_lbs')
        .eq('user_id', user.id)
        .not('weight_lbs', 'is', null)
        .order('log_date', { ascending: false })
        .limit(1)
        .single()

      if (recentBodyComp?.weight_lbs) {
        weightLbs = recentBodyComp.weight_lbs
      } else {
        // Try weight_logs
        const { data: recentWeight } = await (adminClient as any)
          .from('weight_logs')
          .select('weight_lbs')
          .eq('user_id', user.id)
          .order('log_date', { ascending: false })
          .limit(1)
          .single()

        weightLbs = recentWeight?.weight_lbs || null
      }
    }

    // 3. Get last DEXA scan for calibration
    const { data: lastDexa } = await (adminClient as any)
      .from('body_composition_logs')
      .select('body_fat_pct, log_date')
      .eq('user_id', user.id)
      .eq('source', 'dexa')
      .order('log_date', { ascending: false })
      .limit(1)
      .single()

    // 4. Get recent strength data (1RM estimates) for muscle mass proxy
    const { data: recentStrength } = await (adminClient as any)
      .from('exercise_progress')
      .select('exercise_name, estimated_1rm')
      .eq('user_id', user.id)
      .order('calculated_at', { ascending: false })
      .limit(10)

    // Calculate strength score (normalize to population averages)
    let strengthScore: number | null = null
    if (recentStrength && recentStrength.length > 0 && weightLbs) {
      // Look for compound lifts
      const compounds = ['squat', 'deadlift', 'bench', 'press', 'row']
      const relevantLifts = recentStrength.filter((s: any) =>
        compounds.some(c => s.exercise_name?.toLowerCase().includes(c))
      )

      if (relevantLifts.length > 0) {
        // Calculate Wilks-like score (simplified)
        const totalStrength = relevantLifts.reduce((sum: number, s: any) => sum + (s.estimated_1rm || 0), 0)
        // Strength relative to bodyweight
        strengthScore = totalStrength / weightLbs
      }
    }

    // 5. Prepare images for Claude
    const frontBuffer = await frontPhoto.arrayBuffer()
    const frontBase64 = Buffer.from(frontBuffer).toString('base64')

    let sideBase64: string | null = null
    if (sidePhoto && validTypes.includes(sidePhoto.type)) {
      const sideBuffer = await sidePhoto.arrayBuffer()
      sideBase64 = Buffer.from(sideBuffer).toString('base64')
    }

    // 6. Build Claude prompt
    const systemPrompt = `You are an expert in visual body composition assessment. You have been trained on thousands of DEXA scans correlated with photos. Your job is to estimate body fat percentage from photos.

IMPORTANT CONTEXT:
- User's height: ${heightInches ? `${Math.floor(heightInches / 12)}'${heightInches % 12}"` : 'Unknown'}
- User's weight: ${weightLbs ? `${weightLbs} lbs` : 'Unknown'}
- User's age: ${age ? `${age} years` : 'Unknown'}
- User's sex: ${sex || 'Unknown'}
- Recent strength score: ${strengthScore ? `${strengthScore.toFixed(2)} (total compound 1RMs / bodyweight)` : 'Unknown'}
${lastDexa ? `- Last DEXA scan: ${lastDexa.body_fat_pct}% on ${lastDexa.log_date}` : '- No previous DEXA scan on file'}

VISUAL ASSESSMENT GUIDELINES:
- Vascularity (visible veins) indicates lower body fat
- Abdominal definition: 6-pack visible ~10-12% (men) / 18-20% (women)
- Love handles indicate higher body fat storage
- Face leanness correlates with overall body fat
- Muscle striations visible at very low body fat (<10% men, <18% women)

BODY FAT REFERENCE RANGES (Men):
- Essential fat: 2-5%
- Athletes: 6-13%
- Fitness: 14-17%
- Average: 18-24%
- Obese: 25%+

BODY FAT REFERENCE RANGES (Women):
- Essential fat: 10-13%
- Athletes: 14-20%
- Fitness: 21-24%
- Average: 25-31%
- Obese: 32%+

Be conservative with estimates. It's better to give a wider range with high confidence than a narrow range with low confidence.`

    const imageContent: Anthropic.ImageBlockParam[] = [
      {
        type: 'image',
        source: {
          type: 'base64',
          media_type: frontPhoto.type as 'image/jpeg' | 'image/png' | 'image/webp',
          data: frontBase64,
        },
      },
    ]

    if (sideBase64 && sidePhoto) {
      imageContent.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: sidePhoto.type as 'image/jpeg' | 'image/png' | 'image/webp',
          data: sideBase64,
        },
      })
    }

    const userPrompt = `Analyze ${sideBase64 ? 'these front and side photos' : 'this front photo'} for body composition.

Return your analysis as JSON:
{
  "body_type": "ectomorph" | "mesomorph" | "endomorph" | "mixed",
  "visible_muscle_definition": "very_lean" | "lean" | "moderate" | "low" | "none",
  "estimated_body_fat_range": { "min": <number>, "max": <number> },
  "waist_to_hip_ratio_estimate": "low" | "moderate" | "high",
  "shoulder_to_waist_ratio": "narrow" | "moderate" | "wide",
  "confidence": <0-100>,
  "notes": "<observations about what's visible/not visible, clothing impact, lighting, etc.>"
}

Consider:
1. Visible muscle definition (abs, arms, shoulders)
2. Fat distribution patterns (belly, love handles, face)
3. Overall physique category
4. Photo quality and what's obscured

Return ONLY the JSON.`

    // 7. Call Claude
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: [
            ...imageContent,
            { type: 'text', text: userPrompt },
          ],
        },
      ],
    })

    // 8. Parse Claude's response
    const textContent = response.content.find(c => c.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No response from AI')
    }

    let visualAnalysis: VisualAnalysis
    try {
      const jsonMatch = textContent.text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        visualAnalysis = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('No JSON in response')
      }
    } catch {
      return NextResponse.json({
        error: 'Could not analyze photo. Please try a clearer image.',
        raw: textContent.text,
      }, { status: 422 })
    }

    // 9. Calculate final estimate
    const dataSources: string[] = ['photo_analysis']
    const confidenceFactors: string[] = []

    // Start with visual estimate
    let estimatedBF = (visualAnalysis.estimated_body_fat_range.min + visualAnalysis.estimated_body_fat_range.max) / 2
    let rangeWidth = visualAnalysis.estimated_body_fat_range.max - visualAnalysis.estimated_body_fat_range.min

    // Adjust based on strength score (more strength = likely more muscle = adjust lean)
    if (strengthScore !== null) {
      dataSources.push('strength_data')
      if (strengthScore > 3.0) {
        // Very strong - likely more muscular
        estimatedBF -= 1.5
        rangeWidth -= 1
        confidenceFactors.push('High strength-to-weight ratio suggests more muscle mass')
      } else if (strengthScore > 2.0) {
        estimatedBF -= 0.5
        confidenceFactors.push('Good strength levels considered')
      }
    }

    // Apply DEXA calibration if recent (within 90 days)
    if (lastDexa) {
      const dexaDate = new Date(lastDexa.log_date)
      const daysSinceDexa = Math.floor((Date.now() - dexaDate.getTime()) / (1000 * 60 * 60 * 24))

      if (daysSinceDexa <= 90) {
        dataSources.push('dexa_calibration')
        // Weight the DEXA data into our estimate
        const dexaWeight = Math.max(0.2, 1 - (daysSinceDexa / 90) * 0.8) // 20-100% weight based on recency
        estimatedBF = estimatedBF * (1 - dexaWeight) + lastDexa.body_fat_pct * dexaWeight
        rangeWidth *= 0.7 // Narrow the range
        confidenceFactors.push(`DEXA calibration from ${daysSinceDexa} days ago applied`)
      }
    }

    // Ensure reasonable bounds
    estimatedBF = Math.max(3, Math.min(50, estimatedBF))
    const finalMin = Math.max(3, estimatedBF - rangeWidth / 2)
    const finalMax = Math.min(50, estimatedBF + rangeWidth / 2)

    // Calculate derived metrics
    let leanMassLbs: number | null = null
    let fatMassLbs: number | null = null
    let ffmi: number | null = null

    if (weightLbs) {
      dataSources.push('weight')
      fatMassLbs = Math.round(weightLbs * (estimatedBF / 100) * 10) / 10
      leanMassLbs = Math.round((weightLbs - fatMassLbs) * 10) / 10

      // Calculate FFMI if we have height
      if (heightInches) {
        dataSources.push('height')
        const heightMeters = heightInches * 0.0254
        const leanMassKg = leanMassLbs * 0.453592
        ffmi = Math.round((leanMassKg / (heightMeters * heightMeters)) * 10) / 10
      }
    }

    // Determine confidence level
    let confidence: 'high' | 'medium' | 'low' = 'medium'
    if (visualAnalysis.confidence >= 80 && weightLbs && heightInches && lastDexa) {
      confidence = 'high'
    } else if (visualAnalysis.confidence < 60 || (!weightLbs && !heightInches)) {
      confidence = 'low'
    }

    // Build recommendation
    let recommendation = ''
    if (confidence === 'low') {
      recommendation = 'For more accurate results, ensure good lighting, minimal clothing, and provide your current weight.'
    } else if (!lastDexa) {
      recommendation = 'Consider getting a DEXA scan to calibrate future photo estimates for higher accuracy.'
    } else {
      recommendation = 'Continue tracking with photos weekly. Re-calibrate with DEXA every 3-6 months.'
    }

    const result: ScanResult = {
      body_fat_pct: Math.round(estimatedBF * 10) / 10,
      body_fat_range: {
        min: Math.round(finalMin * 10) / 10,
        max: Math.round(finalMax * 10) / 10,
      },
      lean_mass_lbs: leanMassLbs || 0,
      fat_mass_lbs: fatMassLbs || 0,
      ffmi,
      confidence,
      confidence_factors: confidenceFactors,
      visual_analysis: visualAnalysis,
      data_sources: dataSources,
      recommendation,
    }

    return NextResponse.json({
      success: true,
      result,
      can_save: weightLbs !== null, // Only allow saving if we have weight
    })
  } catch (error) {
    console.error('Body scan error:', error)

    if (error instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: 'Could not analyze photo. Please try again.' },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to analyze body composition' },
      { status: 500 }
    )
  }
}
