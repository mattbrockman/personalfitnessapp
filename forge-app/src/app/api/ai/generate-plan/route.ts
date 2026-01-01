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
import { addDays, format, startOfWeek } from 'date-fns'
import { getWeatherForecast, getWeatherSummaryForAI } from '@/lib/weather'

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

    // Fetch weather forecast if user has location set
    let weatherSummary = ''
    try {
      const { data: profile } = await (adminClient as any)
        .from('profiles')
        .select('weather_lat, weather_lon')
        .eq('id', session.user.id)
        .single()

      if (profile?.weather_lat && profile?.weather_lon) {
        const forecast = await getWeatherForecast(
          profile.weather_lat,
          profile.weather_lon,
          14 // 14 days forecast
        )
        weatherSummary = getWeatherSummaryForAI(forecast)
      }
    } catch (weatherError) {
      console.log('Weather fetch failed, continuing without weather context:', weatherError)
    }

    // Group exercises by muscle group for the prompt
    const exercisesByMuscle: Record<string, string[]> = {}
    for (const ex of (exercises || []) as any[]) {
      const muscles = ex.primary_muscles || []
      for (const muscle of muscles) {
        if (!exercisesByMuscle[muscle]) exercisesByMuscle[muscle] = []
        exercisesByMuscle[muscle].push(ex.name)
      }
    }

    const exerciseLibraryText = Object.entries(exercisesByMuscle)
      .map(([muscle, names]) => `${muscle}: ${names.join(', ')}`)
      .join('\n')

    // Calculate 4 weeks from start date for workout generation
    const startDate = new Date(body.start_date)
    const fourWeeksLater = addDays(startDate, 28)
    const workoutEndDate = format(fourWeeksLater, 'yyyy-MM-dd')

    // Build the AI prompt
    const systemPrompt = `You are an expert endurance coach and periodization specialist creating personalized training plans WITH DETAILED WORKOUT PRESCRIPTIONS.

PERIODIZATION PRINCIPLES:
1. Structure phases to peak for "A" priority events
2. Include appropriate base, build, peak, taper, and recovery phases
3. Schedule deload/recovery weeks at the specified frequency
4. Account for cumulative fatigue across multiple activities

MULTI-SPORT BALANCING RULES:
1. When strength training is prioritized (build/peak phase for lifting), reduce cardio volume by 20-40%
2. When building aerobic base, keep lifting to maintenance (40% of normal)
3. Avoid high-intensity work in multiple activities on consecutive days
4. Balance competing energy systems - strength and high-intensity cardio don't mix well

EVENT PEAKING LOGIC:
- A-priority events: 2-week taper, full periodization leading to peak
- B-priority events: 1-week taper, fit within larger training block
- C-priority events: Train through with minor adjustments

PHASE CHARACTERISTICS:
- base: Volume focus (80-100% hours), low intensity, build aerobic foundation
- build: Progressive overload (100-120% hours), increasing intensity
- peak: Highest intensity (80-100% hours), sport-specific work
- taper: Reduced volume (40-60% hours), maintain intensity
- recovery: Low everything (50-70% hours), active recovery
- transition: Between goals, maintain fitness

WEATHER-AWARE SCHEDULING:
When weather forecast is provided:
1. Avoid scheduling outdoor workouts (cycling, running) on days marked [POOR CONDITIONS]
2. Prefer indoor alternatives (trainer rides, treadmill runs, strength training) on bad weather days
3. Move long outdoor sessions to days with better weather when possible
4. Consider temperature extremes - avoid outdoor workouts when temp > 95°F or < 32°F
5. High rain probability (>60%) suggests indoor workout alternatives

WORKOUT GENERATION RULES:
1. Generate SPECIFIC workouts for each training day in the first 4 weeks
2. For STRENGTH workouts:
   - Select exercises from the provided exercise library ONLY
   - Include 4-6 exercises per session
   - Specify sets (2-5), rep ranges (e.g., 6-8 or 10-12), rest periods (60-180 seconds)
   - Base phase = higher reps (10-15), Build phase = moderate (8-12), Peak phase = lower (4-8)
   - Avoid overworking same muscles on consecutive days
   - Split types: upper, lower, full_body
3. For CARDIO workouts (bike/run):
   - Specify ride/run type: steady (Z2), tempo (Z3), intervals, long
   - Include warmup_minutes and cooldown_minutes
   - For intervals: specify duration, intensity (z1-z5), and repeats
   - Match intensity to phase (base = 80% Z2, build = add Z3-4, peak = add Z5)
   - Estimate TSS based on duration and intensity
4. REST days should have no workout entry
5. Deload weeks: reduce volume 40-50%, keep intensity low, fewer exercises per session

VOLUME MODIFIERS: Express as decimal (0.8 = 80%, 1.2 = 120% of base weekly hours)

OUTPUT FORMAT: Return ONLY valid JSON matching the specified structure. No markdown, no explanations outside the JSON.`

    const activitiesLabel = body.primary_activities.map(a => ACTIVITY_LABELS[a]).join(', ')

    const userPrompt = `Create a periodized training plan with DETAILED WORKOUTS for the first 4 weeks.

GOAL: ${body.goal}
PRIMARY ACTIVITIES: ${activitiesLabel}
WEEKLY HOURS AVAILABLE: ${body.weekly_hours_available}
START DATE: ${body.start_date}
END DATE: ${body.end_date || 'Rolling/Open-ended (create ~12 weeks of phases)'}
GENERATE WORKOUTS FOR: ${body.start_date} to ${workoutEndDate} (first 4 weeks)

TARGET EVENTS:
${body.events && body.events.length > 0
  ? body.events.map(e => `- ${e.name} (${e.event_type}, ${e.priority}-priority) on ${e.date}`).join('\n')
  : '- No specific events (general fitness focus)'
}

CONSTRAINTS:
- Deload frequency: Every ${body.preferences?.preferred_deload_frequency || 4} weeks
${body.preferences?.vacation_dates && body.preferences.vacation_dates.length > 0
  ? `- Blocked dates (vacations):\n${body.preferences.vacation_dates.map(v => `  * ${v.start} to ${v.end}${v.name ? ` (${v.name})` : ''}`).join('\n')}`
  : ''
}

AVAILABLE EXERCISES (use ONLY these names for strength workouts):
${exerciseLibraryText}

${adaptationProtocol ? `
PRIMARY ADAPTATION FOCUS: ${body.primary_adaptation}
Evidence-based protocol for ${body.primary_adaptation}:
- Reps: ${adaptationProtocol.rep_min}-${adaptationProtocol.rep_max}
- Sets: ${adaptationProtocol.sets_min}-${adaptationProtocol.sets_max}
- Rest: ${Math.round(adaptationProtocol.rest_min/60)}-${Math.round(adaptationProtocol.rest_max/60)} minutes
- Intensity: ${adaptationProtocol.intensity_min || 'varies'}-${adaptationProtocol.intensity_max || 'varies'}% ${adaptationProtocol.intensity_unit}
- Tempo: ${adaptationProtocol.default_tempo || 'controlled'}
- Sessions/week: ${adaptationProtocol.sessions_per_week_min}-${adaptationProtocol.sessions_per_week_max}
- Notes: ${adaptationProtocol.exercise_selection_notes || 'N/A'}

