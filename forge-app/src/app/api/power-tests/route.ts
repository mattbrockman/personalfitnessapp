import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { PowerTest, LogPowerTestRequest } from '@/types/galpin'

// GET /api/power-tests - Get power test history
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '20')

    const { data: tests, error } = await supabase
      .from('power_tests')
      .select('*')
      .eq('user_id', user.id)
      .order('test_date', { ascending: false })
      .limit(limit) as { data: PowerTest[] | null; error: any }

    if (error) {
      console.error('Error fetching power tests:', error)
      return NextResponse.json({ error: 'Failed to fetch tests' }, { status: 500 })
    }

    // Calculate PRs
    const testsArr = tests || []
    const verticalPR = Math.max(0, ...testsArr.map(t => t.vertical_jump_inches || 0))
    const broadPR = Math.max(0, ...testsArr.map(t => t.broad_jump_inches || 0))
    const sprint40PR = testsArr
      .filter(t => t.sprint_40m_seconds)
      .reduce((min, t) => Math.min(min, t.sprint_40m_seconds || Infinity), Infinity)

    // Determine trend
    let trend: 'improving' | 'stable' | 'declining' | 'insufficient_data' = 'insufficient_data'
    if (testsArr.length >= 3) {
      const recentTests = testsArr.slice(0, 3)
      const olderTests = testsArr.slice(3, 6)

      if (olderTests.length > 0) {
        const recentAvgJump = recentTests.filter(t => t.vertical_jump_inches).reduce((sum, t) => sum + (t.vertical_jump_inches || 0), 0) / Math.max(1, recentTests.filter(t => t.vertical_jump_inches).length)
        const olderAvgJump = olderTests.filter(t => t.vertical_jump_inches).reduce((sum, t) => sum + (t.vertical_jump_inches || 0), 0) / Math.max(1, olderTests.filter(t => t.vertical_jump_inches).length)

        if (recentAvgJump > 0 && olderAvgJump > 0) {
          const change = ((recentAvgJump - olderAvgJump) / olderAvgJump) * 100
          if (change > 5) trend = 'improving'
          else if (change < -5) trend = 'declining'
          else trend = 'stable'
        }
      }
    }

    return NextResponse.json({
      tests: testsArr,
      prs: {
        vertical_jump_inches: verticalPR > 0 ? verticalPR : null,
        broad_jump_inches: broadPR > 0 ? broadPR : null,
        sprint_40m_seconds: sprint40PR < Infinity ? sprint40PR : null,
      },
      trend,
    })
  } catch (error) {
    console.error('Error in power-tests GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/power-tests - Log a power test
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: LogPowerTestRequest = await request.json()
    const {
      test_date = new Date().toISOString().split('T')[0],
      vertical_jump_inches,
      broad_jump_inches,
      reactive_strength_index,
      sprint_10m_seconds,
      sprint_20m_seconds,
      sprint_40m_seconds,
      squat_mean_velocity_mps,
      bench_mean_velocity_mps,
      test_conditions,
      equipment_used,
      notes,
    } = body

    // Require at least one test metric
    if (!vertical_jump_inches && !broad_jump_inches && !sprint_10m_seconds &&
        !sprint_20m_seconds && !sprint_40m_seconds && !squat_mean_velocity_mps &&
        !bench_mean_velocity_mps && !reactive_strength_index) {
      return NextResponse.json({
        error: 'At least one test metric is required'
      }, { status: 400 })
    }

    const { data: test, error: insertError } = await (supabase as any)
      .from('power_tests')
      .insert({
        user_id: user.id,
        test_date,
        vertical_jump_inches: vertical_jump_inches || null,
        broad_jump_inches: broad_jump_inches || null,
        reactive_strength_index: reactive_strength_index || null,
        sprint_10m_seconds: sprint_10m_seconds || null,
        sprint_20m_seconds: sprint_20m_seconds || null,
        sprint_40m_seconds: sprint_40m_seconds || null,
        squat_mean_velocity_mps: squat_mean_velocity_mps || null,
        bench_mean_velocity_mps: bench_mean_velocity_mps || null,
        test_conditions: test_conditions || null,
        equipment_used: equipment_used || null,
        notes: notes || null,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error inserting power test:', insertError)
      return NextResponse.json({ error: 'Failed to save test' }, { status: 500 })
    }

    return NextResponse.json({ test })
  } catch (error) {
    console.error('Error in power-tests POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/power-tests?id=xxx - Delete a power test
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const testId = searchParams.get('id')

    if (!testId) {
      return NextResponse.json({ error: 'id required' }, { status: 400 })
    }

    const { error: deleteError } = await supabase
      .from('power_tests')
      .delete()
      .eq('user_id', user.id)
      .eq('id', testId)

    if (deleteError) {
      console.error('Error deleting power test:', deleteError)
      return NextResponse.json({ error: 'Failed to delete test' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in power-tests DELETE:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
