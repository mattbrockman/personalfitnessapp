import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// GET /api/body-composition - List body composition logs for current user
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
    const limit = searchParams.get('limit')

    let query = supabase
      .from('body_composition_logs')
      .select('*')
      .eq('user_id', session.user.id)
      .order('log_date', { ascending: false })

    if (startDate) {
      query = query.gte('log_date', startDate)
    }
    if (endDate) {
      query = query.lte('log_date', endDate)
    }
    if (limit) {
      query = query.limit(parseInt(limit, 10))
    }

    const { data: logs, error } = await query

    if (error) {
      console.error('Error fetching body composition logs:', error)
      return NextResponse.json({ error: 'Failed to fetch body composition logs' }, { status: 500 })
    }

    return NextResponse.json({ logs })
  } catch (error) {
    console.error('Body composition GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/body-composition - Create a new body composition log
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
      log_date,
      weight_lbs,
      body_fat_pct,
      lean_mass_lbs,
      visceral_fat_rating,
      bone_mass_lbs,
      water_pct,
      muscle_mass_lbs,
      trunk_fat_pct,
      arm_fat_pct,
      leg_fat_pct,
      android_fat_pct,
      gynoid_fat_pct,
      bone_mineral_density,
      ffmi,
      almi,
      source,
      notes,
    } = body

    // Validate required fields
    if (!log_date) {
      return NextResponse.json({ error: 'log_date is required' }, { status: 400 })
    }

    // Calculate lean_mass_lbs if not provided but weight and body_fat are available
    let calculatedLeanMass = lean_mass_lbs
    if (!calculatedLeanMass && weight_lbs && body_fat_pct) {
      calculatedLeanMass = weight_lbs * (1 - body_fat_pct / 100)
    }

    // Insert log (upsert to handle unique constraint per user/date)
    const { data: log, error: insertError }: any = await (adminClient
      .from('body_composition_logs') as any)
      .upsert({
        user_id: session.user.id,
        log_date,
        weight_lbs: weight_lbs || null,
        body_fat_pct: body_fat_pct || null,
        lean_mass_lbs: calculatedLeanMass || null,
        visceral_fat_rating: visceral_fat_rating || null,
        bone_mass_lbs: bone_mass_lbs || null,
        water_pct: water_pct || null,
        muscle_mass_lbs: muscle_mass_lbs || null,
        trunk_fat_pct: trunk_fat_pct || null,
        arm_fat_pct: arm_fat_pct || null,
        leg_fat_pct: leg_fat_pct || null,
        android_fat_pct: android_fat_pct || null,
        gynoid_fat_pct: gynoid_fat_pct || null,
        bone_mineral_density: bone_mineral_density || null,
        ffmi: ffmi || null,
        almi: almi || null,
        source: source || 'manual',
        notes: notes || null,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,log_date',
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error creating body composition log:', insertError)
      return NextResponse.json({
        error: 'Failed to create body composition log',
        details: insertError.message,
      }, { status: 500 })
    }

    return NextResponse.json({ log })
  } catch (error) {
    console.error('Body composition POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/body-composition - Update a body composition log
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
      return NextResponse.json({ error: 'Log ID required' }, { status: 400 })
    }

    // Verify ownership
    const { data: existing } = await supabase
      .from('body_composition_logs')
      .select('user_id')
      .eq('id', id)
      .single()

    if (!existing || existing.user_id !== session.user.id) {
      return NextResponse.json({ error: 'Log not found' }, { status: 404 })
    }

    // Only allow updating specific fields
    const allowedFields = [
      'weight_lbs', 'body_fat_pct', 'lean_mass_lbs', 'visceral_fat_rating',
      'bone_mass_lbs', 'water_pct', 'muscle_mass_lbs', 'trunk_fat_pct',
      'arm_fat_pct', 'leg_fat_pct', 'android_fat_pct', 'gynoid_fat_pct',
      'bone_mineral_density', 'ffmi', 'almi', 'source', 'notes'
    ]
    const updates: Record<string, any> = { updated_at: new Date().toISOString() }

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field]
      }
    }

    const { data: log, error: updateError }: any = await (adminClient
      .from('body_composition_logs') as any)
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating body composition log:', updateError)
      return NextResponse.json({
        error: 'Failed to update body composition log',
        details: updateError.message,
      }, { status: 500 })
    }

    return NextResponse.json({ log })
  } catch (error) {
    console.error('Body composition PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/body-composition - Delete a body composition log
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
      return NextResponse.json({ error: 'Log ID required' }, { status: 400 })
    }

    // Verify ownership
    const { data: existing } = await supabase
      .from('body_composition_logs')
      .select('user_id')
      .eq('id', id)
      .single()

    if (!existing || existing.user_id !== session.user.id) {
      return NextResponse.json({ error: 'Log not found' }, { status: 404 })
    }

    const { error: deleteError } = await (adminClient
      .from('body_composition_logs') as any)
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('Error deleting body composition log:', deleteError)
      return NextResponse.json({ error: 'Failed to delete body composition log' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Body composition DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
