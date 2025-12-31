import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calculate1RM } from '@/lib/strength-calculations'
import { TestType, StrengthTest, StrengthTestWithName } from '@/types/strength'

// GET /api/strength/tests - Get strength test history
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const exerciseId = searchParams.get('exercise_id')
    const limit = parseInt(searchParams.get('limit') || '20')

    let query = (supabase as any)
      .from('strength_tests')
      .select(`
        id,
        user_id,
        workout_id,
        exercise_id,
        test_date,
        test_type,
        weight_lbs,
        reps_achieved,
        rpe,
        estimated_1rm_lbs,
        previous_1rm_lbs,
        improvement_percent,
        notes,
        created_at
      `)
      .eq('user_id', user.id)
      .order('test_date', { ascending: false })
      .limit(limit)

    if (exerciseId) {
      query = query.eq('exercise_id', exerciseId)
    }

    const { data: tests, error } = await query as { data: any[] | null; error: any }

    if (error) {
      console.error('Error fetching strength tests:', error)
      return NextResponse.json({ error: 'Failed to fetch tests' }, { status: 500 })
    }

    // Get exercise names
    const testsArray = tests || []
    const exerciseIds = Array.from(new Set(testsArray.map((t: any) => t.exercise_id)))
    const { data: exercises } = await supabase
      .from('exercises')
      .select('id, name')
      .in('id', exerciseIds)

    const exerciseMap = new Map((exercises || []).map((e: any) => [e.id, e.name]))

    const enrichedTests: StrengthTestWithName[] = testsArray.map((test: any) => ({
      ...test,
      exercise_name: exerciseMap.get(test.exercise_id) || 'Unknown Exercise'
    }))

    // Calculate PRs per exercise
    const prsByExercise = new Map<string, { weight: number; date: string; e1rm: number }>()
    for (const test of enrichedTests) {
      const existing = prsByExercise.get(test.exercise_id)
      if (!existing || test.estimated_1rm_lbs > existing.e1rm) {
        prsByExercise.set(test.exercise_id, {
          weight: test.weight_lbs,
          date: test.test_date,
          e1rm: test.estimated_1rm_lbs
        })
      }
    }

    return NextResponse.json({
      tests: enrichedTests,
      prs: Object.fromEntries(prsByExercise),
    })
  } catch (error) {
    console.error('Error in strength tests GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/strength/tests - Log a new strength test
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      exercise_id,
      workout_id,
      test_date,
      test_type,
      weight_lbs,
      reps_achieved,
      rpe,
      notes,
    }: {
      exercise_id: string
      workout_id?: string
      test_date?: string
      test_type: TestType
      weight_lbs: number
      reps_achieved: number
      rpe?: number
      notes?: string
    } = body

    if (!exercise_id || !test_type || !weight_lbs || !reps_achieved) {
      return NextResponse.json({
        error: 'exercise_id, test_type, weight_lbs, and reps_achieved are required'
      }, { status: 400 })
    }

    // Calculate estimated 1RM
    const result = calculate1RM(weight_lbs, reps_achieved)
    const estimated1RM = result.estimated1RM

    // Get previous test for comparison
    const { data: previousTest } = await (supabase as any)
      .from('strength_tests')
      .select('estimated_1rm_lbs, test_date')
      .eq('user_id', user.id)
      .eq('exercise_id', exercise_id)
      .order('test_date', { ascending: false })
      .limit(1)
      .single()

    const prevTestData = previousTest as any
    const previous1RM = prevTestData?.estimated_1rm_lbs || null
    const improvementPercent = previous1RM
      ? Math.round(((estimated1RM - previous1RM) / previous1RM) * 1000) / 10
      : null

    // Insert the test
    const { data: test, error: insertError } = await (supabase as any)
      .from('strength_tests')
      .insert({
        user_id: user.id,
        exercise_id,
        workout_id,
        test_date: test_date || new Date().toISOString().split('T')[0],
        test_type,
        weight_lbs,
        reps_achieved,
        rpe,
        estimated_1rm_lbs: estimated1RM,
        previous_1rm_lbs: previous1RM,
        improvement_percent: improvementPercent,
        notes,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error inserting strength test:', insertError)
      return NextResponse.json({ error: 'Failed to save test' }, { status: 500 })
    }

    // Update user_exercise_estimates with new 1RM
    const { error: estimateError } = await (supabase as any)
      .from('user_exercise_estimates')
      .upsert({
        user_id: user.id,
        exercise_id,
        estimated_1rm_lbs: estimated1RM,
        source: 'tested',
        test_type,
        test_weight_lbs: weight_lbs,
        test_reps: reps_achieved,
        last_updated: new Date().toISOString(),
      }, { onConflict: 'user_id,exercise_id' })

    if (estimateError) {
      console.warn('Failed to update estimate:', estimateError)
    }

    return NextResponse.json({
      test,
      estimated1RM,
      previous1RM,
      improvementPercent,
      confidence: result.confidence,
    })
  } catch (error) {
    console.error('Error in strength tests POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/strength/tests?id=xxx - Delete a strength test
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
      .from('strength_tests')
      .delete()
      .eq('user_id', user.id)
      .eq('id', testId)

    if (deleteError) {
      console.error('Error deleting test:', deleteError)
      return NextResponse.json({ error: 'Failed to delete test' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in strength tests DELETE:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
