import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { StrengthStandard, StandardizedLift, Sex } from '@/types/galpin'
import { getWeightClass } from '@/lib/galpin-calculations'

// GET /api/strength-standards - Get strength standards
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const exercise = searchParams.get('exercise') as StandardizedLift | null
    const sex = searchParams.get('sex') as Sex | null
    const bodyWeight = searchParams.get('body_weight') ? parseFloat(searchParams.get('body_weight')!) : null

    let query = supabase
      .from('strength_standards')
      .select('*')

    if (exercise) {
      query = query.eq('exercise_name', exercise)
    }

    if (sex) {
      query = query.eq('sex', sex)
    }

    if (bodyWeight && sex) {
      const weightClass = getWeightClass(bodyWeight, sex)
      query = query.eq('body_weight_class', weightClass)
    }

    const { data: standards, error } = await query as { data: StrengthStandard[] | null; error: any }

    if (error) {
      console.error('Error fetching strength standards:', error)
      return NextResponse.json({ error: 'Failed to fetch standards' }, { status: 500 })
    }

    return NextResponse.json({ standards: standards || [] })
  } catch (error) {
    console.error('Error in strength-standards GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
