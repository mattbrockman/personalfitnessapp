// @ts-nocheck
// Adaptation Settings API Endpoint
// GET: Get user's adaptation settings
// PATCH: Update user's adaptation settings
// Note: @ts-nocheck is needed until training-plan.ts types are updated

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

const DEFAULT_SETTINGS = {
  auto_evaluate: true,
  weekly_review_day: 0, // Sunday
  notify_pending_recommendations: true,
  compliance_alert_threshold: 0.8,
  tsb_alert_threshold: -20,
  readiness_alert_threshold: 40,
  day_of_adjustment_enabled: true,
  day_of_readiness_threshold: 50,
}

// GET /api/adaptation/settings - Get current settings
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminClient = createAdminClient()

    // Get existing settings
    const { data: settings, error } = await (adminClient as any)
      .from('adaptation_settings')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching settings:', error)
      return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
    }

    // Return settings or defaults
    if (!settings) {
      return NextResponse.json({
        settings: {
          user_id: user.id,
          ...DEFAULT_SETTINGS,
        },
        is_default: true,
      })
    }

    return NextResponse.json({
      settings,
      is_default: false,
    })
  } catch (error) {
    console.error('Error in settings GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/adaptation/settings - Update settings
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    // Validate fields
    const allowedFields = [
      'auto_evaluate',
      'weekly_review_day',
      'notify_pending_recommendations',
      'compliance_alert_threshold',
      'tsb_alert_threshold',
      'readiness_alert_threshold',
      'day_of_adjustment_enabled',
      'day_of_readiness_threshold',
    ]

    const updates: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field]
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    // Validate specific field values
    if (updates.weekly_review_day !== undefined) {
      const day = updates.weekly_review_day as number
      if (day < 0 || day > 6) {
        return NextResponse.json({
          error: 'weekly_review_day must be 0-6 (Sunday-Saturday)',
        }, { status: 400 })
      }
    }

    if (updates.compliance_alert_threshold !== undefined) {
      const threshold = updates.compliance_alert_threshold as number
      if (threshold < 0 || threshold > 1) {
        return NextResponse.json({
          error: 'compliance_alert_threshold must be 0-1',
        }, { status: 400 })
      }
    }

    if (updates.readiness_alert_threshold !== undefined) {
      const threshold = updates.readiness_alert_threshold as number
      if (threshold < 0 || threshold > 100) {
        return NextResponse.json({
          error: 'readiness_alert_threshold must be 0-100',
        }, { status: 400 })
      }
    }

    if (updates.day_of_readiness_threshold !== undefined) {
      const threshold = updates.day_of_readiness_threshold as number
      if (threshold < 0 || threshold > 100) {
        return NextResponse.json({
          error: 'day_of_readiness_threshold must be 0-100',
        }, { status: 400 })
      }
    }

    const adminClient = createAdminClient()

    // Upsert settings
    const { data: settings, error } = await (adminClient as any)
      .from('adaptation_settings')
      .upsert({
        user_id: user.id,
        ...updates,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })
      .select()
      .single()

    if (error) {
      console.error('Error updating settings:', error)
      return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
    }

    return NextResponse.json({ settings })
  } catch (error) {
    console.error('Error in settings PATCH:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
