'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useWorkout } from '@/contexts/WorkoutContext'
import { Dumbbell, Clock, Target, Timer, ChevronUp } from 'lucide-react'

export function MinimizedWorkoutBar() {
  const { activeWorkout, expandWorkout, isMinimized } = useWorkout()
  const router = useRouter()
  const pathname = usePathname()

  // Don't show if no workout or not minimized
  if (!activeWorkout || !isMinimized) {
    return null
  }

  // Calculate stats
  const totalSets = activeWorkout.exercises.reduce((sum, ex) => sum + ex.sets.length, 0)
  const completedSets = activeWorkout.exercises.reduce(
    (sum, ex) => sum + ex.sets.filter(s => s.completed).length,
    0
  )
  const elapsedMinutes = Math.floor((Date.now() - activeWorkout.startTime.getTime()) / 60000)

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60)
    const secs = s % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleExpand = () => {
    expandWorkout()
    // If not on lifting page, navigate there
    if (!pathname.startsWith('/lifting')) {
      router.push('/lifting')
    }
  }

  return (
    <div
      onClick={handleExpand}
      className="fixed bottom-[76px] left-4 right-4 z-30 cursor-pointer lg:bottom-4 mb-safe"
    >
      <div className="bg-zinc-900/95 backdrop-blur-xl border border-amber-500/30 rounded-2xl p-4 shadow-2xl shadow-black/50 animate-slide-up">
        <div className="flex items-center gap-4">
          {/* Workout icon */}
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
            <Dumbbell size={24} className="text-amber-400" />
          </div>

          {/* Workout info */}
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate">{activeWorkout.name || 'Workout in Progress'}</p>
            <div className="flex items-center gap-3 text-sm text-white/60 mt-0.5">
              <span className="flex items-center gap-1">
                <Clock size={14} />
                {elapsedMinutes}m
              </span>
              <span className="flex items-center gap-1">
                <Target size={14} />
                {completedSets}/{totalSets} sets
              </span>
              {activeWorkout.timerState.hasStarted && activeWorkout.timerState.isRunning && (
                <span className="flex items-center gap-1 text-emerald-400">
                  <Timer size={14} />
                  {formatTime(activeWorkout.timerState.timeLeft)}
                </span>
              )}
            </div>
          </div>

          {/* Expand indicator */}
          <div className="flex-shrink-0 p-2">
            <ChevronUp size={20} className="text-amber-400" />
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-3 h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-amber-500 rounded-full transition-all duration-300"
            style={{ width: `${totalSets > 0 ? (completedSets / totalSets) * 100 : 0}%` }}
          />
        </div>
      </div>
    </div>
  )
}
