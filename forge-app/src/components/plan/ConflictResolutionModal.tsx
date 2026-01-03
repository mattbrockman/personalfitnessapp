'use client'

import { useState, useMemo } from 'react'
import { X, Loader2, AlertTriangle, Check, Replace, Plus, Minus } from 'lucide-react'
import { SuggestedWorkout } from '@/types/training-plan'
import { format, parseISO } from 'date-fns'

interface ExistingWorkout {
  id: string
  name: string
  category: string
  workout_type: string
  status: string
  duration_minutes: number
  scheduled_at: string
}

interface ConflictResolutionModalProps {
  suggestedWorkouts: SuggestedWorkout[]
  conflicts: Record<string, ExistingWorkout[]>
  onConfirm: (options: {
    suggestedWorkoutIds: string[]
    overwriteWorkoutIds: string[]
    skipSuggestedIds: string[]
  }) => void
  onClose: () => void
  isSubmitting?: boolean
}

type ConflictDecision = 'keep' | 'overwrite'
type SuggestedDecision = 'add' | 'skip'

export function ConflictResolutionModal({
  suggestedWorkouts,
  conflicts,
  onConfirm,
  onClose,
  isSubmitting = false,
}: ConflictResolutionModalProps) {
  // Track decisions for existing workouts: keep or overwrite
  const [existingDecisions, setExistingDecisions] = useState<Record<string, ConflictDecision>>(() => {
    const initial: Record<string, ConflictDecision> = {}
    Object.values(conflicts).flat().forEach(w => {
      initial[w.id] = 'keep' // Default to keeping existing
    })
    return initial
  })

  // Track decisions for suggested workouts: add or skip
  const [suggestedDecisions, setSuggestedDecisions] = useState<Record<string, SuggestedDecision>>(() => {
    const initial: Record<string, SuggestedDecision> = {}
    suggestedWorkouts.forEach(w => {
      initial[w.id] = 'add' // Default to adding new
    })
    return initial
  })

  // Group suggested workouts by date
  const suggestedByDate = useMemo(() => {
    const grouped: Record<string, SuggestedWorkout[]> = {}
    suggestedWorkouts.forEach(w => {
      if (!grouped[w.suggested_date]) {
        grouped[w.suggested_date] = []
      }
      grouped[w.suggested_date].push(w)
    })
    return grouped
  }, [suggestedWorkouts])

  // Get all unique dates (from both conflicts and suggested)
  const allDates = useMemo(() => {
    const dates = new Set([
      ...Object.keys(conflicts),
      ...Object.keys(suggestedByDate),
    ])
    return Array.from(dates).sort()
  }, [conflicts, suggestedByDate])

  // Calculate summary
  const summary = useMemo(() => {
    const toAdd = Object.entries(suggestedDecisions)
      .filter(([, d]) => d === 'add')
      .map(([id]) => id)
    const toSkip = Object.entries(suggestedDecisions)
      .filter(([, d]) => d === 'skip')
      .map(([id]) => id)
    const toOverwrite = Object.entries(existingDecisions)
      .filter(([, d]) => d === 'overwrite')
      .map(([id]) => id)
    const toKeep = Object.entries(existingDecisions)
      .filter(([, d]) => d === 'keep')
      .map(([id]) => id)

    return { toAdd, toSkip, toOverwrite, toKeep }
  }, [suggestedDecisions, existingDecisions])

  const handleConfirm = () => {
    onConfirm({
      suggestedWorkoutIds: suggestedWorkouts.map(w => w.id),
      overwriteWorkoutIds: summary.toOverwrite,
      skipSuggestedIds: summary.toSkip,
    })
  }

  const hasConflicts = Object.keys(conflicts).length > 0

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1a2e] rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            {hasConflicts ? (
              <div className="p-2 bg-amber-500/20 rounded-lg">
                <AlertTriangle size={20} className="text-amber-400" />
              </div>
            ) : (
              <div className="p-2 bg-green-500/20 rounded-lg">
                <Check size={20} className="text-green-400" />
              </div>
            )}
            <div>
              <h2 className="text-lg font-semibold">
                {hasConflicts ? 'Schedule Conflicts Detected' : 'Confirm Scheduling'}
              </h2>
              <p className="text-sm text-tertiary">
                {hasConflicts
                  ? 'Choose how to handle existing workouts'
                  : `${suggestedWorkouts.length} workouts ready to schedule`}
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {allDates.map(date => {
            const existing = conflicts[date] || []
            const suggested = suggestedByDate[date] || []
            const hasConflict = existing.length > 0

            return (
              <div key={date} className={`rounded-xl overflow-hidden ${hasConflict ? 'bg-amber-500/5 border border-amber-500/20' : 'bg-white/5'}`}>
                {/* Date header */}
                <div className={`px-4 py-2 ${hasConflict ? 'bg-amber-500/10' : 'bg-white/5'}`}>
                  <p className="font-medium">
                    {format(parseISO(date), 'EEEE, MMM d')}
                    {hasConflict && (
                      <span className="ml-2 text-xs text-amber-400 font-normal">
                        ({existing.length} existing)
                      </span>
                    )}
                  </p>
                </div>

                <div className="p-3 space-y-3">
                  {/* Existing workouts */}
                  {existing.map(workout => (
                    <div key={workout.id} className="bg-white/5 rounded-lg p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs uppercase tracking-wider text-secondary">Existing</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${
                              workout.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                              workout.status === 'planned' ? 'bg-blue-500/20 text-blue-400' :
                              'bg-gray-500/20 text-gray-400'
                            }`}>
                              {workout.status}
                            </span>
                          </div>
                          <p className="font-medium truncate">{workout.name}</p>
                          <p className="text-sm text-tertiary">
                            {workout.duration_minutes}min • {workout.category}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setExistingDecisions(prev => ({
                              ...prev,
                              [workout.id]: 'keep'
                            }))}
                            className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5 ${
                              existingDecisions[workout.id] === 'keep'
                                ? 'bg-green-500 text-white'
                                : 'bg-white/10 hover:bg-white/20 text-white/70'
                            }`}
                          >
                            <Check size={14} />
                            Keep
                          </button>
                          <button
                            onClick={() => setExistingDecisions(prev => ({
                              ...prev,
                              [workout.id]: 'overwrite'
                            }))}
                            disabled={workout.status === 'completed'}
                            className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5 ${
                              existingDecisions[workout.id] === 'overwrite'
                                ? 'bg-red-500 text-white'
                                : 'bg-white/10 hover:bg-white/20 text-white/70'
                            } disabled:opacity-30 disabled:cursor-not-allowed`}
                            title={workout.status === 'completed' ? "Can't overwrite completed workouts" : 'Remove this workout'}
                          >
                            <Replace size={14} />
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Suggested workouts */}
                  {suggested.map(workout => (
                    <div key={workout.id} className="bg-white/5 rounded-lg p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs uppercase tracking-wider text-amber-400">New</span>
                          </div>
                          <p className="font-medium truncate">{workout.name}</p>
                          <p className="text-sm text-tertiary">
                            {workout.planned_duration_minutes}min • {workout.category} • {workout.workout_type}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setSuggestedDecisions(prev => ({
                              ...prev,
                              [workout.id]: 'add'
                            }))}
                            className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5 ${
                              suggestedDecisions[workout.id] === 'add'
                                ? 'bg-amber-500 text-black'
                                : 'bg-white/10 hover:bg-white/20 text-white/70'
                            }`}
                          >
                            <Plus size={14} />
                            Add
                          </button>
                          <button
                            onClick={() => setSuggestedDecisions(prev => ({
                              ...prev,
                              [workout.id]: 'skip'
                            }))}
                            className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5 ${
                              suggestedDecisions[workout.id] === 'skip'
                                ? 'bg-gray-500 text-white'
                                : 'bg-white/10 hover:bg-white/20 text-white/70'
                            }`}
                          >
                            <Minus size={14} />
                            Skip
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* Summary and actions */}
        <div className="p-4 border-t border-white/10 shrink-0">
          <div className="mb-4 p-3 bg-white/5 rounded-lg">
            <p className="text-sm text-white/60 mb-2">Summary</p>
            <div className="flex flex-wrap gap-4 text-sm">
              <div>
                <span className="text-amber-400 font-medium">{summary.toAdd.length}</span>
                <span className="text-tertiary ml-1">to add</span>
              </div>
              {summary.toSkip.length > 0 && (
                <div>
                  <span className="text-gray-400 font-medium">{summary.toSkip.length}</span>
                  <span className="text-tertiary ml-1">to skip</span>
                </div>
              )}
              {summary.toOverwrite.length > 0 && (
                <div>
                  <span className="text-red-400 font-medium">{summary.toOverwrite.length}</span>
                  <span className="text-tertiary ml-1">to remove</span>
                </div>
              )}
              {summary.toKeep.length > 0 && (
                <div>
                  <span className="text-green-400 font-medium">{summary.toKeep.length}</span>
                  <span className="text-tertiary ml-1">to keep</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={isSubmitting || summary.toAdd.length === 0}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-medium rounded-lg flex items-center gap-2 disabled:opacity-50"
            >
              {isSubmitting && <Loader2 size={16} className="animate-spin" />}
              {hasConflicts ? 'Apply & Schedule' : 'Schedule All'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
