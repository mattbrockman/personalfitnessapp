import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Navigation } from '@/components/Navigation'
import { AIChatBubble } from '@/components/AIChatBubble'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen gradient-mesh">
      <Navigation user={session.user} />
      <main>{children}</main>
      <AIChatBubble />
    </div>
  )
}
