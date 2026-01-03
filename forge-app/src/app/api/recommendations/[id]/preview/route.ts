// @ts-nocheck
// Recommendation Preview API Endpoint
// POST: Get a what-if analysis of accepting a recommendation
// Shows the projected impact without actually applying the changes
// TODO: Fix Supabase type generation to include newer tables

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { collectMetrics } from '@/lib/adaptation-engine/metrics-collector'

interface PreviewResult {
  recommendation_id: string
  recommendation_type: string
  current_state: Record<string, unknown>
  projected_state: Record<string, unknown>
  affected_items: {
    phases: string[]
    weeks: string[]
    workouts: string[]
  }
  timeline_impact: {
    original_end_date: string | null
    projected_end_date: string | null
    days_difference: number
  }
  training_load_projection: {
    current_tsb: number
    projected_tsb_7_days: number
    projected_tsb_14_days: number
  }
  risks: string[]
  benefits: string[]
}

// POST /api/recommendations/[id]/preview - Get what-if analysis
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: recommendationId } = await params
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminClient = createAdminClient()

    // Get the recommendation
    const { data: recommendation, error: recError } = await (adminClient as any)
      .from('plan_recommendations')
      .select('*')
      .eq('id', recommendationId)
      .single()

    if (recError || !recommendation) {
      return NextResponse.json({ error: 'Recommendation not found' }, { status: 404 })
    }

    if (recommendation.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Generate preview based on recommendation type
    const preview = await generatePreview(adminClient, user.id, recommendation)

    return NextResponse.json(preview)
  } catch (error) {
    console.error('Error in preview POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * Generate a what-if preview for a recommendation
 */
async function generatePreview(
  adminClient: ReturnType<typeof createAdminClient>,
  userId: string,
  recommendation: any
): Promise<PreviewResult> {
  const planId = recommendation.plan_id
  const changes = recommendation.proposed_changes || {}

  // Collect current metrics
  const metrics = await collectMetrics(userId, planId)

  // Initialize preview result
  const preview: PreviewResult = {
    recommendation_id: recommendation.id,
    recommendation_type: recommendation.recommendation_type,
    current_state: {},
    projected_state: {},
    affected_items: {
      phases: [],
      weeks: [],
      workouts: [],
    },
    timeline_impact: {
      original_end_date: null,
      projected_end_date: null,
      days_difference: 0,
    },
    training_load_projection: {
      current_tsb: metrics.trainingLoad.tsb,
      projected_tsb_7_days: metrics.trainingLoad.tsb,
      projected_tsb_14_days: metrics.trainingLoad.tsb,
    },
    risks: [],
    benefits: [],
  }

  // Generate type-specific preview
  switch (recommendation.recommendation_type) {
    case 'workout_intensity_scale':
      await previewWorkoutIntensityScale(adminClient, recommendation, preview, metrics)
      break

    case 'week_type_change':
      await previewWeekTypeChange(adminClient, recommendation, preview, metrics)
      break

    case 'week_volume_adjust':
      await previewWeekVolumeAdjust(adminClient, recommendation, preview, metrics)
      break

    case 'phase_extension':
      await previewPhaseExtension(adminClient, recommendation, preview, metrics)
      break

    case 'phase_shorten':
      await previewPhaseShorten(adminClient, recommendation, preview, metrics)
      break

    case 'phase_insert':
      await previewPhaseInsert(adminClient, recommendation, preview, metrics)
      break

    default:
      preview.risks.push('Preview not available for this recommendation type')
  }

  return preview
}

/**
 * Preview workout intensity scaling
 */
async function previewWorkoutIntensityScale(
  adminClient: ReturnType<typeof createAdminClient>,
  recommendation: any,
  preview: PreviewResult,
  metrics: any
) {
  const changes = recommendation.proposed_changes
  const factor = changes.adjustment_factor || 1

  // Get today's workouts
  const today = new Date().toISOString().split('T')[0]
  const { data: workouts } = await (adminClient as any)
    .from('suggested_workouts')
    .select('id, title, category, primary_intensity, target_duration_minutes')
    .eq('plan_id', recommendation.plan_id)
    .eq('suggested_date', today)
    .eq('status', 'suggested')

  if (workouts && workouts.length > 0) {
    preview.affected_items.workouts = workouts.map((w: any) => w.id)

    preview.current_state = {
      workouts: workouts.map((w: any) => ({
        id: w.id,
        title: w.title,
        intensity: w.primary_intensity,
        duration: w.target_duration_minutes,
      })),
    }

    const reductionPercent = Math.round((1 - factor) * 100)

    preview.projected_state = {
      workouts: workouts.map((w: any) => ({
        id: w.id,
        title: w.title,
        intensity: `${w.primary_intensity} (reduced by ${reductionPercent}%)`,
        duration: w.target_duration_minutes,
        adjustment_factor: factor,
      })),
    }

    // TSB projection - reducing intensity improves recovery
    const tssReduction = reductionPercent * 0.5 // Rough estimate
    preview.training_load_projection.projected_tsb_7_days = metrics.trainingLoad.tsb + (tssReduction * 0.3)
    preview.training_load_projection.projected_tsb_14_days = metrics.trainingLoad.tsb + (tssReduction * 0.5)

    preview.benefits.push(`Reduced training stress allows better recovery`)
    preview.benefits.push(`Maintains training consistency while respecting fatigue`)

    if (factor < 0.7) {
      preview.risks.push(`Significant intensity reduction may reduce training stimulus`)
    }
  }
}

/**
 * Preview week type change
 */
async function previewWeekTypeChange(
  adminClient: ReturnType<typeof createAdminClient>,
  recommendation: any,
  preview: PreviewResult,
  metrics: any
) {
  const changes = recommendation.proposed_changes
  const weekId = recommendation.target_week_id

  // Get week info
  const { data: week } = await (adminClient as any)
    .from('weekly_targets')
    .select('*')
    .eq('id', weekId)
    .single()

  if (week) {
    preview.affected_items.weeks = [weekId]

    preview.current_state = {
      week_type: changes.original_type || week.week_type,
      target_hours: week.target_hours,
      target_tss: week.target_tss,
    }

    // Recovery weeks typically have 40-50% volume reduction
    const volumeReduction = changes.proposed_type === 'recovery' ? 0.5 : 1
    const projectedHours = (week.target_hours || 0) * volumeReduction
    const projectedTss = (week.target_tss || 0) * volumeReduction

    preview.projected_state = {
      week_type: changes.proposed_type,
      target_hours: Math.round(projectedHours * 10) / 10,
      target_tss: Math.round(projectedTss),
    }

    // TSB projection for recovery week
    if (changes.proposed_type === 'recovery') {
      preview.training_load_projection.projected_tsb_7_days = metrics.trainingLoad.tsb + 15
      preview.training_load_projection.projected_tsb_14_days = metrics.trainingLoad.tsb + 20

      preview.benefits.push(`TSB expected to improve by ~15-20 points`)
      preview.benefits.push(`Allows supercompensation from accumulated training`)
      preview.benefits.push(`Reduces injury risk from fatigue accumulation`)
    }

    // Get workouts that would be affected
    const weekStart = week.week_start_date
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 6)

    const { data: workouts } = await (adminClient as any)
      .from('suggested_workouts')
      .select('id')
      .eq('plan_id', recommendation.plan_id)
      .gte('suggested_date', weekStart)
      .lte('suggested_date', weekEnd.toISOString().split('T')[0])

    if (workouts) {
      preview.affected_items.workouts = workouts.map((w: any) => w.id)
    }
  }
}

/**
 * Preview week volume adjustment
 */
async function previewWeekVolumeAdjust(
  adminClient: ReturnType<typeof createAdminClient>,
  recommendation: any,
  preview: PreviewResult,
  metrics: any
) {
  const changes = recommendation.proposed_changes
  const weekId = recommendation.target_week_id

  // Get week info
  const { data: week } = await (adminClient as any)
    .from('weekly_targets')
    .select('*')
    .eq('id', weekId)
    .single()

  if (week) {
    preview.affected_items.weeks = [weekId]

    preview.current_state = {
      target_hours: changes.target_hours?.original || week.target_hours,
      target_tss: week.target_tss,
    }

    preview.projected_state = {
      target_hours: changes.target_hours?.proposed,
      target_tss: week.target_tss ? Math.round(week.target_tss * (1 + (changes.volume_percentage_change || 0) / 100)) : null,
      volume_change: `${changes.volume_percentage_change > 0 ? '+' : ''}${changes.volume_percentage_change}%`,
    }

    if (changes.volume_percentage_change < 0) {
      preview.benefits.push(`More achievable targets may improve compliance`)
      preview.benefits.push(`Reduced volume aids recovery`)
    } else {
      preview.benefits.push(`Increased training stimulus for continued adaptation`)
      preview.risks.push(`Higher volume requires adequate recovery capacity`)
    }
  }
}

/**
 * Preview phase extension
 */
async function previewPhaseExtension(
  adminClient: ReturnType<typeof createAdminClient>,
  recommendation: any,
  preview: PreviewResult,
  metrics: any
) {
  const changes = recommendation.proposed_changes
  const phaseId = recommendation.target_phase_id

  // Get phase info
  const { data: phase } = await (adminClient as any)
    .from('training_phases')
    .select('*')
    .eq('id', phaseId)
    .single()

  if (phase) {
    preview.affected_items.phases = [phaseId]

    preview.current_state = {
      phase_name: phase.name,
      end_date: changes.original_end_date || phase.end_date,
    }

    preview.projected_state = {
      phase_name: phase.name,
      end_date: changes.proposed_end_date,
      extension_days: changes.extension_days,
    }

    preview.timeline_impact = {
      original_end_date: changes.original_end_date || phase.end_date,
      projected_end_date: changes.proposed_end_date,
      days_difference: changes.extension_days,
    }

    preview.benefits.push(`More time to achieve phase goals`)
    preview.benefits.push(`Reduces pressure and rushing through progressions`)

    // Check for downstream impacts
    const { data: laterPhases } = await (adminClient as any)
      .from('training_phases')
      .select('id, name')
      .eq('plan_id', recommendation.plan_id)
      .gt('start_date', phase.end_date)

    if (laterPhases && laterPhases.length > 0) {
      preview.affected_items.phases.push(...laterPhases.map((p: any) => p.id))
      preview.risks.push(`${laterPhases.length} subsequent phase(s) will be shifted`)

      // Check if this affects an event
      const { data: events } = await (adminClient as any)
        .from('plan_events')
        .select('id, name, event_date')
        .eq('plan_id', recommendation.plan_id)
        .gte('event_date', phase.end_date)

      if (events && events.length > 0) {
        preview.risks.push(`May affect preparation for: ${events.map((e: any) => e.name).join(', ')}`)
      }
    }
  }
}

/**
 * Preview phase shortening
 */
async function previewPhaseShorten(
  adminClient: ReturnType<typeof createAdminClient>,
  recommendation: any,
  preview: PreviewResult,
  metrics: any
) {
  const changes = recommendation.proposed_changes
  const phaseId = recommendation.target_phase_id

  // Get phase info
  const { data: phase } = await (adminClient as any)
    .from('training_phases')
    .select('*')
    .eq('id', phaseId)
    .single()

  if (phase) {
    preview.affected_items.phases = [phaseId]

    preview.current_state = {
      phase_name: phase.name,
      end_date: changes.original_end_date || phase.end_date,
    }

    preview.projected_state = {
      phase_name: phase.name,
      end_date: changes.proposed_end_date,
      days_shortened: changes.shorten_days,
    }

    preview.timeline_impact = {
      original_end_date: changes.original_end_date || phase.end_date,
      projected_end_date: changes.proposed_end_date,
      days_difference: -changes.shorten_days,
    }

    preview.benefits.push(`Earlier progression to next training phase`)
    preview.benefits.push(`Momentum maintained through faster progression`)

    // Check for downstream impacts
    const { data: laterPhases } = await (adminClient as any)
      .from('training_phases')
      .select('id, name')
      .eq('plan_id', recommendation.plan_id)
      .gt('start_date', phase.end_date)

    if (laterPhases && laterPhases.length > 0) {
      preview.affected_items.phases.push(...laterPhases.map((p: any) => p.id))
      preview.benefits.push(`${laterPhases.length} subsequent phase(s) can start earlier`)
    }
  }
}

/**
 * Preview phase insertion
 */
async function previewPhaseInsert(
  adminClient: ReturnType<typeof createAdminClient>,
  recommendation: any,
  preview: PreviewResult,
  metrics: any
) {
  const changes = recommendation.proposed_changes

  preview.current_state = {
    tsb: metrics.trainingLoad.tsb,
    readiness: metrics.readiness.avgLast7Days,
    fatigue_status: metrics.trainingLoad.tsb < -20 ? 'High fatigue' : 'Moderate fatigue',
  }

  preview.projected_state = {
    inserted_phase: {
      type: changes.phase_type,
      duration_days: changes.duration_days,
      start_date: changes.start_date,
      end_date: changes.end_date,
    },
  }

  preview.timeline_impact = {
    original_end_date: null,
    projected_end_date: null,
    days_difference: changes.duration_days,
  }

  // Get affected phases
  if (changes.shifts_remaining_phases) {
    const { data: laterPhases } = await (adminClient as any)
      .from('training_phases')
      .select('id, name')
      .eq('plan_id', recommendation.plan_id)
      .gte('start_date', changes.start_date)

    if (laterPhases && laterPhases.length > 0) {
      preview.affected_items.phases = laterPhases.map((p: any) => p.id)
      preview.risks.push(`${laterPhases.length} phase(s) will be shifted by ${changes.duration_days} days`)
    }
  }

  // TSB projection for recovery
  preview.training_load_projection.projected_tsb_7_days = metrics.trainingLoad.tsb + 20
  preview.training_load_projection.projected_tsb_14_days = metrics.trainingLoad.tsb + 30

  preview.benefits.push(`Critical recovery to prevent overtraining`)
  preview.benefits.push(`TSB expected to improve by 20-30 points`)
  preview.benefits.push(`Reduced injury risk from fatigue accumulation`)
  preview.benefits.push(`Better long-term performance trajectory`)

  // Check for events
  const { data: events } = await (adminClient as any)
    .from('plan_events')
    .select('id, name, event_date')
    .eq('plan_id', recommendation.plan_id)
    .gte('event_date', changes.start_date)

  if (events && events.length > 0) {
    preview.risks.push(`May affect preparation for: ${events.map((e: any) => e.name).join(', ')}`)
  }
}
