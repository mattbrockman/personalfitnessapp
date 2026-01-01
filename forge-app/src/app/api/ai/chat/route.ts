import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import { format, subDays } from 'date-fns'
import { AI_TOOLS, requiresConfirmation } from '@/lib/ai-tools'
import { executeToolHandler } from '@/lib/ai-tool-handlers'
import { ToolName, ToolResult, PendingAction, AIChatResponse } from '@/types/ai-tools'
import { randomUUID } from 'crypto'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// Personality guides for different coach styles
const PERSONALITY_GUIDES: Record<string, string> = {
  coach: `You are a direct, motivating coach. Use "we" language to build partnership. Be encouraging but honest. Push when appropriate, but respect recovery needs. Keep advice actionable and specific.`,
  scientist: `You are an evidence-based sports scientist. Cite training principles when relevant (periodization, progressive overload, supercompensation). Be analytical and precise. Explain the "why" behind recommendations.`,
  friend: `You are a knowledgeable, supportive training buddy. Be conversational and encouraging. Celebrate wins, empathize with struggles. Make training feel fun and achievable. Use casual language.`,
}

// POST /api/ai/chat - Send message and get AI response
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

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { message } = body

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    // 1. Fetch user's AI settings
    const { data: profile } = await (adminClient as any)
      .from('profiles')
      .select('ai_coach_model, ai_coach_personality, full_name')
      .eq('id', user.id)
      .single()

    const model = profile?.ai_coach_model || 'claude-opus-4-20250514'
    const personality = profile?.ai_coach_personality || 'coach'
    const userName = profile?.full_name || 'there'

    // 2. Gather context data
    const today = format(new Date(), 'yyyy-MM-dd')
    const sevenDaysAgo = format(subDays(new Date(), 7), 'yyyy-MM-dd')

    // Recent workouts
    const { data: recentWorkouts } = await (adminClient as any)
      .from('workouts')
      .select('name, workout_type, scheduled_date, status, actual_duration_minutes, actual_tss, category')
      .eq('user_id', user.id)
      .gte('scheduled_date', sevenDaysAgo)
      .order('scheduled_date', { ascending: false })
      .limit(10)

    // Recent sleep
    const { data: recentSleep } = await (adminClient as any)
      .from('sleep_logs')
      .select('log_date, sleep_score, total_sleep_minutes, hrv_avg, deep_sleep_minutes, resting_hr')
      .eq('user_id', user.id)
      .gte('log_date', sevenDaysAgo)
      .order('log_date', { ascending: false })
      .limit(7)

    // Current training plan context
    const { data: activePlan } = await (adminClient as any)
      .from('training_plans')
      .select(`
        name,
        goal,
        training_phases (
          name,
          phase_type,
          intensity_focus,
          start_date,
          end_date
        )
      `)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single()

    // Today's readiness
    const { data: todayReadiness } = await (adminClient as any)
      .from('readiness_assessments')
      .select('readiness_score, subjective_readiness, sleep_quality, sleep_hours, notes')
      .eq('user_id', user.id)
      .eq('date', today)
      .single()

    // Training load (last entry)
    const { data: trainingLoad } = await (adminClient as any)
      .from('training_load_history')
      .select('ctl, atl, tsb, date')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .limit(1)
      .single()

    // 3. Fetch conversation history (last 20 messages)
    const { data: chatHistory } = await (adminClient as any)
      .from('chat_messages')
      .select('role, content, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)

    // Reverse to get chronological order
    const orderedHistory = (chatHistory || []).reverse()

    // 4. Build context summary
    const contextSummary = buildContextSummary({
      workouts: recentWorkouts,
      sleep: recentSleep,
      plan: activePlan,
      readiness: todayReadiness,
      trainingLoad: trainingLoad,
    })

    // 5. Build system prompt
    const personalityGuide = PERSONALITY_GUIDES[personality] || PERSONALITY_GUIDES.coach
    const systemPrompt = `You are FORGE Coach, an AI training assistant for ${userName}. ${personalityGuide}

${contextSummary}

TODAY'S DATE: ${today}

GUIDELINES:
- Be specific to the user's actual data when relevant
- Consider their current fatigue/readiness when recommending intensity
- Reference their training plan and current phase when applicable
- Keep responses concise but actionable (2-4 paragraphs max)
- If asked about something you don't have data for, acknowledge it honestly
- Don't make up specific numbers - only reference data you actually have

TOOL USE - CRITICAL:
You have tools that take REAL actions. When a user asks you to add, modify, or log something, you MUST call the appropriate tool - don't just describe what you would do.

Available tools:
- add_workout: Add new workouts (auto-executes). ALWAYS include the full exercises array with sets/reps.
- modify_workout_exercise: Swap exercises for injury modifications (auto-executes)
- reschedule_workout: Move workouts to different dates (requires user confirmation)
- skip_workout: Mark workouts as skipped (auto-executes)
- log_sleep: Log sleep data (auto-executes)
- log_meal: Log meals with macros (auto-executes)
- log_body_comp: Log weight/body composition (auto-executes)
- log_readiness: Log how the user is feeling (auto-executes)
- get_workout_details: Look up workout information
- find_exercise_alternatives: Find exercise substitutes
- add_to_wishlist: Add feature requests or bug reports to the app wishlist (auto-executes)

IMPORTANT: When adding a workout, call add_workout with the exercises array populated - don't just describe the exercises in your text response.

PHOTO ANALYSIS:
For meal photo logging, direct users to the Nutrition tab camera icon.

DATE HANDLING:
Today is ${today}. When user says "today" use ${today}. For "tomorrow", use the next day in YYYY-MM-DD format.`

    // 6. Build messages array for Claude
    const messages: Anthropic.MessageParam[] = [
      ...orderedHistory.map((msg: any) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
      { role: 'user' as const, content: message },
    ]

    // 7. Call Claude API with tool support - handle tool use loop
    let pendingConfirmation: PendingAction | null = null
    const executedTools: { name: ToolName; result: ToolResult }[] = []
    let finalResponse = ''
    let currentMessages = [...messages]
    let iterationCount = 0
    const MAX_ITERATIONS = 10 // Prevent infinite loops

    while (iterationCount < MAX_ITERATIONS) {
      iterationCount++

      const response = await anthropic.messages.create({
        model,
        max_tokens: 2048,
        system: systemPrompt,
        messages: currentMessages,
        tools: AI_TOOLS,
      })

      // Process response content
      let hasToolUse = false
      const toolResults: Anthropic.ToolResultBlockParam[] = []

      for (const block of response.content) {
        if (block.type === 'text') {
          finalResponse = block.text
        } else if (block.type === 'tool_use') {
          hasToolUse = true
          const toolName = block.name as ToolName
          const toolInput = block.input as Record<string, any>

          // Check if this tool requires confirmation
          if (requiresConfirmation(toolName)) {
            // Return pending confirmation - don't execute yet
            pendingConfirmation = {
              id: randomUUID(),
              tool_name: toolName,
              tool_input: toolInput,
              description: generateToolDescription(toolName, toolInput),
              created_at: new Date().toISOString(),
            }

            // Add a tool result that says it's pending
            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: `This action requires user confirmation. The user will be prompted to approve or reject: ${pendingConfirmation.description}`,
            })
          } else {
            // Auto-execute the tool
            const result = await executeToolHandler(
              toolName,
              toolInput,
              user.id,
              adminClient
            )

            executedTools.push({ name: toolName, result })

            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: result.success
                ? `Success: ${result.message}${result.data ? `\nData: ${JSON.stringify(result.data)}` : ''}`
                : `Error: ${result.message}`,
            })
          }
        }
      }

      // If there were tool uses, continue the loop with tool results
      if (hasToolUse && toolResults.length > 0) {
        // Add assistant's response with tool uses
        currentMessages.push({
          role: 'assistant',
          content: response.content,
        })

        // Add tool results
        currentMessages.push({
          role: 'user',
          content: toolResults,
        })

        // If we have a pending confirmation, break out to let user confirm
        if (pendingConfirmation) {
          // Get Claude's final message acknowledging the pending action
          const finalMessageResponse = await anthropic.messages.create({
            model,
            max_tokens: 1024,
            system: systemPrompt,
            messages: currentMessages,
            tools: AI_TOOLS,
          })

          const textBlock = finalMessageResponse.content.find(c => c.type === 'text')
          if (textBlock && textBlock.type === 'text') {
            finalResponse = textBlock.text
          }
          break
        }
      } else {
        // No tool use, we're done
        break
      }
    }

    // If no text response, provide a default
    if (!finalResponse) {
      finalResponse = executedTools.length > 0
        ? `Done! ${executedTools.map(t => t.result.message).join('. ')}`
        : 'I processed your request.'
    }

    // 8. Save both messages to database
    await (adminClient as any)
      .from('chat_messages')
      .insert({
        user_id: user.id,
        role: 'user',
        content: message,
      })
      .select('id')
      .single()

    const { data: assistantMsg } = await (adminClient as any)
      .from('chat_messages')
      .insert({
        user_id: user.id,
        role: 'assistant',
        content: finalResponse,
        context_type: determineContextType(message),
      })
      .select('id')
      .single()

    const responseData: AIChatResponse = {
      response: finalResponse,
      message_id: assistantMsg?.id,
      ...(pendingConfirmation && { pending_confirmation: pendingConfirmation }),
      ...(executedTools.length > 0 && { executed_tools: executedTools }),
    }

    return NextResponse.json(responseData)
  } catch (error) {
    console.error('AI chat error:', error)

    if (error instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `AI service error: ${error.message}` },
        { status: 503 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to process chat message' },
      { status: 500 }
    )
  }
}

