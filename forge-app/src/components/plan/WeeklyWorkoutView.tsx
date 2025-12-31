'use client'

import { useState, useMemo } from 'react'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  closestCenter,
  useSensor,
  useSensors,
  PointerSensor,
  TouchSensor,
} from '@dnd-kit/core'
import {
  ChevronLeft,
  ChevronRight,
  CalendarPlus,
  Loader2,
  RefreshCw,
  Plus,
} from 'lucide-react'
import {
  SuggestedWorkout,
  TrainingPhase,
  PHASE_COLORS,
  PHASE_LABELS,
} from '@/types/training-plan'
import { SuggestedWorkoutCard } from './SuggestedWorkoutCard'
import { DraggableWorkoutCard, DroppableDayColumn } from './DragDropComponents'
import { addDays, startOfWeek, format, isSameDay, parseISO, addWeeks, subWeeks } from 'date-fns'

interface WeeklyWorkoutViewProps {
  planId: string
  suggestedWorkouts: SuggestedWorkout[]
  phases: TrainingPhase[]
  currentWeekStart: Date
  onWeekChange: (weekStart: Date) => void
  onEdit?: (workout: SuggestedWorkout) => void
  onSchedule?: (workout: SuggestedWorkout) => void
  onScheduleWeek?: (workouts: SuggestedWorkout[]) => void
  onSkip?: (workout: SuggestedWorkout) => void
  onRefresh?: () => void
  onAddWorkout?: (date: Date) => void
  onMoveWorkout?: (workoutId: string, newDate: string, newDayOfWeek: string) => Promise<void>
  isLoading?: boolean
}

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export function WeeklyWorkoutView({
  planId,
  suggestedWorkouts,
  phases,
  currentWeekStart,
  onWeekChange,
  onEdit,
  onSchedule,
  onScheduleWeek,
  onSkip,
  onRefresh,
  onAddWorkout,
  onMoveWorkout,
  isLoading = false,
}: WeeklyWorkoutViewProps) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  // Configure sensors for drag
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement before drag starts
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 5,
      },
    })
  )

  // Get workouts for the current week
  const weekWorkouts = useMemo(() => {
    const workoutsByDay: Record<string, SuggestedWorkout[]> = {}
    const weekEnd = addDays(currentWeekStart, 6)

    DAYS_OF_WEEK.forEach(day => {
      workoutsByDay[day.toLowerCase()] = []
    })

    suggestedWorkouts.forEach(workout => {
      const workoutDate = parseISO(workout.suggested_date)
      if (workoutDate >= currentWeekStart && workoutDate <= weekEnd) {
        const dayKey = workout.day_of_week?.toLowerCase() || format(workoutDate, 'EEEE').toLowerCase()
        if (workoutsByDay[dayKey]) {
          workoutsByDay[dayKey].push(workout)
        }
      }
    })

    return workoutsByDay
  }, [suggestedWorkouts, currentWeekStart])

  // Get current phase for this week
  const currentPhase = useMemo(() => {
    const midWeek = addDays(currentWeekStart, 3)
    const midWeekStr = format(midWeek, 'yyyy-MM-dd')
    return phases.find(p => p.start_date <= midWeekStr && p.end_date >= midWeekStr)
  }, [phases, currentWeekStart])

  // Get week number within plan
  const weekNumber = useMemo(() => {
    if (!phases.length) return null
    const planStart = parseISO(phases[0].start_date)
    const weeksDiff = Math.floor((currentWeekStart.getTime() - startOfWeek(planStart, { weekStartsOn: 1 }).getTime()) / (7 * 24 * 60 * 60 * 1000))
    return weeksDiff + 1
  }, [phases, currentWeekStart])

  // Check if there are schedulable workouts this week
  const schedulableWorkouts = useMemo(() => {
    return Object.values(weekWorkouts).flat().filter(w => w.status === 'suggested')
  }, [weekWorkouts])

  // Navigation
  const goToPreviousWeek = () => onWeekChange(subWeeks(currentWeekStart, 1))
  const goToNextWeek = () => onWeekChange(addWeeks(currentWeekStart, 1))
  const goToCurrentWeek = () => onWeekChange(startOfWeek(new Date(), { weekStartsOn: 1 }))

  // Check if viewing current week
  const isCurrentWeek = isSameDay(currentWeekStart, startOfWeek(new Date(), { weekStartsOn: 1 }))

  // Get the active workout for drag overlay
  const activeWorkout = useMemo(() => {
    if (!activeId) return null
    return suggestedWorkouts.find(w => w.id === activeId) || null
  }, [activeId, suggestedWorkouts])

  // Drag handlers
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
    setIsDragging(true)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)
    setIsDragging(false)

    if (!over || !onMoveWorkout) return

    const workoutId = active.id as string
    const targetDay = over.id as string // e.g., "monday", "tuesday", etc.

    // Find the target date
    const dayIndex = DAYS_OF_WEEK.findIndex(d => d.toLowerCase() === targetDay)
    if (dayIndex === -1) return

    const newDate = addDays(currentWeekStart, dayIndex)
    const newDateStr = format(newDate, 'yyyy-MM-dd')

    // Check if workout is already on this day
    const workout = suggestedWorkouts.find(w => w.id === workoutId)
    if (workout?.suggested_date === newDateStr) return

    // Move the workout
    await onMoveWorkout(workoutId, newDateStr, targetDay)
  }

  const handleDragCancel = () => {
    setActiveId(null)
    setIsDragging(false)
  }

  return (
    <div className="space-y-4">
      {/* Header with navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={goToPreviousWeek}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              title="Previous week"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="text-center min-w-[200px]">
              <p className="font-semibold">
                Week {weekNumber || '—'}
              </p>
              <p className="text-sm text-white/50">
                {format(currentWeekStart, 'MMM d')} - {format(addDays(currentWeekStart, 6), 'MMM d, yyyy')}
              </p>
            </div>
            <button
              onClick={goToNextWeek}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              title="Next week"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          {!isCurrentWeek && (
            <button
              onClick={goToCurrentWeek}
              className="text-sm text-amber-400 hover:text-amber-300"
            >
              Today
            </button>
          )}
        </div>

        {/* Phase indicator and actions */}
        <div className="flex items-center gap-3">
          {currentPhase && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5">
              <div className={`w-2 h-2 rounded-full ${PHASE_COLORS[currentPhase.phase_type]}`} />
              <span className="text-sm">
                {currentPhase.name}
                <span className="text-white/50 ml-1">({PHASE_LABELS[currentPhase.phase_type]})</span>
              </span>
            </div>
          )}

          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
              title="Refresh workouts"
            >
              <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
            </button>
          )}

          {schedulableWorkouts.length > 0 && onScheduleWeek && (
            <button
              onClick={() => onScheduleWeek(schedulableWorkouts)}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-medium rounded-lg text-sm flex items-center gap-2"
            >
              <CalendarPlus size={16} />
              Schedule Week ({schedulableWorkouts.length})
            </button>
          )}
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={32} className="text-amber-400 animate-spin" />
        </div>
      )}

      {/* Week grid with drag-and-drop */}
      {!isLoading && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
            {DAYS_OF_WEEK.map((day, idx) => {
              const dayDate = addDays(currentWeekStart, idx)
              const isToday = isSameDay(dayDate, new Date())
              const dayWorkouts = weekWorkouts[day.toLowerCase()] || []
              const hasWorkouts = dayWorkouts.length > 0

              return (
                <DroppableDayColumn
                  key={day}
                  id={day.toLowerCase()}
                  isOver={isDragging}
                >
                  <div
                    className={`rounded-xl overflow-hidden h-full ${
                      isToday
                        ? 'ring-2 ring-amber-500/50 bg-amber-500/5'
                        : 'bg-white/5'
                    }`}
                  >
                    {/* Day header */}
                    <div className={`px-3 py-2 flex items-center justify-between ${isToday ? 'bg-amber-500/10' : 'bg-white/5'}`}>
                      <div>
                        <p className="text-xs text-white/50">{day.slice(0, 3)}</p>
                        <p className={`font-semibold ${isToday ? 'text-amber-400' : ''}`}>
                          {format(dayDate, 'd')}
                        </p>
                      </div>
                      {onAddWorkout && (
                        <button
                          onClick={() => onAddWorkout(dayDate)}
                          className="p-1 hover:bg-white/10 rounded transition-colors"
                          title="Add workout"
                        >
                          <Plus size={16} className="text-white/40 hover:text-white/70" />
                        </button>
                      )}
                    </div>

                    {/* Workouts */}
                    <div className="p-2 min-h-[120px]">
                      {hasWorkouts ? (
                        <div className="space-y-2">
                          {dayWorkouts.map(workout => (
                            <DraggableWorkoutCard
                              key={workout.id}
                              id={workout.id}
                              workout={workout}
                              onEdit={onEdit}
                              onSchedule={onSchedule}
                              onSkip={onSkip}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="h-full flex items-center justify-center text-white/20 text-xs min-h-[80px]">
                          Rest
                        </div>
                      )}
                    </div>
                  </div>
                </DroppableDayColumn>
              )
            })}
          </div>

          {/* Drag overlay */}
          <DragOverlay>
            {activeWorkout ? (
              <div className="opacity-90 transform scale-105">
                <SuggestedWorkoutCard workout={activeWorkout} compact />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* No workouts message */}
      {!isLoading && Object.values(weekWorkouts).every(w => w.length === 0) && (
        <div className="glass rounded-xl p-8 text-center">
          <p className="text-white/50">No workouts generated for this week yet.</p>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="mt-4 px-4 py-2 bg-violet-500/20 hover:bg-violet-500/30 text-violet-400 rounded-lg text-sm"
            >
              Generate Workouts
            </button>
          )}
        </div>
      )}

      {/* Weekly summary */}
      {!isLoading && schedulableWorkouts.length > 0 && (
        <div className="glass rounded-xl p-4">
          <h3 className="text-sm font-medium text-white/60 mb-3">Week Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-2xl font-semibold">
                {Object.values(weekWorkouts).flat().length}
              </p>
              <p className="text-xs text-white/50">Total Workouts</p>
            </div>
            <div>
              <p className="text-2xl font-semibold">
                {Object.values(weekWorkouts).flat().filter(w => w.category === 'strength').length}
              </p>
              <p className="text-xs text-white/50">Strength</p>
            </div>
            <div>
              <p className="text-2xl font-semibold">
                {Object.values(weekWorkouts).flat().filter(w => w.category === 'cardio').length}
              </p>
              <p className="text-xs text-white/50">Cardio</p>
            </div>
            <div>
              <p className="text-2xl font-semibold">
                {Math.round(Object.values(weekWorkouts).flat().reduce((acc, w) => acc + (w.planned_duration_minutes || 0), 0) / 60 * 10) / 10}h
              </p>
              <p className="text-xs text-white/50">Total Hours</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
