import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { HealthMetric, MetricType } from '@/types/longevity'

// GET /api/health-metrics - List health metrics for current user
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const metricType = searchParams.get('type') as MetricType | null
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const limit = searchParams.get('limit')

    let query = supabase
      .from('health_metrics')
      .select('*')
      .eq('user_id', session.user.id)
      .order('metric_date', { ascending: false })

    if (metricType) {
      query = query.eq('metric_type', metricType)
    }
    if (startDate) {
      query = query.gte('metric_date', startDate)
    }
    if (endDate) {
      query = query.lte('metric_date', endDate)
    }
    if (limit) {
      query = query.limit(parseInt(limit, 10))
    }

    const { data: metrics, error } = await query

    if (error) {
      console.error('Error fetching health metrics:', error)
      return NextResponse.json({ error: 'Failed to fetch health metrics' }, { status: 500 })
    }

    return NextResponse.json({ metrics })
  } catch (error) {
    console.error('Health metrics GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/health-metrics - Create a new health metric entry
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
      metric_date,
      metric_type,
      value,
      unit,
      source,
      notes,
    } = body

    // Validate required fields
    if (!metric_date || !metric_type || value === undefined || !unit) {
      return NextResponse.json({
        error: 'Missing required fields: metric_date, metric_type, value, unit'
      }, { status: 400 })
    }

    // Validate metric_type
    const validTypes: MetricType[] = ['vo2max', 'grip_strength_left', 'grip_strength_right', 'rhr', 'hrv']
    if (!validTypes.includes(metric_type)) {
      return NextResponse.json({
        error: `Invalid metric_type. Must be one of: ${validTypes.join(', ')}`
      }, { status: 400 })
    }

    // Insert metric (upsert to handle unique constraint)
    const { data: metric, error: insertError } = await adminClient
      .from('health_metrics')
      .upsert({
        user_id: session.user.id,
        metric_date,
        metric_type,
        value,
        unit,
        source: source || 'manual',
        notes: notes || null,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,metric_date,metric_type',
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error creating health metric:', insertError)
      return NextResponse.json({
        error: 'Failed to create health metric',
        details: insertError.message,
      }, { status: 500 })
    }

    return NextResponse.json({ metric })
  } catch (error) {
    console.error('Health metrics POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/health-metrics - Update a health metric entry
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()

    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id } = body

    if (!id) {
      return NextResponse.json({ error: 'Metric ID required' }, { status: 400 })
    }

    // Verify ownership
    const { data: existing } = await supabase
      .from('health_metrics')
      .select('user_id')
      .eq('id', id)
      .single()

    if (!existing || existing.user_id !== session.user.id) {
      return NextResponse.json({ error: 'Metric not found' }, { status: 404 })
    }

    // Only allow updating specific fields
    const allowedFields = ['value', 'unit', 'source', 'notes']
    const updates: Record<string, any> = { updated_at: new Date().toISOString() }

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field]
      }
    }

    const { data: metric, error: updateError } = await adminClient
      .from('health_metrics')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating health metric:', updateError)
      return NextResponse.json({
        error: 'Failed to update health metric',
        details: updateError.message,
      }, { status: 500 })
    }

    return NextResponse.json({ metric })
  } catch (error) {
    console.error('Health metrics PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/health-metrics - Delete a health metric entry
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
      return NextResponse.json({ error: 'Metric ID required' }, { status: 400 })
    }

    // Verify ownership
    const { data: existing } = await supabase
      .from('health_metrics')
      .select('user_id')
      .eq('id', id)
      .single()

    if (!existing || existing.user_id !== session.user.id) {
      return NextResponse.json({ error: 'Metric not found' }, { status: 404 })
    }

    const { error: deleteError } = await adminClient
      .from('health_metrics')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('Error deleting health metric:', deleteError)
      return NextResponse.json({ error: 'Failed to delete health metric' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Health metrics DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
