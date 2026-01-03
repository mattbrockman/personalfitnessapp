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
  isSameWeek,
  addMonths,
  subMonths,
  addDays,
  subDays,
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
  Loader2,
  XCircle,
  AlertTriangle,
  CheckCircle,
  List,
  Grid3X3,
} from 'lucide-react'
import { Workout } from '@/types/database'
import { CreateWorkoutModal } from './CreateWorkoutModal'
import { WorkoutDetailModal } from './WorkoutDetailModal'
import { WeeklySummaryBar } from './WeeklySummaryBar'
import { WeatherBadge } from './WeatherBadge'
import { WeatherDetailModal } from './WeatherDetailModal'
import { WeatherDay } from '@/lib/weather'
import { PhaseType, PHASE_COLORS, PHASE_LABELS, EventType, EVENT_TYPE_ICONS } from '@/types/training-plan'
import { MonthViewStyles } from './MonthViewStyles'
import { useToast } from './Toast'

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

type ViewMode = 'week' | 'month'

// Hook to detect mobile viewport
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  return isMobile
}

export function CalendarView({ initialWorkouts, stravaConnected, lastSyncAt }: CalendarViewProps) {
  // Use null initially to avoid hydration mismatch, then set in useEffect
  const [currentDate, setCurrentDate] = useState<Date | null>(null)
  const [workouts, setWorkouts] = useState<Workout[]>(initialWorkouts)
  const [isSyncing, setIsSyncing] = useState(false)
  const [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createModalDate, setCreateModalDate] = useState<Date | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('week')
  const [planData, setPlanData] = useState<PlanData | null>(null)
  const [planLoading, setPlanLoading] = useState(true)
  const [weatherForecast, setWeatherForecast] = useState<WeatherDay[]>([])
  const [selectedWeather, setSelectedWeather] = useState<WeatherDay | null>(null)
  const [mounted, setMounted] = useState(false)
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [touchEnd, setTouchEnd] = useState<number | null>(null)
  const [draggedWorkout, setDraggedWorkout] = useState<string | null>(null)
  const [dropTargetDate, setDropTargetDate] = useState<string | null>(null)
  const [timelineStart, setTimelineStart] = useState<Date | null>(null)
  const [swipeOffset, setSwipeOffset] = useState(0) // For swipe visual feedback
  const [isLoadingWorkouts, setIsLoadingWorkouts] = useState(false)
  const isMobile = useIsMobile()
  const { addToast } = useToast()

  // Set dates after mount to avoid hydration mismatch
  useEffect(() => {
    const today = new Date()
    setCurrentDate(today)
    setCreateModalDate(today)
    // Start timeline on today
    setTimelineStart(today)
    setMounted(true)
  }, [])

  // Auto-switch to week view on mobile (avoid month view on small screens)
  useEffect(() => {
    if (mounted && isMobile && viewMode === 'month') {
      setViewMode('week')
    }
  }, [isMobile, mounted])

  // Fetch workouts from API
  const fetchWorkouts = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoadingWorkouts(true)
    try {
      const response = await fetch('/api/workouts')
      if (response.ok) {
        const data = await response.json()
        setWorkouts(data.workouts || [])
      }
    } catch (error) {
      console.error('Failed to fetch workouts:', error)
    } finally {
      setIsLoadingWorkouts(false)
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

    // Auto-poll Strava for new activities (fallback when webhooks aren't working)
    if (stravaConnected) {
      const pollStrava = async () => {
        try {
          const res = await fetch('/api/strava/poll', { method: 'POST' })
          if (res.ok) {
            const data = await res.json()
            if (data.synced && data.synced > 0) {
              addToast(
                'success',
                `Synced ${data.synced} new ${data.synced === 1 ? 'activity' : 'activities'} from Strava`
              )
              fetchWorkouts()
            }
          }
        } catch (error) {
          console.error('Auto-poll Strava failed:', error)
        }
      }
      pollStrava()
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
          <Loader2 className="w-8 h-8 animate-spin text-secondary" />
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
      setCurrentDate(prev => prev ? subMonths(prev, 1) : prev)
    } else {
      // Week view - shift timeline back
      setTimelineStart(prev => prev ? subDays(prev, 7) : prev)
      setCurrentDate(prev => prev ? subDays(prev, 7) : prev)
    }
  }

  // Touch/swipe handling for timeline
  const minSwipeDistance = 50

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null)
    setTouchStart(e.targetTouches[0].clientX)
    setSwipeOffset(0)
  }

  const onTouchMove = (e: React.TouchEvent) => {
    const currentX = e.targetTouches[0].clientX
    setTouchEnd(currentX)
    // Calculate swipe offset for visual feedback (capped at ±100px)
    if (touchStart !== null) {
      const offset = Math.max(-100, Math.min(100, (currentX - touchStart) * 0.5))
      setSwipeOffset(offset)
    }
  }

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) {
      setSwipeOffset(0)
      return
    }
    const distance = touchStart - touchEnd
    const isLeftSwipe = distance > minSwipeDistance
    const isRightSwipe = distance < -minSwipeDistance

    if (isLeftSwipe) {
      navigateNext()
    } else if (isRightSwipe) {
      navigatePrevious()
    }
    setSwipeOffset(0)
  }

  // Drag and drop handlers for workouts
  const handleDragStart = (e: React.DragEvent, workoutId: string) => {
    setDraggedWorkout(workoutId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', workoutId)
  }

  const handleDragEnd = () => {
    setDraggedWorkout(null)
    setDropTargetDate(null)
  }

  const handleDragOver = (e: React.DragEvent, dateKey: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDropTargetDate(dateKey)
  }

  const handleDragLeave = () => {
    setDropTargetDate(null)
  }

  const handleDrop = async (e: React.DragEvent, newDate: string) => {
    e.preventDefault()
    const workoutId = e.dataTransfer.getData('text/plain')

    if (!workoutId) return

    const workout = workouts.find(w => w.id === workoutId)
    if (!workout || workout.scheduled_date === newDate) {
      setDraggedWorkout(null)
      setDropTargetDate(null)
      return
    }

    // Only allow moving planned workouts, not completed ones
    if (workout.status === 'completed') {
      setDraggedWorkout(null)
      setDropTargetDate(null)
      return
    }

    try {
      const response = await fetch(`/api/workouts/${workoutId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduled_date: newDate }),
      })

      if (response.ok) {
        // Update local state
        setWorkouts(prev => prev.map(w =>
          w.id === workoutId ? { ...w, scheduled_date: newDate } : w
        ))
      }
    } catch (error) {
      console.error('Failed to move workout:', error)
    }

    setDraggedWorkout(null)
    setDropTargetDate(null)
  }

  const navigateNext = () => {
    if (viewMode === 'month') {
      setCurrentDate(prev => prev ? addMonths(prev, 1) : prev)
    } else {
      // Week view - shift timeline forward
      setTimelineStart(prev => prev ? addDays(prev, 7) : prev)
      setCurrentDate(prev => prev ? addDays(prev, 7) : prev)
    }
  }

  const getHeaderTitle = () => {
    if (viewMode === 'month') {
      return format(currentDate, 'MMMM yyyy')
    }
    // Week view - show "Week of [date]"
    if (!timelineStart) return ''
    return `Week of ${format(timelineStart, 'MMM d')}`
  }

  // Get days for timeline view (7 days starting from timelineStart)
  const timelineDays = timelineStart ? eachDayOfInterval({
    start: timelineStart,
    end: addDays(timelineStart, 6)
  }) : []

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
        if (synced > 0 || matched > 0) {
          await fetchWorkouts(false)
          addToast('success', `Synced ${synced + matched} workouts from Strava`)
        } else if (total === 0) {
          addToast('info', 'No new workouts to sync')
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

  const handleWorkoutCreated = async () => {
    await fetchWorkouts(false)
    addToast('success', 'Workout created')
  }

  return (
    <div className="p-4 lg:p-6">
      {/* Navigation with view toggle */}
      <div className="flex items-center justify-between mb-4">
        {/* View toggle icons */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setViewMode('week')}
            aria-label="Week view"
            className={`p-2 rounded-lg transition-colors ${viewMode === 'week' ? 'bg-amber-500/20 text-amber-400' : 'text-secondary hover:text-white/60 hover:bg-white/5'}`}
          >
            <List size={18} />
          </button>
          <button
            onClick={() => setViewMode('month')}
            aria-label="Month view"
            className={`p-2 rounded-lg transition-colors ${viewMode === 'month' ? 'bg-amber-500/20 text-amber-400' : 'text-secondary hover:text-white/60 hover:bg-white/5'}`}
          >
            <Grid3X3 size={18} />
          </button>
        </div>

        {/* Date navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={navigatePrevious}
            className="p-1.5 hover:bg-white/5 rounded-lg transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <h1 className="text-base font-display font-semibold min-w-[160px] text-center">
            {getHeaderTitle()}
          </h1>
          <button
            onClick={navigateNext}
            className="p-1.5 hover:bg-white/5 rounded-lg transition-colors"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Today button */}
        <button
          onClick={() => {
            const today = new Date()
            setCurrentDate(today)
            setTimelineStart(today)
          }}
          className="px-2.5 py-1 text-xs text-white/60 hover:text-white/80 hover:bg-white/5 rounded-lg transition-colors"
        >
          Today
        </button>
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

      {/* Week View - Timeline */}
      {viewMode === 'week' && (
        <div
          className="relative overflow-hidden"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {/* Swipe indicators */}
          {swipeOffset !== 0 && (
            <>
              <div className={`absolute left-2 top-1/2 -translate-y-1/2 transition-opacity ${swipeOffset > 30 ? 'opacity-100' : 'opacity-0'}`}>
                <ChevronLeft size={24} className="text-amber-400" />
              </div>
              <div className={`absolute right-2 top-1/2 -translate-y-1/2 transition-opacity ${swipeOffset < -30 ? 'opacity-100' : 'opacity-0'}`}>
                <ChevronRight size={24} className="text-amber-400" />
              </div>
            </>
          )}

          {/* Vertical timeline line */}
          <div className="absolute left-[60px] top-0 bottom-0 w-0.5 bg-white/10" />

          <div
            className="space-y-6 transition-transform duration-75"
            style={{ transform: `translateX(${swipeOffset}px)` }}
          >
            {timelineDays.map((day, idx) => {
              const dateKey = format(day, 'yyyy-MM-dd')
              const dayWorkouts = workoutsByDate[dateKey] || []
              const isCurrentDay = isToday(day)
              const dayWeather = weatherByDate[dateKey]
              const showWeather = dayWeather && (isToday(day) || day > new Date())

              return (
                <div key={idx} className="relative flex items-start gap-4">
                  {/* Date marker */}
                  <div className={`relative z-10 w-[52px] text-center flex-shrink-0 ${isCurrentDay ? 'text-amber-400' : 'text-white/60'}`}>
                    <div className="text-xs font-medium uppercase">{format(day, 'EEE')}</div>
                    <div className={`text-xl font-bold w-10 h-10 mx-auto flex items-center justify-center rounded-full ${
                      isCurrentDay ? 'bg-amber-500 text-black' : 'bg-zinc-800'
                    }`}>
                      {format(day, 'd')}
                    </div>
                  </div>

                  {/* Timeline dot */}
                  <div className={`absolute left-[56px] top-6 w-3 h-3 rounded-full border-2 ${
                    isCurrentDay ? 'bg-amber-500 border-amber-500' : 'bg-zinc-900 border-white/20'
                  }`} />

                  {/* Workouts - drop zone */}
                  <div
                    className={`flex-1 space-y-2 pl-4 min-h-[60px] rounded-lg transition-colors ${
                      dropTargetDate === dateKey ? 'bg-amber-500/10 ring-2 ring-amber-500/30' : ''
                    }`}
                    onDragOver={(e) => handleDragOver(e, dateKey)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, dateKey)}
                  >
                    {/* Loading skeleton */}
                    {isLoadingWorkouts && idx < 3 && (
                      <div className="animate-pulse flex items-center gap-3 p-3 rounded-xl bg-zinc-800/30">
                        <div className="w-12 h-12 rounded-xl bg-zinc-700/50" />
                        <div className="flex-1 space-y-2">
                          <div className="h-4 bg-zinc-700/50 rounded w-3/4" />
                          <div className="h-3 bg-zinc-700/30 rounded w-1/2" />
                        </div>
                      </div>
                    )}
                    {!isLoadingWorkouts && dayWorkouts.length === 0 ? (
                      <div className="flex items-center gap-3 py-2">
                        <span className="text-sm text-muted italic">
                          {dropTargetDate === dateKey ? 'Drop here' : 'Rest day'}
                        </span>
                        {showWeather && dayWeather && (
                          <WeatherBadge weather={dayWeather} onClick={() => setSelectedWeather(dayWeather)} size="sm" />
                        )}
                        <button
                          onClick={() => openCreateModal(day)}
                          className="ml-auto text-xs text-muted hover:text-tertiary"
                        >
                          + Add
                        </button>
                      </div>
                    ) : (
                      <>
                        {showWeather && dayWeather && (
                          <div className="mb-2">
                            <WeatherBadge weather={dayWeather} onClick={() => setSelectedWeather(dayWeather)} size="sm" />
                          </div>
                        )}
                        {dayWorkouts.map(workout => {
                          const colors = categoryColors[workout.category] || categoryColors.other
                          const Icon = getWorkoutIcon(workout.workout_type)
                          const statusIcon = getStatusIcon(workout)
                          const isDragging = draggedWorkout === workout.id
                          const canDrag = workout.status === 'planned'

                          return (
                            <div
                              key={workout.id}
                              draggable={canDrag}
                              onDragStart={(e) => canDrag && handleDragStart(e, workout.id)}
                              onDragEnd={handleDragEnd}
                              onClick={() => setSelectedWorkout(workout)}
                              className={`w-full flex items-center gap-3 p-3 rounded-xl border ${colors.border} bg-zinc-800/50 hover:bg-zinc-800 transition-all text-left cursor-pointer animate-fade-in ${
                                isDragging ? 'opacity-50 scale-95' : ''
                              } ${canDrag ? 'cursor-grab active:cursor-grabbing' : ''}`}
                              style={{ animationDelay: `${idx * 50}ms` }}
                            >
                              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colors.light}`}>
                                <Icon size={24} className={colors.text} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  {statusIcon && (
                                    <statusIcon.Icon size={14} className={statusIcon.color} />
                                  )}
                                  <span className="font-medium truncate text-base">
                                    {workout.name || workout.workout_type}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3 mt-1 text-sm text-tertiary">
                                  {workout.status === 'completed' && workout.actual_duration_minutes ? (
                                    <span className="flex items-center gap-1">
                                      <Clock size={12} />
                                      {workout.actual_duration_minutes} min
                                    </span>
                                  ) : workout.planned_duration_minutes ? (
                                    <span className="flex items-center gap-1">
                                      <Clock size={12} />
                                      {workout.planned_duration_minutes} min
                                    </span>
                                  ) : null}
                                  {workout.actual_distance_miles && (
                                    <span className="flex items-center gap-1">
                                      <Route size={12} />
                                      {workout.actual_distance_miles} mi
                                    </span>
                                  )}
                                </div>
                              </div>
                              <ChevronRight size={18} className="text-muted" />
                            </div>
                          )
                        })}
                        <button
                          onClick={() => openCreateModal(day)}
                          className="text-xs text-muted hover:text-tertiary py-1"
                        >
                          + Add workout
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Month View - Switchable styles */}
      {viewMode === 'month' && (
        <MonthViewStyles
          currentDate={currentDate}
          workouts={workouts}
          workoutsByDate={workoutsByDate}
          onSelectWorkout={setSelectedWorkout}
          onSelectDate={openCreateModal}
          weatherByDate={weatherByDate}
          onWeatherClick={setSelectedWeather}
          onWorkoutMove={async (workoutId, newDate) => {
            try {
              const response = await fetch(`/api/workouts/${workoutId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ scheduled_date: newDate }),
              })
              if (response.ok) {
                setWorkouts(prev => prev.map(w =>
                  w.id === workoutId ? { ...w, scheduled_date: newDate } : w
                ))
              }
            } catch (error) {
              console.error('Failed to move workout:', error)
            }
          }}
        />
      )}

      {/* Legend - only on week/month, at bottom */}
      {(viewMode === 'week' || viewMode === 'month') && (
        <div className="flex items-center justify-center gap-4 mt-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded bg-sky-500" />
            <span className="text-secondary">Cardio</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded bg-violet-500" />
            <span className="text-secondary">Strength</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded bg-amber-500" />
            <span className="text-secondary">Other</span>
          </div>
        </div>
      )}

      {/* Workout detail modal */}
      {selectedWorkout && (
        <WorkoutDetailModal
          workout={selectedWorkout}
          onClose={() => setSelectedWorkout(null)}
          onUpdate={async () => {
            await fetchWorkouts(false)
            setSelectedWorkout(null)
            addToast('success', 'Workout updated')
          }}
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
