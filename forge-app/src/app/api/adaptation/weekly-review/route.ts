// @ts-nocheck
// Weekly Review API Endpoint
// GET: Get current week analysis without creating recommendations
// POST: Run full weekly review and generate recommendations
// Note: @ts-nocheck is needed until training-plan.ts types are updated

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { evaluateCurrentWeek, runWeeklyReview } from '@/lib/adaptation-engine/week-evaluator'

// GET /api/adaptation/weekly-review - Get current week analysis
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get plan_id from query params or find active plan
    const { searchParams } = new URL(request.url)
    let planId = searchParams.get('plan_id')

    if (!planId) {
      // Find active training plan
      const adminClient = createAdminClient()
      const { data: activePlan } = await (adminClient as any)
        .from('training_plans')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single()

      if (!activePlan) {
        return NextResponse.json({
          error: 'No active training plan found',
          analysis: null,
        }, { status: 404 })
      }

      planId = activePlan.id
    }

    // Evaluate current week without creating recommendations
    const result = await evaluateCurrentWeek(user.id, planId)

    return NextResponse.json({
      plan_id: planId,
      analysis: result.analysis,
      potential_recommendations: result.recommendations.length,
      has_recommendation: result.hasRecommendation,
    })
  } catch (error) {
    console.error('Error in weekly review GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/adaptation/weekly-review - Run full weekly review
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get plan_id from body or query params
    const body = await request.json().catch(() => ({}))
    let planId = body.plan_id

    if (!planId) {
      // Find active training plan
      const adminClient = createAdminClient()
      const { data: activePlan } = await (adminClient as any)
        .from('training_plans')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single()

      if (!activePlan) {
        return NextResponse.json({
          error: 'No active training plan found',
        }, { status: 404 })
      }

      planId = activePlan.id
    }

    // Check user's adaptation settings
    const adminClient = createAdminClient()
    const { data: settings } = await (adminClient as any)
      .from('adaptation_settings')
      .select('auto_evaluate, weekly_review_day')
      .eq('user_id', user.id)
      .single()

    // Run the full weekly review
    const { evaluation, recommendationIds } = await runWeeklyReview(user.id, planId)

    // Update last evaluation date on plan
    await (adminClient as any)
      .from('training_plans')
      .update({
        last_adaptation_eval: new Date().toISOString(),
        pending_recommendations_count: recommendationIds.length,
      })
      .eq('id', planId)

    // Fetch created recommendations
    let recommendations: any[] = []
    if (recommendationIds.length > 0) {
      const { data: recs } = await (adminClient as any)
        .from('plan_recommendations')
        .select('*')
        .in('id', recommendationIds)

      recommendations = recs || []
    }

    return NextResponse.json({
      plan_id: planId,
      analysis: evaluation.analysis,
      recommendations_generated: recommendationIds.length,
      recommendations,
      evaluation_timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error in weekly review POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
