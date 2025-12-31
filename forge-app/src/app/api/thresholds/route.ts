import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/thresholds - Fetch threshold history
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '20')
    const type = searchParams.get('type') // 'ftp', 'lthr', 'pace'

    // Build query
    let query = (supabase as any)
      .from('threshold_history')
      .select('*')
      .eq('user_id', user.id)
      .order('test_date', { ascending: false })
      .limit(limit)

    // Filter by type if specified
    if (type === 'ftp') {
      query = query.not('ftp_watts', 'is', null)
    } else if (type === 'lthr') {
      query = query.not('lthr_bpm', 'is', null)
    } else if (type === 'pace') {
      query = query.not('threshold_pace_min_mile', 'is', null)
    }

    const { data: thresholds, error: thresholdError } = await query

    if (thresholdError) {
      console.error('Error fetching thresholds:', thresholdError)
      return NextResponse.json({ error: 'Failed to fetch thresholds' }, { status: 500 })
    }

    // Get current values from profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('ftp_watts, lthr_bpm, threshold_pace_min_mile, resting_hr, max_hr')
      .eq('id', user.id)
      .single()

    // Calculate trends
    const ftpTests = (thresholds || []).filter((t: any) => t.ftp_watts)
    const lthrTests = (thresholds || []).filter((t: any) => t.lthr_bpm)

    let ftpTrend: 'improving' | 'declining' | 'stable' | null = null
    if (ftpTests.length >= 2) {
      const recent = ftpTests[0].ftp_watts
      const older = ftpTests[1].ftp_watts
      if (recent > older * 1.02) ftpTrend = 'improving'
      else if (recent < older * 0.98) ftpTrend = 'declining'
      else ftpTrend = 'stable'
    }

    let lthrTrend: 'improving' | 'declining' | 'stable' | null = null
    if (lthrTests.length >= 2) {
      const recent = lthrTests[0].lthr_bpm
      const older = lthrTests[1].lthr_bpm
      // For LTHR, lower at same power = improving (usually)
      if (recent < older * 0.98) lthrTrend = 'improving'
      else if (recent > older * 1.02) lthrTrend = 'declining'
      else lthrTrend = 'stable'
    }

    return NextResponse.json({
      thresholds: thresholds || [],
      current: {
        ftp_watts: (profile as any)?.ftp_watts || null,
        lthr_bpm: (profile as any)?.lthr_bpm || null,
        threshold_pace_min_mile: (profile as any)?.threshold_pace_min_mile || null,
        resting_hr: (profile as any)?.resting_hr || null,
        max_hr: (profile as any)?.max_hr || null,
        last_ftp_test: ftpTests[0]?.test_date || null,
        last_lthr_test: lthrTests[0]?.test_date || null,
        ftp_trend: ftpTrend,
        lthr_trend: lthrTrend,
      },
    })
  } catch (error) {
    console.error('Error in thresholds GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/thresholds - Add new threshold test result
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      test_date,
      ftp_watts,
      lthr_bpm,
      threshold_pace_min_mile,
      threshold_pace_min_km,
      test_type,
      source = 'manual',
      activity_id,
      confidence_level = 'medium',
      protocol_followed = true,
      conditions,
      notes,
    } = body

    if (!test_date) {
      return NextResponse.json({ error: 'test_date is required' }, { status: 400 })
    }

    // At least one threshold value required
    if (!ftp_watts && !lthr_bpm && !threshold_pace_min_mile) {
      return NextResponse.json({ error: 'At least one threshold value required' }, { status: 400 })
    }

    // Insert threshold test
    const { data: threshold, error: insertError } = await ((supabase as any)
      .from('threshold_history')
      .insert({
        user_id: user.id,
        test_date,
        ftp_watts,
        lthr_bpm,
        threshold_pace_min_mile,
        threshold_pace_min_km,
        test_type,
        source,
        activity_id,
        confidence_level,
        protocol_followed,
        conditions,
        notes,
      })
      .select()
      .single())

    if (insertError) {
      console.error('Error inserting threshold:', insertError)
      return NextResponse.json({ error: 'Failed to add threshold' }, { status: 500 })
    }

    // Update profile with latest values if this is the most recent test
    const updates: Record<string, any> = {}
    if (ftp_watts) updates.ftp_watts = ftp_watts
    if (lthr_bpm) updates.lthr_bpm = lthr_bpm
    if (threshold_pace_min_mile) updates.threshold_pace_min_mile = threshold_pace_min_mile

    if (Object.keys(updates).length > 0) {
      await (supabase as any)
        .from('profiles')
        .update(updates)
        .eq('id', user.id)
    }

    return NextResponse.json({ threshold })
  } catch (error) {
    console.error('Error in thresholds POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
