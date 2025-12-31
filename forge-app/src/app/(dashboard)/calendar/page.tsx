import { createClient } from '@/lib/supabase/server'
import { CalendarView } from '@/components/CalendarView'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { Workout } from '@/types/database'

export default async function CalendarPage() {
  const supabase = createClient()
  
  // Get current month's date range
  const now = new Date()
  const monthStart = startOfMonth(now)
  const monthEnd = endOfMonth(now)

  // Fetch workouts for current month
  const { data: workouts } = await supabase
    .from('workouts')
    .select('*')
    .gte('scheduled_date', format(monthStart, 'yyyy-MM-dd'))
    .lte('scheduled_date', format(monthEnd, 'yyyy-MM-dd'))
    .order('scheduled_date', { ascending: true })

  // Check Strava connection
  const { data: stravaIntegration } = await supabase
    .from('integrations')
    .select('last_sync_at, sync_status')
    .eq('service', 'strava')
    .maybeSingle() as { data: { last_sync_at: string | null; sync_status: string } | null }

  return (
    <CalendarView 
      initialWorkouts={(workouts as Workout[]) || []} 
      stravaConnected={!!stravaIntegration}
      lastSyncAt={stravaIntegration?.last_sync_at ?? null}
    />
  )
}
