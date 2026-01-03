import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { RespondToRecommendationRequest, PlanRecommendation } from '@/types/training-plan'

// POST /api/recommendations/[id]/respond - Respond to a recommendation
export async function POST(
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

    const body: RespondToRecommendationRequest = await request.json()

    // Validate action
    if (!body.action || !['accept', 'modify', 'dismiss'].includes(body.action)) {
      return NextResponse.json(
        { error: 'action must be one of: accept, modify, dismiss' },
        { status: 400 }
      )
    }

    // Verify recommendation exists and belongs to user
    const { data: recommendation, error: fetchError } = await (adminClient as ReturnType<typeof createAdminClient>)
      .from('plan_recommendations')
      .select('*')
      .eq('id', id)
      .eq('user_id', session.user.id)
      .single()

    if (fetchError || !recommendation) {
      return NextResponse.json({ error: 'Recommendation not found' }, { status: 404 })
    }

    // Can only respond to pending recommendations
    const rec = recommendation as PlanRecommendation
    if (rec.status !== 'pending') {
      return NextResponse.json(
        { error: `Cannot respond to recommendation with status: ${rec.status}` },
        { status: 400 }
      )
    }

    const now = new Date().toISOString()
    let newStatus: string
    let appliedAt: string | null = null

    switch (body.action) {
      case 'accept':
        newStatus = 'accepted'
        // Apply the recommendation
        const applyResult = await applyRecommendation(
          adminClient as ReturnType<typeof createAdminClient>,
          recommendation as PlanRecommendation
        )
        if (!applyResult.success) {
          return NextResponse.json(
            { error: `Failed to apply recommendation: ${applyResult.error}` },
            { status: 500 }
          )
        }
        appliedAt = now
        break

      case 'modify':
        if (!body.modified_changes) {
          return NextResponse.json(
            { error: 'modified_changes required when action is modify' },
            { status: 400 }
          )
        }
        newStatus = 'modified'
        // Apply the modified recommendation
        const modifyResult = await applyRecommendation(
          adminClient as ReturnType<typeof createAdminClient>,
          recommendation as PlanRecommendation,
          body.modified_changes
        )
        if (!modifyResult.success) {
          return NextResponse.json(
            { error: `Failed to apply modified recommendation: ${modifyResult.error}` },
            { status: 500 }
          )
        }
        appliedAt = now
        break

      case 'dismiss':
        newStatus = 'dismissed'
        break

      default:
        newStatus = 'pending'
    }

    // Update the recommendation
    const { data: updated, error: updateError } = await (adminClient as any)
      .from('plan_recommendations')
      .update({
        status: newStatus,
        user_notes: body.notes || null,
        modified_changes: body.modified_changes || null,
        responded_at: now,
        applied_at: appliedAt,
        updated_at: now,
      })
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating recommendation:', updateError)
      return NextResponse.json({ error: 'Failed to update recommendation' }, { status: 500 })
    }

    return NextResponse.json({
      recommendation: updated,
      applied: appliedAt !== null,
    })
  } catch (error) {
    console.error('Recommendation respond error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * Apply a recommendation's changes to the plan
 */
async function applyRecommendation(
  adminClient: ReturnType<typeof createAdminClient>,
  recommendation: PlanRecommendation,
  overrideChanges?: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  const changes = overrideChanges || recommendation.proposed_changes

  try {
    switch (recommendation.recommendation_type) {
      // ========== PHASE-LEVEL ==========
      case 'phase_extension':
        return await applyPhaseExtension(adminClient, recommendation, changes)

      case 'phase_shorten':
        return await applyPhaseShorten(adminClient, recommendation, changes)

      case 'phase_insert':
        return await applyPhaseInsert(adminClient, recommendation, changes)

      // ========== WEEK-LEVEL ==========
      case 'week_volume_adjust':
        return await applyWeekVolumeAdjust(adminClient, recommendation, changes)

      case 'week_type_change':
        return await applyWeekTypeChange(adminClient, recommendation, changes)

      // ========== WORKOUT-LEVEL ==========
      case 'workout_intensity_scale':
        return await applyWorkoutIntensityScale(adminClient, recommendation, changes)

      case 'workout_substitute':
        return await applyWorkoutSubstitute(adminClient, recommendation, changes)

      case 'workout_skip':
        return await applyWorkoutSkip(adminClient, recommendation)

      default:
        return { success: true } // No-op for unsupported types
    }
  } catch (error) {
    console.error(`Error applying ${recommendation.recommendation_type}:`, error)
    return { success: false, error: String(error) }
  }
}

// ========== PHASE-LEVEL APPLICATIONS ==========

async function applyPhaseExtension(
  adminClient: ReturnType<typeof createAdminClient>,
  recommendation: PlanRecommendation,
  changes: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  if (!recommendation.target_phase_id) {
    return { success: false, error: 'No target phase specified' }
  }

  const newEndDate = (changes as { new_end_date?: string }).new_end_date
  if (!newEndDate) {
    return { success: false, error: 'No new_end_date in changes' }
  }

  // Get current phase to store original end date
  const { data: currentPhase } = await (adminClient as any)
    .from('training_phases')
    .select('end_date, adaptation_history')
    .eq('id', recommendation.target_phase_id)
    .single()

  const history = (currentPhase?.adaptation_history as unknown[]) || []
  history.push({
    date: new Date().toISOString().split('T')[0],
    type: 'extension',
    original_end_date: currentPhase?.end_date,
    new_end_date: newEndDate,
    recommendation_id: recommendation.id,
  })

  // Update the phase
  const { error } = await (adminClient as any)
    .from('training_phases')
    .update({
      end_date: newEndDate,
      original_end_date: currentPhase?.end_date || null,
      adaptation_history: history,
      updated_at: new Date().toISOString(),
    })
    .eq('id', recommendation.target_phase_id)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}

async function applyPhaseShorten(
  adminClient: ReturnType<typeof createAdminClient>,
  recommendation: PlanRecommendation,
  changes: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  if (!recommendation.target_phase_id) {
    return { success: false, error: 'No target phase specified' }
  }

  const newEndDate = (changes as { new_end_date?: string }).new_end_date
  if (!newEndDate) {
    return { success: false, error: 'No new_end_date in changes' }
  }

  const { data: currentPhase } = await (adminClient as any)
    .from('training_phases')
    .select('end_date, adaptation_history')
    .eq('id', recommendation.target_phase_id)
    .single()

  const history = (currentPhase?.adaptation_history as unknown[]) || []
  history.push({
    date: new Date().toISOString().split('T')[0],
    type: 'shorten',
    original_end_date: currentPhase?.end_date,
    new_end_date: newEndDate,
    recommendation_id: recommendation.id,
  })

  const { error } = await (adminClient as any)
    .from('training_phases')
    .update({
      end_date: newEndDate,
      original_end_date: currentPhase?.end_date || null,
      adaptation_history: history,
      updated_at: new Date().toISOString(),
    })
    .eq('id', recommendation.target_phase_id)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}

async function applyPhaseInsert(
  adminClient: ReturnType<typeof createAdminClient>,
  recommendation: PlanRecommendation,
  changes: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  const insertChanges = changes as {
    phase_type?: string
    duration_days?: number
    insert_after_phase_id?: string
  }

  if (!insertChanges.phase_type || !insertChanges.duration_days) {
    return { success: false, error: 'phase_type and duration_days required' }
  }

  // Get the phase to insert after
  const { data: afterPhase } = await (adminClient as any)
    .from('training_phases')
    .select('id, plan_id, end_date, order_index')
    .eq('id', insertChanges.insert_after_phase_id || recommendation.target_phase_id)
    .single()

  if (!afterPhase) {
    return { success: false, error: 'Reference phase not found' }
  }

  // Calculate new phase dates
  const startDate = new Date(afterPhase.end_date)
  startDate.setDate(startDate.getDate() + 1)
  const endDate = new Date(startDate)
  endDate.setDate(endDate.getDate() + insertChanges.duration_days - 1)

  // Shift subsequent phases
  await (adminClient as any)
    .from('training_phases')
    .update({
      order_index: afterPhase.order_index + 1,
    })
    .eq('plan_id', afterPhase.plan_id)
    .gt('order_index', afterPhase.order_index)

  // Insert the new phase
  const { error } = await (adminClient as any)
    .from('training_phases')
    .insert({
      plan_id: afterPhase.plan_id,
      name: `Inserted ${insertChanges.phase_type}`,
      phase_type: insertChanges.phase_type,
      order_index: afterPhase.order_index + 1,
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0],
      intensity_focus: insertChanges.phase_type === 'recovery' ? 'recovery' : 'volume',
      volume_modifier: insertChanges.phase_type === 'recovery' ? 0.5 : 0.7,
      intensity_modifier: insertChanges.phase_type === 'recovery' ? 0.6 : 0.8,
      activity_distribution: {},
      adaptation_history: [{
        date: new Date().toISOString().split('T')[0],
        type: 'inserted',
        recommendation_id: recommendation.id,
      }],
    })

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}

// ========== WEEK-LEVEL APPLICATIONS ==========

async function applyWeekVolumeAdjust(
  adminClient: ReturnType<typeof createAdminClient>,
  recommendation: PlanRecommendation,
  changes: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  if (!recommendation.target_week_id) {
    return { success: false, error: 'No target week specified' }
  }

  const volumeChanges = changes as {
    target_hours?: { proposed: number }
    target_tss?: { proposed: number }
  }

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (volumeChanges.target_hours?.proposed !== undefined) {
    updates.target_hours = volumeChanges.target_hours.proposed
  }
  if (volumeChanges.target_tss?.proposed !== undefined) {
    updates.target_tss = volumeChanges.target_tss.proposed
  }

  // Get current adjustments
  const { data: current } = await (adminClient as any)
    .from('weekly_targets')
    .select('adaptation_adjustments')
    .eq('id', recommendation.target_week_id)
    .single()

  const adjustments = (current?.adaptation_adjustments as unknown[]) || []
  adjustments.push({
    date: new Date().toISOString().split('T')[0],
    type: 'volume_adjust',
    changes: volumeChanges,
    recommendation_id: recommendation.id,
  })
  updates.adaptation_adjustments = adjustments

  const { error } = await (adminClient as any)
    .from('weekly_targets')
    .update(updates)
    .eq('id', recommendation.target_week_id)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}

async function applyWeekTypeChange(
  adminClient: ReturnType<typeof createAdminClient>,
  recommendation: PlanRecommendation,
  changes: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  if (!recommendation.target_week_id) {
    return { success: false, error: 'No target week specified' }
  }

  const typeChanges = changes as { proposed_type?: string }
  if (!typeChanges.proposed_type) {
    return { success: false, error: 'No proposed_type in changes' }
  }

  const { data: current } = await (adminClient as any)
    .from('weekly_targets')
    .select('week_type, adaptation_adjustments')
    .eq('id', recommendation.target_week_id)
    .single()

  const adjustments = (current?.adaptation_adjustments as unknown[]) || []
  adjustments.push({
    date: new Date().toISOString().split('T')[0],
    type: 'week_type_change',
    from: current?.week_type,
    to: typeChanges.proposed_type,
    recommendation_id: recommendation.id,
  })

  const { error } = await (adminClient as any)
    .from('weekly_targets')
    .update({
      week_type: typeChanges.proposed_type,
      adaptation_adjustments: adjustments,
      updated_at: new Date().toISOString(),
    })
    .eq('id', recommendation.target_week_id)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}

// ========== WORKOUT-LEVEL APPLICATIONS ==========

async function applyWorkoutIntensityScale(
  adminClient: ReturnType<typeof createAdminClient>,
  recommendation: PlanRecommendation,
  changes: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  if (!recommendation.target_workout_id) {
    return { success: false, error: 'No target workout specified' }
  }

  const scaleChanges = changes as {
    adjustment_factor?: number
    original_intensity?: string
    scaled_intensity?: string
  }

  if (!scaleChanges.adjustment_factor) {
    return { success: false, error: 'No adjustment_factor in changes' }
  }

  const { error } = await (adminClient as any)
    .from('suggested_workouts')
    .update({
      readiness_adjusted: true,
      adjustment_factor: scaleChanges.adjustment_factor,
      original_intensity: scaleChanges.original_intensity || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', recommendation.target_workout_id)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}

async function applyWorkoutSubstitute(
  adminClient: ReturnType<typeof createAdminClient>,
  recommendation: PlanRecommendation,
  changes: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  if (!recommendation.target_workout_id) {
    return { success: false, error: 'No target workout specified' }
  }

  const subChanges = changes as {
    substitutions?: Array<{
      original_exercise: string
      substitute_exercise: string
      reason: string
    }>
  }

  if (!subChanges.substitutions || subChanges.substitutions.length === 0) {
    return { success: true } // Nothing to substitute
  }

  // Get current workout exercises
  const { data: workout } = await (adminClient as any)
    .from('suggested_workouts')
    .select('exercises')
    .eq('id', recommendation.target_workout_id)
    .single()

  if (!workout || !workout.exercises) {
    return { success: false, error: 'Workout not found or has no exercises' }
  }

  // Apply substitutions
  const exercises = workout.exercises as Array<{ exercise_name: string; [key: string]: unknown }>
  for (const sub of subChanges.substitutions) {
    const idx = exercises.findIndex(
      e => e.exercise_name.toLowerCase() === sub.original_exercise.toLowerCase()
    )
    if (idx !== -1) {
      exercises[idx].exercise_name = sub.substitute_exercise
    }
  }

  const { error } = await (adminClient as any)
    .from('suggested_workouts')
    .update({
      exercises,
      substitution_reason: subChanges.substitutions.map(s => s.reason).join(', '),
      updated_at: new Date().toISOString(),
    })
    .eq('id', recommendation.target_workout_id)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}

async function applyWorkoutSkip(
  adminClient: ReturnType<typeof createAdminClient>,
  recommendation: PlanRecommendation
): Promise<{ success: boolean; error?: string }> {
  if (!recommendation.target_workout_id) {
    return { success: false, error: 'No target workout specified' }
  }

  const { error } = await (adminClient as any)
    .from('suggested_workouts')
    .update({
      status: 'skipped',
      updated_at: new Date().toISOString(),
    })
    .eq('id', recommendation.target_workout_id)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}
