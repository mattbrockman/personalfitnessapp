import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// GET /api/workouts/conflicts - Check for existing workouts on specific dates
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()

    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse dates from query params
    const { searchParams } = new URL(request.url)
    const datesParam = searchParams.get('dates')

    if (!datesParam) {
      return NextResponse.json(
        { error: 'Missing required parameter: dates' },
        { status: 400 }
      )
    }

    // Parse comma-separated dates
    const dates = datesParam.split(',').map(d => d.trim())

    if (dates.length === 0) {
      return NextResponse.json({ conflicts: {} })
    }

    // Fetch workouts for the user on these dates
    const { data: workouts, error } = await (adminClient as any)
      .from('workouts')
      .select('id, name, category, workout_type, status, duration_minutes, scheduled_at, scheduled_date')
      .eq('user_id', session.user.id)
      .in('scheduled_date', dates)
      .order('scheduled_at', { ascending: true })

    if (error) {
      console.error('Error fetching workouts for conflict check:', error)
      return NextResponse.json({ error: 'Failed to check conflicts' }, { status: 500 })
    }

    // Group workouts by date
    const conflicts: Record<string, Array<{
      id: string
      name: string
      category: string
      workout_type: string
      status: string
      duration_minutes: number
      scheduled_at: string
    }>> = {}

    for (const workout of workouts || []) {
      const date = workout.scheduled_date
      if (!conflicts[date]) {
        conflicts[date] = []
      }
      conflicts[date].push({
        id: workout.id,
        name: workout.name,
        category: workout.category,
        workout_type: workout.workout_type,
        status: workout.status,
        duration_minutes: workout.duration_minutes,
        scheduled_at: workout.scheduled_at,
      })
    }

    return NextResponse.json({ conflicts })
  } catch (error) {
    console.error('Conflict check error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
