import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/junction/debug - Debug Junction setup
export async function GET() {
  const checks: Record<string, any> = {}

  // Check 1: Environment variable
  checks.junction_api_key_set = !!process.env.JUNCTION_API_KEY
  checks.junction_api_key_prefix = process.env.JUNCTION_API_KEY?.substring(0, 10) + '...'
  checks.junction_environment = process.env.JUNCTION_ENVIRONMENT || 'not set (defaults to sandbox)'

  // Check 2: Auth
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    checks.auth_user = user?.id || null
    checks.auth_error = authError?.message || null
  } catch (e: any) {
    checks.auth_error = e.message
  }

  // Check 3: Profile with junction_user_id
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile, error: profileError } = await (supabase as any)
        .from('profiles')
        .select('id, junction_user_id, junction_connected_providers')
        .eq('id', user.id)
        .single()

      checks.profile = profile
      checks.profile_error = profileError?.message || null
    }
  } catch (e: any) {
    checks.profile_error = e.message
  }

  // Check 4: Test Junction API
  if (process.env.JUNCTION_API_KEY) {
    try {
      const baseUrl = process.env.JUNCTION_ENVIRONMENT === 'production'
        ? 'https://api.tryvital.io'
        : 'https://api.sandbox.tryvital.io'

      const response = await fetch(`${baseUrl}/v2/team`, {
        headers: {
          'x-vital-api-key': process.env.JUNCTION_API_KEY,
        },
      })

      checks.junction_api_status = response.status
      checks.junction_api_ok = response.ok
      if (!response.ok) {
        checks.junction_api_error = await response.text()
      } else {
        checks.junction_api_response = await response.json()
      }
    } catch (e: any) {
      checks.junction_api_error = e.message
    }
  }

  return NextResponse.json(checks, { status: 200 })
}
