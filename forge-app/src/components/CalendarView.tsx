'use client'

import { useState } from 'react'
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  isToday,
} from 'date-fns'
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Bike,
  Dumbbell,
  Activity,
  Footprints,
  Waves,
  Clock,
  Route,
  Gauge,
  CheckCircle2,
  RefreshCw,
  Loader2,
  Link as LinkIcon,
  Zap,
  CalendarDays,
  CalendarRange,
} from 'lucide-react'
import { Workout } from '@/types/database'
import { CreateWorkoutModal } from './CreateWorkoutModal'
import { WorkoutDetailModal } from './WorkoutDetailModal'
import { WeeklySummaryBar } from './WeeklySummaryBar'
import { AIChatBubble } from './AIChatBubble'

interface CalendarViewProps {
  initialWorkouts: Workout[]
  stravaConnected: boolean
  lastSyncAt: string | null
}

const categoryColors = {
  cardio: { bg: 'bg-sky-500', light: 'bg-sky-500/20', text: 'text-sky-400', border: 'border-sky-500/30' },
  strength: { bg: 'bg-violet-500', light: 'bg-violet-500/20', text: 'text-violet-400', border: 'border-violet-500/30' },
  other: { bg: 'bg-emerald-500', light: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30' },
}

const intensityZones = {
  z1: { label: 'Z1', color: 'bg-blue-400' },
  z2: { label: 'Z2', color: 'bg-green-400' },
  z3: { label: 'Z3', color: 'bg-yellow-400' },
  z4: { label: 'Z4', color: 'bg-orange-400' },
  z5: { label: 'Z5', color: 'bg-red-400' },
  hit: { label: 'HIT', color: 'bg-red-500' },
  mixed: { label: 'MIX', color: 'bg-purple-400' },
}

const workoutIcons: Record<string, any> = {
  bike: Bike,
  run: Footprints,
  swim: Waves,
  strength: Dumbbell,
  default: Activity,
}

type ViewMode = 'month' | 'week'

export function CalendarView({ initialWorkouts, stravaConnected, lastSyncAt }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [workouts, setWorkouts] = useState<Workout[]>(initialWorkouts)
  const [isSyncing, setIsSyncing] = useState(false)
  const [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createModalDate, setCreateModalDate] = useState<Date>(new Date())
  const [viewMode, setViewMode] = useState<ViewMode>('month')

  // Generate calendar days based on view mode
  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 })

  const calendarStart = viewMode === 'month' ? startOfWeek(monthStart, { weekStartsOn: 1 }) : weekStart
  const calendarEnd = viewMode === 'month' ? endOfWeek(monthEnd, { weekStartsOn: 1 }) : weekEnd
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  // Navigation functions
  const navigatePrevious = () => {
    if (viewMode === 'month') {
      setCurrentDate(subMonths(currentDate, 1))
    } else {
      setCurrentDate(subWeeks(currentDate, 1))
    }
  }

  const navigateNext = () => {
    if (viewMode === 'month') {
      setCurrentDate(addMonths(currentDate, 1))
    } else {
      setCurrentDate(addWeeks(currentDate, 1))
    }
  }

  const getHeaderTitle = () => {
    if (viewMode === 'month') {
      return format(currentDate, 'MMMM yyyy')
    }
    return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`
  }

  // Group workouts by date
  const workoutsByDate = workouts.reduce((acc, workout) => {
    if (workout.scheduled_date) {
      const key = workout.scheduled_date
      if (!acc[key]) acc[key] = []
      acc[key].push(workout)
    }
    return acc
  }, {} as Record<string, Workout[]>)

  const handleSync = async () => {
    setIsSyncing(true)
    try {
      const response = await fetch('/api/strava/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ daysBack: 60 }),
      })

      const text = await response.text()
      let data
      try {
        data = JSON.parse(text)
      } catch {
        alert(`Invalid response: ${text.slice(0, 200)}`)
        return
      }

      if (response.ok) {
        const { synced = 0, matched = 0, skipped = 0, errors = 0, total = 0, lastError, version = 0 } = data
        // Show full response for debugging
        alert(`v${version}: synced=${synced}, matched=${matched}, skipped=${skipped}, errors=${errors}, total=${total}${lastError ? `\nError: ${lastError}` : ''}`)
        if (synced > 0 || matched > 0) {
          window.location.reload()
        }
      } else {
        alert(`Sync error (${response.status}): ${data.error || JSON.stringify(data)}`)
      }
    } catch (error: any) {
      console.error('Sync failed:', error)
      alert(`Sync failed: ${error?.message || error}`)
    } finally {
      setIsSyncing(false)
    }
  }

  const getWorkoutIcon = (type: string) => {
    return workoutIcons[type] || workoutIcons.default
  }

  const openCreateModal = (date: Date) => {
    setCreateModalDate(date)
    setShowCreateModal(true)
  }

  const handleWorkoutCreated = () => {
    // Refresh the page to get updated workouts
    window.location.reload()
  }

  return (
    <div className="p-4 lg:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={navigatePrevious}
              className="p-2 hover:bg-white/5 rounded-lg transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <h1 className="text-2xl font-display font-semibold min-w-[280px] text-center">
              {getHeaderTitle()}
            </h1>
            <button
              onClick={navigateNext}
              className="p-2 hover:bg-white/5 rounded-lg transition-colors"
            >
              <ChevronRight size={20} />
            </button>
          </div>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="px-3 py-1.5 glass rounded-lg text-sm hover:bg-white/10 transition-colors"
          >
            Today
          </button>

          {/* View toggle */}
          <div className="flex items-center glass rounded-lg p-1">
            <button
              onClick={() => setViewMode('month')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
                viewMode === 'month' ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white/80'
              }`}
            >
              <CalendarDays size={16} />
              Month
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
                viewMode === 'week' ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white/80'
              }`}
            >
              <CalendarRange size={16} />
              Week
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Strava sync */}
          {stravaConnected ? (
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className="flex items-center gap-2 px-4 py-2 glass rounded-lg text-sm hover:bg-white/10 transition-colors disabled:opacity-50"
            >
              {isSyncing ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <RefreshCw size={16} />
              )}
              {isSyncing ? 'Syncing...' : 'Sync Strava'}
            </button>
          ) : (
            <a
              href="/api/auth/strava"
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-400 text-white rounded-lg text-sm transition-colors"
            >
              <LinkIcon size={16} />
              Connect Strava
            </a>
          )}
        </div>
      </div>

      {/* Last sync indicator */}
      {lastSyncAt && (
        <p className="text-xs text-white/40 mb-4">
          Last synced: {format(new Date(lastSyncAt), 'MMM d, h:mm a')}
        </p>
      )}

      {/* Legend */}
      <div className="flex items-center gap-6 mb-4 text-xs">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-sky-500" />
            <span className="text-white/50">Cardio</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-violet-500" />
            <span className="text-white/50">Strength</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-emerald-500" />
            <span className="text-white/50">Other</span>
          </div>
        </div>
        <div className="h-4 w-px bg-white/10" />
        <div className="flex items-center gap-2">
          {Object.entries(intensityZones).slice(0, 5).map(([key, zone]) => (
            <span key={key} className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${zone.color} text-black`}>
              {zone.label}
            </span>
          ))}
        </div>
      </div>

      {/* Weekly Summary Bar */}
      <WeeklySummaryBar
        currentDate={currentDate}
        workouts={workouts}
        trainingPhase="base"
        targetTSS={500}
        targetHours={10}
      />

      {/* Calendar grid */}
      <div className="border border-white/10 rounded-xl overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 bg-white/5">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
            <div key={day} className="p-3 text-center text-sm text-white/40 font-medium border-b border-white/5">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar days */}
        <div className="grid grid-cols-7">
          {days.map((day, idx) => {
            const dateKey = format(day, 'yyyy-MM-dd')
            const dayWorkouts = workoutsByDate[dateKey] || []
            const isCurrentMonth = isSameMonth(day, currentDate)
            const isCurrentDay = isToday(day)

            // In week view, show all workouts; in month view, limit to 3
            const maxWorkoutsToShow = viewMode === 'week' ? 10 : 3

            return (
              <div
                key={idx}
                className={`${viewMode === 'week' ? 'min-h-[300px]' : 'min-h-[140px]'} p-2 border-b border-r border-white/5 transition-colors hover:bg-white/[0.02] ${
                  !isCurrentMonth && viewMode === 'month' ? 'bg-white/[0.01]' : ''
                }`}
              >
                {/* Day number */}
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full ${
                    isCurrentDay 
                      ? 'bg-amber-500 text-black' 
                      : isCurrentMonth 
                        ? 'text-white' 
                        : 'text-white/30'
                  }`}>
                    {format(day, 'd')}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); openCreateModal(day); }}
                    className="p-1 hover:bg-white/10 rounded opacity-0 hover:opacity-100 transition-opacity"
                  >
                    <Plus size={14} className="text-white/40" />
                  </button>
                </div>

                {/* Workouts */}
                <div className="space-y-1.5">
                  {dayWorkouts.slice(0, maxWorkoutsToShow).map(workout => {
                    const colors = categoryColors[workout.category]
                    const Icon = getWorkoutIcon(workout.workout_type)
                    const zone = workout.primary_intensity ? intensityZones[workout.primary_intensity] : null

                    return (
                      <div
                        key={workout.id}
                        onClick={() => setSelectedWorkout(workout)}
                        className={`rounded-lg overflow-hidden cursor-pointer border ${colors.border} hover:translate-y-[-1px] transition-all ${
                          workout.status === 'completed' ? 'opacity-80' : ''
                        }`}
                      >
                        <div className={`h-1 ${colors.bg}`} />
                        <div className="p-2 bg-zinc-800/90">
                          <div className="flex items-start gap-1.5">
                            <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${colors.light}`}>
                              <Icon size={12} className={colors.text} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1">
                                {workout.status === 'completed' && (
                                  <CheckCircle2 size={10} className="text-emerald-400 flex-shrink-0" />
                                )}
                                <span className="text-xs font-medium truncate">
                                  {workout.name || workout.workout_type}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-0.5 text-[10px] text-white/40">
                                {workout.actual_duration_minutes && (
                                  <span>{Math.floor(workout.actual_duration_minutes / 60)}:{String(workout.actual_duration_minutes % 60).padStart(2, '0')}</span>
                                )}
                                {workout.actual_distance_miles && (
                                  <span>{workout.actual_distance_miles}mi</span>
                                )}
                              </div>
                            </div>
                            {zone && (
                              <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${zone.color} text-black flex-shrink-0`}>
                                {zone.label}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}

                  {dayWorkouts.length > maxWorkoutsToShow && (
                    <button className="w-full text-[10px] text-white/40 hover:text-white/60 py-1">
                      +{dayWorkouts.length - maxWorkoutsToShow} more
                    </button>
                  )}

                  {dayWorkouts.length === 0 && isCurrentMonth && (
                    <button
                      onClick={() => openCreateModal(day)}
                      className="w-full py-3 border border-dashed border-white/10 rounded-lg text-white/20 hover:text-white/40 hover:border-white/20 transition-all text-xs flex items-center justify-center gap-1 opacity-0 hover:opacity-100"
                    >
                      <Plus size={12} />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Workout detail modal */}
      {selectedWorkout && (
        <WorkoutDetailModal
          workout={selectedWorkout}
          onClose={() => setSelectedWorkout(null)}
          onUpdate={() => window.location.reload()}
        />
      )}

      {/* Create workout modal */}
      {showCreateModal && (
        <CreateWorkoutModal
          selectedDate={createModalDate}
          onClose={() => setShowCreateModal(false)}
          onCreated={handleWorkoutCreated}
        />
      )}

      {/* AI Chat Bubble */}
      <AIChatBubble
        workoutContext={{
          weeklyTSS: workouts
            .filter(w => w.status === 'completed')
            .reduce((sum, w) => sum + (w.actual_tss || 0), 0),
          completedWorkouts: workouts.filter(w => w.status === 'completed').length,
          plannedWorkouts: workouts.filter(w => w.status === 'planned').length,
        }}
      />
    </div>
  )
}
