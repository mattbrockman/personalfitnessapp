// RPE Prompt API
// GET: Fetch pending RPE prompts for the user
// POST: Submit RPE rating for a workout

import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// GET: Fetch pending RPE prompts
export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const adminSupabase = createAdminClient()

  // Get pending prompts that are due
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: pendingPrompts, error } = await (adminSupabase as any)
    .from('rpe_prompts')
    .select(`
      id,
      workout_id,
      suggested_workout_id,
      source_platform,
      scheduled_for,
      created_at,
      workouts (
        id,
        name,
        category,
        workout_type,
        scheduled_date,
        completed_at,
        actual_duration_minutes,
        actual_tss
      )
    `)
    .eq('user_id', user.id)
    .is('responded_at', null)
    .lte('scheduled_for', new Date().toISOString())
    .order('scheduled_for', { ascending: false })

  if (error) {
    console.error('Failed to fetch RPE prompts:', error)
    return NextResponse.json({ error: 'Failed to fetch prompts' }, { status: 500 })
  }

  // Format response
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prompts = pendingPrompts?.map((p: any) => ({
    id: p.id,
    workout_id: p.workout_id,
    workout_name: p.workouts?.name || 'Unknown Workout',
    workout_category: p.workouts?.category,
    workout_type: p.workouts?.workout_type,
    workout_date: p.workouts?.scheduled_date,
    completed_at: p.workouts?.completed_at,
    duration_minutes: p.workouts?.actual_duration_minutes,
    tss: p.workouts?.actual_tss,
    source_platform: p.source_platform,
    scheduled_for: p.scheduled_for,
  })) || []

  return NextResponse.json({
    pending: prompts,
    count: prompts.length,
  })
}

// POST: Submit RPE rating
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { workout_id, rpe_value, notes } = body

    // Validate RPE value
    if (!workout_id) {
      return NextResponse.json({ error: 'workout_id is required' }, { status: 400 })
    }

    if (!rpe_value || rpe_value < 1 || rpe_value > 10) {
      return NextResponse.json({ error: 'rpe_value must be between 1 and 10' }, { status: 400 })
    }

    const adminSupabase = createAdminClient()

    // Update the RPE prompt
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: prompt, error: promptError } = await (adminSupabase as any)
      .from('rpe_prompts')
      .update({
        rpe_value,
        notes: notes || null,
        responded_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .eq('workout_id', workout_id)
      .select()
      .single()

    if (promptError && promptError.code !== 'PGRST116') {
      // PGRST116 = no rows found, which is okay if prompt doesn't exist
      console.error('Failed to update RPE prompt:', promptError)
    }

    // Update the workout with RPE (session_rpe or perceived_exertion)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: workoutError } = await (adminSupabase as any)
      .from('workouts')
      .update({
        session_rpe: rpe_value,
        perceived_exertion: rpe_value,
        updated_at: new Date().toISOString(),
      })
      .eq('id', workout_id)
      .eq('user_id', user.id)

    if (workoutError) {
      console.error('Failed to update workout with RPE:', workoutError)
      return NextResponse.json({ error: 'Failed to save RPE' }, { status: 500 })
    }

    // Calculate training load if we have duration and RPE (session RPE method)
    // Training Load = Duration (min) × RPE
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: workout } = await (adminSupabase as any)
      .from('workouts')
      .select('actual_duration_minutes, training_load')
      .eq('id', workout_id)
      .single()

    if (workout?.actual_duration_minutes && !workout.training_load) {
      const trainingLoad = workout.actual_duration_minutes * rpe_value
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (adminSupabase as any)
        .from('workouts')
        .update({ training_load: trainingLoad })
        .eq('id', workout_id)
    }

    return NextResponse.json({
      success: true,
      workout_id,
      rpe_value,
    })

  } catch (error) {
    console.error('RPE submission error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to submit RPE' },
      { status: 500 }
    )
  }
}

// DELETE: Dismiss an RPE prompt without submitting
export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const workoutId = searchParams.get('workout_id')

    if (!workoutId) {
      return NextResponse.json({ error: 'workout_id is required' }, { status: 400 })
    }

    const adminSupabase = createAdminClient()

    // Mark prompt as dismissed (set responded_at without rpe_value)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (adminSupabase as any)
      .from('rpe_prompts')
      .update({
        responded_at: new Date().toISOString(),
        notes: 'Dismissed by user',
      })
      .eq('user_id', user.id)
      .eq('workout_id', workoutId)

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('RPE dismiss error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to dismiss prompt' },
      { status: 500 }
    )
  }
}
