import { createClient, createAdminClient } from '@/lib/supabase/server'
import { CalendarView } from '@/components/CalendarView'
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns'
import { Workout } from '@/types/database'

export default async function CalendarPage() {
  const supabase = await createClient()
  const adminClient = createAdminClient()

  // Get current user
  const { data: { user } } = await supabase.auth.getUser()

  // Get expanded date range (3 months back, 3 months forward)
  const now = new Date()
  const rangeStart = startOfMonth(subMonths(now, 3))
  const rangeEnd = endOfMonth(addMonths(now, 3))
  const startStr = format(rangeStart, 'yyyy-MM-dd')
  const endStr = format(rangeEnd, 'yyyy-MM-dd')

  // Fetch regular workouts
  const { data: workouts } = await supabase
    .from('workouts')
    .select('*')
    .gte('scheduled_date', startStr)
    .lte('scheduled_date', endStr)
    .order('scheduled_date', { ascending: true })

  // Fetch suggested workouts from active plan
  let suggestedWorkouts: any[] = []
  if (user) {
    const { data: profile } = await (adminClient as any)
      .from('profiles')
      .select('active_program_id')
      .eq('id', user.id)
      .single()

    if (profile?.active_program_id) {
      const { data: sw } = await (adminClient as any)
        .from('suggested_workouts')
        .select('*')
        .eq('plan_id', profile.active_program_id)
        .gte('suggested_date', startStr)
        .lte('suggested_date', endStr)
        .order('suggested_date', { ascending: true })

      suggestedWorkouts = (sw || []).map((w: any) => ({
        ...w,
        scheduled_date: w.suggested_date,
        source: 'suggested',
      }))
    }
  }

  // Combine workouts
  const allWorkouts = [...(workouts || []), ...suggestedWorkouts]

  // Check Strava connection
  const { data: stravaIntegration } = await (supabase
    .from('integrations') as any)
    .select('id, updated_at')
    .eq('provider', 'strava')
    .maybeSingle()

  return (
    <CalendarView
      initialWorkouts={(allWorkouts as Workout[]) || []}
      stravaConnected={!!stravaIntegration}
      lastSyncAt={stravaIntegration?.updated_at ?? null}
    />
  )
}
