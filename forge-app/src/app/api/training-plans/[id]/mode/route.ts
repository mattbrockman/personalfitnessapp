// @ts-nocheck
// Plan Mode API Endpoint
// GET: Get current plan mode configuration
// PUT: Update plan mode configuration
// POST: Convert plan between modes (rolling <-> goal)
// TODO: Fix Supabase type generation to include newer tables

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { PlanMode, PlanModeConfig, PhaseType } from '@/types/training-plan'

const DEFAULT_ROLLING_CONFIG = {
  rolling_cycle: {
    sequence: ['base', 'build', 'recovery'] as PhaseType[],
    repeat: true,
  },
  rolling_phase_durations: {
    base: 28,
    build: 21,
    peak: 14,
    taper: 7,
    recovery: 7,
    competition: 1,
  },
  auto_generate_weeks: 4,
  regenerate_threshold: 2,
}

const DEFAULT_GOAL_CONFIG = {
  peak_readiness_target: 85,
  taper_weeks: 2,
  taper_volume_reduction: 40,
}

// GET /api/training-plans/[id]/mode - Get plan mode config
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: planId } = await params
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminClient = createAdminClient()

    // Verify plan ownership
    const { data: plan, error: planError } = await (adminClient as any)
      .from('training_plans')
      .select('id, user_id, plan_mode, end_date')
      .eq('id', planId)
      .single()

    if (planError || !plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    if (plan.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Get mode config
    const { data: modeConfig, error: configError } = await (adminClient as any)
      .from('plan_mode_config')
      .select('*')
      .eq('plan_id', planId)
      .single()

    // Determine current mode
    const currentMode: PlanMode = plan.plan_mode || (plan.end_date ? 'goal_based' : 'rolling')

    if (!modeConfig) {
      // Return defaults based on current mode
      return NextResponse.json({
        plan_id: planId,
        plan_mode: currentMode,
        config: currentMode === 'rolling' ? DEFAULT_ROLLING_CONFIG : DEFAULT_GOAL_CONFIG,
        is_default: true,
      })
    }

    return NextResponse.json({
      plan_id: planId,
      plan_mode: modeConfig.plan_mode || currentMode,
      config: modeConfig,
      is_default: false,
    })
  } catch (error) {
    console.error('Error in mode GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/training-plans/[id]/mode - Update plan mode config
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: planId } = await params
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const adminClient = createAdminClient()

    // Verify plan ownership
    const { data: plan, error: planError } = await (adminClient as any)
      .from('training_plans')
      .select('id, user_id')
      .eq('id', planId)
      .single()

    if (planError || !plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    if (plan.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Validate and filter allowed fields
    const allowedFields = [
      'plan_mode',
      'rolling_cycle',
      'rolling_phase_durations',
      'auto_generate_weeks',
      'regenerate_threshold',
      'target_event_id',
      'target_event_date',
      'peak_readiness_target',
      'taper_weeks',
      'taper_volume_reduction',
    ]

    const updates: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field]
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    // Upsert mode config
    const { data: config, error: upsertError } = await (adminClient as any)
      .from('plan_mode_config')
      .upsert({
        plan_id: planId,
        ...updates,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'plan_id' })
      .select()
      .single()

    if (upsertError) {
      console.error('Error upserting mode config:', upsertError)
      return NextResponse.json({ error: 'Failed to update mode config' }, { status: 500 })
    }

    // Update plan's plan_mode field if it changed
    if (updates.plan_mode) {
      await (adminClient as any)
        .from('training_plans')
        .update({ plan_mode: updates.plan_mode })
        .eq('id', planId)
    }

    return NextResponse.json({ config })
  } catch (error) {
    console.error('Error in mode PUT:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/training-plans/[id]/mode - Convert between modes
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: planId } = await params
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { target_mode, event_id, event_date, reason } = body

    if (!target_mode || !['rolling', 'goal_based'].includes(target_mode)) {
      return NextResponse.json({
        error: 'target_mode must be "rolling" or "goal_based"',
      }, { status: 400 })
    }

    const adminClient = createAdminClient()

    // Get current plan and mode
    const { data: plan, error: planError } = await (adminClient as any)
      .from('training_plans')
      .select('*, plan_mode_config(*)')
      .eq('id', planId)
      .single()

    if (planError || !plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    if (plan.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const currentMode: PlanMode = plan.plan_mode || (plan.end_date ? 'goal_based' : 'rolling')

    if (currentMode === target_mode) {
      return NextResponse.json({
        error: `Plan is already in ${target_mode} mode`,
      }, { status: 400 })
    }

    // Perform conversion
    const conversionResult = await convertPlanMode(
      adminClient,
      planId,
      currentMode,
      target_mode as PlanMode,
      { event_id, event_date, reason }
    )

    return NextResponse.json(conversionResult)
  } catch (error) {
    console.error('Error in mode POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * Convert a plan between rolling and goal-based modes
 */
async function convertPlanMode(
  adminClient: ReturnType<typeof createAdminClient>,
  planId: string,
  fromMode: PlanMode,
  toMode: PlanMode,
  options: {
    event_id?: string
    event_date?: string
    reason?: string
  }
): Promise<{
  success: boolean
  plan_id: string
  from_mode: PlanMode
  to_mode: PlanMode
  changes: string[]
}> {
  const changes: string[] = []

  if (toMode === 'goal_based') {
    // Converting from rolling to goal-based
    // Need an event or end date
    if (!options.event_date && !options.event_id) {
      throw new Error('Converting to goal mode requires event_date or event_id')
    }

    let targetDate = options.event_date
    let eventId = options.event_id

    // If event_id provided, get the event date
    if (eventId && !targetDate) {
      const { data: event } = await (adminClient as any)
        .from('plan_events')
        .select('event_date')
        .eq('id', eventId)
        .single()

      if (event) {
        targetDate = event.event_date
      }
    }

    if (!targetDate) {
      throw new Error('Could not determine target date for goal mode')
    }

    // Update plan with end date
    await (adminClient as any)
      .from('training_plans')
      .update({
        end_date: targetDate,
        plan_mode: 'goal_based',
      })
      .eq('id', planId)

    changes.push(`Set plan end date to ${targetDate}`)

    // Update or create mode config
    await (adminClient as any)
      .from('plan_mode_config')
      .upsert({
        plan_id: planId,
        plan_mode: 'goal_based',
        target_event_id: eventId || null,
        target_event_date: targetDate,
        converted_from: fromMode,
        converted_at: new Date().toISOString(),
        conversion_reason: options.reason || 'Manual conversion',
        ...DEFAULT_GOAL_CONFIG,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'plan_id' })

    changes.push('Created goal-based configuration')

    // Adjust phases to fit timeline
    const adjustResult = await adjustPhasesForGoalMode(adminClient, planId, targetDate)
    changes.push(...adjustResult.changes)

  } else {
    // Converting from goal-based to rolling
    // Remove end date, set up rolling cycle

    await (adminClient as any)
      .from('training_plans')
      .update({
        end_date: null,
        plan_mode: 'rolling',
      })
      .eq('id', planId)

    changes.push('Removed plan end date')

    // Update or create mode config
    await (adminClient as any)
      .from('plan_mode_config')
      .upsert({
        plan_id: planId,
        plan_mode: 'rolling',
        target_event_id: null,
        target_event_date: null,
        converted_from: fromMode,
        converted_at: new Date().toISOString(),
        conversion_reason: options.reason || 'Manual conversion',
        ...DEFAULT_ROLLING_CONFIG,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'plan_id' })

    changes.push('Created rolling configuration with default cycle')
  }

  return {
    success: true,
    plan_id: planId,
    from_mode: fromMode,
    to_mode: toMode,
    changes,
  }
}

/**
 * Adjust phases to fit a goal-based timeline
 */
async function adjustPhasesForGoalMode(
  adminClient: ReturnType<typeof createAdminClient>,
  planId: string,
  targetDate: string
): Promise<{ changes: string[] }> {
  const changes: string[] = []
  const today = new Date()
  const target = new Date(targetDate)
  const daysUntilEvent = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (daysUntilEvent < 14) {
    changes.push('Warning: Less than 2 weeks until target date - limited time for proper periodization')
    return { changes }
  }

  // Get existing phases
  const { data: phases } = await (adminClient as any)
    .from('training_phases')
    .select('*')
    .eq('plan_id', planId)
    .order('start_date', { ascending: true })

  if (!phases || phases.length === 0) {
    changes.push('No phases to adjust')
    return { changes }
  }

  // Calculate taper phase (typically 1-2 weeks before event)
  const taperWeeks = daysUntilEvent > 42 ? 2 : 1
  const taperStart = new Date(target)
  taperStart.setDate(taperStart.getDate() - (taperWeeks * 7))

  // Check if last phase ends after target
  const lastPhase = phases[phases.length - 1]
  if (new Date(lastPhase.end_date) > target) {
    // Shorten last phase to end at taper start
    await (adminClient as any)
      .from('training_phases')
      .update({
        end_date: taperStart.toISOString().split('T')[0],
        original_end_date: lastPhase.end_date,
      })
      .eq('id', lastPhase.id)

    changes.push(`Shortened ${lastPhase.name} to end before taper`)
  }

  // Check if we need to add a taper phase
  const hasTaper = phases.some((p: any) => p.phase_type === 'taper')
  if (!hasTaper && daysUntilEvent > 21) {
    // Create taper phase
    await (adminClient as any)
      .from('training_phases')
      .insert({
        plan_id: planId,
        name: 'Taper',
        phase_type: 'taper',
        start_date: taperStart.toISOString().split('T')[0],
        end_date: targetDate,
        focus_areas: ['recovery', 'sharpening'],
        intensity_zone_distribution: { z1: 40, z2: 30, z3: 20, z4: 10, z5: 0 },
      })

    changes.push(`Added taper phase from ${taperStart.toISOString().split('T')[0]} to ${targetDate}`)
  }

  return { changes }
}
