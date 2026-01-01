// AI Tool Handlers - Execute tool calls against the database
import { format } from 'date-fns'
import {
  ToolName,
  ToolResult,
  ModifyWorkoutExerciseInput,
  RescheduleWorkoutInput,
  SkipWorkoutInput,
  AddWorkoutInput,
  LogSleepInput,
  LogMealInput,
  LogBodyCompInput,
  LogReadinessInput,
  GetWorkoutDetailsInput,
  FindExerciseAlternativesInput,
} from '@/types/ai-tools'

type ToolInput = Record<string, any>

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any

// Main handler dispatcher
export async function executeToolHandler(
  toolName: ToolName,
  input: ToolInput,
  userId: string,
  supabase: SupabaseClient
): Promise<ToolResult> {
  try {
    switch (toolName) {
      case 'modify_workout_exercise':
        return await handleModifyWorkoutExercise(input as ModifyWorkoutExerciseInput, userId, supabase)
      case 'reschedule_workout':
        return await handleRescheduleWorkout(input as RescheduleWorkoutInput, userId, supabase)
      case 'skip_workout':
        return await handleSkipWorkout(input as SkipWorkoutInput, userId, supabase)
      case 'add_workout':
        return await handleAddWorkout(input as AddWorkoutInput, userId, supabase)
      case 'log_sleep':
        return await handleLogSleep(input as LogSleepInput, userId, supabase)
      case 'log_meal':
        return await handleLogMeal(input as LogMealInput, userId, supabase)
      case 'log_body_comp':
        return await handleLogBodyComp(input as LogBodyCompInput, userId, supabase)
      case 'log_readiness':
        return await handleLogReadiness(input as LogReadinessInput, userId, supabase)
      case 'get_workout_details':
        return await handleGetWorkoutDetails(input as GetWorkoutDetailsInput, userId, supabase)
      case 'find_exercise_alternatives':
        return await handleFindExerciseAlternatives(input as FindExerciseAlternativesInput, supabase)
      default:
        return { success: false, message: `Unknown tool: ${toolName}` }
    }
  } catch (error: any) {
    console.error(`Tool execution error (${toolName}):`, error)
    return { success: false, message: error.message || 'Tool execution failed', error: error.message }
  }
}

// ============ WORKOUT MODIFICATION HANDLERS ============

async function handleModifyWorkoutExercise(
  input: ModifyWorkoutExerciseInput,
  userId: string,
  supabase: SupabaseClient
): Promise<ToolResult> {
  // First try suggested_workouts table
  const { data: suggestedWorkout, error: swError } = await supabase
    .from('suggested_workouts')
    .select('id, exercises, plan_id')
    .eq('id', input.workout_id)
    .single()

  if (suggestedWorkout && suggestedWorkout.exercises) {
    // Verify user owns this workout via plan
    const { data: plan } = await supabase
      .from('training_plans')
      .select('user_id')
      .eq('id', suggestedWorkout.plan_id)
      .single()

    if (!plan || plan.user_id !== userId) {
      return { success: false, message: 'Workout not found or access denied' }
    }

    // Modify the exercise in the exercises array
    const exercises = suggestedWorkout.exercises as any[]
    const exerciseIndex = exercises.findIndex(
      (ex: any) => ex.exercise_name?.toLowerCase() === input.original_exercise.toLowerCase()
    )

    if (exerciseIndex === -1) {
      return {
        success: false,
        message: `Exercise "${input.original_exercise}" not found in workout`,
      }
    }

    // Update the exercise
    exercises[exerciseIndex] = {
      ...exercises[exerciseIndex],
      exercise_name: input.new_exercise,
      ...(input.sets !== undefined && { sets: input.sets }),
      ...(input.reps_min !== undefined && { reps_min: input.reps_min }),
      ...(input.reps_max !== undefined && { reps_max: input.reps_max }),
      ...(input.notes && { notes: input.notes }),
      modification_reason: input.reason,
    }

    // Save back to database
    const { error: updateError } = await supabase
      .from('suggested_workouts')
      .update({ exercises, updated_at: new Date().toISOString() })
      .eq('id', input.workout_id)

    if (updateError) {
      return { success: false, message: `Failed to update workout: ${updateError.message}` }
    }

    return {
      success: true,
      message: `Swapped "${input.original_exercise}" with "${input.new_exercise}" (Reason: ${input.reason})`,
      data: { modified_exercise: exercises[exerciseIndex] },
    }
  }

  // Try regular workouts table
  const { data: workout, error: wError } = await supabase
    .from('workouts')
    .select('id, exercises, user_id')
    .eq('id', input.workout_id)
    .eq('user_id', userId)
    .single()

  if (!workout) {
    return { success: false, message: 'Workout not found' }
  }

  // Similar logic for regular workouts
  const exercises = (workout.exercises as any[]) || []
  const exerciseIndex = exercises.findIndex(
    (ex: any) => ex.exercise_name?.toLowerCase() === input.original_exercise.toLowerCase()
  )

  if (exerciseIndex === -1) {
    return {
      success: false,
      message: `Exercise "${input.original_exercise}" not found in workout`,
    }
  }

  exercises[exerciseIndex] = {
    ...exercises[exerciseIndex],
    exercise_name: input.new_exercise,
    ...(input.sets !== undefined && { sets: input.sets }),
    ...(input.reps_min !== undefined && { reps_min: input.reps_min }),
    ...(input.reps_max !== undefined && { reps_max: input.reps_max }),
    ...(input.notes && { notes: input.notes }),
    modification_reason: input.reason,
  }

  const { error: updateError } = await supabase
    .from('workouts')
    .update({ exercises, updated_at: new Date().toISOString() })
    .eq('id', input.workout_id)

  if (updateError) {
    return { success: false, message: `Failed to update workout: ${updateError.message}` }
  }

  return {
    success: true,
    message: `Swapped "${input.original_exercise}" with "${input.new_exercise}" (Reason: ${input.reason})`,
    data: { modified_exercise: exercises[exerciseIndex] },
  }
}

