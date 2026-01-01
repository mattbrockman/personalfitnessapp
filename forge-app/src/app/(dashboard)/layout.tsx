import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Navigation } from '@/components/Navigation'
import { AIChatBubble } from '@/components/AIChatBubble'
import { BottomNav } from '@/components/BottomNav'
import { ToastProvider } from '@/components/Toast'

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
    <ToastProvider>
      <div className="min-h-screen gradient-mesh">
        <Navigation user={session.user} />
        <main id="main-content" className="pb-20 lg:pb-0">
          {children}
        </main>
        <BottomNav />
        <AIChatBubble />
      </div>
    </ToastProvider>
  )
}
