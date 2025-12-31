import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { DeloadTrigger, DeloadResponse, RespondToDeloadRequest, DELOAD_THRESHOLDS } from '@/types/galpin'
import { evaluateDeloadNeed } from '@/lib/galpin-calculations'

// GET /api/deload - Evaluate deload need and get pending triggers
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const evaluate = searchParams.get('evaluate') !== 'false'

    // Fetch pending triggers
    const { data: pendingTriggers, error: triggerError } = await supabase
      .from('deload_triggers')
      .select('*')
      .eq('user_id', user.id)
      .eq('user_response', 'pending')
      .order('triggered_at', { ascending: false }) as { data: DeloadTrigger[] | null; error: any }

    if (triggerError) {
      console.error('Error fetching deload triggers:', triggerError)
      return NextResponse.json({ error: 'Failed to fetch triggers' }, { status: 500 })
    }

    // Fetch recent triggers (for history)
    const { data: recentTriggers } = await supabase
      .from('deload_triggers')
      .select('*')
      .eq('user_id', user.id)
      .order('triggered_at', { ascending: false })
      .limit(10) as { data: DeloadTrigger[] | null; error: any }

    let recommendation = null

    if (evaluate) {
      // Fetch current TSB
      let tsb: number | null = null
      try {
        const { data: loadData } = await (supabase as any)
          .from('training_load_history')
          .select('tsb')
          .eq('user_id', user.id)
          .order('calculation_date', { ascending: false })
          .limit(1)
          .single()

        if (loadData) {
          tsb = loadData.tsb
        }
      } catch {
        // Table might not exist
      }

      // Fetch muscles over MRV
      let musclesOverMRV: string[] = []
      try {
        const { data: volumeData } = await (supabase as any)
          .from('weekly_volume_stats')
          .select('muscle_group, volume_status')
          .eq('user_id', user.id)
          .eq('volume_status', 'over_mrv')

        if (volumeData) {
          musclesOverMRV = volumeData.map((v: any) => v.muscle_group)
        }
      } catch {
        // Table might not exist
      }

      // Fetch plateaued exercises
      let plateauedExercises: { exerciseId: string; weeksWithoutProgress: number }[] = []
      try {
        const { data: plateauData } = await (supabase as any)
          .from('progression_history')
          .select('exercise_id, weeks_without_progress')
          .eq('user_id', user.id)
          .eq('plateau_detected', true)

        if (plateauData) {
          plateauedExercises = plateauData.map((p: any) => ({
            exerciseId: p.exercise_id,
            weeksWithoutProgress: p.weeks_without_progress,
          }))
        }
      } catch {
        // Table might not exist
      }

      // Fetch recent recovery scores
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0]

      const { data: recoveryData } = await supabase
        .from('readiness_assessments')
        .select('calculated_readiness_score')
        .eq('user_id', user.id)
        .gte('assessment_date', sevenDaysAgoStr) as { data: any[] | null; error: any }

      const recentRecoveryScores = (recoveryData || [])
        .map(r => r.calculated_readiness_score)
        .filter((s): s is number => s !== null)

      // Calculate days since last deload
      const lastDeload = recentTriggers?.find(t => t.user_response === 'accepted')
      const daysSinceLastDeload = lastDeload
        ? Math.floor((Date.now() - new Date(lastDeload.triggered_at).getTime()) / (1000 * 60 * 60 * 24))
        : null

      // Evaluate deload need
      recommendation = evaluateDeloadNeed(
        tsb,
        musclesOverMRV,
        plateauedExercises,
        recentRecoveryScores,
        daysSinceLastDeload
      )

      // If deload is recommended and no pending trigger exists, create one
      if (recommendation.shouldDeload && (!pendingTriggers || pendingTriggers.length === 0)) {
        const triggerType = recommendation.triggers[0]?.type || 'manual'
        const triggerData = recommendation.triggers[0]?.data || {}

        const { data: newTrigger, error: insertError } = await (supabase as any)
          .from('deload_triggers')
          .insert({
            user_id: user.id,
            trigger_type: triggerType,
            trigger_data: triggerData,
            severity: recommendation.severity,
            recommended_deload_type: recommendation.deloadType,
            recommended_duration_days: recommendation.durationDays,
            user_response: 'pending',
          })
          .select()
          .single()

        if (!insertError && newTrigger) {
          return NextResponse.json({
            pendingTriggers: [newTrigger],
            recentTriggers: recentTriggers || [],
            recommendation,
          })
        }
      }
    }

    return NextResponse.json({
      pendingTriggers: pendingTriggers || [],
      recentTriggers: recentTriggers || [],
      recommendation,
    })
  } catch (error) {
    console.error('Error in deload GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/deload - Respond to a deload trigger
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: RespondToDeloadRequest = await request.json()
    const { trigger_id, response, notes } = body

    if (!trigger_id) {
      return NextResponse.json({ error: 'trigger_id is required' }, { status: 400 })
    }

    const validResponses: DeloadResponse[] = ['accepted', 'modified', 'dismissed']
    if (!response || !validResponses.includes(response)) {
      return NextResponse.json({
        error: 'response is required and must be one of: ' + validResponses.join(', ')
      }, { status: 400 })
    }

    const { data: trigger, error: updateError } = await (supabase as any)
      .from('deload_triggers')
      .update({
        user_response: response,
        response_notes: notes || null,
        responded_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .eq('id', trigger_id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating deload trigger:', updateError)
      return NextResponse.json({ error: 'Failed to update trigger' }, { status: 500 })
    }

    return NextResponse.json({ trigger })
  } catch (error) {
    console.error('Error in deload POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/deload - Create a manual deload trigger
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { severity = 'moderate', deload_type = 'volume', duration_days = 7, notes } = body

    const { data: trigger, error: insertError } = await (supabase as any)
      .from('deload_triggers')
      .insert({
        user_id: user.id,
        trigger_type: 'manual',
        trigger_data: { reason: notes || 'User-initiated deload' },
        severity,
        recommended_deload_type: deload_type,
        recommended_duration_days: duration_days,
        user_response: 'accepted', // Manual deloads are auto-accepted
        responded_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error creating manual deload:', insertError)
      return NextResponse.json({ error: 'Failed to create deload' }, { status: 500 })
    }

    return NextResponse.json({ trigger })
  } catch (error) {
    console.error('Error in deload PUT:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