async function handleRescheduleWorkout(
  input: RescheduleWorkoutInput,
  userId: string,
  supabase: SupabaseClient
): Promise<ToolResult> {
  // Try suggested_workouts first
  const { data: suggestedWorkout } = await supabase
    .from('suggested_workouts')
    .select('id, suggested_date, plan_id')
    .eq('id', input.workout_id)
    .single()

  if (suggestedWorkout) {
    // Verify ownership via plan
    const { data: plan } = await supabase
      .from('training_plans')
      .select('user_id')
      .eq('id', suggestedWorkout.plan_id)
      .single()

    if (!plan || plan.user_id !== userId) {
      return { success: false, message: 'Workout not found or access denied' }
    }

    const oldDate = suggestedWorkout.suggested_date
    const newDayOfWeek = format(new Date(input.new_date), 'EEEE').toLowerCase()

    const { error } = await supabase
      .from('suggested_workouts')
      .update({
        suggested_date: input.new_date,
        day_of_week: newDayOfWeek,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.workout_id)

    if (error) {
      return { success: false, message: `Failed to reschedule: ${error.message}` }
    }

    return {
      success: true,
      message: `Moved workout from ${oldDate} to ${input.new_date} (Reason: ${input.reason})`,
    }
  }

  // Try regular workouts
  const { data: workout } = await supabase
    .from('workouts')
    .select('id, scheduled_date')
    .eq('id', input.workout_id)
    .eq('user_id', userId)
    .single()

  if (!workout) {
    return { success: false, message: 'Workout not found' }
  }

  const oldDate = workout.scheduled_date

  const { error } = await supabase
    .from('workouts')
    .update({
      scheduled_date: input.new_date,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.workout_id)

  if (error) {
    return { success: false, message: `Failed to reschedule: ${error.message}` }
  }

  return {
    success: true,
    message: `Moved workout from ${oldDate} to ${input.new_date} (Reason: ${input.reason})`,
  }
}

async function handleSkipWorkout(
  input: SkipWorkoutInput,
  userId: string,
  supabase: SupabaseClient
): Promise<ToolResult> {
  // Try suggested_workouts
  const { data: suggestedWorkout } = await supabase
    .from('suggested_workouts')
    .select('id, name, plan_id')
    .eq('id', input.workout_id)
    .single()

  if (suggestedWorkout) {
    const { data: plan } = await supabase
      .from('training_plans')
      .select('user_id')
      .eq('id', suggestedWorkout.plan_id)
      .single()

    if (!plan || plan.user_id !== userId) {
      return { success: false, message: 'Workout not found or access denied' }
    }

    const { error } = await supabase
      .from('suggested_workouts')
      .update({ status: 'skipped', updated_at: new Date().toISOString() })
      .eq('id', input.workout_id)

    if (error) {
      return { success: false, message: `Failed to skip workout: ${error.message}` }
    }

    return {
      success: true,
      message: `Marked "${suggestedWorkout.name}" as skipped (Reason: ${input.reason})`,
    }
  }

  // Try regular workouts
  const { data: workout } = await supabase
    .from('workouts')
    .select('id, name')
    .eq('id', input.workout_id)
    .eq('user_id', userId)
    .single()

  if (!workout) {
    return { success: false, message: 'Workout not found' }
  }

  const { error } = await supabase
    .from('workouts')
    .update({ status: 'skipped', updated_at: new Date().toISOString() })
    .eq('id', input.workout_id)

  if (error) {
    return { success: false, message: `Failed to skip workout: ${error.message}` }
  }

  return {
    success: true,
    message: `Marked "${workout.name}" as skipped (Reason: ${input.reason})`,
  }
}

async function handleAddWorkout(
  input: AddWorkoutInput,
  userId: string,
  supabase: SupabaseClient
): Promise<ToolResult> {
  // Debug: Log what we received
  console.log('add_workout input:', JSON.stringify(input, null, 2))
  console.log('exercises count:', input.exercises?.length || 0)

  // Get user's active training plan
  const { data: profile, error: profileFetchError } = await supabase
    .from('profiles')
    .select('active_program_id')
    .eq('id', userId)
    .single()

  console.log('[add_workout] profile fetch:', { profile, error: profileFetchError?.message })

  const planId = profile?.active_program_id
  console.log('[add_workout] active_program_id:', planId)

  if (planId) {
    console.log('[add_workout] PATH A: Adding to existing plan', planId)
    // Add as suggested workout
    const dayOfWeek = format(new Date(input.date), 'EEEE').toLowerCase()

    const { data: newWorkout, error } = await supabase
      .from('suggested_workouts')
      .insert({
        plan_id: planId,
        suggested_date: input.date,
        day_of_week: dayOfWeek,
        category: input.category,
        workout_type: input.workout_type,
        name: input.name,
        description: input.description || null,
        planned_duration_minutes: input.duration_minutes || 60,
        exercises: input.exercises || null,
        status: 'suggested',
      })
      .select()
      .single()

    if (error) {
      return { success: false, message: `Failed to add workout: ${error.message}` }
    }

    return {
      success: true,
      message: `Added "${input.name}" on ${input.date}`,
      data: newWorkout,
    }
  }

  // No active plan - create a training plan first, then add as suggested workout
  // This ensures exercises are properly stored
  console.log('[add_workout] PATH B: No active plan, creating new plan...')
  const { data: newPlan, error: planError } = await supabase
    .from('training_plans')
    .insert({
      user_id: userId,
      name: 'My Training Plan',
      goal: 'General fitness',
      status: 'active',
    })
    .select('id')
    .single()

  if (planError) {
    // Fall back to regular workout without exercises
    console.log('[add_workout] PATH C: Plan creation FAILED, falling back to workouts table')
    console.log('[add_workout] planError:', planError.message, planError.code)
    const { data: newWorkout, error } = await supabase
      .from('workouts')
      .insert({
        user_id: userId,
        scheduled_date: input.date,
        category: input.category,
        workout_type: input.workout_type,
        name: input.name,
        description: input.exercises ? `Exercises: ${input.exercises.map((e: any) => `${e.exercise_name} ${e.sets}x${e.reps_min}-${e.reps_max}`).join(', ')}` : input.description,
        planned_duration_minutes: input.duration_minutes || 60,
        status: 'planned',
      })
      .select()
      .single()

    if (error) {
      return { success: false, message: `Failed to add workout: ${error.message}` }
    }

    return {
      success: true,
      message: `Added "${input.name}" on ${input.date}`,
      data: newWorkout,
    }
  }

  // CRITICAL: Update profile with active plan BEFORE inserting workout
  // This fixes race condition where fetches happen before profile is updated
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ active_program_id: newPlan.id })
    .eq('id', userId)

  if (profileError) {
    console.error('Failed to update profile active_program_id:', profileError)
  }

  console.log('[add_workout] PATH B SUCCESS: Created plan', newPlan.id)

  // Now add as suggested workout with exercises
  const dayOfWeek = format(new Date(input.date), 'EEEE').toLowerCase()
  console.log('[add_workout] Inserting into suggested_workouts with exercises:', input.exercises?.length)

  const { data: newWorkout, error } = await supabase
    .from('suggested_workouts')
    .insert({
      plan_id: newPlan.id,
      suggested_date: input.date,
      day_of_week: dayOfWeek,
      category: input.category,
      workout_type: input.workout_type,
      name: input.name,
      description: input.description || null,
      planned_duration_minutes: input.duration_minutes || 60,
      exercises: input.exercises || null,
      status: 'suggested',
    })
    .select()
    .single()

  if (error) {
    console.log('[add_workout] suggested_workouts insert FAILED:', error.message)
    return { success: false, message: `Failed to add workout: ${error.message}` }
  }

  console.log('[add_workout] SUCCESS: Workout added to suggested_workouts with id:', newWorkout.id)

  return {
    success: true,
    message: `Added "${input.name}" on ${input.date}`,
    data: newWorkout,
  }
}

