import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import {
  AIGeneratePlanRequest,
  AIGeneratePlanResponse,
  TrainingPlan,
  ACTIVITY_LABELS,
  AISuggestedWorkout,
  AIGeneratePlanResponseWithWorkouts,
} from '@/types/training-plan'
import { addDays, format, startOfWeek, subWeeks, differenceInYears } from 'date-fns'
import { getWeatherForecast, getWeatherSummaryForAI } from '@/lib/weather'

// Helper to calculate age from date of birth
function calculateAge(dateOfBirth: string | null): number | null {
  if (!dateOfBirth) return null
  return differenceInYears(new Date(), new Date(dateOfBirth))
}

// Helper to summarize training history
function summarizeTrainingHistory(workouts: any[]): string {
  if (!workouts || workouts.length === 0) return 'No recent training history'

  // Group by week and category
  const weeklyTotals: Record<string, { total: number; byCategory: Record<string, number> }> = {}

  for (const w of workouts) {
    const weekKey = format(new Date(w.scheduled_date), 'yyyy-ww')
    if (!weeklyTotals[weekKey]) {
      weeklyTotals[weekKey] = { total: 0, byCategory: {} }
    }
    const duration = w.actual_duration_minutes || w.planned_duration_minutes || 0
    weeklyTotals[weekKey].total += duration
    const cat = w.category || 'other'
    weeklyTotals[weekKey].byCategory[cat] = (weeklyTotals[weekKey].byCategory[cat] || 0) + duration
  }

  const weeks = Object.values(weeklyTotals)
  if (weeks.length === 0) return 'No recent training history'

  const avgWeeklyMinutes = weeks.reduce((sum, w) => sum + w.total, 0) / weeks.length
  const avgWeeklyHours = Math.round(avgWeeklyMinutes / 60 * 10) / 10

  // Calculate category breakdown
  const categoryTotals: Record<string, number> = {}
  for (const w of weeks) {
    for (const [cat, mins] of Object.entries(w.byCategory)) {
      categoryTotals[cat] = (categoryTotals[cat] || 0) + mins
    }
  }
  const totalMins = Object.values(categoryTotals).reduce((a, b) => a + b, 0)
  const breakdown = Object.entries(categoryTotals)
    .map(([cat, mins]) => `${cat}: ${Math.round(mins / totalMins * 100)}%`)
    .join(', ')

  return `${avgWeeklyHours}h/week avg over ${weeks.length} weeks (${breakdown})`
}

// Helper to estimate 1RM using Brzycki formula
function estimate1RM(weight: number, reps: number): number {
  if (reps === 1) return weight
  if (reps > 12) return weight * 1.3 // Rough estimate for high rep sets
  return Math.round(weight * (36 / (37 - reps)))
}

// Helper to summarize strength baselines
function summarizeStrengthBaselines(sets: any[]): string {
  if (!sets || sets.length === 0) return 'No strength history'

  // Group by exercise and find best estimated 1RM
  const exerciseBests: Record<string, number> = {}

  for (const set of sets) {
    const name = set.workout_exercises?.exercise_name || 'Unknown'
    if (!set.actual_weight_lbs || !set.actual_reps) continue

    const estimated1RM = estimate1RM(set.actual_weight_lbs, set.actual_reps)
    if (!exerciseBests[name] || estimated1RM > exerciseBests[name]) {
      exerciseBests[name] = estimated1RM
    }
  }

  // Focus on main compound lifts
  const keyLifts = ['Barbell Back Squat', 'Deadlift', 'Bench Press', 'Overhead Press', 'Barbell Row']
  const relevantLifts = keyLifts
    .filter(lift => exerciseBests[lift])
    .map(lift => `${lift.replace('Barbell ', '').replace(' Press', '')}: ~${exerciseBests[lift]}lb`)

  if (relevantLifts.length === 0) {
    // Fall back to any lifts we have
    const anyLifts = Object.entries(exerciseBests).slice(0, 3).map(([name, rm]) => `${name}: ~${rm}lb`)
    return anyLifts.length > 0 ? `Est. 1RMs: ${anyLifts.join(', ')}` : 'No strength history'
  }

  return `Est. 1RMs: ${relevantLifts.join(', ')}`
}

