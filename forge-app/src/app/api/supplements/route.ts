import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// GET /api/supplements - List supplements for current user
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const activeOnly = searchParams.get('active_only') === 'true'
    const category = searchParams.get('category')

    let query = supabase
      .from('supplements')
      .select('*')
      .eq('user_id', session.user.id)
      .order('name', { ascending: true })

    if (activeOnly) {
      query = query.eq('is_active', true)
    }
    if (category) {
      query = query.eq('category', category)
    }

    const { data: supplements, error } = await query

    if (error) {
      console.error('Error fetching supplements:', error)
      return NextResponse.json({ error: 'Failed to fetch supplements' }, { status: 500 })
    }

    return NextResponse.json({ supplements })
  } catch (error) {
    console.error('Supplements GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/supplements - Create a new supplement
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
      brand,
      dosage,
      dosage_unit,
      frequency,
      time_of_day,
      cycle_on_days,
      cycle_off_days,
      is_active,
      start_date,
      end_date,
      category,
      reason,
      notes,
    } = body

    // Validate required fields
    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }

    const { data: supplement, error: insertError } = await adminClient
      .from('supplements')
      .insert({
        user_id: session.user.id,
        name,
        brand: brand || null,
        dosage: dosage || null,
        dosage_unit: dosage_unit || null,
        frequency: frequency || 'daily',
        time_of_day: time_of_day || null,
        cycle_on_days: cycle_on_days || null,
        cycle_off_days: cycle_off_days || null,
        is_active: is_active !== false,
        start_date: start_date || null,
        end_date: end_date || null,
        category: category || null,
        reason: reason || null,
        notes: notes || null,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error creating supplement:', insertError)
      return NextResponse.json({
        error: 'Failed to create supplement',
        details: insertError.message,
      }, { status: 500 })
    }

    return NextResponse.json({ supplement })
  } catch (error) {
    console.error('Supplements POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/supplements - Update a supplement
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
      return NextResponse.json({ error: 'Supplement ID required' }, { status: 400 })
    }

    // Verify ownership
    const { data: existing } = await supabase
      .from('supplements')
      .select('user_id')
      .eq('id', id)
      .single()

    if (!existing || existing.user_id !== session.user.id) {
      return NextResponse.json({ error: 'Supplement not found' }, { status: 404 })
    }

    // Only allow updating specific fields
    const allowedFields = [
      'name', 'brand', 'dosage', 'dosage_unit', 'frequency', 'time_of_day',
      'cycle_on_days', 'cycle_off_days', 'is_active', 'start_date', 'end_date',
      'category', 'reason', 'notes'
    ]
    const updates: Record<string, any> = { updated_at: new Date().toISOString() }

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field]
      }
    }

    const { data: supplement, error: updateError } = await adminClient
      .from('supplements')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating supplement:', updateError)
      return NextResponse.json({
        error: 'Failed to update supplement',
        details: updateError.message,
      }, { status: 500 })
    }

    return NextResponse.json({ supplement })
  } catch (error) {
    console.error('Supplements PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/supplements - Delete a supplement
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
      return NextResponse.json({ error: 'Supplement ID required' }, { status: 400 })
    }

    // Verify ownership
    const { data: existing } = await supabase
      .from('supplements')
      .select('user_id')
      .eq('id', id)
      .single()

    if (!existing || existing.user_id !== session.user.id) {
      return NextResponse.json({ error: 'Supplement not found' }, { status: 404 })
    }

    const { error: deleteError } = await adminClient
      .from('supplements')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('Error deleting supplement:', deleteError)
      return NextResponse.json({ error: 'Failed to delete supplement' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Supplements DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
