import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { TechniqueAssessment, LogTechniqueRequest, TechniqueRating } from '@/types/galpin'

// GET /api/technique - Get technique assessments
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const exerciseId = searchParams.get('exercise_id')
    const exerciseName = searchParams.get('exercise_name')
    const limit = parseInt(searchParams.get('limit') || '20')

    let query = supabase
      .from('technique_assessments')
      .select('*')
      .eq('user_id', user.id)
      .order('assessment_date', { ascending: false })
      .limit(limit)

    if (exerciseId) {
      query = query.eq('exercise_id', exerciseId)
    } else if (exerciseName) {
      query = query.ilike('exercise_name', `%${exerciseName}%`)
    }

    const { data: assessments, error } = await query as { data: TechniqueAssessment[] | null; error: any }

    if (error) {
      console.error('Error fetching technique assessments:', error)
      return NextResponse.json({ error: 'Failed to fetch assessments' }, { status: 500 })
    }

    // Group by exercise and calculate trends
    const exerciseGroups = new Map<string, TechniqueAssessment[]>()
    for (const a of assessments || []) {
      const key = a.exercise_name.toLowerCase()
      if (!exerciseGroups.has(key)) {
        exerciseGroups.set(key, [])
      }
      exerciseGroups.get(key)!.push(a)
    }

    const summaries = Array.from(exerciseGroups.entries()).map(([name, assessments]) => {
      const sorted = [...assessments].sort((a, b) =>
        new Date(b.assessment_date).getTime() - new Date(a.assessment_date).getTime()
      )
      const current = sorted[0]?.technique_rating || 3

      let trend: 'improving' | 'stable' | 'declining' = 'stable'
      if (sorted.length >= 2) {
        const recent = sorted.slice(0, Math.min(3, sorted.length))
        const avgRecent = recent.reduce((sum, a) => sum + a.technique_rating, 0) / recent.length

        if (sorted.length >= 4) {
          const older = sorted.slice(3, Math.min(6, sorted.length))
          const avgOlder = older.reduce((sum, a) => sum + a.technique_rating, 0) / older.length

          if (avgRecent > avgOlder + 0.3) trend = 'improving'
          else if (avgRecent < avgOlder - 0.3) trend = 'declining'
        }
      }

      // Collect unique cues across assessments
      const allCues = new Set<string>()
      for (const a of sorted.slice(0, 3)) {
        for (const cue of a.cues_to_focus || []) {
          allCues.add(cue)
        }
      }

      return {
        exercise_name: sorted[0]?.exercise_name || name,
        currentRating: current,
        assessmentCount: sorted.length,
        trend,
        priorityCues: Array.from(allCues).slice(0, 5),
        latestAssessment: sorted[0] || null,
      }
    })

    return NextResponse.json({
      assessments: assessments || [],
      summaries,
    })
  } catch (error) {
    console.error('Error in technique GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/technique - Log a technique assessment
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: LogTechniqueRequest = await request.json()
    const {
      exercise_id,
      exercise_name,
      assessment_date = new Date().toISOString().split('T')[0],
      technique_rating,
      video_url,
      strengths,
      areas_for_improvement,
      cues_to_focus,
      assessed_by = 'self',
      coach_notes,
    } = body

    if (!exercise_name) {
      return NextResponse.json({ error: 'exercise_name is required' }, { status: 400 })
    }

    if (!technique_rating || technique_rating < 1 || technique_rating > 5) {
      return NextResponse.json({
        error: 'technique_rating is required and must be between 1 and 5'
      }, { status: 400 })
    }

    const { data: assessment, error: insertError } = await (supabase as any)
      .from('technique_assessments')
      .insert({
        user_id: user.id,
        exercise_id: exercise_id || null,
        exercise_name,
        assessment_date,
        technique_rating,
        video_url: video_url || null,
        strengths: strengths || null,
        areas_for_improvement: areas_for_improvement || null,
        cues_to_focus: cues_to_focus || null,
        assessed_by,
        coach_notes: coach_notes || null,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error inserting technique assessment:', insertError)
      return NextResponse.json({ error: 'Failed to save assessment' }, { status: 500 })
    }

    return NextResponse.json({ assessment })
  } catch (error) {
    console.error('Error in technique POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/technique?id=xxx - Delete a technique assessment
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const assessmentId = searchParams.get('id')

    if (!assessmentId) {
      return NextResponse.json({ error: 'id required' }, { status: 400 })
    }

    const { error: deleteError } = await supabase
      .from('technique_assessments')
      .delete()
      .eq('user_id', user.id)
      .eq('id', assessmentId)

    if (deleteError) {
      console.error('Error deleting technique assessment:', deleteError)
      return NextResponse.json({ error: 'Failed to delete assessment' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in technique DELETE:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
