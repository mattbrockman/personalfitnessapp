import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { ReadinessBaselines, LogReadinessRequest } from '@/types/galpin'
import { calculateReadinessScore } from '@/lib/galpin-calculations'
import { createWorkoutRecommendation, ReadinessData } from '@/lib/adaptation-engine/workout-evaluator'

// POST /api/readiness/with-recommendations - Log readiness and get workout recommendations
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: LogReadinessRequest = await request.json()
    const {
      assessment_date = new Date().toISOString().split('T')[0],
      subjective_readiness,
      grip_strength_lbs,
      vertical_jump_inches,
      hrv_reading,
      resting_hr,
      sleep_quality,
      sleep_hours,
      notes
    } = body

    // Validate subjective readiness
    if (subjective_readiness === undefined || subjective_readiness < 1 || subjective_readiness > 10) {
      return NextResponse.json({
        error: 'subjective_readiness is required and must be between 1 and 10'
      }, { status: 400 })
    }

    // Fetch baselines for score calculation
    const { data: baselines } = await supabase
      .from('readiness_baselines')
      .select('*')
      .eq('user_id', user.id)
      .single() as { data: ReadinessBaselines | null; error: unknown }

    // Try to get TSB from training load if available
    let tsb_value: number | null = null
    let atl_value: number | null = null
    let ctl_value: number | null = null

    try {
      const { data: loadData } = await (adminClient as any)
        .from('training_load_history')
        .select('tsb, atl, ctl')
        .eq('user_id', user.id)
        .order('calculation_date', { ascending: false })
        .limit(1)
        .single()

      if (loadData) {
        tsb_value = (loadData as any).tsb as number | null
        atl_value = (loadData as any).atl as number | null
        ctl_value = (loadData as any).ctl as number | null
      }
    } catch {
      // Training load table might not exist, that's OK
    }

    // Calculate readiness score
    const assessmentData = {
      subjective_readiness,
      grip_strength_lbs,
      vertical_jump_inches,
      hrv_reading,
      resting_hr,
      sleep_quality,
      sleep_hours,
      tsb_value,
      atl_value,
      ctl_value,
    }

    const result = calculateReadinessScore(assessmentData, baselines)

    // Upsert the assessment
    const { data: assessment, error: upsertError } = await (adminClient as any)
      .from('readiness_assessments')
      .upsert({
        user_id: user.id,
        assessment_date,
        subjective_readiness,
        grip_strength_lbs: grip_strength_lbs || null,
        vertical_jump_inches: vertical_jump_inches || null,
        hrv_reading: hrv_reading || null,
        resting_hr: resting_hr || null,
        sleep_quality: sleep_quality || null,
        sleep_hours: sleep_hours || null,
        tsb_value,
        atl_value,
        ctl_value,
        calculated_readiness_score: result.score,
        recommended_intensity: result.recommendation,
        adjustment_factor: result.adjustmentFactor,
        notes: notes || null,
      }, { onConflict: 'user_id,assessment_date' })
      .select()
      .single()

    if (upsertError) {
      console.error('Error upserting readiness:', upsertError)
      return NextResponse.json({ error: 'Failed to save assessment' }, { status: 500 })
    }

    // Get user's active training plan
    const { data: activePlan } = await (adminClient as any)
      .from('training_plans')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single()

    let recommendation = null
    let workoutEvaluation = null

    // If user has an active plan, generate workout recommendations
    if (activePlan) {
      // Build readiness data for workout evaluator
      let hrvPercentBaseline: number | null = null
      if (hrv_reading && baselines?.avg_hrv) {
        hrvPercentBaseline = Math.round((hrv_reading / baselines.avg_hrv) * 100)
      }

      const readinessData: ReadinessData = {
        readinessScore: result.score,
        subjectiveReadiness: subjective_readiness,
        adjustmentFactor: result.adjustmentFactor,
        recommendedIntensity: result.recommendation as 'reduce' | 'maintain' | 'push',
        hrvPercentBaseline,
        sleepHours: sleep_hours || null,
        sleepQuality: sleep_quality || null,
        tsb: tsb_value,
        assessmentDate: assessment_date,
      }

      // Create workout recommendation if needed
      const { recommendationId, result: evalResult } = await createWorkoutRecommendation(
        user.id,
        activePlan.id,
        readinessData
      )

      workoutEvaluation = evalResult
      if (recommendationId) {
        // Fetch the created recommendation
        const { data: rec } = await (adminClient as any)
          .from('plan_recommendations')
          .select('*')
          .eq('id', recommendationId)
          .single()
        recommendation = rec
      }
    }

    return NextResponse.json({
      assessment,
      result,
      baselines,
      plan_id: activePlan?.id || null,
      workout_evaluation: workoutEvaluation,
      recommendation,
    })
  } catch (error) {
    console.error('Error in readiness with recommendations:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