// Helper to summarize journal entries for injuries/constraints
function summarizeJournalEntries(entries: any[]): string {
  if (!entries || entries.length === 0) return ''

  // Look for injury-related keywords
  const injuryKeywords = ['injury', 'injured', 'pain', 'hurt', 'sore', 'strain', 'sprain', 'avoid', 'careful', 'recovery', 'rehab']

  const relevantEntries = entries.filter(e => {
    const content = (e.content || '').toLowerCase()
    return injuryKeywords.some(keyword => content.includes(keyword))
  })

  if (relevantEntries.length === 0) return ''

  // Return most recent relevant entries (truncated)
  const summaries = relevantEntries.slice(0, 3).map(e => {
    const date = format(new Date(e.entry_date), 'MMM d')
    const content = e.content.substring(0, 100) + (e.content.length > 100 ? '...' : '')
    return `[${date}] ${content}`
  })

  return summaries.join('\n')
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// POST /api/ai/generate-plan - Generate a training plan using AI
export async function POST(request: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'AI service not configured' },
        { status: 503 }
      )
    }

    const supabase = await createClient()
    const adminClient = createAdminClient()

    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: AIGeneratePlanRequest = await request.json()

    // Validate required fields
    if (!body.goal || !body.primary_activities || body.primary_activities.length === 0) {
      return NextResponse.json(
        { error: 'Goal and activities are required' },
        { status: 400 }
      )
    }

    console.log('Generating training plan:', body)

    // Fetch full user profile with fitness baselines
    const { data: profileData } = await (adminClient as any)
      .from('profiles')
      .select(`
        available_equipment,
        ftp_watts,
        lthr_bpm,
        max_hr_bpm,
        threshold_pace_per_mile,
        vo2max_ml_kg_min,
        experience_level,
        resting_hr_baseline,
        date_of_birth,
        biological_sex,
        weather_lat,
        weather_lon
      `)
      .eq('id', session.user.id)
      .single()

    const userEquipment: string[] = profileData?.available_equipment ||
      ['barbell', 'dumbbell', 'cable', 'machine', 'bodyweight']

    // Fetch recent training history (last 12 weeks)
    const twelveWeeksAgo = format(subWeeks(new Date(), 12), 'yyyy-MM-dd')
    const { data: recentWorkouts } = await (adminClient as any)
      .from('workouts')
      .select(`
        scheduled_date,
        category,
        workout_type,
        actual_duration_minutes,
        planned_duration_minutes,
        status
      `)
      .eq('user_id', session.user.id)
      .gte('scheduled_date', twelveWeeksAgo)
      .eq('status', 'completed')
      .order('scheduled_date')

    // Fetch strength history for 1RM estimates
    const { data: strengthSets } = await (adminClient as any)
      .from('exercise_sets')
      .select(`
        actual_weight_lbs,
        actual_reps,
        workout_exercises!inner(
          exercise_name,
          workouts!inner(user_id)
        )
      `)
      .eq('workout_exercises.workouts.user_id', session.user.id)
      .not('actual_weight_lbs', 'is', null)
      .not('actual_reps', 'is', null)
      .order('created_at', { ascending: false })
      .limit(500)

    // Fetch journal entries for injury/recovery context
    const { data: journalEntries } = await (adminClient as any)
      .from('journal_entries')
      .select('entry_date, content, mood, energy_level')
      .eq('user_id', session.user.id)
      .gte('entry_date', twelveWeeksAgo)
      .order('entry_date', { ascending: false })
      .limit(20)

    // Build athlete context summary
    const age = calculateAge(profileData?.date_of_birth)
    const trainingHistorySummary = summarizeTrainingHistory(recentWorkouts || [])
    const strengthSummary = summarizeStrengthBaselines(strengthSets || [])
    const journalSummary = summarizeJournalEntries(journalEntries || [])

    // Fetch exercise library for strength workouts
    const { data: exercises } = await (adminClient as any)
      .from('exercises')
      .select('name, primary_muscles, equipment, is_compound')
      .order('name')

    // Fetch adaptation protocols if primary_adaptation specified (Galpin framework)
    let adaptationProtocol: any = null
    let secondaryProtocol: any = null

    if (body.primary_adaptation) {
      const { data: protocol } = await (adminClient as any)
        .from('adaptation_protocols')
        .select('*')
        .eq('adaptation_type', body.primary_adaptation)
        .single()
      adaptationProtocol = protocol
    }

    if (body.secondary_adaptation) {
      const { data: protocol } = await (adminClient as any)
        .from('adaptation_protocols')
        .select('*')
        .eq('adaptation_type', body.secondary_adaptation)
        .single()
      secondaryProtocol = protocol
    }

    // Fetch weather forecast if user has location set (using already-fetched profile data)
    let weatherSummary = ''
    try {
      if (profileData?.weather_lat && profileData?.weather_lon) {
        const forecast = await getWeatherForecast(
          profileData.weather_lat,
          profileData.weather_lon,
          14 // 14 days forecast
        )
        weatherSummary = getWeatherSummaryForAI(forecast)
      }
    } catch (weatherError) {
      console.log('Weather fetch failed, continuing without weather context:', weatherError)
    }

    // Group exercises by muscle group, filtered by user equipment
    // Limit to 5 exercises per muscle group to keep prompt size manageable
    const exercisesByMuscle: Record<string, string[]> = {}
    for (const ex of (exercises || []) as any[]) {
      const exEquipment = (ex.equipment || '').toLowerCase()

      // Check if exercise matches user's available equipment
      const includeExercise = userEquipment.some(equip => {
        const equipLower = equip.toLowerCase()
        if (equipLower === 'bodyweight') {
          return exEquipment.includes('bodyweight') || exEquipment === 'none' || exEquipment === ''
        }
        return exEquipment.includes(equipLower)
      })

      if (!includeExercise) continue

      const muscles = ex.primary_muscles || []
      for (const muscle of muscles) {
        if (!exercisesByMuscle[muscle]) exercisesByMuscle[muscle] = []
        // Limit to 5 per muscle group, prioritize compound exercises
        if (exercisesByMuscle[muscle].length < 5 || ex.is_compound) {
          if (exercisesByMuscle[muscle].length >= 5 && ex.is_compound) {
            // Replace a non-compound with compound
            exercisesByMuscle[muscle] = exercisesByMuscle[muscle].slice(0, 4)
          }
          if (exercisesByMuscle[muscle].length < 5) {
            exercisesByMuscle[muscle].push(ex.name)
          }
        }
      }
    }

    const exerciseLibraryText = Object.entries(exercisesByMuscle)
      .map(([muscle, names]) => `${muscle}: ${names.join(', ')}`)
      .join('\n')

    // Calculate 4 weeks from start date for workout generation
    const startDate = new Date(body.start_date)
    const fourWeeksLater = addDays(startDate, 28)
    const workoutEndDate = format(fourWeeksLater, 'yyyy-MM-dd')

    // Build the AI prompt - Galpin persona with hybrid JSON output
    const systemPrompt = `You are Dr. Andy Galpin, an exercise physiologist specializing in periodized training programs. Create a comprehensive, periodized workout schedule based on the athlete's provided data.

Your approach combines deep knowledge of:
- The 9 physiological adaptations and how to train each optimally
- Periodization principles (base, build, peak, taper, recovery phases)
- Evidence-based strength programming (proper volume, frequency, exercise selection)
- Endurance training principles (Zone 2 base, polarized distribution, interval protocols)
- Recovery and fatigue management
- Specific loading parameters (tempo, RPE, percentage of 1RM)
- Assessment protocols and testing frequency
- Injury prevention and exercise substitutions

When designing programs, you:
- Start with the athlete's current fitness level and training history
- Account for their goals, constraints, and available time
- Build progressive phases that create appropriate stimulus
- Include strategic deload weeks for recovery
- Provide specific, actionable workout prescriptions with EXACT loads, tempo, and coaching cues
- Design warmup and cooldown sequences for each workout
- Create assessment checkpoints to track progress
- Provide injury-specific exercise substitutions when relevant
- Include comprehensive recovery protocols

CRITICAL FORMATTING INSTRUCTIONS:
1. Respond with ONLY a valid JSON object
2. Do NOT wrap the response in markdown code blocks (no \`\`\`json)
3. Do NOT include any text before or after the JSON
4. Start your response with { and end with }
5. Ensure all strings are properly escaped
6. BE CONCISE - keep descriptions to 1-2 sentences, coaching_cues to max 2 per exercise
7. Only generate workouts for the first 2 weeks to keep response size manageable`

    const activitiesLabel = body.primary_activities.map(a => ACTIVITY_LABELS[a]).join(', ')

    // Build athlete context from fetched data
    const athleteContextParts: string[] = []
    if (age) athleteContextParts.push(`Age: ${age}`)
    if (profileData?.experience_level) athleteContextParts.push(`Experience: ${profileData.experience_level}`)
    if (profileData?.ftp_watts) athleteContextParts.push(`FTP: ${profileData.ftp_watts}w`)
    if (profileData?.max_hr_bpm) athleteContextParts.push(`Max HR: ${profileData.max_hr_bpm}`)
    if (profileData?.vo2max_ml_kg_min) athleteContextParts.push(`VO2max: ${profileData.vo2max_ml_kg_min}`)
    if (profileData?.resting_hr_baseline) athleteContextParts.push(`Resting HR: ${profileData.resting_hr_baseline}`)

    const athleteContext = `
ATHLETE CONTEXT:
${athleteContextParts.length > 0 ? `- Profile: ${athleteContextParts.join(', ')}` : '- Profile: Not fully set up'}
- Recent training: ${trainingHistorySummary}
- ${strengthSummary}
${journalSummary ? `- Notes from journal:\n${journalSummary}` : ''}`

    // Calculate week dates for first 4 weeks
    const weekDates: string[][] = []
    for (let week = 0; week < 4; week++) {
      const weekStart = addDays(startDate, week * 7)
      const days: string[] = []
      for (let day = 0; day < 7; day++) {
        days.push(format(addDays(weekStart, day), 'yyyy-MM-dd'))
      }
      weekDates.push(days)
    }

    const userPrompt = `Design a comprehensive, periodized training program for me and return as JSON.

## MY DATA

### Current Fitness Profile
${athleteContextParts.length > 0 ? athleteContextParts.join('\n') : 'Profile not fully set up'}

### Training History (Last 12 Weeks)
${trainingHistorySummary}

### Strength Baselines
${strengthSummary}
${journalSummary ? `
### Notes from My Journal (may contain injury info)
${journalSummary}` : ''}

## TRAINING GOALS & PREFERENCES

- Goal: ${body.goal}
- Primary Activities: ${activitiesLabel}
- Weekly Hours Available: ~${body.weekly_hours_available} hours
- Program Start Date: ${body.start_date}
- Program Duration: ${body.end_date ? `Until ${body.end_date}` : '12-16 weeks'}
${body.preferences?.preferred_deload_frequency ? `- Deload Frequency: Every ${body.preferences.preferred_deload_frequency} weeks` : ''}

### Target Events
${body.events && body.events.length > 0
  ? body.events.map(e => `- ${e.name} (${e.event_type}, ${e.priority}-priority) on ${e.date}`).join('\n')
  : 'No specific events - general fitness focus'
}
${body.preferences?.vacation_dates && body.preferences.vacation_dates.length > 0
  ? `
