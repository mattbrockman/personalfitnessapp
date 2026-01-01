'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isSameWeek,
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
  XCircle,
  AlertTriangle,
  CheckCircle,
  Target,
  Flag,
} from 'lucide-react'
import { Workout } from '@/types/database'
import { CreateWorkoutModal } from './CreateWorkoutModal'
import { WorkoutDetailModal } from './WorkoutDetailModal'
import { WeeklySummaryBar } from './WeeklySummaryBar'
import { WeatherBadge } from './WeatherBadge'
import { WeatherDetailModal } from './WeatherDetailModal'
import { WeatherDay } from '@/lib/weather'
import { PhaseType, PHASE_COLORS, PHASE_LABELS, EventType, EVENT_TYPE_ICONS } from '@/types/training-plan'

interface PlanData {
  plan: {
    id: string
    name: string
    goal: string
    primary_sport: string
    weekly_hours_target: number
  } | null
  phase: {
    id: string
    name: string
    phase_type: PhaseType
    intensity_focus: string
    volume_modifier: number
    intensity_modifier: number
    activity_distribution: Record<string, number>
    start_date: string
    end_date: string
  } | null
  weeklyTarget: {
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
  } | null
  events: Array<{
    id: string
    name: string
    event_type: EventType
    priority: string
    event_date: string
  }>
}

interface CalendarViewProps {
  initialWorkouts: Workout[]
  stravaConnected: boolean
  lastSyncAt: string | null
}

