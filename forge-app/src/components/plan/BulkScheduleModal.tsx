'use client'

import { useState } from 'react'
import {
  X,
  CalendarPlus,
  Loader2,
  Check,
  AlertCircle,
  Dumbbell,
  Bike,
  Clock,
} from 'lucide-react'
import { SuggestedWorkout } from '@/types/training-plan'
import { format } from 'date-fns'

interface BulkScheduleModalProps {
  workouts: SuggestedWorkout[]
  onSchedule: (workoutIds: string[]) => Promise<void>
  onClose: () => void
}

export function BulkScheduleModal({
  workouts,
  onSchedule,
  onClose,
}: BulkScheduleModalProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(workouts.map(w => w.id))
  )
  const [isScheduling, setIsScheduling] = useState(false)
  const [result, setResult] = useState<{
    scheduled: number
    failed: number
  } | null>(null)

  // Group workouts by date
  const workoutsByDate = workouts.reduce((acc, workout) => {
    const date = workout.suggested_date
    if (!acc[date]) acc[date] = []
    acc[date].push(workout)
    return acc
  }, {} as Record<string, SuggestedWorkout[]>)

  const sortedDates = Object.keys(workoutsByDate).sort()

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
    if (selectedIds.size === workouts.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(workouts.map(w => w.id)))
    }
  }

  // Calculate totals
  const selectedWorkouts = workouts.filter(w => selectedIds.has(w.id))
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
                {workouts.length} workout{workouts.length !== 1 ? 's' : ''} available
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
              {selectedIds.size === workouts.length ? 'Deselect All' : 'Select All'}
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

        {/* Workout list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {sortedDates.map(date => (
            <div key={date}>
              <p className="text-xs text-white/50 font-medium mb-2">
                {format(new Date(date), 'EEEE, MMM d')}
              </p>
              <div className="space-y-2">
                {workoutsByDate[date].map(workout => (
                  <label
                    key={workout.id}
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                      selectedIds.has(workout.id)
                        ? 'bg-amber-500/10 border border-amber-500/30'
                        : 'bg-white/5 border border-transparent hover:bg-white/10'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(workout.id)}
                      onChange={() => toggleWorkout(workout.id)}
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
                ))}
              </div>
            </div>
          ))}
        </div>

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
