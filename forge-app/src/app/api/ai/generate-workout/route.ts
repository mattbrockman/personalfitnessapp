import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

interface GenerateWorkoutRequest {
  muscle_focus?: string[]
  duration_minutes?: number
  equipment?: string
  prompt?: string
}

// POST /api/ai/generate-workout - Generate a workout using AI
export async function POST(request: NextRequest) {
  try {
    // Check for API key
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('ANTHROPIC_API_KEY is not configured')
      return NextResponse.json(
        { error: 'AI service not configured. Please contact support.' },
        { status: 503 }
      )
    }

    const supabase = await createClient()
    const adminClient = createAdminClient()

    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: GenerateWorkoutRequest = await request.json()
    const { muscle_focus, duration_minutes = 45, equipment, prompt } = body

    console.log('AI Workout Generation request:', { muscle_focus, duration_minutes, equipment, hasPrompt: !!prompt })

    // Fetch user's saved equipment preferences
    const { data: profileData } = await adminClient
      .from('profiles')
      .select('available_equipment')
      .eq('id', session.user.id)
      .single() as { data: { available_equipment: string[] | null } | null }

    // Use equipment from request, or fall back to saved preferences, or default
    const userEquipment = equipment || profileData?.available_equipment || ['barbell', 'dumbbell', 'cable', 'machine', 'bodyweight']

    console.log('Using equipment:', userEquipment)

    // Gather context for the AI

    // 1. Get recent workouts (last 14 days)
    const twoWeeksAgo = new Date()
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)

    const { data: recentWorkoutsData } = await adminClient
      .from('workouts')
      .select('id, name, category, scheduled_date, status, completed_at')
      .eq('user_id', session.user.id)
      .eq('category', 'strength')
      .gte('scheduled_date', twoWeeksAgo.toISOString().split('T')[0])
      .order('scheduled_date', { ascending: false })
      .limit(10)
    const recentWorkouts = recentWorkoutsData as any[] | null

    // 2. Get active injuries from journal entries
    const { data: injuriesData } = await adminClient
      .from('journal_entries')
      .select('body_part, severity, status, created_at')
      .eq('user_id', session.user.id)
      .eq('entry_type', 'injury')
      .in('status', ['active', 'recovering'])
      .order('created_at', { ascending: false })
      .limit(5)
    const injuries = injuriesData as any[] | null

    // 3. Get exercise library
    const { data: exercisesData, error: exercisesError } = await adminClient
      .from('exercises')
      .select('id, name, primary_muscles, secondary_muscles, equipment')
      .order('name')
    const exercises = exercisesData as any[] | null

    if (exercisesError) {
      console.error('Error fetching exercises:', exercisesError)
    }

    console.log('Fetched exercises count:', exercises?.length || 0)

    if (!exercises || exercises.length === 0) {
      return NextResponse.json(
        { error: 'No exercises available. Please add exercises to the library first.' },
        { status: 400 }
      )
    }

    // 4. Get recent sleep/recovery if available
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)

    const { data: recentSleepData } = await adminClient
      .from('sleep_data')
      .select('sleep_score, time_in_bed_hours, deep_sleep_hours')
      .eq('user_id', session.user.id)
      .gte('date', yesterday.toISOString().split('T')[0])
      .order('date', { ascending: false })
      .limit(3)
    const recentSleep = recentSleepData as any[] | null

    // Build context string
    let contextParts: string[] = []

    // Recent workouts context
    if (recentWorkouts && recentWorkouts.length > 0) {
      const workoutSummary = recentWorkouts.map(w => {
        const status = w.status === 'completed' ? 'completed' : 'planned'
        return `- ${w.name || 'Workout'} on ${w.scheduled_date} (${status})`
      }).join('\n')
      contextParts.push(`Recent workouts (last 14 days):\n${workoutSummary}`)
    } else {
      contextParts.push('No recent strength workouts recorded.')
    }

    // Injuries context
    if (injuries && injuries.length > 0) {
      const injurySummary = injuries.map(i =>
        `- ${i.body_part}: ${i.severity} severity, ${i.status}`
      ).join('\n')
      contextParts.push(`Active injuries/issues:\n${injurySummary}\nIMPORTANT: Avoid exercises that stress these areas.`)
    }

    // Recovery context
    if (recentSleep && recentSleep.length > 0) {
      const avgScore = recentSleep.reduce((sum, s) => sum + (s.sleep_score || 70), 0) / recentSleep.length
      if (avgScore < 60) {
        contextParts.push(`Recovery status: Low recent sleep scores (avg ${Math.round(avgScore)}). Consider lighter volume.`)
      } else if (avgScore > 80) {
        contextParts.push(`Recovery status: Good recovery (sleep avg ${Math.round(avgScore)}). Ready for harder training.`)
      }
    }

    // Build exercise library reference
    const exerciseByMuscle: Record<string, string[]> = {}
    if (exercises) {
      exercises.forEach(ex => {
        const primaryMuscles = ex.primary_muscles || []
        primaryMuscles.forEach((muscle: string) => {
          if (!exerciseByMuscle[muscle]) {
            exerciseByMuscle[muscle] = []
          }
          // Only add if equipment matches user's available equipment
          const exEquipment = ex.equipment?.toLowerCase() || ''

          // Check if exercise equipment type matches any of user's available equipment
          const equipmentArray = Array.isArray(userEquipment) ? userEquipment : ['barbell', 'dumbbell', 'cable', 'machine', 'bodyweight']

          const includeExercise = equipmentArray.some(equip => {
            const equipLower = equip.toLowerCase()
            if (equipLower === 'bodyweight') {
              return exEquipment.includes('bodyweight') || exEquipment === 'none' || exEquipment === ''
            }
            return exEquipment.includes(equipLower)
          })

          if (includeExercise && exerciseByMuscle[muscle].length < 8) {
            exerciseByMuscle[muscle].push(ex.name)
          }
        })
      })
    }

    // Build the AI prompt
    const systemPrompt = `You are an expert strength coach creating personalized workout plans.

CRITICAL RULES (MUST FOLLOW):
- The user's request is your PRIMARY DIRECTIVE - follow it closely
- If user asks to focus on specific muscles/exercises, prioritize those
- If user asks to avoid something (exercise, muscle group, movement), DO NOT include it
- If user mentions an injury, pain, or limitation, avoid exercises that stress that area
- User preferences take ABSOLUTE priority over generic workout optimization

Guidelines:
- Create workouts that are challenging but achievable
- Prioritize compound movements, then isolation
- Group exercises logically (same muscle group together, or use supersets)
- Use standard rep ranges: 5-8 for strength, 8-12 for hypertrophy, 12-15 for endurance
- Rest times: 90-180s for compound lifts, 60-90s for isolation

IMPORTANT: Only use exercises from the provided exercise library.`

    let userRequest = ''
    if (prompt) {
      userRequest = prompt
    } else if (muscle_focus && muscle_focus.length > 0) {
      const focusLabel = muscle_focus[0]
      switch (focusLabel) {
        case 'push':
          userRequest = 'Create a push day workout focusing on chest, shoulders, and triceps'
          break
        case 'pull':
          userRequest = 'Create a pull day workout focusing on back, biceps, and rear delts'
          break
        case 'legs':
          userRequest = 'Create a leg day workout focusing on quads, hamstrings, glutes, and calves'
          break
        case 'upper':
          userRequest = 'Create an upper body workout hitting chest, back, shoulders, and arms'
          break
        case 'lower':
          userRequest = 'Create a lower body workout focusing on quads, hamstrings, and glutes'
          break
        case 'full':
          userRequest = 'Create a full body workout hitting all major muscle groups'
          break
        default:
          userRequest = `Create a workout focusing on ${muscle_focus.join(', ')}`
      }
    } else {
      userRequest = 'Create a balanced strength training workout'
    }

    // Format equipment list for prompt
    const equipmentArray = Array.isArray(userEquipment) ? userEquipment : ['barbell', 'dumbbell', 'cable', 'machine', 'bodyweight']
    const equipmentLabels: Record<string, string> = {
      barbell: 'Barbell & Rack',
      dumbbell: 'Dumbbells',
      cable: 'Cable Machine',
      machine: 'Weight Machines',
      bodyweight: 'Bodyweight/Pull-up Bar',
      kettlebell: 'Kettlebells',
      bands: 'Resistance Bands',
    }
    const equipmentDescription = equipmentArray.map(e => equipmentLabels[e] || e).join(', ')

    const userPrompt = `PRIMARY DIRECTIVE (from user):
"${prompt || userRequest}"

Your workout MUST follow this directive. If they want to focus on something, focus on it. If they want to avoid something, avoid it entirely.

WORKOUT PARAMETERS:
- Duration: approximately ${duration_minutes} minutes
- Available Equipment: ${equipmentDescription}
- IMPORTANT: Only use exercises that can be done with the available equipment listed above

ADDITIONAL CONTEXT:
${contextParts.join('\n\n')}

AVAILABLE EXERCISES BY MUSCLE GROUP:
${Object.entries(exerciseByMuscle).map(([muscle, exs]) => `${muscle}: ${exs.join(', ')}`).join('\n')}

Create a workout that DIRECTLY addresses the user's request above.
Return your response as a JSON object with this exact structure:
{
  "name": "<workout name reflecting what user asked for>",
  "exercises": [
    {
      "exercise_name": "<exact name from the library>",
      "sets": <number>,
      "reps_min": <number>,
      "reps_max": <number>,
      "rest_seconds": <number>,
      "superset_group": <null or "A", "B", "C" if supersetting>,
      "notes": "<optional coaching note>"
    }
  ],
  "estimated_duration": <minutes>,
  "reasoning": "<1-2 sentences explaining how you honored the user's request>"
}

Include 4-8 exercises appropriate for the duration. Return ONLY the JSON, no other text.`

    console.log('Calling Claude API with muscle groups:', Object.keys(exerciseByMuscle))

    // Call Claude API
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    })

    console.log('Claude API response received, stop_reason:', response.stop_reason)

    // Extract text response
    const textContent = response.content.find(c => c.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from Claude')
    }

    // Parse JSON from response
    let workoutData
    try {
      const jsonMatch = textContent.text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        workoutData = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('No JSON found in response')
      }
    } catch (parseError) {
      console.error('Failed to parse Claude response:', textContent.text)
      return NextResponse.json(
        { error: 'Failed to generate workout. Please try again.' },
        { status: 500 }
      )
    }

    // Map exercise names to exercise IDs and build BuilderExercise format
    const exerciseMap = new Map<string, any>()
    if (exercises) {
      exercises.forEach(ex => {
        exerciseMap.set(ex.name.toLowerCase(), ex)
      })
    }

    const builderExercises = workoutData.exercises.map((ex: any, index: number) => {
      const exerciseData = exerciseMap.get(ex.exercise_name.toLowerCase())

      return {
        id: `ai-${Date.now()}-${index}`,
        exercise: {
          id: exerciseData?.id || '',
          name: ex.exercise_name,
          primary_muscle: exerciseData?.primary_muscles?.[0] || '',
          equipment: exerciseData?.equipment || '',
          cues: [],
        },
        sets: ex.sets || 3,
        reps_min: ex.reps_min || 8,
        reps_max: ex.reps_max || 12,
        rest_seconds: ex.rest_seconds || 90,
        superset_group: ex.superset_group || null,
        notes: ex.notes || '',
      }
    })

    return NextResponse.json({
      workout: {
        name: workoutData.name || 'AI Generated Workout',
        exercises: builderExercises,
        estimated_duration: workoutData.estimated_duration || duration_minutes,
        reasoning: workoutData.reasoning || '',
      }
    })
  } catch (error) {
    console.error('AI workout generation error:', error)

    if (error instanceof Anthropic.APIError) {
      console.error('Anthropic API error:', error.status, error.message)
      if (error.status === 401) {
        return NextResponse.json(
          { error: 'AI service authentication failed. Please check API key configuration.' },
          { status: 503 }
        )
      }
      return NextResponse.json(
        { error: `AI service error: ${error.message}` },
        { status: 503 }
      )
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error details:', errorMessage)

    return NextResponse.json(
      { error: `Failed to generate workout: ${errorMessage}` },
      { status: 500 }
    )
  }
}