// GET /api/ai/chat - Fetch chat history
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminClient = createAdminClient()

    const { data: messages, error } = await (adminClient as any)
      .from('chat_messages')
      .select('id, role, content, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      throw error
    }

    // Return in chronological order (oldest first)
    return NextResponse.json({
      messages: (messages || []).reverse(),
    })
  } catch (error) {
    console.error('Fetch chat history error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch chat history' },
      { status: 500 }
    )
  }
}

// DELETE /api/ai/chat - Clear chat history
export async function DELETE() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminClient = createAdminClient()

    await (adminClient as any)
      .from('chat_messages')
      .delete()
      .eq('user_id', user.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Clear chat history error:', error)
    return NextResponse.json(
      { error: 'Failed to clear chat history' },
      { status: 500 }
    )
  }
}

// Helper: Build context summary from gathered data
function buildContextSummary(data: {
  workouts: any[] | null
  sleep: any[] | null
  plan: any | null
  readiness: any | null
  trainingLoad: any | null
}): string {
  const sections: string[] = []

  // Training plan context
  if (data.plan) {
    const currentPhase = data.plan.training_phases?.find((p: any) => {
      const now = new Date()
      return new Date(p.start_date) <= now && new Date(p.end_date) >= now
    })

    sections.push(`TRAINING PLAN:
- Plan: ${data.plan.name}
- Goal: ${data.plan.goal}
${currentPhase ? `- Current Phase: ${currentPhase.name} (${currentPhase.phase_type})
- Focus: ${currentPhase.intensity_focus}` : '- No active phase'}`)
  }

  // Recent workouts
  if (data.workouts && data.workouts.length > 0) {
    const workoutSummary = data.workouts
      .slice(0, 5)
      .map((w: any) => {
        const status = w.status === 'completed' ? '✓' : w.status === 'planned' ? '○' : '✗'
        const duration = w.actual_duration_minutes ? `${w.actual_duration_minutes}min` : 'planned'
        const tss = w.actual_tss ? `, TSS ${w.actual_tss}` : ''
        return `  ${status} ${w.scheduled_date}: ${w.name || w.workout_type} (${duration}${tss})`
      })
      .join('\n')

    sections.push(`RECENT WORKOUTS (last 7 days):
${workoutSummary}`)
  }

  // Sleep data
  if (data.sleep && data.sleep.length > 0) {
    const avgScore = Math.round(data.sleep.reduce((sum: number, s: any) => sum + (s.sleep_score || 0), 0) / data.sleep.length)
    const avgDuration = Math.round(data.sleep.reduce((sum: number, s: any) => sum + (s.total_sleep_minutes || 0), 0) / data.sleep.length)
    const avgHRV = data.sleep.filter((s: any) => s.hrv_avg).length > 0
      ? Math.round(data.sleep.filter((s: any) => s.hrv_avg).reduce((sum: number, s: any) => sum + s.hrv_avg, 0) / data.sleep.filter((s: any) => s.hrv_avg).length)
      : null

    sections.push(`SLEEP (7-day average):
- Score: ${avgScore}/100
- Duration: ${Math.floor(avgDuration / 60)}h ${avgDuration % 60}m
${avgHRV ? `- HRV: ${avgHRV}ms` : ''}`)
  }

  // Today's readiness
  if (data.readiness) {
    sections.push(`TODAY'S READINESS:
- Score: ${data.readiness.readiness_score || 'Not calculated'}
- Subjective: ${data.readiness.subjective_readiness}/10
- Sleep quality: ${data.readiness.sleep_quality}/10
${data.readiness.notes ? `- Notes: ${data.readiness.notes}` : ''}`)
  }

  // Training load
  if (data.trainingLoad) {
    const tsbStatus = data.trainingLoad.tsb > 10 ? 'Fresh' :
      data.trainingLoad.tsb > 0 ? 'Recovered' :
      data.trainingLoad.tsb > -10 ? 'Neutral' :
      data.trainingLoad.tsb > -20 ? 'Fatigued' : 'Very Fatigued'

    sections.push(`TRAINING LOAD:
- CTL (Fitness): ${Math.round(data.trainingLoad.ctl)}
- ATL (Fatigue): ${Math.round(data.trainingLoad.atl)}
- TSB (Form): ${Math.round(data.trainingLoad.tsb)} (${tsbStatus})`)
  }

  if (sections.length === 0) {
    return 'USER CONTEXT: Limited data available. User is new or hasn\'t logged recent activities.'
  }

  return `USER CONTEXT:\n\n${sections.join('\n\n')}`
}

