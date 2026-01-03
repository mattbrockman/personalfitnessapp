'use client'

import { useMemo, useState } from 'react'
import { format, startOfWeek, endOfWeek, isSameWeek } from 'date-fns'
import { TrendingUp, Clock, Gauge, Target, Bike, Dumbbell, Footprints, Waves, Loader2, ChevronRight } from 'lucide-react'
import { Workout } from '@/types/database'
import Link from 'next/link'
import { WeeklyProgressModal } from './WeeklyProgressModal'

interface WeeklyTarget {
  id: string
  target_hours: number
  target_tss: number
  cycling_hours: number
  running_hours: number
  swimming_hours: number
  lifting_sessions: number
  other_hours: number
  week_type: string
  daily_structure: Record<string, string>
}

interface WeeklySummaryBarProps {
  currentDate: Date
  workouts: Workout[]
  trainingPhase?: string
  phaseName?: string
  targetTSS?: number
  targetHours?: number
  weeklyTarget?: WeeklyTarget | null
  planName?: string
  loading?: boolean
}

const phaseColors: Record<string, { bg: string; text: string; label: string }> = {
  base: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Base' },
  build: { bg: 'bg-amber-500/20', text: 'text-amber-400', label: 'Build' },
  peak: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Peak' },
  taper: { bg: 'bg-purple-500/20', text: 'text-purple-400', label: 'Taper' },
  recovery: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: 'Recovery' },
  transition: { bg: 'bg-indigo-500/20', text: 'text-indigo-400', label: 'Transition' },
  rest: { bg: 'bg-zinc-500/20', text: 'text-zinc-400', label: 'Rest' },
}

