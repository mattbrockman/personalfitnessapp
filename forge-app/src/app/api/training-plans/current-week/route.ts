import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { startOfWeek, format } from 'date-fns'

// GET /api/training-plans/current-week - Get current week's targets from active plan
export async function GET() {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()

    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's profile with active plan
    const { data: profile } = await (adminClient as any)
      .from('profiles')
      .select('active_program_id')
      .eq('id', session.user.id)
      .single()

    if (!profile?.active_program_id) {
      return NextResponse.json({
        plan: null,
        phase: null,
        weeklyTarget: null,
        events: []
      })
    }

    // Fetch the active plan
    const { data: plan } = await (adminClient as any)
      .from('training_plans')
      .select('*')
      .eq('id', profile.active_program_id)
      .single()

    if (!plan) {
      return NextResponse.json({
        plan: null,
        phase: null,
        weeklyTarget: null,
        events: []
      })
    }

    // Get today's date and current week start (Monday)
    const today = new Date()
    const weekStart = startOfWeek(today, { weekStartsOn: 1 })
    const weekStartStr = format(weekStart, 'yyyy-MM-dd')
    const todayStr = format(today, 'yyyy-MM-dd')

    // Find the current phase (where today falls between start and end)
    const { data: phases } = await (adminClient as any)
      .from('training_phases')
      .select('*')
      .eq('plan_id', plan.id)
      .lte('start_date', todayStr)
      .gte('end_date', todayStr)
      .order('order_index', { ascending: true })
      .limit(1)

    const currentPhase = phases?.[0] || null

    // Find weekly target for current week
    let weeklyTarget = null
    if (currentPhase) {
      const { data: targets } = await (adminClient as any)
        .from('weekly_targets')
        .select('*')
        .eq('phase_id', currentPhase.id)
        .eq('week_start_date', weekStartStr)
        .limit(1)

      weeklyTarget = targets?.[0] || null
    }

    // If no exact weekly target, try to get from phase defaults
    if (!weeklyTarget && currentPhase) {
      // Create a synthetic target from phase settings
      const baseHours = plan.weekly_hours_target || 10
      const volumeModifier = currentPhase.volume_modifier || 1.0
      const targetHours = baseHours * volumeModifier

      weeklyTarget = {
        id: 'synthetic',
        phase_id: currentPhase.id,
        week_start_date: weekStartStr,
        target_hours: targetHours,
        target_tss: Math.round(targetHours * 50), // Rough estimate: 50 TSS per hour
        cycling_hours: currentPhase.activity_distribution?.cycling ? (targetHours * currentPhase.activity_distribution.cycling / 100) : 0,
        running_hours: currentPhase.activity_distribution?.running ? (targetHours * currentPhase.activity_distribution.running / 100) : 0,
        swimming_hours: currentPhase.activity_distribution?.swimming ? (targetHours * currentPhase.activity_distribution.swimming / 100) : 0,
        lifting_sessions: currentPhase.activity_distribution?.lifting ? Math.round(targetHours * currentPhase.activity_distribution.lifting / 100 / 1.5) : 0, // ~1.5hr per session
        other_hours: currentPhase.activity_distribution?.other ? (targetHours * currentPhase.activity_distribution.other / 100) : 0,
        week_type: 'normal',
        zone_distribution: {},
        daily_structure: {},
      }
    }

    // Get upcoming events (next 30 days)
    const thirtyDaysLater = new Date()
    thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30)
    const thirtyDaysStr = format(thirtyDaysLater, 'yyyy-MM-dd')

    const { data: events } = await (adminClient as any)
      .from('plan_events')
      .select('*')
      .eq('plan_id', plan.id)
      .gte('event_date', todayStr)
      .lte('event_date', thirtyDaysStr)
      .order('event_date', { ascending: true })

    return NextResponse.json({
      plan: {
        id: plan.id,
        name: plan.name,
        goal: plan.goal,
        primary_sport: plan.primary_sport,
        weekly_hours_target: plan.weekly_hours_target,
      },
      phase: currentPhase ? {
        id: currentPhase.id,
        name: currentPhase.name,
        phase_type: currentPhase.phase_type,
        intensity_focus: currentPhase.intensity_focus,
        volume_modifier: currentPhase.volume_modifier,
        intensity_modifier: currentPhase.intensity_modifier,
        activity_distribution: currentPhase.activity_distribution,
        start_date: currentPhase.start_date,
        end_date: currentPhase.end_date,
      } : null,
      weeklyTarget,
      events: events || [],
    })
  } catch (error) {
    console.error('Current week targets error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