IMPORTANT: For strength workouts, use these rep/set/rest parameters when designing exercises.
` : ''}
${secondaryProtocol ? `
SECONDARY ADAPTATION: ${body.secondary_adaptation}
Protocol: ${secondaryProtocol.rep_min}-${secondaryProtocol.rep_max} reps, ${secondaryProtocol.sets_min}-${secondaryProtocol.sets_max} sets
Incorporate some exercises following this secondary protocol, especially for accessory work.
` : ''}
${weatherSummary ? `
${weatherSummary}

IMPORTANT: Use this weather data when scheduling outdoor workouts in the first 2 weeks. Schedule outdoor rides and runs on days with good weather, and prefer indoor alternatives on bad weather days.
` : ''}
${body.custom_prompt ? `ADDITIONAL INSTRUCTIONS:\n${body.custom_prompt}` : ''}

Return a JSON object with this EXACT structure:
{
  "plan": {
    "name": "<descriptive plan name>",
    "description": "<1-2 sentence summary>",
    "goal": "${body.goal}",
    "start_date": "${body.start_date}",
    "end_date": "<calculated end date or null for rolling>",
    "primary_sport": "<main focus activity>",
    "weekly_hours_target": ${body.weekly_hours_available}
  },
  "phases": [
    {
      "name": "<phase name>",
      "phase_type": "<base|build|peak|taper|recovery|transition>",
      "order_index": 0,
      "start_date": "<YYYY-MM-DD>",
      "end_date": "<YYYY-MM-DD>",
      "intensity_focus": "<volume|intensity|speed|strength|recovery>",
      "volume_modifier": 1.0,
      "intensity_modifier": 1.0,
      "activity_distribution": {
        "cycling": 40,
        "lifting": 30,
        "running": 20,
        "rest": 10
      },
      "description": "<phase focus description>"
    }
  ],
  "weekly_targets": [
    {
      "phase_index": 0,
      "targets": [
        {
          "week_number": 1,
          "week_start_date": "<YYYY-MM-DD>",
          "target_hours": 8,
          "cycling_hours": 3,
          "running_hours": 2,
          "swimming_hours": 0,
          "lifting_sessions": 3,
          "other_hours": 1,
          "zone_distribution": {"z1": 20, "z2": 60, "z3": 15, "z4": 5},
          "week_type": "<normal|build|recovery|deload|race>",
          "daily_structure": {
            "monday": "lifting",
            "tuesday": "cycling_z2",
            "wednesday": "rest",
            "thursday": "lifting",
            "friday": "running_easy",
            "saturday": "cycling_long",
            "sunday": "rest"
          }
        }
      ]
    }
  ],
  "suggested_workouts": [
    {
      "phase_index": 0,
      "week_number": 1,
      "day_of_week": "monday",
      "suggested_date": "2025-01-06",
      "category": "strength",
      "workout_type": "lower",
      "name": "Lower Body Strength",
      "description": "Heavy leg day focusing on squat and hip hinge patterns",
      "planned_duration_minutes": 60,
      "primary_intensity": "mixed",
      "exercises": [
        {"exercise_name": "Barbell Back Squat", "sets": 4, "reps_min": 8, "reps_max": 10, "rest_seconds": 180, "notes": "Focus on depth"},
        {"exercise_name": "Romanian Deadlift", "sets": 3, "reps_min": 10, "reps_max": 12, "rest_seconds": 120},
        {"exercise_name": "Leg Press", "sets": 3, "reps_min": 12, "reps_max": 15, "rest_seconds": 90},
        {"exercise_name": "Leg Curl", "sets": 3, "reps_min": 12, "reps_max": 15, "rest_seconds": 60}
      ]
    },
    {
      "phase_index": 0,
      "week_number": 1,
      "day_of_week": "tuesday",
      "suggested_date": "2025-01-07",
      "category": "cardio",
      "workout_type": "bike",
      "name": "Z2 Endurance Ride",
      "description": "Easy aerobic base building ride",
      "planned_duration_minutes": 90,
      "primary_intensity": "z2",
      "planned_tss": 70,
      "cardio_structure": {
        "type": "steady",
        "warmup_minutes": 10,
        "main_set": [{"duration_minutes": 70, "intensity": "z2"}],
        "cooldown_minutes": 10
      }
    },
    {
      "phase_index": 0,
      "week_number": 1,
      "day_of_week": "thursday",
      "suggested_date": "2025-01-09",
      "category": "cardio",
      "workout_type": "bike",
      "name": "VO2max Intervals",
      "description": "High intensity intervals for aerobic power",
      "planned_duration_minutes": 60,
      "primary_intensity": "z5",
      "planned_tss": 85,
      "cardio_structure": {
        "type": "intervals",
        "warmup_minutes": 15,
        "main_set": [
          {"duration_minutes": 3, "intensity": "z5", "repeats": 5},
          {"duration_minutes": 3, "intensity": "z1"}
        ],
        "cooldown_minutes": 15
      }
    }
  ],
  "balance_rules": [
    {
      "rule_type": "reduce_when",
      "trigger_activity": "lifting",
      "trigger_phase": "build",
      "affected_activity": "cycling",
      "modifier": 0.7,
      "description": "Reduce cycling 30% during strength building phases"
    }
  ],
  "reasoning": "<2-3 sentences explaining the periodization strategy>"
}

CRITICAL REQUIREMENTS:
- Generate suggested_workouts for EVERY training day in the first 4 weeks (not rest days)
- Use ONLY exercise names from the AVAILABLE EXERCISES list above
- Ensure all dates are valid YYYY-MM-DD format
- Week start dates should be Mondays
- Activity distribution should sum to 100
- Generate 4-12 phases depending on plan duration
- Each phase should have 2-4 weeks typically
- For cardio, estimate TSS (rule of thumb: Z2 ~0.8 TSS/min, Z3 ~1.0, Z4 ~1.2, Z5 ~1.5)`

    // Call Claude API - increased tokens for workout details
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

    // Parse JSON
    let planData: AIGeneratePlanResponseWithWorkouts
    try {
      const jsonMatch = textContent.text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('No JSON found in response')
      }
      planData = JSON.parse(jsonMatch[0])
    } catch (parseError) {
      console.error('Failed to parse AI response:', textContent.text)
      return NextResponse.json(
        { error: 'Failed to parse AI response. Please try again.' },
        { status: 500 }
      )
    }

    console.log('AI generated plan structure:', {
      phases: planData.phases?.length,
      weekly_targets: planData.weekly_targets?.length,
      suggested_workouts: planData.suggested_workouts?.length,
    })

    // Save the plan to database
    // Note: Using 'as any' because training_plans table is new and not in generated types yet
    const { data: createdPlan, error: planError } = await (adminClient as any)
      .from('training_plans')
      .insert({
        user_id: session.user.id,
        name: planData.plan.name,
        description: planData.plan.description,
        goal: planData.plan.goal,
        start_date: planData.plan.start_date,
        end_date: planData.plan.end_date || null,
        primary_sport: planData.plan.primary_sport,
        weekly_hours_target: planData.plan.weekly_hours_target,
        status: 'active',
        ai_generated: true,
        ai_prompt: body.custom_prompt || null,
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
            volume_modifier: phase.volume_modifier,
            intensity_modifier: phase.intensity_modifier,
            activity_distribution: phase.activity_distribution,
            description: phase.description,
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

        for (const target of phaseTargets.targets) {
          await (adminClient as any)
            .from('weekly_targets')
            .insert({
              phase_id: phase.id,
              week_number: target.week_number,
              week_start_date: target.week_start_date,
              target_hours: target.target_hours,
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

    // Create suggested workouts
    const createdSuggestedWorkouts: any[] = []
    if (planData.suggested_workouts && planData.suggested_workouts.length > 0) {
      for (const workout of planData.suggested_workouts) {
        // Find the phase for this workout
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
            description: workout.description,
            planned_duration_minutes: workout.planned_duration_minutes,
            primary_intensity: workout.primary_intensity || null,
            planned_tss: workout.planned_tss || null,
            exercises: workout.exercises || null,
            cardio_structure: workout.cardio_structure || null,
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
      console.log(`Created ${createdSuggestedWorkouts.length} suggested workouts`)
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

    return NextResponse.json({
      plan: {
        ...fullPlan,
        phases: phasesWithTargets,
        events: events || [],
        suggested_workouts: suggestedWorkouts || [],
      } as TrainingPlan,
      reasoning: planData.reasoning,
    })
  } catch (error) {
    console.error('AI plan generation error:', error)

    if (error instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `AI service error: ${error.message}` },
        { status: 503 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to generate training plan' },
      { status: 500 }
    )
  }
}
