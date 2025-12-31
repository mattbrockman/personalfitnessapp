import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// GET /api/training-plans/[id] - Get single training plan with all details
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()

    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const planId = params.id

    // Fetch plan - using 'as any' because training_plans table is new
    const { data: plan, error: planError } = await (adminClient as any)
      .from('training_plans')
      .select('*')
      .eq('id', planId)
      .eq('user_id', session.user.id)
      .single()

    if (planError || !plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    // Fetch phases with weekly targets
    const { data: phases } = await (adminClient as any)
      .from('training_phases')
      .select('*')
      .eq('plan_id', planId)
      .order('order_index', { ascending: true })

    // Fetch weekly targets for all phases
    const phaseIds = (phases || []).map((p: any) => p.id)
    let weeklyTargets: any[] = []
    if (phaseIds.length > 0) {
      const { data: targets } = await (adminClient as any)
        .from('weekly_targets')
        .select('*')
        .in('phase_id', phaseIds)
        .order('week_number', { ascending: true })
      weeklyTargets = targets || []
    }

    // Attach weekly targets to phases
    const phasesWithTargets = (phases || []).map((phase: any) => ({
      ...phase,
      weekly_targets: weeklyTargets.filter((t: any) => t.phase_id === phase.id),
    }))

    // Fetch events
    const { data: events } = await (adminClient as any)
      .from('plan_events')
      .select('*')
      .eq('plan_id', planId)
      .order('event_date', { ascending: true })

    // Fetch balance rules
    const { data: balanceRules } = await (adminClient as any)
      .from('activity_balance_rules')
      .select('*')
      .eq('plan_id', planId)

    return NextResponse.json({
      plan: {
        ...plan,
        phases: phasesWithTargets,
        events: events || [],
        balance_rules: balanceRules || [],
      }
    })
  } catch (error) {
    console.error('Training plan GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/training-plans/[id] - Update training plan
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()

    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const planId = params.id
    const body = await request.json()

    // Verify ownership
    const { data: existing } = await (adminClient as any)
      .from('training_plans')
      .select('user_id')
      .eq('id', planId)
      .single()

    if (!existing || existing.user_id !== session.user.id) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    // Allowed fields to update
    const allowedFields = [
      'name', 'description', 'goal', 'start_date', 'end_date',
      'primary_sport', 'weekly_hours_target', 'status'
    ]

    const updates: Record<string, any> = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field]
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid updates provided' }, { status: 400 })
    }

    updates.updated_at = new Date().toISOString()

    const { data: plan, error } = await (adminClient as any)
      .from('training_plans')
      .update(updates)
      .eq('id', planId)
      .select()
      .single()

    if (error) {
      console.error('Error updating plan:', error)
      return NextResponse.json({ error: 'Failed to update plan' }, { status: 500 })
    }

    return NextResponse.json({ plan })
  } catch (error) {
    console.error('Training plan PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/training-plans/[id] - Delete training plan
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()

    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const planId = params.id

    // Verify ownership
    const { data: existingPlan } = await (adminClient as any)
      .from('training_plans')
      .select('user_id')
      .eq('id', planId)
      .single()

    if (!existingPlan || existingPlan.user_id !== session.user.id) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    // Clear active_program_id if this was the active plan
    await (adminClient as any)
      .from('profiles')
      .update({ active_program_id: null })
      .eq('id', session.user.id)
      .eq('active_program_id', planId)

    // Delete plan (cascades to phases, weekly_targets, events, balance_rules)
    const { error } = await (adminClient as any)
      .from('training_plans')
      .delete()
      .eq('id', planId)

    if (error) {
      console.error('Error deleting plan:', error)
      return NextResponse.json({ error: 'Failed to delete plan' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Training plan DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