// ============ DATA LOGGING HANDLERS ============

async function handleLogSleep(
  input: LogSleepInput,
  userId: string,
  supabase: SupabaseClient
): Promise<ToolResult> {
  // Calculate total sleep if bedtime/wake_time provided
  let totalSleepMinutes = input.total_sleep_minutes
  if (!totalSleepMinutes && input.bedtime && input.wake_time) {
    const [bedH, bedM] = input.bedtime.split(':').map(Number)
    const [wakeH, wakeM] = input.wake_time.split(':').map(Number)
    let minutes = (wakeH * 60 + wakeM) - (bedH * 60 + bedM)
    if (minutes < 0) minutes += 24 * 60 // Handle overnight
    totalSleepMinutes = minutes
  }

  const { data, error } = await supabase
    .from('sleep_logs')
    .upsert({
      user_id: userId,
      log_date: input.log_date,
      bedtime: input.bedtime || null,
      wake_time: input.wake_time || null,
      total_sleep_minutes: totalSleepMinutes || null,
      sleep_score: input.sleep_score || null,
      hrv_avg: input.hrv_avg || null,
      resting_hr: input.resting_hr || null,
      notes: input.notes || null,
      source: 'manual',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,log_date' })
    .select()
    .single()

  if (error) {
    return { success: false, message: `Failed to log sleep: ${error.message}` }
  }

  const hoursStr = totalSleepMinutes
    ? `${Math.floor(totalSleepMinutes / 60)}h ${totalSleepMinutes % 60}m`
    : 'sleep data'

  return {
    success: true,
    message: `Logged ${hoursStr} of sleep for ${input.log_date}`,
    data,
  }
}

async function handleLogMeal(
  input: LogMealInput,
  userId: string,
  supabase: SupabaseClient
): Promise<ToolResult> {
  // First ensure nutrition_log exists for this date
  const { data: existingLog } = await supabase
    .from('nutrition_logs')
    .select('id')
    .eq('user_id', userId)
    .eq('log_date', input.log_date)
    .single()

  let nutritionLogId = existingLog?.id

  if (!nutritionLogId) {
    const { data: newLog, error: logError } = await supabase
      .from('nutrition_logs')
      .insert({
        user_id: userId,
        log_date: input.log_date,
        total_calories: 0,
        total_protein_g: 0,
        total_carbs_g: 0,
        total_fat_g: 0,
      })
      .select('id')
      .single()

    if (logError) {
      return { success: false, message: `Failed to create nutrition log: ${logError.message}` }
    }
    nutritionLogId = newLog.id
  }

  // Add the food item
  const { data: food, error: foodError } = await supabase
    .from('nutrition_foods')
    .insert({
      nutrition_log_id: nutritionLogId,
      meal_type: input.meal_type,
      food_name: input.food_name,
      serving_size: input.serving_size || null,
      calories: input.calories || null,
      protein_g: input.protein_g || null,
      carbs_g: input.carbs_g || null,
      fat_g: input.fat_g || null,
      fiber_g: input.fiber_g || null,
      source: 'manual',
    })
    .select()
    .single()

  if (foodError) {
    return { success: false, message: `Failed to log food: ${foodError.message}` }
  }

  return {
    success: true,
    message: `Logged ${input.food_name} for ${input.meal_type}${input.calories ? ` (${input.calories} cal)` : ''}`,
    data: food,
  }
}

async function handleLogBodyComp(
  input: LogBodyCompInput,
  userId: string,
  supabase: SupabaseClient
): Promise<ToolResult> {
  // Calculate lean mass if weight and body fat provided
  let leanMass = input.lean_mass_lbs
  if (!leanMass && input.weight_lbs && input.body_fat_pct) {
    leanMass = input.weight_lbs * (1 - input.body_fat_pct / 100)
  }

  const { data, error } = await supabase
    .from('body_composition_logs')
    .upsert({
      user_id: userId,
      log_date: input.log_date,
      weight_lbs: input.weight_lbs || null,
      body_fat_pct: input.body_fat_pct || null,
      lean_mass_lbs: leanMass || null,
      muscle_mass_lbs: input.muscle_mass_lbs || null,
      source: input.source || 'manual',
      notes: input.notes || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,log_date' })
    .select()
    .single()

  if (error) {
    return { success: false, message: `Failed to log body composition: ${error.message}` }
  }

  const parts = []
  if (input.weight_lbs) parts.push(`${input.weight_lbs} lbs`)
  if (input.body_fat_pct) parts.push(`${input.body_fat_pct}% body fat`)

  return {
    success: true,
    message: `Logged body composition: ${parts.join(', ') || 'data recorded'}`,
    data,
  }
}

async function handleLogReadiness(
  input: LogReadinessInput,
  userId: string,
  supabase: SupabaseClient
): Promise<ToolResult> {
  const { data, error } = await supabase
    .from('readiness_assessments')
    .upsert({
      user_id: userId,
      date: input.date,
      subjective_readiness: input.subjective_readiness,
      sleep_quality: input.sleep_quality || null,
      sleep_hours: input.sleep_hours || null,
      muscle_soreness: input.muscle_soreness || null,
      stress_level: input.stress_level || null,
      notes: input.notes || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,date' })
    .select()
    .single()

  if (error) {
    return { success: false, message: `Failed to log readiness: ${error.message}` }
  }

  return {
    success: true,
    message: `Logged readiness ${input.subjective_readiness}/10 for ${input.date}`,
    data,
  }
}

// ============ QUERY HANDLERS ============

async function handleGetWorkoutDetails(
  input: GetWorkoutDetailsInput,
  userId: string,
  supabase: SupabaseClient
): Promise<ToolResult> {
  if (input.workout_id) {
    // Try suggested_workouts
    const { data: suggestedWorkout } = await supabase
      .from('suggested_workouts')
      .select('*, training_plans!inner(user_id)')
      .eq('id', input.workout_id)
      .single()

    if (suggestedWorkout) {
      if ((suggestedWorkout as any).training_plans?.user_id !== userId) {
        return { success: false, message: 'Workout not found or access denied' }
      }
      return {
        success: true,
        message: `Found workout: ${suggestedWorkout.name}`,
        data: {
          id: suggestedWorkout.id,
          name: suggestedWorkout.name,
          date: suggestedWorkout.suggested_date,
          category: suggestedWorkout.category,
          workout_type: suggestedWorkout.workout_type,
          duration_minutes: suggestedWorkout.planned_duration_minutes,
          exercises: suggestedWorkout.exercises,
          description: suggestedWorkout.description,
          status: suggestedWorkout.status,
        },
      }
    }

    // Try regular workouts
    const { data: workout } = await supabase
      .from('workouts')
      .select('*')
      .eq('id', input.workout_id)
      .eq('user_id', userId)
      .single()

    if (workout) {
      return {
        success: true,
        message: `Found workout: ${workout.name}`,
        data: workout,
      }
    }

    return { success: false, message: 'Workout not found' }
  }

  if (input.date) {
    // Find workouts by date
    const { data: suggestedWorkouts } = await supabase
      .from('suggested_workouts')
      .select('*, training_plans!inner(user_id)')
      .eq('suggested_date', input.date)
      .eq('training_plans.user_id', userId)

    const { data: regularWorkouts } = await supabase
      .from('workouts')
      .select('*')
      .eq('scheduled_date', input.date)
      .eq('user_id', userId)

    const allWorkouts = [
      ...(suggestedWorkouts || []).map((sw: any) => ({
        id: sw.id,
        name: sw.name,
        date: sw.suggested_date,
        category: sw.category,
        workout_type: sw.workout_type,
        duration_minutes: sw.planned_duration_minutes,
        exercises: sw.exercises,
        description: sw.description,
        status: sw.status,
        type: 'suggested',
      })),
      ...(regularWorkouts || []).map((w: any) => ({
        id: w.id,
        name: w.name,
        date: w.scheduled_date,
        category: w.category,
        workout_type: w.workout_type,
        duration_minutes: w.planned_duration_minutes,
        exercises: w.exercises,
        status: w.status,
        type: 'regular',
      })),
    ]

    if (allWorkouts.length === 0) {
      return { success: false, message: `No workouts found for ${input.date}` }
    }

    return {
      success: true,
      message: `Found ${allWorkouts.length} workout(s) on ${input.date}`,
      data: allWorkouts,
    }
  }

  return { success: false, message: 'Please provide workout_id or date' }
}

async function handleFindExerciseAlternatives(
  input: FindExerciseAlternativesInput,
  supabase: SupabaseClient
): Promise<ToolResult> {
  // Get the original exercise to find its muscle groups
  const { data: originalExercise } = await supabase
    .from('exercises')
    .select('primary_muscles, equipment')
    .ilike('name', input.exercise_name)
    .single()

  const targetMuscles = input.muscle_group
    ? [input.muscle_group]
    : originalExercise?.primary_muscles || []

  if (targetMuscles.length === 0) {
    return { success: false, message: `Could not find muscle group for "${input.exercise_name}"` }
  }

  // Find alternatives with same primary muscles
  const { data: alternatives } = await supabase
    .from('exercises')
    .select('name, primary_muscles, equipment, difficulty')
    .contains('primary_muscles', targetMuscles)
    .neq('name', input.exercise_name)
    .limit(10)

  if (!alternatives || alternatives.length === 0) {
    return {
      success: false,
      message: `No alternatives found for "${input.exercise_name}" targeting ${targetMuscles.join(', ')}`,
    }
  }

  // Filter by constraint if provided
  let filtered = alternatives
  if (input.constraint) {
    const constraintLower = input.constraint.toLowerCase()

    // Filter based on common constraints
    if (constraintLower.includes('knee')) {
      // Avoid exercises that heavily load the knee
      filtered = alternatives.filter((ex: any) =>
        !['squat', 'lunge', 'leg press', 'leg extension'].some(term =>
          ex.name.toLowerCase().includes(term)
        )
      )
    } else if (constraintLower.includes('shoulder')) {
      filtered = alternatives.filter((ex: any) =>
        !['overhead', 'press', 'raise'].some(term =>
          ex.name.toLowerCase().includes(term)
        )
      )
    } else if (constraintLower.includes('back') || constraintLower.includes('spine')) {
      filtered = alternatives.filter((ex: any) =>
        !['deadlift', 'row', 'good morning'].some(term =>
          ex.name.toLowerCase().includes(term)
        )
      )
    } else if (constraintLower.includes('no barbell')) {
      filtered = alternatives.filter((ex: any) =>
        !ex.equipment?.toLowerCase().includes('barbell')
      )
    } else if (constraintLower.includes('no machine')) {
      filtered = alternatives.filter((ex: any) =>
        !ex.equipment?.toLowerCase().includes('machine')
      )
    } else if (constraintLower.includes('bodyweight')) {
      filtered = alternatives.filter((ex: any) =>
        ex.equipment?.toLowerCase().includes('bodyweight') || !ex.equipment
      )
    }
  }

  return {
    success: true,
    message: `Found ${filtered.length} alternatives for "${input.exercise_name}"`,
    data: {
      original: input.exercise_name,
      target_muscles: targetMuscles,
      constraint: input.constraint || null,
      alternatives: filtered.map((ex: any) => ({
        name: ex.name,
        equipment: ex.equipment,
        difficulty: ex.difficulty,
      })),
    },
  }
}