// Category colors - WHAT type of workout
const categoryColors: Record<string, { bg: string; light: string; text: string; border: string }> = {
  cardio: { bg: 'bg-sky-500', light: 'bg-sky-500/20', text: 'text-sky-400', border: 'border-sky-500/30' },
  strength: { bg: 'bg-violet-500', light: 'bg-violet-500/20', text: 'text-violet-400', border: 'border-violet-500/30' },
  other: { bg: 'bg-amber-500', light: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30' },
}

// Status icon helper - HOW the workout went
const getStatusIcon = (workout: Workout) => {
  const { status, scheduled_date, planned_duration_minutes, actual_duration_minutes } = workout
  if (!scheduled_date) return null
  const isPast = new Date(scheduled_date) < new Date(new Date().toDateString()) // Compare dates only

  if (!isPast && status === 'planned') return null // Future planned - no icon

  if (status === 'completed') {
    const planned = planned_duration_minutes || 0
    const actual = actual_duration_minutes || 0

    // Unplanned workouts (no planned duration) - always green check
    if (planned === 0) {
      return { Icon: CheckCircle, color: 'text-emerald-400' }
    }

    // Planned workouts - compare actual vs planned
    const ratio = actual / planned
    if (ratio >= 0.95) return { Icon: CheckCircle, color: 'text-emerald-400' } // Green check
    if (ratio >= 0.80) return { Icon: AlertTriangle, color: 'text-yellow-400' } // Yellow caution
    return { Icon: AlertTriangle, color: 'text-red-400' } // Red warning (way off plan)
  }

  if (isPast && status === 'planned') {
    return { Icon: XCircle, color: 'text-red-400' } // Red X - missed
  }

  if (status === 'skipped') {
    return { Icon: XCircle, color: 'text-gray-400' } // Gray X - intentionally skipped
  }

  return null
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
  // Use null initially to avoid hydration mismatch, then set in useEffect
  const [currentDate, setCurrentDate] = useState<Date | null>(null)
  const [workouts, setWorkouts] = useState<Workout[]>(initialWorkouts)
  const [isSyncing, setIsSyncing] = useState(false)
  const [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createModalDate, setCreateModalDate] = useState<Date | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('month')
  const [planData, setPlanData] = useState<PlanData | null>(null)
  const [planLoading, setPlanLoading] = useState(true)
  const [weatherForecast, setWeatherForecast] = useState<WeatherDay[]>([])
  const [selectedWeather, setSelectedWeather] = useState<WeatherDay | null>(null)
  const [mounted, setMounted] = useState(false)

  // Set dates after mount to avoid hydration mismatch
  useEffect(() => {
    setCurrentDate(new Date())
    setCreateModalDate(new Date())
    setMounted(true)
  }, [])

  // Fetch workouts from API
  const fetchWorkouts = useCallback(async () => {
    try {
      const response = await fetch('/api/workouts')
      if (response.ok) {
        const data = await response.json()
        setWorkouts(data.workouts || [])
      }
    } catch (error) {
      console.error('Failed to fetch workouts:', error)
    }
  }, [])

  // Fetch weather forecast
  const fetchWeather = useCallback(async () => {
    try {
      const response = await fetch('/api/weather')
      if (response.ok) {
        const data = await response.json()
        setWeatherForecast(data.forecast || [])
      }
    } catch (error) {
      console.error('Failed to fetch weather:', error)
    }
  }, [])

  // Fetch current week's plan data
  const fetchPlanData = useCallback(async () => {
    try {
      const response = await fetch('/api/training-plans/current-week')
      if (response.ok) {
        const data = await response.json()
        setPlanData(data)
      }
    } catch (error) {
      console.error('Failed to fetch plan data:', error)
    } finally {
      setPlanLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPlanData()
    fetchWeather()

    // Check if AI Coach made updates while we were on another page
    const lastUpdate = localStorage.getItem('workout-updated')
    if (lastUpdate) {
      const updateTime = parseInt(lastUpdate)
      // If update was within the last 5 minutes, refresh
      if (Date.now() - updateTime < 5 * 60 * 1000) {
        fetchWorkouts()
      }
      localStorage.removeItem('workout-updated')
    }
  }, [])

  // Listen for workout updates from AI Coach (same-page updates)
  useEffect(() => {
    const handleWorkoutUpdate = () => {
      console.log('[CalendarView] Received workout-updated event, fetching workouts...')
      fetchWorkouts()
      fetchPlanData()
    }
    window.addEventListener('workout-updated', handleWorkoutUpdate)
    return () => window.removeEventListener('workout-updated', handleWorkoutUpdate)
  }, [fetchWorkouts, fetchPlanData])

  // Show loading state until mounted (avoids hydration mismatch)
  if (!mounted || !currentDate) {
    return (
      <div className="p-4 lg:p-6">
        <div className="flex items-center justify-center h-[600px]">
          <Loader2 className="w-8 h-8 animate-spin text-white/40" />
        </div>
      </div>
    )
  }

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

  // Create weather lookup map by date
  const weatherByDate = weatherForecast.reduce((acc, weather) => {
    acc[weather.date] = weather
    return acc
  }, {} as Record<string, WeatherDay>)

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
        trainingPhase={planData?.phase?.phase_type || 'base'}
        phaseName={planData?.phase?.name}
        targetTSS={planData?.weeklyTarget?.target_tss || 500}
        targetHours={planData?.weeklyTarget?.target_hours || 10}
        weeklyTarget={planData?.weeklyTarget || null}
        planName={planData?.plan?.name}
        loading={planLoading}
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
            const dayWeather = weatherByDate[dateKey]
            const showWeather = dayWeather && (isToday(day) || day > new Date())

            // In week view, show all workouts; in month view, limit to 3
            const maxWorkoutsToShow = viewMode === 'week' ? 10 : 3

            return (
              <div
                key={idx}
                className={`${viewMode === 'week' ? 'min-h-[300px]' : 'min-h-[140px]'} p-2 border-b border-r border-white/5 transition-colors hover:bg-white/[0.02] ${
                  !isCurrentMonth && viewMode === 'month' ? 'bg-white/[0.01]' : ''
                }`}
              >
                {/* Day number, weather, and event marker */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1">
                    <span className={`text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full ${
                      isCurrentDay
                        ? 'bg-amber-500 text-black'
                        : isCurrentMonth
                          ? 'text-white'
                          : 'text-white/30'
                    }`}>
                      {format(day, 'd')}
                    </span>
                    {/* Plan event marker */}
                    {planData?.events?.filter(e => e.event_date === dateKey).map(event => (
                      <span
                        key={event.id}
                        className="text-xs cursor-help"
                        title={`${event.name} (${event.event_type}, ${event.priority}-priority)`}
                      >
                        {EVENT_TYPE_ICONS[event.event_type] || '📅'}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-1">
                    {/* Weather badge */}
                    {showWeather && dayWeather && (
                      <WeatherBadge
                        weather={dayWeather}
                        onClick={() => setSelectedWeather(dayWeather)}
                        size="sm"
                      />
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); openCreateModal(day); }}
                      className="p-1 hover:bg-white/10 rounded opacity-0 hover:opacity-100 transition-opacity"
                    >
                      <Plus size={14} className="text-white/40" />
                    </button>
                  </div>
                </div>

                {/* Workouts */}
                <div className="space-y-1.5">
                  {dayWorkouts.slice(0, maxWorkoutsToShow).map(workout => {
                    const colors = categoryColors[workout.category] || categoryColors.other
                    const Icon = getWorkoutIcon(workout.workout_type)
                    const statusIcon = getStatusIcon(workout)

                    return (
                      <div
                        key={workout.id}
                        onClick={() => setSelectedWorkout(workout)}
                        className={`rounded-lg overflow-hidden cursor-pointer border ${colors.border} hover:translate-y-[-1px] transition-all`}
                      >
                        <div className={`h-1 ${colors.bg}`} />
                        <div className="p-2 bg-zinc-800/90">
                          <div className="flex items-start gap-1.5">
                            <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${colors.light}`}>
                              <Icon size={12} className={colors.text} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1">
                                {statusIcon && (
                                  <statusIcon.Icon size={10} className={`${statusIcon.color} flex-shrink-0`} />
                                )}
                                <span className="text-xs font-medium truncate">
                                  {workout.name || workout.workout_type}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-0.5 text-[10px] text-white/40">
                                {workout.status === 'completed' && workout.actual_duration_minutes ? (
                                  <span>{workout.actual_duration_minutes}m</span>
                                ) : workout.planned_duration_minutes ? (
                                  <span>{workout.planned_duration_minutes}m planned</span>
                                ) : null}
                                {workout.actual_distance_miles && (
                                  <span>{workout.actual_distance_miles}mi</span>
                                )}
                              </div>
                            </div>
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
      {showCreateModal && createModalDate && (
        <CreateWorkoutModal
          selectedDate={createModalDate}
          onClose={() => setShowCreateModal(false)}
          onCreated={handleWorkoutCreated}
        />
      )}

      {/* Weather detail modal */}
      {selectedWeather && (
        <WeatherDetailModal
          weather={selectedWeather}
          onClose={() => setSelectedWeather(null)}
        />
      )}

    </div>
  )
}
