import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { MealContext } from '@/types/longevity'

// GET /api/cgm - List CGM readings for current user
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const mealContext = searchParams.get('meal_context') as MealContext | null
    const limit = searchParams.get('limit')

    let query = supabase
      .from('cgm_readings')
      .select('*')
      .eq('user_id', session.user.id)
      .order('reading_time', { ascending: false })

    if (startDate) {
      query = query.gte('reading_time', startDate)
    }
    if (endDate) {
      query = query.lte('reading_time', endDate)
    }
    if (mealContext) {
      query = query.eq('meal_context', mealContext)
    }
    if (limit) {
      query = query.limit(parseInt(limit, 10))
    }

    const { data: readings, error } = await query

    if (error) {
      console.error('Error fetching CGM readings:', error)
      return NextResponse.json({ error: 'Failed to fetch CGM readings' }, { status: 500 })
    }

    return NextResponse.json({ readings })
  } catch (error) {
    console.error('CGM GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/cgm - Create new CGM reading(s)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()

    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    // Support both single reading and batch import
    const readings = Array.isArray(body) ? body : [body]

    // Validate readings
    for (const reading of readings) {
      if (!reading.reading_time || reading.glucose_mg_dl === undefined) {
        return NextResponse.json({
          error: 'Each reading requires reading_time and glucose_mg_dl'
        }, { status: 400 })
      }
    }

    // Prepare readings for insert
    const readingsToInsert = readings.map(r => ({
      user_id: session.user.id,
      reading_time: r.reading_time,
      glucose_mg_dl: r.glucose_mg_dl,
      source: r.source || 'manual',
      meal_context: r.meal_context || null,
      nutrition_log_id: r.nutrition_log_id || null,
      notes: r.notes || null,
    }))

    const { data: insertedReadings, error: insertError } = await adminClient
      .from('cgm_readings')
      .insert(readingsToInsert)
      .select()

    if (insertError) {
      console.error('Error creating CGM readings:', insertError)
      return NextResponse.json({
        error: 'Failed to create CGM readings',
        details: insertError.message,
      }, { status: 500 })
    }

    return NextResponse.json({
      readings: insertedReadings,
      count: insertedReadings?.length || 0
    })
  } catch (error) {
    console.error('CGM POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/cgm - Delete CGM reading(s)
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
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    // Either delete by ID or by date range
    if (id) {
      // Verify ownership
      const { data: existing } = await supabase
        .from('cgm_readings')
        .select('user_id')
        .eq('id', id)
        .single()

      if (!existing || existing.user_id !== session.user.id) {
        return NextResponse.json({ error: 'Reading not found' }, { status: 404 })
      }

      const { error: deleteError } = await adminClient
        .from('cgm_readings')
        .delete()
        .eq('id', id)

      if (deleteError) {
        console.error('Error deleting CGM reading:', deleteError)
        return NextResponse.json({ error: 'Failed to delete CGM reading' }, { status: 500 })
      }

      return NextResponse.json({ success: true, deleted: 1 })
    } else if (startDate && endDate) {
      // Delete range (for bulk cleanup)
      const { data: deleted, error: deleteError } = await adminClient
        .from('cgm_readings')
        .delete()
        .eq('user_id', session.user.id)
        .gte('reading_time', startDate)
        .lte('reading_time', endDate)
        .select('id')

      if (deleteError) {
        console.error('Error deleting CGM readings:', deleteError)
        return NextResponse.json({ error: 'Failed to delete CGM readings' }, { status: 500 })
      }

      return NextResponse.json({ success: true, deleted: deleted?.length || 0 })
    } else {
      return NextResponse.json({
        error: 'Either id or start_date and end_date are required'
      }, { status: 400 })
    }
  } catch (error) {
    console.error('CGM DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET /api/cgm/stats - Get CGM statistics for a time period
export async function getStats(request: NextRequest) {
  // This would be accessed via /api/cgm/stats route
  // Implemented in separate route file
}
