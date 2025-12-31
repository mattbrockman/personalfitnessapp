import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  StrengthStandard,
  StandardizedLift,
  Sex,
  StrengthProfile,
  UserStrengthPercentile,
  StrengthClassification,
  GetStrengthProfileRequest
} from '@/types/galpin'
import {
  getWeightClass,
  calculateUserStrengthPercentile,
  calculateWilksScore,
  calculateDOTSScore,
} from '@/lib/galpin-calculations'

// POST /api/strength-standards/profile - Get user's strength profile with percentiles
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: GetStrengthProfileRequest = await request.json()
    const { body_weight_lbs, sex, lifts } = body

    if (!body_weight_lbs || body_weight_lbs <= 0) {
      return NextResponse.json({ error: 'body_weight_lbs is required and must be positive' }, { status: 400 })
    }

    if (!sex || !['male', 'female'].includes(sex)) {
      return NextResponse.json({ error: 'sex is required and must be male or female' }, { status: 400 })
    }

    if (!lifts || lifts.length === 0) {
      return NextResponse.json({ error: 'lifts array is required with at least one lift' }, { status: 400 })
    }

    const weightClass = getWeightClass(body_weight_lbs, sex)

    // Fetch standards for all requested lifts
    const exerciseNames = lifts.map(l => l.exercise_name)
    const { data: standards, error: standardsError } = await supabase
      .from('strength_standards')
      .select('*')
      .eq('sex', sex)
      .eq('body_weight_class', weightClass)
      .in('exercise_name', exerciseNames) as { data: StrengthStandard[] | null; error: any }

    if (standardsError) {
      console.error('Error fetching standards:', standardsError)
      return NextResponse.json({ error: 'Failed to fetch standards' }, { status: 500 })
    }

    const standardsMap = new Map<string, StrengthStandard>()
    for (const s of standards || []) {
      standardsMap.set(s.exercise_name, s)
    }

    // Calculate percentiles for each lift
    const userPercentiles: UserStrengthPercentile[] = []

    for (const lift of lifts) {
      const standard = standardsMap.get(lift.exercise_name)
      if (!standard) {
        // No standards available for this lift
        continue
      }

      const percentile = calculateUserStrengthPercentile(
        lift.exercise_name,
        lift.current_1rm_lbs,
        body_weight_lbs,
        sex,
        standard
      )
      userPercentiles.push(percentile)
    }

    // Calculate powerlifting totals if big 3 are present
    const squat = lifts.find(l => l.exercise_name === 'squat')?.current_1rm_lbs
    const bench = lifts.find(l => l.exercise_name === 'bench_press')?.current_1rm_lbs
    const deadlift = lifts.find(l => l.exercise_name === 'deadlift')?.current_1rm_lbs

    let wilksScore: number | null = null
    let dotsScore: number | null = null

    if (squat && bench && deadlift) {
      const total = squat + bench + deadlift
      wilksScore = calculateWilksScore(total, body_weight_lbs, sex)
      dotsScore = calculateDOTSScore(total, body_weight_lbs, sex)
    }

    // Determine overall classification (most common classification among lifts)
    const classificationCounts = new Map<StrengthClassification, number>()
    for (const p of userPercentiles) {
      const count = classificationCounts.get(p.classification) || 0
      classificationCounts.set(p.classification, count + 1)
    }

    let overallClassification: StrengthClassification = 'untrained'
    let maxCount = 0
    for (const [cls, count] of Array.from(classificationCounts.entries())) {
      if (count > maxCount) {
        maxCount = count
        overallClassification = cls
      }
    }

    // Find strongest and weakest lifts
    let strongestLift: StandardizedLift | null = null
    let weakestLift: StandardizedLift | null = null
    let maxPercentile = 0
    let minPercentile = 100

    for (const p of userPercentiles) {
      if (p.percentile > maxPercentile) {
        maxPercentile = p.percentile
        strongestLift = p.exercise_name
      }
      if (p.percentile < minPercentile) {
        minPercentile = p.percentile
        weakestLift = p.exercise_name
      }
    }

    const profile: StrengthProfile = {
      lifts: userPercentiles,
      wilksScore,
      dotsScore,
      overallClassification,
      strongestLift,
      weakestLift,
    }

    return NextResponse.json({ profile })
  } catch (error) {
    console.error('Error in strength-standards profile POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET /api/strength-standards/profile - Get profile using stored estimates
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch user's profile for body weight and sex
    const { data: profile } = await supabase
      .from('profiles')
      .select('biological_sex')
      .eq('id', user.id)
      .single() as { data: { biological_sex: string | null } | null; error: any }

    // Fetch latest body weight
    const { data: weightLog } = await supabase
      .from('weight_logs')
      .select('weight_lbs')
      .eq('user_id', user.id)
      .order('log_date', { ascending: false })
      .limit(1)
      .single() as { data: { weight_lbs: number | null } | null; error: any }

    const sex = profile?.biological_sex as Sex | null
    const bodyWeight = weightLog?.weight_lbs as number | null

    if (!sex) {
      return NextResponse.json({
        error: 'biological_sex not set in profile. Set it first or use POST with explicit values.'
      }, { status: 400 })
    }

    if (!bodyWeight) {
      return NextResponse.json({
        error: 'No body weight logged. Log a weight or use POST with explicit values.'
      }, { status: 400 })
    }

    // Fetch user's 1RM estimates for big lifts
    const liftNames: StandardizedLift[] = ['squat', 'bench_press', 'deadlift', 'overhead_press', 'barbell_row']

    const { data: exercises } = await supabase
      .from('exercises')
      .select('id, name')
      .in('name', ['Barbell Back Squat', 'Barbell Bench Press', 'Conventional Deadlift', 'Barbell Overhead Press', 'Barbell Row', 'Squat', 'Bench Press', 'Deadlift', 'Overhead Press']) as { data: { id: string; name: string }[] | null; error: any }

    if (!exercises || exercises.length === 0) {
      return NextResponse.json({
        error: 'No standard exercises found in database'
      }, { status: 400 })
    }

    const exerciseIds = exercises.map(e => e.id)

    const { data: estimates } = await supabase
      .from('user_exercise_estimates')
      .select('exercise_id, estimated_1rm_lbs')
      .eq('user_id', user.id)
      .in('exercise_id', exerciseIds) as { data: any[] | null; error: any }

    if (!estimates || estimates.length === 0) {
      return NextResponse.json({
        error: 'No 1RM estimates found. Log some strength tests first or use POST with explicit values.'
      }, { status: 400 })
    }

    // Map exercise names to standard lift names
    const exerciseNameMap: Record<string, StandardizedLift> = {
      'barbell back squat': 'squat',
      'squat': 'squat',
      'barbell bench press': 'bench_press',
      'bench press': 'bench_press',
      'conventional deadlift': 'deadlift',
      'deadlift': 'deadlift',
      'barbell overhead press': 'overhead_press',
      'overhead press': 'overhead_press',
      'barbell row': 'barbell_row',
    }

    const exerciseIdToName = new Map<string, string>()
    for (const e of exercises) {
      exerciseIdToName.set(e.id, e.name.toLowerCase())
    }

    const lifts: { exercise_name: StandardizedLift; current_1rm_lbs: number }[] = []
    for (const est of estimates) {
      const rawName = exerciseIdToName.get(est.exercise_id)
      if (rawName && exerciseNameMap[rawName]) {
        lifts.push({
          exercise_name: exerciseNameMap[rawName],
          current_1rm_lbs: est.estimated_1rm_lbs,
        })
      }
    }

    if (lifts.length === 0) {
      return NextResponse.json({
        error: 'No matching lifts found for standards comparison'
      }, { status: 400 })
    }

    // Use POST handler logic
    const reqBody: GetStrengthProfileRequest = {
      body_weight_lbs: bodyWeight,
      sex,
      lifts,
    }

    // Redirect to POST handler - or inline the logic
    // For simplicity, let's inline it
    const weightClass = getWeightClass(bodyWeight, sex)

    const { data: standards } = await supabase
      .from('strength_standards')
      .select('*')
      .eq('sex', sex)
      .eq('body_weight_class', weightClass)
      .in('exercise_name', lifts.map(l => l.exercise_name)) as { data: StrengthStandard[] | null; error: any }

    const standardsMap = new Map<string, StrengthStandard>()
    for (const s of standards || []) {
      standardsMap.set(s.exercise_name, s)
    }

    const userPercentiles: UserStrengthPercentile[] = []
    for (const lift of lifts) {
      const standard = standardsMap.get(lift.exercise_name)
      if (!standard) continue

      const percentile = calculateUserStrengthPercentile(
        lift.exercise_name,
        lift.current_1rm_lbs,
        bodyWeight,
        sex,
        standard
      )
      userPercentiles.push(percentile)
    }

    // Calculate Wilks/DOTS
    const squat = lifts.find(l => l.exercise_name === 'squat')?.current_1rm_lbs
    const bench = lifts.find(l => l.exercise_name === 'bench_press')?.current_1rm_lbs
    const deadlift = lifts.find(l => l.exercise_name === 'deadlift')?.current_1rm_lbs

    let wilksScore: number | null = null
    let dotsScore: number | null = null

    if (squat && bench && deadlift) {
      const total = squat + bench + deadlift
      wilksScore = calculateWilksScore(total, bodyWeight, sex)
      dotsScore = calculateDOTSScore(total, bodyWeight, sex)
    }

    // Determine classifications
    const classificationCounts = new Map<StrengthClassification, number>()
    for (const p of userPercentiles) {
      const count = classificationCounts.get(p.classification) || 0
      classificationCounts.set(p.classification, count + 1)
    }

    let overallClassification: StrengthClassification = 'untrained'
    let maxCount = 0
    for (const [cls, count] of Array.from(classificationCounts.entries())) {
      if (count > maxCount) {
        maxCount = count
        overallClassification = cls
      }
    }

    let strongestLift: StandardizedLift | null = null
    let weakestLift: StandardizedLift | null = null
    let maxPercentile = 0
    let minPercentile = 100

    for (const p of userPercentiles) {
      if (p.percentile > maxPercentile) {
        maxPercentile = p.percentile
        strongestLift = p.exercise_name
      }
      if (p.percentile < minPercentile) {
        minPercentile = p.percentile
        weakestLift = p.exercise_name
      }
    }

    const strengthProfile: StrengthProfile = {
      lifts: userPercentiles,
      wilksScore,
      dotsScore,
      overallClassification,
      strongestLift,
      weakestLift,
    }

    return NextResponse.json({ profile: strengthProfile })
  } catch (error) {
    console.error('Error in strength-standards profile GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
