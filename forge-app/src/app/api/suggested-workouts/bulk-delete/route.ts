import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// DELETE /api/suggested-workouts/bulk-delete - Delete suggested workouts by date range
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()

    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const fromDate = searchParams.get('from_date')
    const planId = searchParams.get('plan_id')

    if (!fromDate) {
      return NextResponse.json({ error: 'from_date is required' }, { status: 400 })
    }

    // Get user's active plan if no plan_id specified
    let targetPlanId = planId
    if (!targetPlanId) {
      const { data: activePlan } = await (adminClient as any)
        .from('training_plans')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (!activePlan) {
        return NextResponse.json({ error: 'No active training plan found' }, { status: 404 })
      }
      targetPlanId = activePlan.id
    } else {
      // Verify ownership of the plan
      const { data: plan } = await (adminClient as any)
        .from('training_plans')
        .select('user_id')
        .eq('id', targetPlanId)
        .single()

      if (!plan || plan.user_id !== session.user.id) {
        return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
      }
    }

    // Delete suggested workouts from the specified date onwards
    const { error: deleteError, count } = await (adminClient as any)
      .from('suggested_workouts')
      .delete()
      .eq('plan_id', targetPlanId)
      .gte('suggested_date', fromDate)

    if (deleteError) {
      console.error('Error bulk deleting suggested workouts:', deleteError)
      return NextResponse.json({ error: 'Failed to delete workouts' }, { status: 500 })
    }

    return NextResponse.json({ success: true, deleted: count || 0 })
  } catch (error) {
    console.error('Bulk delete suggested workouts error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
