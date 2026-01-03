import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Navigation } from '@/components/Navigation'
import { AIChatBubble } from '@/components/AIChatBubble'
import { BottomNav } from '@/components/BottomNav'
import { ToastProvider } from '@/components/Toast'
import { WorkoutProvider } from '@/contexts/WorkoutContext'
import { MinimizedWorkoutBar } from '@/components/MinimizedWorkoutBar'

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
    <WorkoutProvider>
      <ToastProvider>
        <div className="min-h-screen gradient-mesh">
          {/* Desktop navigation only */}
          <div className="hidden lg:block">
            <Navigation user={session.user} />
          </div>
          <main id="main-content" className="pb-20 lg:pb-0">
            {children}
          </main>
          <BottomNav user={session.user} />
          <AIChatBubble showFloatingButton={false} />
          <MinimizedWorkoutBar />
        </div>
      </ToastProvider>
    </WorkoutProvider>
  )
}
