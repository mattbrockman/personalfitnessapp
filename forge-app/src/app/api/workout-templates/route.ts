import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// GET /api/workout-templates - List system templates + user's custom templates
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()

    const { data: { session } } = await supabase.auth.getSession()

    // Build query - system templates (is_system=true) + user's templates
    let query = adminClient
      .from('workout_templates')
      .select('*')
      .order('is_favorite', { ascending: false })
      .order('times_used', { ascending: false })
      .order('name', { ascending: true })

    // Filter to system templates OR user's own templates
    if (session?.user?.id) {
      query = query.or(`is_system.eq.true,user_id.eq.${session.user.id}`)
    } else {
      // Not logged in - only show system templates
      query = query.eq('is_system', true)
    }

    const { data: templates, error } = await query

    if (error) {
      console.error('Error fetching workout templates:', error)
      return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 })
    }

    // Normalize response to match frontend expectations
    const normalizedTemplates = (templates || []).map((t: any) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      category: t.category,
      estimated_duration_min: t.estimated_duration_min,
      exercises: t.exercises || [],
      is_system: t.is_system,
      is_favorite: t.is_favorite,
      times_used: t.times_used || 0,
      last_used: t.last_used_at,
      created_at: t.created_at,
      user_id: t.user_id,
    }))

    return NextResponse.json({ templates: normalizedTemplates })
  } catch (error) {
    console.error('Workout templates GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/workout-templates - Create a new template
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()

    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      name,
      description,
      category,
      estimated_duration_min,
      exercises,
    } = body

    if (!name || !category || !exercises) {
      return NextResponse.json(
        { error: 'Name, category, and exercises are required' },
        { status: 400 }
      )
    }

    const { data: template, error }: any = await (adminClient
      .from('workout_templates') as any)
      .insert({
        user_id: session.user.id,
        name,
        description: description || null,
        category,
        estimated_duration_min: estimated_duration_min || null,
        exercises,
        is_system: false,
        is_favorite: false,
        times_used: 0,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating workout template:', error)
      return NextResponse.json(
        { error: 'Failed to create template', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ template })
  } catch (error) {
    console.error('Workout templates POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/workout-templates - Update a template (favorite, times_used, etc.)
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()

    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: 'Template ID required' }, { status: 400 })
    }

    // Verify ownership or check if toggling favorite on system template
    const { data: existing }: any = await (adminClient
      .from('workout_templates') as any)
      .select('user_id, is_system, times_used')
      .eq('id', id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    // Only allow certain updates on system templates
    const allowedUpdates: Record<string, any> = {}

    if (existing.is_system) {
      // For system templates, only allow updating is_favorite and incrementing times_used
      if (updates.is_favorite !== undefined) allowedUpdates.is_favorite = updates.is_favorite
      if (updates.increment_usage) {
        allowedUpdates.times_used = (existing as any).times_used + 1
        allowedUpdates.last_used_at = new Date().toISOString()
      }
    } else {
      // For user templates, verify ownership
      if (existing.user_id !== session.user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      // Allow all updates for user's own templates
      const allowedFields = ['name', 'description', 'category', 'estimated_duration_min', 'exercises', 'is_favorite']
      for (const field of allowedFields) {
        if (updates[field] !== undefined) allowedUpdates[field] = updates[field]
      }
      if (updates.increment_usage) {
        allowedUpdates.times_used = (existing as any).times_used + 1
        allowedUpdates.last_used_at = new Date().toISOString()
      }
    }

    if (Object.keys(allowedUpdates).length === 0) {
      return NextResponse.json({ error: 'No valid updates provided' }, { status: 400 })
    }

    allowedUpdates.updated_at = new Date().toISOString()

    const { data: template, error }: any = await (adminClient
      .from('workout_templates') as any)
      .update(allowedUpdates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating workout template:', error)
      return NextResponse.json(
        { error: 'Failed to update template', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ template })
  } catch (error) {
    console.error('Workout templates PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/workout-templates - Delete a user's custom template
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()

    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Template ID required' }, { status: 400 })
    }

    // Verify ownership and not system template
    const { data: existing }: any = await (adminClient
      .from('workout_templates') as any)
      .select('user_id, is_system')
      .eq('id', id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    if (existing.is_system) {
      return NextResponse.json({ error: 'Cannot delete system templates' }, { status: 403 })
    }

    if (existing.user_id !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { error } = await (adminClient
      .from('workout_templates') as any)
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting workout template:', error)
      return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Workout templates DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
