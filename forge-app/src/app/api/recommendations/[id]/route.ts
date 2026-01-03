import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// GET /api/recommendations/[id] - Get a single recommendation
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const adminClient = createAdminClient()

    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: recommendation, error } = await (adminClient as ReturnType<typeof createAdminClient>)
      .from('plan_recommendations')
      .select(`
        *,
        training_plans(id, name),
        training_phases(id, name, phase_type),
        weekly_targets(id, week_number, week_start_date),
        suggested_workouts(id, name, suggested_date)
      `)
      .eq('id', id)
      .eq('user_id', session.user.id)
      .single()

    if (error || !recommendation) {
      return NextResponse.json({ error: 'Recommendation not found' }, { status: 404 })
    }

    return NextResponse.json({ recommendation })
  } catch (error) {
    console.error('Recommendation GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/recommendations/[id] - Delete a recommendation
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const adminClient = createAdminClient()

    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify ownership and delete
    const { error } = await (adminClient as ReturnType<typeof createAdminClient>)
      .from('plan_recommendations')
      .delete()
      .eq('id', id)
      .eq('user_id', session.user.id)

    if (error) {
      console.error('Error deleting recommendation:', error)
      return NextResponse.json({ error: 'Failed to delete recommendation' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Recommendation DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
