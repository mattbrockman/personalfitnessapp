import { createClient } from '@/lib/supabase/server'
import { LongevityDashboard } from '@/components/longevity/LongevityDashboard'

export default async function LongevityPage() {
  const supabase = createClient()

  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    return null
  }

  // Fetch profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single()

  return (
    <LongevityDashboard
      user={session.user}
      profile={profile}
    />
  )
}
