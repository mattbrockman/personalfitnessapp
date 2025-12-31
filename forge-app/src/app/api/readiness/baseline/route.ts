import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ReadinessBaselines } from '@/types/galpin'

// GET /api/readiness/baseline - Get user's readiness baselines
export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: baselines, error } = await supabase
      .from('readiness_baselines')
      .select('*')
      .eq('user_id', user.id)
      .single() as { data: ReadinessBaselines | null; error: any }

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching baselines:', error)
      return NextResponse.json({ error: 'Failed to fetch baselines' }, { status: 500 })
    }

    return NextResponse.json({ baselines: baselines || null })
  } catch (error) {
    console.error('Error in baselines GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
