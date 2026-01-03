import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { calculateWorkoutTSS } from '@/lib/calculate-workout-tss'

/**
 * POST /api/admin/backfill-tss
 * Backfills TSS for completed workouts that have null actual_tss
 */
export async function POST() {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const adminSupabase = createAdminClient() as any

  // Get user's profile for TSS calculation
  const { data: profile } = await adminSupabase
    .from('profiles')
    .select('ftp_watts, lthr_bpm, resting_hr, max_hr_bpm')
    .eq('id', session.user.id)
    .single()

  // Find completed workouts with null TSS
  const { data: workouts, error: fetchError } = await adminSupabase
    .from('workouts')
    .select('id, category, actual_duration_minutes, actual_avg_hr, actual_np, perceived_exertion')
    .eq('user_id', session.user.id)
    .eq('status', 'completed')
    .is('actual_tss', null)
    .not('actual_duration_minutes', 'is', null)
    .order('scheduled_date', { ascending: false })

  if (fetchError) {
    console.error('Error fetching workouts:', fetchError)
    return NextResponse.json({ error: 'Failed to fetch workouts' }, { status: 500 })
  }

  if (!workouts || workouts.length === 0) {
    return NextResponse.json({
      success: true,
      message: 'No workouts need TSS backfill',
      updated: 0,
    })
  }

  let updated = 0
  let errors = 0

  for (const workout of workouts) {
    try {
      // Calculate TSS using available data
      const tss = calculateWorkoutTSS({
        category: workout.category || 'other',
        durationMinutes: workout.actual_duration_minutes,
        avgHR: workout.actual_avg_hr,
        np: workout.actual_np,
        perceivedExertion: workout.perceived_exertion,
        lthr: profile?.lthr_bpm,
        ftp: profile?.ftp_watts,
        restingHR: profile?.resting_hr,
        maxHR: profile?.max_hr_bpm,
      })

      // Update workout with calculated TSS
      const { error: updateError } = await adminSupabase
        .from('workouts')
        .update({ actual_tss: tss })
        .eq('id', workout.id)

      if (updateError) {
        console.error(`Error updating workout ${workout.id}:`, updateError)
        errors++
      } else {
        updated++
      }
    } catch (err) {
      console.error(`Error processing workout ${workout.id}:`, err)
      errors++
    }
  }

  return NextResponse.json({
    success: true,
    message: `Backfilled TSS for ${updated} workouts`,
    total: workouts.length,
    updated,
    errors,
  })
}

/**
 * GET /api/admin/backfill-tss
 * Check how many workouts need TSS backfill
 */
export async function GET() {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const adminSupabase = createAdminClient() as any

  // Count completed workouts with null TSS
  const { count, error } = await adminSupabase
    .from('workouts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', session.user.id)
    .eq('status', 'completed')
    .is('actual_tss', null)
    .not('actual_duration_minutes', 'is', null)

  if (error) {
    console.error('Error counting workouts:', error)
    return NextResponse.json({ error: 'Failed to count workouts' }, { status: 500 })
  }

  return NextResponse.json({
    needsBackfill: count || 0,
    message: count > 0
      ? `${count} workouts need TSS backfill. POST to this endpoint to backfill.`
      : 'All workouts have TSS calculated.',
  })
}
