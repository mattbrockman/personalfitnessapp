import { createClient } from '@/lib/supabase/server'
import { SettingsView } from '@/components/SettingsView'
import { redirect } from 'next/navigation'

export default async function SettingsPage() {
  const supabase = createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }
  
  // Get profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // Get integrations
  const { data: integrations } = await supabase
    .from('integrations')
    .select('*')

  return (
    <SettingsView 
      user={user}
      profile={profile as any}
      integrations={(integrations as any[]) || []}
    />
  )
}
