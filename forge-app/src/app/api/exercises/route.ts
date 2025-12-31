import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// GET /api/exercises - List exercises from database
export async function GET(request: NextRequest) {
  try {
    const adminClient = createAdminClient()

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const muscleGroup = searchParams.get('muscle_group')
    const equipment = searchParams.get('equipment')
    const limit = searchParams.get('limit')

    let query = adminClient
      .from('exercises')
      .select('*')
      .order('name', { ascending: true })

    // Full-text search on name
    if (search) {
      query = query.ilike('name', `%${search}%`)
    }

    // Filter by primary muscle - handle both column name possibilities
    if (muscleGroup) {
      // Try primary_muscle first (seed file format), fall back to primary_muscles
      query = query.or(`primary_muscle.eq.${muscleGroup},primary_muscles.cs.{${muscleGroup}}`)
    }

    // Filter by equipment
    if (equipment) {
      query = query.eq('equipment', equipment)
    }

    // Limit results
    if (limit) {
      query = query.limit(parseInt(limit, 10))
    } else {
      query = query.limit(100) // Default limit
    }

    const { data: exercises, error } = await query

    if (error) {
      console.error('Error fetching exercises:', error)
      return NextResponse.json({ error: 'Failed to fetch exercises' }, { status: 500 })
    }

    // Normalize the response to match what the frontend expects
    const normalizedExercises = (exercises || []).map((ex: any) => ({
      id: ex.id,
      name: ex.name,
      description: ex.description,
      // Handle both column name formats
      primary_muscle: ex.primary_muscle || (ex.primary_muscles?.[0] ?? ''),
      primary_muscles: ex.primary_muscles || (ex.primary_muscle ? [ex.primary_muscle] : []),
      secondary_muscles: ex.secondary_muscles || [],
      equipment: ex.equipment,
      difficulty: ex.difficulty,
      instructions: ex.instructions,
      // Handle both cues and coaching_cues
      cues: ex.cues || ex.coaching_cues || [],
      coaching_cues: ex.coaching_cues || ex.cues || [],
      common_mistakes: ex.common_mistakes || [],
      is_compound: ex.is_compound,
      is_unilateral: ex.is_unilateral,
      video_url: ex.video_url,
      thumbnail_url: ex.thumbnail_url,
    }))

    return NextResponse.json({ exercises: normalizedExercises })
  } catch (error) {
    console.error('Exercises GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET unique muscle groups for filtering
export async function OPTIONS(request: NextRequest) {
  try {
    const adminClient = createAdminClient()

    // Get distinct muscle groups
    const { data: exercises } = await adminClient
      .from('exercises')
      .select('primary_muscle, primary_muscles')

    if (!exercises) {
      return NextResponse.json({ muscle_groups: [], equipment: [] })
    }

    // Extract unique muscle groups
    const muscleGroups = new Set<string>()
    exercises.forEach((ex: any) => {
      if (ex.primary_muscle) muscleGroups.add(ex.primary_muscle)
      if (ex.primary_muscles) ex.primary_muscles.forEach((m: string) => muscleGroups.add(m))
    })

    // Get distinct equipment
    const { data: equipmentData } = await adminClient
      .from('exercises')
      .select('equipment')

    const equipment = new Set<string>()
    equipmentData?.forEach((ex: any) => {
      if (ex.equipment) equipment.add(ex.equipment)
    })

    return NextResponse.json({
      muscle_groups: Array.from(muscleGroups).sort(),
      equipment: Array.from(equipment).sort(),
    })
  } catch (error) {
    console.error('Exercises OPTIONS error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
