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
    const bodyPart = searchParams.get('body_part')
    const difficulty = searchParams.get('difficulty')
    const adaptation = searchParams.get('adaptation')
    const isCompound = searchParams.get('is_compound')
    const limit = searchParams.get('limit')
    const offset = searchParams.get('offset')

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

    // Filter by body part
    if (bodyPart) {
      query = query.eq('body_part', bodyPart)
    }

    // Filter by difficulty
    if (difficulty) {
      query = query.eq('difficulty', difficulty)
    }

    // Filter by Galpin adaptation
    if (adaptation) {
      query = query.contains('galpin_adaptations', [adaptation])
    }

    // Filter by compound/isolation
    if (isCompound !== null && isCompound !== undefined) {
      query = query.eq('is_compound', isCompound === 'true')
    }

    // Pagination
    if (offset) {
      query = query.range(parseInt(offset, 10), parseInt(offset, 10) + (parseInt(limit || '100', 10) - 1))
    } else if (limit) {
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
      // New fields from ExerciseDB expansion
      body_part: ex.body_part,
      galpin_adaptations: ex.galpin_adaptations || [],
      external_source: ex.external_source,
    }))

    return NextResponse.json({ exercises: normalizedExercises })
  } catch (error) {
    console.error('Exercises GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET unique filter options for exercise search
export async function OPTIONS(request: NextRequest) {
  try {
    const adminClient = createAdminClient()

    // Get all exercise data for extracting unique values
    const { data: exercises } = await adminClient
      .from('exercises')
      .select('primary_muscle, primary_muscles, equipment, body_part, difficulty, galpin_adaptations')

    if (!exercises) {
      return NextResponse.json({
        muscle_groups: [],
        equipment: [],
        body_parts: [],
        difficulties: [],
        adaptations: [],
      })
    }

    // Extract unique values
    const muscleGroups = new Set<string>()
    const equipmentSet = new Set<string>()
    const bodyParts = new Set<string>()
    const difficulties = new Set<string>()
    const adaptations = new Set<string>()

    exercises.forEach((ex: any) => {
      if (ex.primary_muscle) muscleGroups.add(ex.primary_muscle)
      if (ex.primary_muscles) ex.primary_muscles.forEach((m: string) => muscleGroups.add(m))
      if (ex.equipment) equipmentSet.add(ex.equipment)
      if (ex.body_part) bodyParts.add(ex.body_part)
      if (ex.difficulty) difficulties.add(ex.difficulty)
      if (ex.galpin_adaptations) ex.galpin_adaptations.forEach((a: string) => adaptations.add(a))
    })

    return NextResponse.json({
      muscle_groups: Array.from(muscleGroups).sort(),
      equipment: Array.from(equipmentSet).sort(),
      body_parts: Array.from(bodyParts).sort(),
      difficulties: Array.from(difficulties).sort(),
      adaptations: Array.from(adaptations).sort(),
    })
  } catch (error) {
    console.error('Exercises OPTIONS error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