export function WeeklySummaryBar({
  currentDate,
  workouts,
  trainingPhase = 'base',
  phaseName,
  targetTSS = 500,
  targetHours = 10,
  weeklyTarget,
  planName,
  loading = false,
}: WeeklySummaryBarProps) {
  const [showProgressModal, setShowProgressModal] = useState(false)
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 })

  const weeklyStats = useMemo(() => {
    const weekWorkouts = workouts.filter(w => {
      if (!w.scheduled_date) return false
      const workoutDate = new Date(w.scheduled_date)
      return isSameWeek(workoutDate, currentDate, { weekStartsOn: 1 })
    })

    // Include in_progress workouts that have actual data recorded
    const completedWorkouts = weekWorkouts.filter(w =>
      w.status === 'completed' ||
      (w.status === 'in_progress' && w.actual_duration_minutes)
    )
    const plannedWorkouts = weekWorkouts.filter(w => w.status === 'planned')

    // Calculate completed TSS and hours
    const completedTSS = completedWorkouts.reduce((sum, w) => sum + (w.actual_tss || 0), 0)
    const completedMinutes = completedWorkouts.reduce((sum, w) => sum + (w.actual_duration_minutes || 0), 0)

    // Calculate planned TSS and hours
    const plannedTSS = plannedWorkouts.reduce((sum, w) => sum + (w.planned_tss || 0), 0)
    const plannedMinutes = plannedWorkouts.reduce((sum, w) => sum + (w.planned_duration_minutes || 0), 0)

    const totalPlannedTSS = completedTSS + plannedTSS
    const totalPlannedMinutes = completedMinutes + plannedMinutes

    return {
      completedTSS,
      completedMinutes,
      totalPlannedTSS,
      totalPlannedMinutes,
      completedCount: completedWorkouts.length,
      plannedCount: plannedWorkouts.length,
    }
  }, [workouts, currentDate])

  const tssProgress = targetTSS > 0 ? (weeklyStats.completedTSS / targetTSS) * 100 : 0
  const hoursProgress = targetHours > 0 ? ((weeklyStats.completedMinutes / 60) / targetHours) * 100 : 0

  const formatHours = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}:${String(mins).padStart(2, '0')}`
  }

  const phase = phaseColors[trainingPhase] || phaseColors.base

  // Determine status color based on progress
  const getProgressColor = (progress: number) => {
    if (progress >= 90) return 'bg-emerald-500'
    if (progress >= 70) return 'bg-amber-500'
    return 'bg-sky-500'
  }

  // Calculate activity-specific progress
  const activityStats = useMemo(() => {
    const weekWorkouts = workouts.filter(w => {
      if (!w.scheduled_date) return false
      const workoutDate = new Date(w.scheduled_date)
      // Include completed and in_progress workouts with actual data
      return isSameWeek(workoutDate, currentDate, { weekStartsOn: 1 }) &&
        (w.status === 'completed' || (w.status === 'in_progress' && w.actual_duration_minutes))
    })

    const cyclingMinutes = weekWorkouts
      .filter(w => w.workout_type === 'bike' || w.workout_type === 'cycling')
      .reduce((sum, w) => sum + (w.actual_duration_minutes || 0), 0)

    const runningMinutes = weekWorkouts
      .filter(w => w.workout_type === 'run' || w.workout_type === 'running')
      .reduce((sum, w) => sum + (w.actual_duration_minutes || 0), 0)

    const swimmingMinutes = weekWorkouts
      .filter(w => w.workout_type === 'swim' || w.workout_type === 'swimming')
      .reduce((sum, w) => sum + (w.actual_duration_minutes || 0), 0)

    const liftingSessions = weekWorkouts
      .filter(w => w.category === 'strength')
      .length

    return {
      cyclingHours: cyclingMinutes / 60,
      runningHours: runningMinutes / 60,
      swimmingHours: swimmingMinutes / 60,
      liftingSessions,
    }
  }, [workouts, currentDate])

  if (loading) {
    return (
      <div className="glass rounded-xl p-4 mb-4">
        <div className="flex items-center justify-center gap-2 text-secondary">
          <Loader2 size={16} className="animate-spin" />
          <span className="text-sm">Loading plan data...</span>
        </div>
      </div>
    )
  }

  // Calculate workouts progress (assume 5 workouts per week as default target)
  const targetWorkouts = weeklyTarget?.lifting_sessions
    ? Math.max(5, weeklyTarget.lifting_sessions + 3)
    : 5
  const workoutsProgress = (weeklyStats.completedCount / targetWorkouts) * 100

  return (
    <div className="glass rounded-xl p-3 mb-4">
      {/* Compact summary - tap to see details */}
      <button
        onClick={() => setShowProgressModal(true)}
        className="w-full text-left"
      >
        <div className="flex items-center gap-3">
          {/* Phase badge */}
          <div className={`px-2.5 py-2 rounded-lg ${phase.bg} flex-shrink-0 self-start`}>
            <span className={`text-xs font-medium ${phase.text}`}>
              {phaseName || phase.label}
            </span>
          </div>

          {/* Stacked progress bars */}
          <div className="flex-1 space-y-2 min-w-0">
            {/* Hours */}
            <div>
              <div className="flex items-center justify-between text-[11px] mb-0.5">
                <span className="text-tertiary">Hours</span>
                <span className="font-medium">{formatHours(weeklyStats.completedMinutes)} / {targetHours}h</span>
              </div>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className={`h-full ${getProgressColor(hoursProgress)} transition-all`}
                  style={{ width: `${Math.min(hoursProgress, 100)}%` }}
                />
              </div>
            </div>

            {/* TSS */}
            <div>
              <div className="flex items-center justify-between text-[11px] mb-0.5">
                <span className="text-tertiary">TSS</span>
                <span className="font-medium">{weeklyStats.completedTSS} / {targetTSS}</span>
              </div>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className={`h-full ${getProgressColor(tssProgress)} transition-all`}
                  style={{ width: `${Math.min(tssProgress, 100)}%` }}
                />
              </div>
            </div>

            {/* Workouts */}
            <div>
              <div className="flex items-center justify-between text-[11px] mb-0.5">
                <span className="text-tertiary">Workouts</span>
                <span className="font-medium">{weeklyStats.completedCount} / {targetWorkouts}</span>
              </div>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className={`h-full ${getProgressColor(workoutsProgress)} transition-all`}
                  style={{ width: `${Math.min(workoutsProgress, 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Arrow */}
          <ChevronRight size={18} className="text-muted flex-shrink-0 self-center" />
        </div>
      </button>

      {/* No plan CTA - simplified */}
      {!planName && !loading && (
        <Link
          href="/plan"
          className="flex items-center justify-center gap-1.5 mt-2 pt-2 border-t border-white/10 text-[11px] text-secondary hover:text-white/60"
        >
          <Target size={12} />
          Create a training plan
        </Link>
      )}

      {/* Weekly Progress Modal */}
      <WeeklyProgressModal
        isOpen={showProgressModal}
        onClose={() => setShowProgressModal(false)}
      />
    </div>
  )
}
