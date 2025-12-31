import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ReadinessAssessment, LogReadinessRequest, ReadinessBaselines } from '@/types/galpin'
import { calculateReadinessScore } from '@/lib/galpin-calculations'

// GET /api/readiness - Get readiness assessments
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const date = searchParams.get('date')
    const limit = parseInt(searchParams.get('limit') || '7')

    let query = supabase
      .from('readiness_assessments')
      .select('*')
      .eq('user_id', user.id)
      .order('assessment_date', { ascending: false })
      .limit(limit)

    if (date) {
      query = query.eq('assessment_date', date)
    }

    const { data: assessments, error } = await query as { data: ReadinessAssessment[] | null; error: any }

    if (error) {
      console.error('Error fetching readiness:', error)
      return NextResponse.json({ error: 'Failed to fetch assessments' }, { status: 500 })
    }

    // Also fetch baselines
    const { data: baselines } = await supabase
      .from('readiness_baselines')
      .select('*')
      .eq('user_id', user.id)
      .single() as { data: ReadinessBaselines | null; error: any }

    return NextResponse.json({
      assessments: assessments || [],
      baselines: baselines || null
    })
  } catch (error) {
    console.error('Error in readiness GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/readiness - Log a readiness assessment
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: LogReadinessRequest = await request.json()
    const {
      assessment_date = new Date().toISOString().split('T')[0],
      subjective_readiness,
      grip_strength_lbs,
      vertical_jump_inches,
      hrv_reading,
      resting_hr,
      sleep_quality,
      sleep_hours,
      notes
    } = body

    // Validate subjective readiness
    if (subjective_readiness === undefined || subjective_readiness < 1 || subjective_readiness > 10) {
      return NextResponse.json({
        error: 'subjective_readiness is required and must be between 1 and 10'
      }, { status: 400 })
    }

    // Fetch baselines for score calculation
    const { data: baselines } = await supabase
      .from('readiness_baselines')
      .select('*')
      .eq('user_id', user.id)
      .single() as { data: ReadinessBaselines | null; error: any }

    // Try to get TSB from training load if available
    let tsb_value: number | null = null
    let atl_value: number | null = null
    let ctl_value: number | null = null

    try {
      const { data: loadData } = await (supabase as any)
        .from('training_load_history')
        .select('tsb, atl, ctl')
        .eq('user_id', user.id)
        .order('calculation_date', { ascending: false })
        .limit(1)
        .single()

      if (loadData) {
        tsb_value = loadData.tsb
        atl_value = loadData.atl
        ctl_value = loadData.ctl
      }
    } catch {
      // Training load table might not exist, that's OK
    }

    // Calculate readiness score
    const assessmentData: Partial<ReadinessAssessment> = {
      subjective_readiness,
      grip_strength_lbs,
      vertical_jump_inches,
      hrv_reading,
      resting_hr,
      sleep_quality,
      sleep_hours,
      tsb_value,
      atl_value,
      ctl_value,
    }

    const result = calculateReadinessScore(assessmentData, baselines)

    // Upsert the assessment
    const { data: assessment, error: upsertError } = await (supabase as any)
      .from('readiness_assessments')
      .upsert({
        user_id: user.id,
        assessment_date,
        subjective_readiness,
        grip_strength_lbs: grip_strength_lbs || null,
        vertical_jump_inches: vertical_jump_inches || null,
        hrv_reading: hrv_reading || null,
        resting_hr: resting_hr || null,
        sleep_quality: sleep_quality || null,
        sleep_hours: sleep_hours || null,
        tsb_value,
        atl_value,
        ctl_value,
        calculated_readiness_score: result.score,
        recommended_intensity: result.recommendation,
        adjustment_factor: result.adjustmentFactor,
        notes: notes || null,
      }, { onConflict: 'user_id,assessment_date' })
      .select()
      .single()

    if (upsertError) {
      console.error('Error upserting readiness:', upsertError)
      return NextResponse.json({ error: 'Failed to save assessment' }, { status: 500 })
    }

    // Update baselines with new data points
    await updateBaselines(supabase, user.id, {
      grip_strength_lbs,
      vertical_jump_inches,
      hrv_reading,
      sleep_hours,
      resting_hr,
    })

    return NextResponse.json({
      assessment,
      result,
      baselines,
    })
  } catch (error) {
    console.error('Error in readiness POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Helper function to update rolling baselines
async function updateBaselines(
  supabase: any,
  userId: string,
  newData: {
    grip_strength_lbs?: number | null
    vertical_jump_inches?: number | null
    hrv_reading?: number | null
    sleep_hours?: number | null
    resting_hr?: number | null
  }
) {
  // Fetch recent readings for averaging (last 30 days)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0]

  const { data: recentReadings } = await supabase
    .from('readiness_assessments')
    .select('grip_strength_lbs, vertical_jump_inches, hrv_reading, sleep_hours, resting_hr')
    .eq('user_id', userId)
    .gte('assessment_date', thirtyDaysAgoStr)

  if (!recentReadings || recentReadings.length === 0) return

  // Calculate averages and standard deviations
  const calcStats = (values: number[]) => {
    if (values.length === 0) return { avg: null, std: null, count: 0 }
    const avg = values.reduce((a, b) => a + b, 0) / values.length
    if (values.length < 2) return { avg, std: null, count: values.length }
    const variance = values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / (values.length - 1)
    return { avg, std: Math.sqrt(variance), count: values.length }
  }

  const gripValues = recentReadings.filter((r: any) => r.grip_strength_lbs).map((r: any) => r.grip_strength_lbs)
  const jumpValues = recentReadings.filter((r: any) => r.vertical_jump_inches).map((r: any) => r.vertical_jump_inches)
  const hrvValues = recentReadings.filter((r: any) => r.hrv_reading).map((r: any) => r.hrv_reading)
  const sleepValues = recentReadings.filter((r: any) => r.sleep_hours).map((r: any) => r.sleep_hours)
  const rhrValues = recentReadings.filter((r: any) => r.resting_hr).map((r: any) => r.resting_hr)

  const gripStats = calcStats(gripValues)
  const jumpStats = calcStats(jumpValues)
  const hrvStats = calcStats(hrvValues)
  const sleepStats = calcStats(sleepValues)
  const rhrStats = calcStats(rhrValues)

  await supabase
    .from('readiness_baselines')
    .upsert({
      user_id: userId,
      avg_grip_strength_lbs: gripStats.avg,
      avg_vertical_jump_inches: jumpStats.avg,
      avg_hrv: hrvStats.avg,
      avg_resting_hr: rhrStats.avg,
      avg_sleep_hours: sleepStats.avg,
      std_hrv: hrvStats.std,
      std_grip_strength: gripStats.std,
      std_vertical_jump: jumpStats.std,
      grip_sample_count: gripStats.count,
      jump_sample_count: jumpStats.count,
      hrv_sample_count: hrvStats.count,
      last_updated: new Date().toISOString(),
    }, { onConflict: 'user_id' })
}
