import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import {
  TrainingPlan,
  CreateTrainingPlanRequest,
  TrainingPhase,
  WeeklyTarget,
  PlanEvent,
} from '@/types/training-plan'

// GET /api/training-plans - List user's training plans
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()

    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') // 'active', 'draft', 'completed', 'archived'
    const includeDetails = searchParams.get('include') === 'details' // Include phases, events

    // Build query - using 'as any' because training_plans table is new
    let query = (adminClient as any)
      .from('training_plans')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    }

    const { data: plans, error } = await query

    if (error) {
      console.error('Error fetching training plans:', error)
      return NextResponse.json({ error: 'Failed to fetch training plans' }, { status: 500 })
    }

    // If details requested, fetch phases and events for each plan
    if (includeDetails && plans && plans.length > 0) {
      const planIds = plans.map((p: any) => p.id)

      // Fetch phases
      const { data: phases } = await (adminClient as any)
        .from('training_phases')
        .select('*')
        .in('plan_id', planIds)
        .order('order_index', { ascending: true })

      // Fetch events
      const { data: events } = await (adminClient as any)
        .from('plan_events')
        .select('*')
        .in('plan_id', planIds)
        .order('event_date', { ascending: true })

      // Attach to plans
      const plansWithDetails = plans.map((plan: any) => ({
        ...plan,
        phases: (phases || []).filter((p: any) => p.plan_id === plan.id),
        events: (events || []).filter((e: any) => e.plan_id === plan.id),
      }))

      return NextResponse.json({ plans: plansWithDetails })
    }

    return NextResponse.json({ plans: plans || [] })
  } catch (error) {
    console.error('Training plans GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/training-plans - Create a new training plan
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()

    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: CreateTrainingPlanRequest = await request.json()

    // Validate required fields
    if (!body.name || !body.start_date) {
      return NextResponse.json(
        { error: 'Name and start_date are required' },
        { status: 400 }
      )
    }

    // Create the plan
    const { data: plan, error: planError } = await (adminClient as any)
      .from('training_plans')
      .insert({
        user_id: session.user.id,
        name: body.name,
        description: body.description || null,
        goal: body.goal || null,
        start_date: body.start_date,
        end_date: body.end_date || null,
        primary_sport: body.primary_sport || null,
        weekly_hours_target: body.weekly_hours_target || null,
        status: 'active',
        ai_generated: false,
      })
      .select()
      .single()

    if (planError || !plan) {
      console.error('Error creating training plan:', planError)
      return NextResponse.json({ error: 'Failed to create training plan' }, { status: 500 })
    }

    // Create phases if provided
    let createdPhases: TrainingPhase[] = []
    if (body.phases && body.phases.length > 0) {
      const phasesData = body.phases.map(phase => ({
        plan_id: plan.id,
        name: phase.name,
        phase_type: phase.phase_type,
        order_index: phase.order_index,
        start_date: phase.start_date,
        end_date: phase.end_date,
        intensity_focus: phase.intensity_focus || null,
        volume_modifier: phase.volume_modifier || 1.0,
        intensity_modifier: phase.intensity_modifier || 1.0,
        activity_distribution: phase.activity_distribution || {},
        description: phase.description || null,
        notes: phase.notes || null,
      }))

      const { data: phases, error: phasesError } = await (adminClient as any)
        .from('training_phases')
        .insert(phasesData)
        .select()

      if (phasesError) {
        console.error('Error creating phases:', phasesError)
      } else {
        createdPhases = phases || []

        // Create weekly targets for each phase
        for (let i = 0; i < createdPhases.length; i++) {
          const phase = createdPhases[i]
          const phaseRequest = body.phases[i]

          if (phaseRequest.weekly_targets && phaseRequest.weekly_targets.length > 0) {
            const targetsData = phaseRequest.weekly_targets.map(target => ({
              phase_id: phase.id,
              week_number: target.week_number,
              week_start_date: target.week_start_date,
              target_hours: target.target_hours || null,
              target_tss: target.target_tss || null,
              cycling_hours: target.cycling_hours || 0,
              running_hours: target.running_hours || 0,
              swimming_hours: target.swimming_hours || 0,
              lifting_sessions: target.lifting_sessions || 0,
              other_hours: target.other_hours || 0,
              zone_distribution: target.zone_distribution || {},
              week_type: target.week_type || 'normal',
              daily_structure: target.daily_structure || {},
              notes: target.notes || null,
            }))

            await (adminClient as any).from('weekly_targets').insert(targetsData)
          }
        }
      }
    }

    // Create events if provided
    let createdEvents: PlanEvent[] = []
    if (body.events && body.events.length > 0) {
      const eventsData = body.events.map(event => ({
        plan_id: plan.id,
        name: event.name,
        event_type: event.event_type,
        priority: event.priority || 'B',
        event_date: event.event_date,
        end_date: event.end_date || null,
        sport: event.sport || null,
        distance_miles: event.distance_miles || null,
        elevation_ft: event.elevation_ft || null,
        expected_duration_hours: event.expected_duration_hours || null,
        taper_days: event.taper_days || 0,
        recovery_days: event.recovery_days || 0,
        blocks_training: event.blocks_training || false,
        notes: event.notes || null,
        location: event.location || null,
        external_url: event.external_url || null,
      }))

      const { data: events, error: eventsError } = await (adminClient as any)
        .from('plan_events')
        .insert(eventsData)
        .select()

      if (eventsError) {
        console.error('Error creating events:', eventsError)
      } else {
        createdEvents = events || []
      }
    }

    // Set as active plan in profile
    await (adminClient as any)
      .from('profiles')
      .update({ active_program_id: plan.id })
      .eq('id', session.user.id)

    return NextResponse.json({
      plan: {
        ...plan,
        phases: createdPhases,
        events: createdEvents,
      }
    }, { status: 201 })
  } catch (error) {
    console.error('Training plans POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
