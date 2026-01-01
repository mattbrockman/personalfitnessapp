import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { executeToolHandler } from '@/lib/ai-tool-handlers'
import { ToolName, ToolResult } from '@/types/ai-tools'

// POST /api/ai/execute-tool - Execute a confirmed tool action
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action_id, tool_name, tool_input, approved } = body

    if (!tool_name || !tool_input) {
      return NextResponse.json(
        { error: 'tool_name and tool_input are required' },
        { status: 400 }
      )
    }

    // If user rejected the action
    if (approved === false) {
      return NextResponse.json({
        success: false,
        message: 'Action cancelled by user',
        rejected: true,
      })
    }

    // Execute the tool
    const result: ToolResult = await executeToolHandler(
      tool_name as ToolName,
      tool_input,
      user.id,
      adminClient
    )

    // Log the action to chat history for context
    if (result.success) {
      await (adminClient as any)
        .from('chat_messages')
        .insert({
          user_id: user.id,
          role: 'assistant',
          content: `✓ ${result.message}`,
          context_type: 'action',
        })
    }

    return NextResponse.json({
      success: result.success,
      message: result.message,
      data: result.data,
      error: result.error,
    })
  } catch (error) {
    console.error('Execute tool error:', error)
    return NextResponse.json(
      { error: 'Failed to execute action' },
      { status: 500 }
    )
  }
}
