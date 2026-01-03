// @ts-nocheck
// Phase Review API Endpoint
// GET: Get current phase analysis and timeline
// POST: Run full phase review and generate recommendations
// TODO: Fix Supabase type generation to include newer tables

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import {
  evaluateCurrentPhase,
  runPhaseEndReview,
  getPhaseTimeline,
} from '@/lib/adaptation-engine/phase-evaluator'

// GET /api/adaptation/phase-review - Get current phase analysis
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
    const includeTimeline = searchParams.get('include_timeline') === 'true'

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

    // Evaluate current phase
    const result = await evaluateCurrentPhase(user.id, planId)

    // Optionally include full timeline
    let timeline = null
    if (includeTimeline) {
      timeline = await getPhaseTimeline(user.id, planId)
    }

    return NextResponse.json({
      plan_id: planId,
      analysis: result.analysis,
      potential_recommendations: result.recommendations.length,
      has_recommendation: result.hasRecommendation,
      timeline,
    })
  } catch (error) {
    console.error('Error in phase review GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/adaptation/phase-review - Run full phase review
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

    // Run the full phase review
    const { evaluation, recommendationIds } = await runPhaseEndReview(user.id, planId)

    // Update last evaluation date on plan
    const adminClient = createAdminClient()
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

    // Get full timeline
    const timeline = await getPhaseTimeline(user.id, planId)

    return NextResponse.json({
      plan_id: planId,
      analysis: evaluation.analysis,
      recommendations_generated: recommendationIds.length,
      recommendations,
      timeline,
      evaluation_timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error in phase review POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
