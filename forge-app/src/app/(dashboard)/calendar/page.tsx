import { createClient } from '@/lib/supabase/server'
import { CalendarView } from '@/components/CalendarView'
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns'
import { Workout } from '@/types/database'

export default async function CalendarPage() {
  const supabase = await createClient()

  // Get expanded date range (3 months back, 3 months forward)
  const now = new Date()
  const rangeStart = startOfMonth(subMonths(now, 3))
  const rangeEnd = endOfMonth(addMonths(now, 3))
  const startStr = format(rangeStart, 'yyyy-MM-dd')
  const endStr = format(rangeEnd, 'yyyy-MM-dd')

  // Fetch only actual workouts (not suggested ones - those belong in Plan view)
  const { data: workouts } = await supabase
    .from('workouts')
    .select('*')
    .gte('scheduled_date', startStr)
    .lte('scheduled_date', endStr)
    .order('scheduled_date', { ascending: true })

  // Check Strava connection
  const { data: stravaIntegration } = await (supabase
    .from('integrations') as any)
    .select('id, updated_at')
    .eq('provider', 'strava')
    .maybeSingle()

  return (
    <CalendarView
      initialWorkouts={(workouts as Workout[]) || []}
      stravaConnected={!!stravaIntegration}
      lastSyncAt={stravaIntegration?.updated_at ?? null}
    />
  )
}
