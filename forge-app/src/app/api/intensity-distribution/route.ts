import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  analyzePolarizedDistribution,
  zoneSecondsToHours,
} from '@/lib/training-load'
import { ZoneDistribution, WeeklyIntensityDistribution } from '@/types/endurance'

// GET /api/intensity-distribution - Fetch zone distribution analysis
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const weeks = parseInt(searchParams.get('weeks') || '4')
    const groupBy = searchParams.get('group_by') || 'week' // 'week' or 'total'

    // Get user's polarized targets
    const { data: profile } = await supabase
      .from('profiles')
      .select('target_low_intensity_pct, target_high_intensity_pct, polarized_training_enabled')
      .eq('id', user.id)
      .single()

    const targetLowPct = (profile as any)?.target_low_intensity_pct || 80
    const targetHighPct = (profile as any)?.target_high_intensity_pct || 20

    // Calculate date range
    const endDate = new Date()
    const startDate = new Date(endDate.getTime() - weeks * 7 * 24 * 60 * 60 * 1000)

    // Fetch training load history with zone data
    const { data: loadHistory, error: loadError } = await (supabase
      .from('training_load_history')
      .select('*')
      .eq('user_id', user.id)
      .gte('log_date', startDate.toISOString().split('T')[0])
      .lte('log_date', endDate.toISOString().split('T')[0])
      .order('log_date', { ascending: true }) as any)

    if (loadError) {
      console.error('Error fetching training load:', loadError)
      return NextResponse.json({ error: 'Failed to fetch training data' }, { status: 500 })
    }

    if (groupBy === 'total') {
      // Aggregate all data into one distribution
      const totalDistribution: ZoneDistribution = {
        zone1Seconds: 0,
        zone2Seconds: 0,
        zone3Seconds: 0,
        zone4Seconds: 0,
        zone5Seconds: 0,
        totalSeconds: 0,
      }

      let totalTSS = 0
      let totalMinutes = 0
      let workoutDays = 0

      for (const day of (loadHistory || [])) {
        totalDistribution.zone1Seconds += day.zone_1_seconds || 0
        totalDistribution.zone2Seconds += day.zone_2_seconds || 0
        totalDistribution.zone3Seconds += day.zone_3_seconds || 0
        totalDistribution.zone4Seconds += day.zone_4_seconds || 0
        totalDistribution.zone5Seconds += day.zone_5_seconds || 0
        totalTSS += Number(day.total_tss) || 0
        totalMinutes += day.total_duration_minutes || 0
        if (day.total_duration_minutes > 0) workoutDays++
      }

      totalDistribution.totalSeconds =
        totalDistribution.zone1Seconds +
        totalDistribution.zone2Seconds +
        totalDistribution.zone3Seconds +
        totalDistribution.zone4Seconds +
        totalDistribution.zone5Seconds

      const analysis = analyzePolarizedDistribution(totalDistribution, targetLowPct, targetHighPct)

      return NextResponse.json({
        period: {
          start: startDate.toISOString().split('T')[0],
          end: endDate.toISOString().split('T')[0],
          weeks,
        },
        distribution: totalDistribution,
        analysis,
        summary: {
          totalTSS,
          totalHours: Math.round((totalMinutes / 60) * 10) / 10,
          workoutDays,
          avgWeeklyHours: Math.round((totalMinutes / 60 / weeks) * 10) / 10,
          avgWeeklyTSS: Math.round(totalTSS / weeks),
          hoursPerZone: {
            zone1: zoneSecondsToHours(totalDistribution.zone1Seconds),
            zone2: zoneSecondsToHours(totalDistribution.zone2Seconds),
            zone3: zoneSecondsToHours(totalDistribution.zone3Seconds),
            zone4: zoneSecondsToHours(totalDistribution.zone4Seconds),
            zone5: zoneSecondsToHours(totalDistribution.zone5Seconds),
          },
        },
      })
    }

    // Group by week
    const weeklyDistributions: WeeklyIntensityDistribution[] = []
    const daysByWeek: Map<string, any[]> = new Map()

    // Group days into weeks (Monday start)
    for (const day of (loadHistory || [])) {
      const date = new Date(day.log_date)
      const weekStart = getWeekStart(date)
      const weekKey = weekStart.toISOString().split('T')[0]

      if (!daysByWeek.has(weekKey)) {
        daysByWeek.set(weekKey, [])
      }
      daysByWeek.get(weekKey)!.push(day)
    }

    // Calculate distribution for each week
    for (const [weekStartStr, days] of Array.from(daysByWeek.entries())) {
      const weekStart = new Date(weekStartStr)
      const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000)

      const distribution: ZoneDistribution = {
        zone1Seconds: 0,
        zone2Seconds: 0,
        zone3Seconds: 0,
        zone4Seconds: 0,
        zone5Seconds: 0,
        totalSeconds: 0,
      }

      let totalTSS = 0
      let totalMinutes = 0

      for (const day of days) {
        distribution.zone1Seconds += day.zone_1_seconds || 0
        distribution.zone2Seconds += day.zone_2_seconds || 0
        distribution.zone3Seconds += day.zone_3_seconds || 0
        distribution.zone4Seconds += day.zone_4_seconds || 0
        distribution.zone5Seconds += day.zone_5_seconds || 0
        totalTSS += Number(day.total_tss) || 0
        totalMinutes += day.total_duration_minutes || 0
      }

      distribution.totalSeconds =
        distribution.zone1Seconds +
        distribution.zone2Seconds +
        distribution.zone3Seconds +
        distribution.zone4Seconds +
        distribution.zone5Seconds

      const analysis = analyzePolarizedDistribution(distribution, targetLowPct, targetHighPct)

      weeklyDistributions.push({
        weekStart: weekStartStr,
        weekEnd: weekEnd.toISOString().split('T')[0],
        distribution,
        analysis,
        totalTSS,
        totalHours: Math.round((totalMinutes / 60) * 10) / 10,
        workoutCount: days.filter(d => d.total_duration_minutes > 0).length,
      })
    }

    // Sort by week start descending
    weeklyDistributions.sort((a, b) => b.weekStart.localeCompare(a.weekStart))

    // Calculate overall summary
    const overallDistribution: ZoneDistribution = {
      zone1Seconds: 0,
      zone2Seconds: 0,
      zone3Seconds: 0,
      zone4Seconds: 0,
      zone5Seconds: 0,
      totalSeconds: 0,
    }

    for (const week of weeklyDistributions) {
      overallDistribution.zone1Seconds += week.distribution.zone1Seconds
      overallDistribution.zone2Seconds += week.distribution.zone2Seconds
      overallDistribution.zone3Seconds += week.distribution.zone3Seconds
      overallDistribution.zone4Seconds += week.distribution.zone4Seconds
      overallDistribution.zone5Seconds += week.distribution.zone5Seconds
    }

    overallDistribution.totalSeconds =
      overallDistribution.zone1Seconds +
      overallDistribution.zone2Seconds +
      overallDistribution.zone3Seconds +
      overallDistribution.zone4Seconds +
      overallDistribution.zone5Seconds

    const overallAnalysis = analyzePolarizedDistribution(overallDistribution, targetLowPct, targetHighPct)

    return NextResponse.json({
      period: {
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0],
        weeks,
      },
      weeklyDistributions,
      overallDistribution,
      overallAnalysis,
      targets: {
        lowIntensityPct: targetLowPct,
        highIntensityPct: targetHighPct,
        maxMidIntensityPct: 100 - targetLowPct - targetHighPct,
      },
    })
  } catch (error) {
    console.error('Error in intensity-distribution GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Helper: Get Monday of the week for a given date
function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Adjust when day is Sunday
  return new Date(d.setDate(diff))
}
