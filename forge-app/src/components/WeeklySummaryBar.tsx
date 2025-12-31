'use client'

import { useMemo } from 'react'
import { format, startOfWeek, endOfWeek, isSameWeek } from 'date-fns'
import { TrendingUp, Clock, Gauge, Target } from 'lucide-react'
import { Workout } from '@/types/database'

interface WeeklySummaryBarProps {
  currentDate: Date
  workouts: Workout[]
  trainingPhase?: string
  targetTSS?: number
  targetHours?: number
}

const phaseColors: Record<string, { bg: string; text: string; label: string }> = {
  base: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Base' },
  build: { bg: 'bg-amber-500/20', text: 'text-amber-400', label: 'Build' },
  peak: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Peak' },
  taper: { bg: 'bg-purple-500/20', text: 'text-purple-400', label: 'Taper' },
  recovery: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: 'Recovery' },
  rest: { bg: 'bg-zinc-500/20', text: 'text-zinc-400', label: 'Rest' },
}

export function WeeklySummaryBar({
  currentDate,
  workouts,
  trainingPhase = 'base',
  targetTSS = 500,
  targetHours = 10,
}: WeeklySummaryBarProps) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 })

  const weeklyStats = useMemo(() => {
    const weekWorkouts = workouts.filter(w => {
      if (!w.scheduled_date) return false
      const workoutDate = new Date(w.scheduled_date)
      return isSameWeek(workoutDate, currentDate, { weekStartsOn: 1 })
    })

    const completedWorkouts = weekWorkouts.filter(w => w.status === 'completed')
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

  return (
    <div className="glass rounded-xl p-4 mb-4">
      <div className="flex items-center justify-between gap-6">
        {/* Week info */}
        <div className="flex items-center gap-3">
          <div className={`px-3 py-1.5 rounded-lg ${phase.bg}`}>
            <span className={`text-sm font-medium ${phase.text}`}>{phase.label}</span>
          </div>
          <div>
            <p className="text-sm font-medium">
              Week of {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d')}
            </p>
            <p className="text-xs text-white/40">
              {weeklyStats.completedCount} completed, {weeklyStats.plannedCount} planned
            </p>
          </div>
        </div>

        {/* TSS Progress */}
        <div className="flex-1 max-w-[200px]">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="flex items-center gap-1 text-white/60">
              <Gauge size={12} />
              TSS
            </span>
            <span className="font-medium">
              {weeklyStats.completedTSS} / {targetTSS}
            </span>
          </div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className={`h-full ${getProgressColor(tssProgress)} transition-all duration-500`}
              style={{ width: `${Math.min(tssProgress, 100)}%` }}
            />
          </div>
        </div>

        {/* Hours Progress */}
        <div className="flex-1 max-w-[200px]">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="flex items-center gap-1 text-white/60">
              <Clock size={12} />
              Hours
            </span>
            <span className="font-medium">
              {formatHours(weeklyStats.completedMinutes)} / {targetHours}h
            </span>
          </div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className={`h-full ${getProgressColor(hoursProgress)} transition-all duration-500`}
              style={{ width: `${Math.min(hoursProgress, 100)}%` }}
            />
          </div>
        </div>

        {/* Quick stats */}
        <div className="flex items-center gap-4 text-xs">
          <div className="text-center">
            <p className="text-white/40">Planned</p>
            <p className="font-medium">{weeklyStats.totalPlannedTSS} TSS</p>
          </div>
          <div className="h-8 w-px bg-white/10" />
          <div className="text-center">
            <p className="text-white/40">Time</p>
            <p className="font-medium">{formatHours(weeklyStats.totalPlannedMinutes)}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
