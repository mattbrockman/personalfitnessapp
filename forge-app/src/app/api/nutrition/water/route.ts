import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { format } from 'date-fns'

// PATCH /api/nutrition/water - Update water intake for today
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { water_oz } = await request.json()

    if (typeof water_oz !== 'number' || water_oz < 0) {
      return NextResponse.json(
        { error: 'Invalid water_oz value' },
        { status: 400 }
      )
    }

    const today = format(new Date(), 'yyyy-MM-dd')

    // Check if log exists for today
    const { data: existingLog } = await (adminClient as any)
      .from('nutrition_logs')
      .select('id')
      .eq('user_id', user.id)
      .eq('log_date', today)
      .single()

    if (existingLog) {
      // Update existing log
      const { error: updateError } = await (adminClient as any)
        .from('nutrition_logs')
        .update({ water_oz })
        .eq('id', existingLog.id)

      if (updateError) {
        throw updateError
      }
    } else {
      // Create new log with water
      const { error: insertError } = await (adminClient as any)
        .from('nutrition_logs')
        .insert({
          user_id: user.id,
          log_date: today,
          water_oz,
          total_calories: 0,
          total_protein_g: 0,
          total_carbs_g: 0,
          total_fat_g: 0,
        })

      if (insertError) {
        throw insertError
      }
    }

    return NextResponse.json({ success: true, water_oz })
  } catch (error) {
    console.error('Update water error:', error)
    return NextResponse.json(
      { error: 'Failed to update water intake' },
      { status: 500 }
    )
  }
}