### Blocked Dates (no training)
${body.preferences.vacation_dates.map(v => `- ${v.start} to ${v.end}${v.name ? ` (${v.name})` : ''}`).join('\n')}`
  : ''
}

## AVAILABLE RESOURCES

Equipment: ${userEquipment.join(', ')}

Exercise Library (use EXACT names from this list for strength exercises):
${exerciseLibraryText}
${adaptationProtocol ? `
### Adaptation Protocol (${body.primary_adaptation})
- Reps: ${adaptationProtocol.rep_min}-${adaptationProtocol.rep_max}
- Sets: ${adaptationProtocol.sets_min}-${adaptationProtocol.sets_max}
- Rest: ${Math.round(adaptationProtocol.rest_min/60)}-${Math.round(adaptationProtocol.rest_max/60)} minutes` : ''}
${weatherSummary ? `
### Weather Forecast
${weatherSummary}` : ''}
${body.custom_prompt ? `
### Additional Notes
${body.custom_prompt}` : ''}

---

Return a JSON object with this structure (BE CONCISE - all text fields should be 1-2 sentences max):

{
  "program_philosophy": "Brief 2-3 sentence overview of the program approach.",
  "coaching_notes": "Key focus points in 1-2 sentences.",
  "athlete_profile_snapshot": { "age": 39, "weight_lbs": 200, "vo2max": 45, "max_hr": 185, "squat_1rm": 250, "bench_1rm": 200, "deadlift_1rm": 300, "ohp_1rm": 135, "total_1rm": 750, "injury_notes": "Brief notes" },
  "goal_pathway": { "primary_goal": { "name": "Goal", "current_value": 750, "target_value": 1000, "realistic_end_value": 850, "unit": "lbs", "breakdown": { "squat": { "current": 250, "target": 300, "realistic_end": 275 }, "bench": { "current": 200, "target": 250, "realistic_end": 225 }, "deadlift": { "current": 300, "target": 350, "realistic_end": 325 } } } },
  "plan": { "name": "Plan Name", "description": "Short tagline" },
  "phases": [{ "name": "Phase Name", "phase_type": "base|build|peak|taper|recovery", "description": "Brief purpose", "order_index": 0, "start_date": "YYYY-MM-DD", "end_date": "YYYY-MM-DD", "intensity_focus": "volume", "volume_modifier": 1.0, "intensity_modifier": 0.7, "activity_distribution": { "lifting": 50, "cycling": 50 }, "training_parameters": { "rep_range": "8-15", "intensity_percent": "60-72%" } }],
  "weekly_targets": [{ "phase_index": 0, "targets": [{ "week_number": 1, "week_start_date": "${weekDates[0][0]}", "target_hours": ${body.weekly_hours_available}, "cycling_hours": 3, "running_hours": 0, "swimming_hours": 0, "lifting_sessions": 3, "other_hours": 0, "week_type": "normal" }] }],
  "suggested_workouts": [{ "phase_index": 0, "week_number": 1, "suggested_date": "${weekDates[0][0]}", "day_of_week": "monday", "category": "strength", "workout_type": "full_body", "name": "Full Body A", "description": "Brief", "planned_duration_minutes": 60, "primary_intensity": "mixed", "exercises": [{ "exercise_name": "ExerciseName", "sets": 3, "reps_min": 10, "reps_max": 12, "rest_seconds": 90, "load_type": "rpe", "load_value": 7 }], "cardio_structure": null }],
  "assessments": [{ "assessment_week": 4, "assessment_type": "mid_phase", "tests": [{ "test_name": "Test", "protocol": "Brief" }] }],
  "recovery_protocols": { "sleep": { "target_hours": 8, "recommendations": ["Tip 1"] }, "nutrition": { "protein_g_per_lb": 0.9, "recommendations": ["Tip 1"] }, "pain_management": {} },
  "exercise_substitutions": { "Main Lift": { "knee_pain": ["Alt 1"], "equipment": ["Alt 1"] } },
  "balance_rules": []
}

REQUIREMENTS:
1. PHASES: Create 3-4 phases for full duration (${body.end_date ? `until ${body.end_date}` : '12-16 weeks'}). Include weekly_targets for ALL phases.
2. WORKOUTS: Generate ONLY first 2 weeks (${weekDates[0][0]} to ${weekDates[1][6]}). Use exact exercise names from library. Strength: include exercises array. Cardio: include cardio_structure, set exercises to null.
3. VOLUME: Week total MUST equal ~${body.weekly_hours_available} hours. DO NOT under-program.
4. ASSESSMENTS: Include at weeks 4, 8, 12, 16.
5. FORMAT: day_of_week lowercase (monday, tuesday...). load_type: "percent_1rm"|"rpe"|"weight"|"bodyweight".
6. BE CONCISE: Keep all descriptions to 1-2 sentences. No coaching_cues unless truly necessary. Minimize optional fields.`

    // Call Claude API - use 16384 tokens to avoid streaming requirement
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 16384,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userPrompt },
      ],
    })

    // Extract text response
    const textContent = response.content.find(c => c.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from Claude')
    }

    // Parse JSON response
    let planData: any
    try {
      const responseLength = textContent.text.length
      const stopReason = response.stop_reason
      console.log('AI response: ' + responseLength + ' chars, stop_reason: ' + stopReason)
      console.log('Raw AI response (first 500 chars):', textContent.text.substring(0, 500))
      console.log('Raw AI response (last 200 chars):', textContent.text.substring(responseLength - 200))

      // Check if response was truncated (max_tokens hit)
      if (stopReason === 'max_tokens') {
        console.error('Response was truncated due to max_tokens limit')
        return NextResponse.json(
          { error: 'AI response was too long and got truncated. Please try again.' },
          { status: 500 }
        )
      }

      // Clean up the response - remove markdown code blocks if present
      let jsonText = textContent.text.trim()

      // Remove markdown code blocks (using String.fromCharCode to avoid encoding issues)
      const backtick = String.fromCharCode(96)
      const codeBlockJson = backtick + backtick + backtick + 'json'
      const codeBlock = backtick + backtick + backtick
      if (jsonText.startsWith(codeBlockJson)) {
        jsonText = jsonText.slice(codeBlockJson.length).trim()
        if (jsonText.endsWith(codeBlock)) {
          jsonText = jsonText.slice(0, -codeBlock.length).trim()
        }
      } else if (jsonText.startsWith(codeBlock)) {
        jsonText = jsonText.slice(codeBlock.length).trim()
        if (jsonText.endsWith(codeBlock)) {
          jsonText = jsonText.slice(0, -codeBlock.length).trim()
        }
      }

      // Try to extract JSON from the response (in case there's extra text)
      const jsonMatch = jsonText.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        console.error('No JSON object found in response. Full response:', jsonText.substring(0, 2000))
        throw new Error('No JSON found in response')
      }

      planData = JSON.parse(jsonMatch[0])
      console.log('Successfully parsed JSON with keys:', Object.keys(planData))
    } catch (parseError) {
      console.error('Failed to parse AI response:', textContent.text.substring(0, 1000))
      console.error('Parse error:', parseError)
      return NextResponse.json(
        { error: 'Failed to parse AI response. Please try again.' },
        { status: 500 }
      )
    }

    console.log('AI generated plan:', {
      program_philosophy: planData.program_philosophy?.substring(0, 100) + '...',
      coaching_notes: planData.coaching_notes?.substring(0, 100) + '...',
      plan: planData.plan,
      phases: planData.phases?.length,
      weekly_targets: planData.weekly_targets?.length,
      suggested_workouts: planData.suggested_workouts?.length,
    })

    // Save the plan to database with all enhanced fields
    const { data: createdPlan, error: planError } = await (adminClient as any)
      .from('training_plans')
      .insert({
        user_id: session.user.id,
        name: planData.plan?.name || (body.goal + ' Plan'),
        description: planData.plan?.description || null,
        goal: body.goal,
        start_date: body.start_date,
        end_date: body.end_date || null,
        primary_sport: body.primary_activities[0] || null,
        weekly_hours_target: body.weekly_hours_available,
        status: 'active',
        ai_generated: true,
        ai_prompt: body.custom_prompt || null,
        program_philosophy: planData.program_philosophy || null,
        coaching_notes: planData.coaching_notes || null,
        athlete_profile_snapshot: planData.athlete_profile_snapshot || null,
        goal_pathway: planData.goal_pathway || null,
        recovery_protocols: planData.recovery_protocols || null,
        exercise_substitutions: planData.exercise_substitutions || null,
      })
      .select()
      .single()

    if (planError || !createdPlan) {
      console.error('Error creating plan:', planError)
      return NextResponse.json({ error: 'Failed to save plan' }, { status: 500 })
    }

    // Create phases
    const createdPhases: any[] = []
    if (planData.phases && planData.phases.length > 0) {
      for (const phase of planData.phases) {
        const { data: createdPhase, error: phaseError } = await (adminClient as any)
          .from('training_phases')
          .insert({
            plan_id: createdPlan.id,
            name: phase.name,
            phase_type: phase.phase_type,
            order_index: phase.order_index,
            start_date: phase.start_date,
            end_date: phase.end_date,
            intensity_focus: phase.intensity_focus,
            volume_modifier: phase.volume_modifier || 1.0,
            intensity_modifier: phase.intensity_modifier || 1.0,
            activity_distribution: phase.activity_distribution || {},
            description: phase.description || null,
          })
          .select()
          .single()

        if (phaseError) {
          console.error('Error creating phase:', phaseError)
        } else if (createdPhase) {
          createdPhases.push(createdPhase)
        }
      }
    }

    // Create weekly targets
    if (planData.weekly_targets && planData.weekly_targets.length > 0) {
      for (const phaseTargets of planData.weekly_targets) {
        const phase = createdPhases[phaseTargets.phase_index]
        if (!phase) continue

        for (const target of phaseTargets.targets || []) {
          await (adminClient as any)
            .from('weekly_targets')
            .insert({
              phase_id: phase.id,
              week_number: target.week_number,
              week_start_date: target.week_start_date,
              target_hours: target.target_hours || null,
              cycling_hours: target.cycling_hours || 0,
              running_hours: target.running_hours || 0,
              swimming_hours: target.swimming_hours || 0,
              lifting_sessions: target.lifting_sessions || 0,
              other_hours: target.other_hours || 0,
              zone_distribution: target.zone_distribution || {},
              week_type: target.week_type || 'normal',
              daily_structure: target.daily_structure || {},
            })
        }
      }
    }

    // Create suggested workouts with enhanced fields
    const createdSuggestedWorkouts: any[] = []
    if (planData.suggested_workouts && planData.suggested_workouts.length > 0) {
      for (const workout of planData.suggested_workouts) {
        const phase = createdPhases[workout.phase_index]

        const { data: createdWorkout, error: workoutError } = await (adminClient as any)
          .from('suggested_workouts')
          .insert({
            plan_id: createdPlan.id,
            phase_id: phase?.id || null,
            suggested_date: workout.suggested_date,
            day_of_week: workout.day_of_week,
            category: workout.category,
            workout_type: workout.workout_type,
            name: workout.name,
            description: workout.description || null,
            planned_duration_minutes: workout.planned_duration_minutes,
            primary_intensity: workout.primary_intensity || null,
            planned_tss: workout.planned_tss || null,
            exercises: workout.exercises || null,
            cardio_structure: workout.cardio_structure || null,
            warmup_exercises: workout.warmup_exercises || [],
            cooldown_exercises: workout.cooldown_exercises || [],
            status: 'suggested',
            week_number: workout.week_number,
            order_in_day: 0,
          })
          .select()
          .single()

        if (workoutError) {
          console.error('Error creating suggested workout:', workoutError)
        } else if (createdWorkout) {
          createdSuggestedWorkouts.push(createdWorkout)
        }
      }
      console.log('Created ' + createdSuggestedWorkouts.length + ' suggested workouts')
    }

    // Create events from input
    if (body.events && body.events.length > 0) {
      for (const event of body.events) {
        await (adminClient as any)
          .from('plan_events')
          .insert({
            plan_id: createdPlan.id,
            name: event.name,
            event_type: event.event_type,
            priority: event.priority,
            event_date: event.date,
            sport: event.sport || null,
          })
      }
    }

    // Create vacation events
    if (body.preferences?.vacation_dates) {
      for (const vac of body.preferences.vacation_dates) {
        await (adminClient as any)
          .from('plan_events')
          .insert({
            plan_id: createdPlan.id,
            name: vac.name || 'Vacation',
            event_type: 'vacation',
            priority: 'C',
            event_date: vac.start,
            end_date: vac.end,
            blocks_training: true,
          })
      }
    }

    // Create balance rules
    if (planData.balance_rules && planData.balance_rules.length > 0) {
      for (const rule of planData.balance_rules) {
        await (adminClient as any)
          .from('activity_balance_rules')
          .insert({
            plan_id: createdPlan.id,
            rule_type: rule.rule_type,
            trigger_activity: rule.trigger_activity,
            trigger_phase: rule.trigger_phase || null,
            affected_activity: rule.affected_activity,
            modifier: rule.modifier,
            description: rule.description,
          })
      }
    }

    // Create assessments
    const createdAssessments: any[] = []
    if (planData.assessments && planData.assessments.length > 0) {
      for (const assessment of planData.assessments) {
        // Calculate assessment date based on week number and plan start
        const assessmentDate = format(
          addDays(startDate, (assessment.assessment_week - 1) * 7),
          'yyyy-MM-dd'
        )

        const { data: createdAssessment, error: assessmentError } = await (adminClient as any)
          .from('plan_assessments')
          .insert({
            plan_id: createdPlan.id,
            assessment_week: assessment.assessment_week,
            assessment_date: assessmentDate,
            assessment_type: assessment.assessment_type,
            tests: assessment.tests || [],
            completed: false,
          })
          .select()
          .single()

        if (assessmentError) {
          console.error('Error creating assessment:', assessmentError)
        } else if (createdAssessment) {
          createdAssessments.push(createdAssessment)
        }
      }
      console.log('Created ' + createdAssessments.length + ' assessments')
    }

    // Set as active plan
    await (adminClient as any)
      .from('profiles')
      .update({ active_program_id: createdPlan.id })
      .eq('id', session.user.id)

    // Fetch full plan with relations
    const { data: fullPlan } = await (adminClient as any)
      .from('training_plans')
      .select('*')
      .eq('id', createdPlan.id)
      .single()

    const { data: phases } = await (adminClient as any)
      .from('training_phases')
      .select('*')
      .eq('plan_id', createdPlan.id)
      .order('order_index')

    const phaseIds = (phases || []).map((p: any) => p.id)
    let weeklyTargets: any[] = []
    if (phaseIds.length > 0) {
      const { data: targets } = await (adminClient as any)
        .from('weekly_targets')
        .select('*')
        .in('phase_id', phaseIds)
        .order('week_number')
      weeklyTargets = targets || []
    }

    const { data: events } = await (adminClient as any)
      .from('plan_events')
      .select('*')
      .eq('plan_id', createdPlan.id)
      .order('event_date')

    // Attach weekly targets to phases
    const phasesWithTargets = (phases || []).map((phase: any) => ({
      ...phase,
      weekly_targets: weeklyTargets.filter((t: any) => t.phase_id === phase.id),
    }))

    // Fetch suggested workouts
    const { data: suggestedWorkouts } = await (adminClient as any)
      .from('suggested_workouts')
      .select('*')
      .eq('plan_id', createdPlan.id)
      .order('suggested_date')

    // Fetch assessments
    const { data: assessments } = await (adminClient as any)
      .from('plan_assessments')
      .select('*')
      .eq('plan_id', createdPlan.id)
      .order('assessment_week')

    console.log('Final response:', {
      planId: createdPlan.id,
      phasesCount: phasesWithTargets?.length,
      eventsCount: events?.length,
      suggestedWorkoutsCount: suggestedWorkouts?.length,
      assessmentsCount: assessments?.length,
      hasPhilosophy: !!planData.program_philosophy,
      hasCoachingNotes: !!planData.coaching_notes,
      hasAthleteProfile: !!planData.athlete_profile_snapshot,
      hasGoalPathway: !!planData.goal_pathway,
      hasRecoveryProtocols: !!planData.recovery_protocols,
      hasExerciseSubstitutions: !!planData.exercise_substitutions,
    })

    return NextResponse.json({
      plan: {
        ...fullPlan,
        phases: phasesWithTargets,
        events: events || [],
        suggested_workouts: suggestedWorkouts || [],
        assessments: assessments || [],
      } as TrainingPlan,
      program_philosophy: planData.program_philosophy || '',
      coaching_notes: planData.coaching_notes || '',
    })
  } catch (error) {
    console.error('AI plan generation error:', error)

    if (error instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: 'AI service error: ' + error.message },
        { status: 503 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to generate training plan' },
      { status: 500 }
    )
  }
}
