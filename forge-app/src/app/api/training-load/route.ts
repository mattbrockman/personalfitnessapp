import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  calculateCTL,
  calculateATL,
  calculateTSB,
  calculateMonotony,
  calculateStrain,
  calculateACWR,
  getTSBRange,
} from '@/lib/training-load'

// GET /api/training-load - Fetch training load history with CTL/ATL/TSB
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const days = parseInt(searchParams.get('days') || '90')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    // Calculate date range
    const end = endDate ? new Date(endDate) : new Date()
    const start = startDate
      ? new Date(startDate)
      : new Date(end.getTime() - days * 24 * 60 * 60 * 1000)

    // Fetch training load history
    const { data: loadHistory, error: loadError } = await (supabase
      .from('training_load_history')
      .select('*')
      .eq('user_id', user.id)
      .gte('log_date', start.toISOString().split('T')[0])
      .lte('log_date', end.toISOString().split('T')[0])
      .order('log_date', { ascending: false }) as any)

    if (loadError) {
      console.error('Error fetching training load:', loadError)
      return NextResponse.json({ error: 'Failed to fetch training load' }, { status: 500 })
    }

    // Get current CTL/ATL/TSB
    const tssHistory = (loadHistory || []).map((h: any) => ({
      date: h.log_date,
      tss: Number(h.total_tss) || 0,
    }))

    const currentCTL = calculateCTL(tssHistory)
    const currentATL = calculateATL(tssHistory)
    const currentTSB = calculateTSB(currentCTL, currentATL)
    const tsbRange = getTSBRange(currentTSB)

    // Calculate weekly strain
    const last7Days = (loadHistory || []).slice(0, 7).map((h: any) => Number(h.training_load) || 0)
    const monotony = calculateMonotony(last7Days)
    const weeklyLoad = last7Days.reduce((a: number, b: number) => a + b, 0)
    const strain = calculateStrain(weeklyLoad, monotony)
    const acwr = calculateACWR(currentATL, currentCTL)

    return NextResponse.json({
      history: loadHistory || [],
      summary: {
        currentCTL,
        currentATL,
        currentTSB,
        tsbRange,
        monotony,
        strain,
        acwr,
        weeklyLoad,
        weeklyTSS: tssHistory.slice(0, 7).reduce((sum: number, h: { date: string; tss: number }) => sum + h.tss, 0),
      },
    })
  } catch (error) {
    console.error('Error in training-load GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/training-load - Update or create training load for a date
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      log_date,
      total_tss,
      total_duration_minutes,
      session_rpe_avg,
      training_load,
      zone_1_seconds,
      zone_2_seconds,
      zone_3_seconds,
      zone_4_seconds,
      zone_5_seconds,
    } = body

    if (!log_date) {
      return NextResponse.json({ error: 'log_date is required' }, { status: 400 })
    }

    // Fetch all history for CTL/ATL calculation
    const { data: allHistory } = await (supabase
      .from('training_load_history')
      .select('log_date, total_tss, training_load')
      .eq('user_id', user.id)
      .order('log_date', { ascending: false })
      .limit(100) as any)

    // Add today's values to history for calculation
    const tssHistory = [
      { date: log_date, tss: total_tss || 0 },
      ...(allHistory || []).filter((h: any) => h.log_date !== log_date).map((h: any) => ({
        date: h.log_date,
        tss: Number(h.total_tss) || 0,
      })),
    ]

    const ctl = calculateCTL(tssHistory)
    const atl = calculateATL(tssHistory)
    const tsb = calculateTSB(ctl, atl)

    // Calculate monotony from last 7 days including today
    const loadHistory = [
      { date: log_date, load: training_load || 0 },
      ...(allHistory || []).filter((h: any) => h.log_date !== log_date).map((h: any) => ({
        date: h.log_date,
        load: Number(h.training_load) || 0,
      })),
    ].slice(0, 7)

    const dailyLoads = loadHistory.map((h: { date: string; load: number }) => h.load)
    const monotony = calculateMonotony(dailyLoads)
    const weeklyLoad = dailyLoads.reduce((a: number, b: number) => a + b, 0)
    const strain = calculateStrain(weeklyLoad, monotony)

    // Upsert training load record
    const { data: record, error: upsertError } = await ((supabase as any)
      .from('training_load_history')
      .upsert({
        user_id: user.id,
        log_date,
        total_tss: total_tss || 0,
        total_duration_minutes: total_duration_minutes || 0,
        session_rpe_avg,
        training_load,
        zone_1_seconds: zone_1_seconds || 0,
        zone_2_seconds: zone_2_seconds || 0,
        zone_3_seconds: zone_3_seconds || 0,
        zone_4_seconds: zone_4_seconds || 0,
        zone_5_seconds: zone_5_seconds || 0,
        ctl,
        atl,
        tsb,
        monotony,
        strain,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,log_date' })
      .select()
      .single())

    if (upsertError) {
      console.error('Error upserting training load:', upsertError)
      return NextResponse.json({ error: 'Failed to update training load' }, { status: 500 })
    }

    return NextResponse.json({ record, ctl, atl, tsb })
  } catch (error) {
    console.error('Error in training-load POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