// Helper: Determine what type of context the message relates to
function determineContextType(message: string): string | null {
  const lower = message.toLowerCase()
  if (lower.includes('workout') || lower.includes('train') || lower.includes('exercise')) return 'workout'
  if (lower.includes('sleep') || lower.includes('rest') || lower.includes('recover')) return 'sleep'
  if (lower.includes('plan') || lower.includes('schedule') || lower.includes('week')) return 'plan'
  if (lower.includes('ready') || lower.includes('feel') || lower.includes('tired')) return 'readiness'
  if (lower.includes('eat') || lower.includes('nutrition') || lower.includes('protein')) return 'nutrition'
  return null
}

// Helper: Get list of context types that were used
function getContextUsed(contextSummary: string): string[] {
  const used: string[] = []
  if (contextSummary.includes('TRAINING PLAN:')) used.push('plan')
  if (contextSummary.includes('RECENT WORKOUTS')) used.push('workouts')
  if (contextSummary.includes('SLEEP')) used.push('sleep')
  if (contextSummary.includes('READINESS:')) used.push('readiness')
  if (contextSummary.includes('TRAINING LOAD:')) used.push('training_load')
  return used
}

// Helper: Generate human-readable description for pending tool actions
function generateToolDescription(toolName: ToolName, input: Record<string, any>): string {
  switch (toolName) {
    case 'reschedule_workout':
      return `Move workout to ${input.new_date}${input.reason ? ` (${input.reason})` : ''}`
    case 'add_workout':
      return `Add "${input.name}" workout on ${input.date}`
    case 'delete_workout':
      return `Delete workout ${input.workout_id}`
    case 'modify_workout_exercise':
      return `Swap "${input.original_exercise}" with "${input.new_exercise}" in workout`
    case 'skip_workout':
      return `Skip workout${input.reason ? ` (${input.reason})` : ''}`
    case 'log_sleep':
      return `Log sleep data for ${input.log_date}`
    case 'log_meal':
      return `Log ${input.meal_type}: ${input.food_name}`
    case 'log_body_comp':
      return `Log body composition for ${input.log_date}`
    case 'log_readiness':
      return `Log readiness ${input.subjective_readiness}/10 for ${input.date}`
    default:
      return `Execute ${toolName}`
  }
}
