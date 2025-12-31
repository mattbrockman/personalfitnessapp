import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calculate1RM } from '@/lib/strength-calculations'
import { UserExerciseEstimate, EstimateSource, TestType } from '@/types/strength'

// GET /api/strength/estimates - Get user's 1RM estimates for all or specific exercises
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const exerciseId = searchParams.get('exercise_id')

    let query = supabase
      .from('user_exercise_estimates')
      .select(`
        id,
        user_id,
        exercise_id,
        estimated_1rm_lbs,
        source,
        test_type,
        test_weight_lbs,
        test_reps,
        last_updated,
        created_at
      `)
      .eq('user_id', user.id)

    if (exerciseId) {
      query = query.eq('exercise_id', exerciseId)
    }

    const { data: estimates, error } = await query.order('last_updated', { ascending: false }) as { data: any[] | null; error: any }

    if (error) {
      console.error('Error fetching estimates:', error)
      return NextResponse.json({ error: 'Failed to fetch estimates' }, { status: 500 })
    }

    // Get exercise names
    const estimatesArray = estimates || []
    const exerciseIds = Array.from(new Set(estimatesArray.map((e: any) => e.exercise_id)))
    const { data: exercises } = await supabase
      .from('exercises')
      .select('id, name')
      .in('id', exerciseIds)

    const exerciseMap = new Map((exercises || []).map((e: any) => [e.id, e.name]))

    const enrichedEstimates = estimatesArray.map((est: any) => ({
      ...est,
      exercise_name: exerciseMap.get(est.exercise_id) || 'Unknown Exercise'
    }))

    return NextResponse.json({ estimates: enrichedEstimates })
  } catch (error) {
    console.error('Error in estimates GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/strength/estimates - Create or update a 1RM estimate
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
      estimated_1rm_lbs,
      source = 'manual',
      test_type,
      test_weight_lbs,
      test_reps
    }: {
      exercise_id: string
      estimated_1rm_lbs?: number
      source?: EstimateSource
      test_type?: TestType
      test_weight_lbs?: number
      test_reps?: number
    } = body

    if (!exercise_id) {
      return NextResponse.json({ error: 'exercise_id is required' }, { status: 400 })
    }

    // Calculate 1RM if test data provided
    let final1RM = estimated_1rm_lbs
    if (source === 'calculated' && test_weight_lbs && test_reps) {
      const result = calculate1RM(test_weight_lbs, test_reps)
      final1RM = result.estimated1RM
    } else if (source === 'tested' && test_weight_lbs && test_reps) {
      const result = calculate1RM(test_weight_lbs, test_reps)
      final1RM = result.estimated1RM
    }

    if (!final1RM) {
      return NextResponse.json({ error: 'estimated_1rm_lbs or test data required' }, { status: 400 })
    }

    // Upsert the estimate
    const { data: estimate, error: upsertError } = await (supabase as any)
      .from('user_exercise_estimates')
      .upsert({
        user_id: user.id,
        exercise_id,
        estimated_1rm_lbs: final1RM,
        source,
        test_type,
        test_weight_lbs,
        test_reps,
        last_updated: new Date().toISOString(),
      }, { onConflict: 'user_id,exercise_id' })
      .select()
      .single()

    if (upsertError) {
      console.error('Error upserting estimate:', upsertError)
      return NextResponse.json({ error: 'Failed to save estimate' }, { status: 500 })
    }

    return NextResponse.json({ estimate })
  } catch (error) {
    console.error('Error in estimates POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/strength/estimates?exercise_id=xxx - Delete an estimate
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const exerciseId = searchParams.get('exercise_id')

    if (!exerciseId) {
      return NextResponse.json({ error: 'exercise_id required' }, { status: 400 })
    }

    const { error: deleteError } = await supabase
      .from('user_exercise_estimates')
      .delete()
      .eq('user_id', user.id)
      .eq('exercise_id', exerciseId)

    if (deleteError) {
      console.error('Error deleting estimate:', deleteError)
      return NextResponse.json({ error: 'Failed to delete estimate' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in estimates DELETE:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
