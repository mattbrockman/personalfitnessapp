'use client'

import { useMemo } from 'react'
import { format, startOfWeek, endOfWeek, isSameWeek } from 'date-fns'
import { TrendingUp, Clock, Gauge, Target, Bike, Dumbbell, Footprints, Waves, Loader2 } from 'lucide-react'
import { Workout } from '@/types/database'
import Link from 'next/link'

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

  // Calculate activity-specific progress
  const activityStats = useMemo(() => {
    const weekWorkouts = workouts.filter(w => {
      if (!w.scheduled_date) return false
      const workoutDate = new Date(w.scheduled_date)
      return isSameWeek(workoutDate, currentDate, { weekStartsOn: 1 }) && w.status === 'completed'
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
        <div className="flex items-center justify-center gap-2 text-white/40">
          <Loader2 size={16} className="animate-spin" />
          <span className="text-sm">Loading plan data...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="glass rounded-xl p-4 mb-4">
      <div className="flex flex-col gap-4">
        {/* Top row: Phase info and main progress */}
        <div className="flex items-center justify-between gap-6">
          {/* Week info */}
          <div className="flex items-center gap-3">
            <Link href="/plan" className={`px-3 py-1.5 rounded-lg ${phase.bg} hover:brightness-110 transition-all`}>
              <span className={`text-sm font-medium ${phase.text}`}>
                {phaseName || phase.label}
              </span>
            </Link>
            <div>
              <p className="text-sm font-medium">
                Week of {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d')}
              </p>
              <p className="text-xs text-white/40">
                {planName ? (
                  <Link href="/plan" className="hover:text-white/60">{planName}</Link>
                ) : (
                  <>{weeklyStats.completedCount} completed, {weeklyStats.plannedCount} planned</>
                )}
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

        {/* Activity breakdown row - only show if we have plan targets */}
        {weeklyTarget && (
          <div className="flex items-center gap-6 pt-2 border-t border-white/10">
            <span className="text-xs text-white/40">Activity Targets:</span>

            {weeklyTarget.cycling_hours > 0 && (
              <div className="flex items-center gap-2 text-xs">
                <Bike size={14} className="text-blue-400" />
                <span className={activityStats.cyclingHours >= weeklyTarget.cycling_hours ? 'text-emerald-400' : 'text-white/70'}>
                  {activityStats.cyclingHours.toFixed(1)} / {weeklyTarget.cycling_hours.toFixed(1)}h
                </span>
              </div>
            )}

            {weeklyTarget.running_hours > 0 && (
              <div className="flex items-center gap-2 text-xs">
                <Footprints size={14} className="text-green-400" />
                <span className={activityStats.runningHours >= weeklyTarget.running_hours ? 'text-emerald-400' : 'text-white/70'}>
                  {activityStats.runningHours.toFixed(1)} / {weeklyTarget.running_hours.toFixed(1)}h
                </span>
              </div>
            )}

            {weeklyTarget.swimming_hours > 0 && (
              <div className="flex items-center gap-2 text-xs">
                <Waves size={14} className="text-cyan-400" />
                <span className={activityStats.swimmingHours >= weeklyTarget.swimming_hours ? 'text-emerald-400' : 'text-white/70'}>
                  {activityStats.swimmingHours.toFixed(1)} / {weeklyTarget.swimming_hours.toFixed(1)}h
                </span>
              </div>
            )}

            {weeklyTarget.lifting_sessions > 0 && (
              <div className="flex items-center gap-2 text-xs">
                <Dumbbell size={14} className="text-amber-400" />
                <span className={activityStats.liftingSessions >= weeklyTarget.lifting_sessions ? 'text-emerald-400' : 'text-white/70'}>
                  {activityStats.liftingSessions} / {weeklyTarget.lifting_sessions} sessions
                </span>
              </div>
            )}

            {/* Week type badge */}
            {weeklyTarget.week_type && weeklyTarget.week_type !== 'normal' && (
              <div className={`ml-auto px-2 py-0.5 rounded text-xs font-medium ${
                weeklyTarget.week_type === 'deload' || weeklyTarget.week_type === 'recovery'
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : weeklyTarget.week_type === 'race'
                  ? 'bg-red-500/20 text-red-400'
                  : weeklyTarget.week_type === 'build'
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'bg-white/10 text-white/60'
              }`}>
                {weeklyTarget.week_type.charAt(0).toUpperCase() + weeklyTarget.week_type.slice(1)} Week
              </div>
            )}
          </div>
        )}

        {/* No plan CTA */}
        {!planName && !loading && (
          <div className="flex items-center justify-center pt-2 border-t border-white/10">
            <Link
              href="/plan"
              className="flex items-center gap-2 text-xs text-white/40 hover:text-white/70 transition-colors"
            >
              <Target size={14} />
              Create a training plan for personalized targets
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
