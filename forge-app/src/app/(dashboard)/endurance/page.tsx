import { createClient } from '@/lib/supabase/server'
import { PolarizedDashboard } from '@/components/endurance/PolarizedDashboard'

export default async function EndurancePage() {
  const supabase = await createClient()

  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    return null
  }

  return <PolarizedDashboard user={session.user} />
}
