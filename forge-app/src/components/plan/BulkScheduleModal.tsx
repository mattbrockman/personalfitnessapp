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
  useDroppable,
  useDraggable,
} from '@dnd-kit/core'
import {
  X,
  CalendarPlus,
  Loader2,
  Check,
  AlertCircle,
  Dumbbell,
  Bike,
  Clock,
  GripVertical,
} from 'lucide-react'
import { SuggestedWorkout } from '@/types/training-plan'
import { format, parseISO, addDays } from 'date-fns'

interface BulkScheduleModalProps {
  workouts: SuggestedWorkout[]
  onSchedule: (workoutIds: string[]) => Promise<void>
  onClose: () => void
  onUpdateWorkoutDate?: (workoutId: string, newDate: string) => Promise<void>
}

// Draggable workout item component
function DraggableWorkoutItem({
  workout,
  isSelected,
  onToggle,
}: {
  workout: SuggestedWorkout
  isSelected: boolean
  onToggle: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: workout.id,
    data: { workout },
  })

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 p-3 rounded-lg transition-colors ${
        isSelected
          ? 'bg-amber-500/10 border border-amber-500/30'
          : 'bg-white/5 border border-transparent hover:bg-white/10'
      }`}
    >
      <div
        {...listeners}
        {...attributes}
        className="cursor-grab active:cursor-grabbing p-1 -ml-1 text-white/30 hover:text-white/60 touch-none"
      >
        <GripVertical size={16} />
      </div>
      <label className="flex items-center gap-3 flex-1 cursor-pointer">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggle}
          className="w-4 h-4 rounded border-white/20 bg-white/5 text-amber-500 focus:ring-amber-500/50"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {workout.category === 'strength' ? (
              <Dumbbell size={14} className="text-amber-400" />
            ) : (
              <Bike size={14} className="text-blue-400" />
            )}
            <span className="font-medium truncate">{workout.name}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-white/50 mt-0.5">
            <span className="capitalize">{workout.workout_type}</span>
            {workout.planned_duration_minutes && (
              <>
                <span>•</span>
                <span>{workout.planned_duration_minutes}min</span>
              </>
            )}
            {workout.primary_intensity && (
              <>
                <span>•</span>
                <span className="uppercase">{workout.primary_intensity}</span>
              </>
            )}
          </div>
        </div>
      </label>
    </div>
  )
}

// Droppable day container component
function DroppableDayContainer({
  date,
  children,
  isOver,
}: {
  date: string
  children: React.ReactNode
  isOver?: boolean
}) {
  const { setNodeRef, isOver: dropIsOver } = useDroppable({
    id: `day-${date}`,
    data: { date },
  })

  const showHighlight = isOver || dropIsOver

  return (
    <div
      ref={setNodeRef}
      className={`transition-all ${showHighlight ? 'ring-2 ring-amber-400/50 ring-offset-2 ring-offset-[#1a1a2e] rounded-lg' : ''}`}
    >
      <p className="text-xs text-white/50 font-medium mb-2">
        {format(parseISO(date), 'EEEE, MMM d')}
      </p>
      <div className={`space-y-2 min-h-[60px] p-2 -m-2 rounded-lg ${showHighlight ? 'bg-amber-500/5' : ''}`}>
        {children}
      </div>
    </div>
  )
}

export function BulkScheduleModal({
  workouts: initialWorkouts,
  onSchedule,
  onClose,
  onUpdateWorkoutDate,
}: BulkScheduleModalProps) {
  // Local state for workouts (to track date changes)
  const [localWorkouts, setLocalWorkouts] = useState<SuggestedWorkout[]>(initialWorkouts)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(initialWorkouts.map(w => w.id))
  )
  const [isScheduling, setIsScheduling] = useState(false)
  const [result, setResult] = useState<{
    scheduled: number
    failed: number
  } | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)

  // Configure sensors for drag
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 5,
      },
    })
  )

  // Group workouts by date
  const workoutsByDate = useMemo(() => {
    return localWorkouts.reduce((acc, workout) => {
      const date = workout.suggested_date
      if (!acc[date]) acc[date] = []
      acc[date].push(workout)
      return acc
    }, {} as Record<string, SuggestedWorkout[]>)
  }, [localWorkouts])

  const sortedDates = useMemo(() => Object.keys(workoutsByDate).sort(), [workoutsByDate])

  // Get active workout for drag overlay
  const activeWorkout = useMemo(() => {
    if (!activeId) return null
    return localWorkouts.find(w => w.id === activeId) || null
  }, [activeId, localWorkouts])

  // Drag handlers
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    if (!over) return

    const workoutId = active.id as string
    const overId = over.id as string

    // Check if dropped on a day container
    if (overId.startsWith('day-')) {
      const newDate = overId.replace('day-', '')
      const workout = localWorkouts.find(w => w.id === workoutId)

      if (workout && workout.suggested_date !== newDate) {
        // Update local state immediately
        setLocalWorkouts(prev =>
          prev.map(w =>
            w.id === workoutId ? { ...w, suggested_date: newDate } : w
          )
        )

        // Persist to server if callback provided
        if (onUpdateWorkoutDate) {
          try {
            await onUpdateWorkoutDate(workoutId, newDate)
          } catch (err) {
            // Rollback on error
            setLocalWorkouts(prev =>
              prev.map(w =>
                w.id === workoutId ? { ...w, suggested_date: workout.suggested_date } : w
              )
            )
          }
        }
      }
    }
  }

  const handleDragCancel = () => {
    setActiveId(null)
  }

  // Toggle selection
  const toggleWorkout = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const toggleAll = () => {
    if (selectedIds.size === localWorkouts.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(localWorkouts.map(w => w.id)))
    }
  }

  // Calculate totals
  const selectedWorkouts = localWorkouts.filter(w => selectedIds.has(w.id))
  const totalDuration = selectedWorkouts.reduce(
    (acc, w) => acc + (w.planned_duration_minutes || 0),
    0
  )
  const strengthCount = selectedWorkouts.filter(w => w.category === 'strength').length
  const cardioCount = selectedWorkouts.filter(w => w.category === 'cardio').length

  // Handle schedule
  const handleSchedule = async () => {
    if (selectedIds.size === 0) return

    setIsScheduling(true)
    try {
      await onSchedule(Array.from(selectedIds))
      setResult({ scheduled: selectedIds.size, failed: 0 })
    } catch (error) {
      console.error('Bulk schedule error:', error)
      setResult({ scheduled: 0, failed: selectedIds.size })
    } finally {
      setIsScheduling(false)
    }
  }

  // Success state
  if (result && result.scheduled > 0) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-[#1a1a2e] rounded-2xl w-full max-w-md p-6 text-center">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check size={32} className="text-green-400" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Workouts Scheduled!</h2>
          <p className="text-white/60 mb-6">
            {result.scheduled} workout{result.scheduled !== 1 ? 's' : ''} have been added to your calendar.
          </p>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-amber-500 hover:bg-amber-400 text-black font-medium rounded-lg"
          >
            Done
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1a2e] rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 rounded-lg">
              <CalendarPlus size={20} className="text-amber-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Schedule Workouts</h2>
              <p className="text-sm text-white/50">
                {localWorkouts.length} workout{localWorkouts.length !== 1 ? 's' : ''} available
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>

        {/* Summary stats */}
        <div className="p-4 bg-white/5 border-b border-white/10">
          <div className="flex items-center justify-between text-sm">
            <button
              onClick={toggleAll}
              className="text-amber-400 hover:text-amber-300"
            >
              {selectedIds.size === localWorkouts.length ? 'Deselect All' : 'Select All'}
            </button>
            <span className="text-white/60">
              {selectedIds.size} selected
            </span>
          </div>
          <div className="grid grid-cols-3 gap-4 mt-3">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-white/60">
                <Dumbbell size={14} />
                <span className="text-lg font-semibold text-white">{strengthCount}</span>
              </div>
              <p className="text-xs text-white/40">Strength</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-white/60">
                <Bike size={14} />
                <span className="text-lg font-semibold text-white">{cardioCount}</span>
              </div>
              <p className="text-xs text-white/40">Cardio</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-white/60">
                <Clock size={14} />
                <span className="text-lg font-semibold text-white">
                  {Math.round(totalDuration / 60 * 10) / 10}h
                </span>
              </div>
              <p className="text-xs text-white/40">Total</p>
            </div>
          </div>
        </div>

        {/* Workout list with drag-and-drop */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {sortedDates.map(date => (
              <DroppableDayContainer key={date} date={date}>
                {workoutsByDate[date].map(workout => (
                  <DraggableWorkoutItem
                    key={workout.id}
                    workout={workout}
                    isSelected={selectedIds.has(workout.id)}
                    onToggle={() => toggleWorkout(workout.id)}
                  />
                ))}
              </DroppableDayContainer>
            ))}
          </div>

          {/* Drag overlay */}
          <DragOverlay>
            {activeWorkout ? (
              <div className="opacity-90 bg-[#1a1a2e] rounded-lg p-3 shadow-xl border border-amber-500/30">
                <div className="flex items-center gap-2">
                  {activeWorkout.category === 'strength' ? (
                    <Dumbbell size={14} className="text-amber-400" />
                  ) : (
                    <Bike size={14} className="text-blue-400" />
                  )}
                  <span className="font-medium">{activeWorkout.name}</span>
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleSchedule}
            disabled={selectedIds.size === 0 || isScheduling}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-medium rounded-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isScheduling ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Scheduling...
              </>
            ) : (
              <>
                <CalendarPlus size={16} />
                Schedule {selectedIds.size} Workout{selectedIds.size !== 1 ? 's' : ''}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
