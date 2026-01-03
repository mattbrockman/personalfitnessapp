import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type {
  PlanRecommendation,
  RecommendationScope,
  RecommendationStatus,
  CreateRecommendationRequest,
} from '@/types/training-plan'

// GET /api/recommendations - List recommendations for user's active plan
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()

    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const planId = searchParams.get('plan_id')
    const status = searchParams.get('status') as RecommendationStatus | 'all' | null
    const scope = searchParams.get('scope') as RecommendationScope | null
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    // Build query
    let query = (adminClient as ReturnType<typeof createAdminClient>)
      .from('plan_recommendations')
      .select(`
        *,
        training_plans!inner(id, name, user_id)
      `)
      .eq('user_id', session.user.id)
      .order('priority', { ascending: true })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Filter by plan if specified
    if (planId) {
      query = query.eq('plan_id', planId)
    }

    // Filter by status
    if (status && status !== 'all') {
      query = query.eq('status', status)
    } else if (!status) {
      // Default to pending only
      query = query.eq('status', 'pending')
    }

    // Filter by scope
    if (scope) {
      query = query.eq('scope', scope)
    }

    const { data: recommendations, error, count } = await query

    if (error) {
      console.error('Error fetching recommendations:', error)
      return NextResponse.json({ error: 'Failed to fetch recommendations' }, { status: 500 })
    }

    // Transform to remove nested training_plans data
    const transformed = (recommendations || []).map((rec: PlanRecommendation & { training_plans?: { name: string } }) => ({
      ...rec,
      plan_name: rec.training_plans?.name,
      training_plans: undefined,
    }))

    // Get count of pending recommendations
    const { count: pendingCount } = await (adminClient as ReturnType<typeof createAdminClient>)
      .from('plan_recommendations')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', session.user.id)
      .eq('status', 'pending')

    return NextResponse.json({
      recommendations: transformed,
      total: count || 0,
      pending_count: pendingCount || 0,
    })
  } catch (error) {
    console.error('Recommendations GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/recommendations - Create a new recommendation (typically called by adaptation engine)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()

    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: CreateRecommendationRequest = await request.json()

    // Validate required fields
    if (!body.plan_id || !body.recommendation_type || !body.scope || !body.trigger_type) {
      return NextResponse.json(
        { error: 'plan_id, recommendation_type, scope, and trigger_type are required' },
        { status: 400 }
      )
    }

    // Verify user owns the plan
    const { data: plan, error: planError } = await (adminClient as ReturnType<typeof createAdminClient>)
      .from('training_plans')
      .select('id, user_id')
      .eq('id', body.plan_id)
      .eq('user_id', session.user.id)
      .single()

    if (planError || !plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    // Create the recommendation
    const { data: recommendation, error: insertError } = await (adminClient as any)
      .from('plan_recommendations')
      .insert({
        plan_id: body.plan_id,
        user_id: session.user.id,
        recommendation_type: body.recommendation_type,
        scope: body.scope,
        trigger_type: body.trigger_type,
        trigger_data: body.trigger_data,
        target_phase_id: body.target_phase_id || null,
        target_week_id: body.target_week_id || null,
        target_workout_id: body.target_workout_id || null,
        proposed_changes: body.proposed_changes,
        reasoning: body.reasoning,
        confidence_score: body.confidence_score || null,
        evidence_summary: body.evidence_summary || null,
        projected_impact: body.projected_impact || null,
        priority: body.priority || 5,
        expires_at: body.expires_at || null,
        status: 'pending',
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error creating recommendation:', insertError)
      return NextResponse.json({ error: 'Failed to create recommendation' }, { status: 500 })
    }

    return NextResponse.json({ recommendation }, { status: 201 })
  } catch (error) {
    console.error('Recommendations POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
