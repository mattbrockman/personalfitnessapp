'use client'

import { useState } from 'react'
import {
  Dumbbell,
  Bike,
  PersonStanding,
  Clock,
  Pencil,
  CalendarPlus,
  X,
  ChevronDown,
  ChevronUp,
  Zap,
  Timer,
  Activity,
  Check,
} from 'lucide-react'
import { SuggestedWorkout, INTENSITY_COLORS, PrimaryIntensity, EnhancedSuggestedExercise, WarmupExercise } from '@/types/training-plan'
import { CardioStructureDisplay } from './CardioStructureDisplay'
import { WarmupDisplay } from './WarmupDisplay'

interface EnhancedSuggestedWorkout extends SuggestedWorkout {
  warmup_exercises?: WarmupExercise[]
  cooldown_exercises?: WarmupExercise[]
  exercises: EnhancedSuggestedExercise[] | null
}

interface SuggestedWorkoutCardProps {
  workout: SuggestedWorkout | EnhancedSuggestedWorkout
  onEdit?: (workout: SuggestedWorkout) => void
  onSchedule?: (workout: SuggestedWorkout) => void
  onSkip?: (workout: SuggestedWorkout) => void
  compact?: boolean
}

// Format load display
function formatLoad(exercise: EnhancedSuggestedExercise): string {
  if (!exercise.load_type || exercise.load_value === undefined) return ''

  switch (exercise.load_type) {
    case 'percent_1rm':
      return `${exercise.load_value}% 1RM`
    case 'rpe':
      return `RPE ${exercise.load_value}`
    case 'weight':
      return `${exercise.load_value} lbs`
    case 'bodyweight':
      return 'BW'
    default:
      return ''
  }
}

export function SuggestedWorkoutCard({
  workout,
  onEdit,
  onSchedule,
  onSkip,
  compact = false,
}: SuggestedWorkoutCardProps) {
  const [expanded, setExpanded] = useState(false)

  // Get category icon
  const getCategoryIcon = () => {
    switch (workout.category) {
      case 'strength':
        return <Dumbbell size={compact ? 14 : 16} />
      case 'cardio':
        return workout.workout_type === 'run' ? (
          <PersonStanding size={compact ? 14 : 16} />
        ) : (
          <Bike size={compact ? 14 : 16} />
        )
      default:
        return <Zap size={compact ? 14 : 16} />
    }
  }

  // Get intensity color
  const getIntensityColor = () => {
    if (!workout.primary_intensity) return 'bg-white/20'
    return INTENSITY_COLORS[workout.primary_intensity as PrimaryIntensity] || 'bg-white/20'
  }

  // Check if workout is completed (scheduled AND linked workout is completed)
  const isCompleted = workout.status === 'scheduled' &&
    workout.linked_workout?.status === 'completed'

  // Status styling
  const getStatusStyle = () => {
    if (isCompleted) {
      return 'opacity-70 border-emerald-500/40'
    }
    switch (workout.status) {
      case 'scheduled':
        return 'opacity-60 border-green-500/30'
      case 'skipped':
        return 'opacity-40 line-through'
      default:
        return ''
    }
  }

  if (compact) {
    return (
      <div
        className={`p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer ${getStatusStyle()}`}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <div className={`p-1 rounded ${getIntensityColor()}`}>
            {getCategoryIcon()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{workout.name}</p>
            {workout.planned_duration_minutes && (
              <p className="text-xs text-tertiary">{workout.planned_duration_minutes}min</p>
            )}
          </div>
          {isCompleted && (
            <span className="text-xs text-emerald-400 flex items-center gap-1">
              <Check size={12} />
              Done
            </span>
          )}
          {workout.status === 'scheduled' && !isCompleted && (
            <span className="text-xs text-green-400">Scheduled</span>
          )}
        </div>

        {expanded && (
          <div className="mt-2 pt-2 border-t border-white/10">
            {/* Exercises for strength */}
            {workout.exercises && workout.exercises.length > 0 && (
              <div className="space-y-1">
                {workout.exercises.slice(0, 3).map((ex, idx) => (
                  <p key={idx} className="text-xs text-white/60">
                    {ex.exercise_name}: {ex.sets}x{ex.reps_min}-{ex.reps_max}
                  </p>
                ))}
                {workout.exercises.length > 3 && (
                  <p className="text-xs text-secondary">
                    +{workout.exercises.length - 3} more
                  </p>
                )}
              </div>
            )}

            {/* Cardio structure */}
            {workout.cardio_structure && (
              <CardioStructureDisplay structure={workout.cardio_structure} compact />
            )}

            {/* Action buttons */}
            {workout.status === 'suggested' && (
              <div className="flex gap-1 mt-2">
                {onEdit && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onEdit(workout) }}
                    className="flex-1 px-2 py-1 text-xs bg-white/10 hover:bg-white/20 rounded"
                  >
                    Edit
                  </button>
                )}
                {onSchedule && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onSchedule(workout) }}
                    className="flex-1 px-2 py-1 text-xs bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded"
                  >
                    Schedule
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // Full card view
  return (
    <div className={`glass rounded-xl overflow-hidden ${getStatusStyle()}`}>
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg ${getIntensityColor()}`}>
            {getCategoryIcon()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">{workout.name}</h3>
              {isCompleted && (
                <span className="px-2 py-0.5 text-xs bg-emerald-500/20 text-emerald-400 rounded flex items-center gap-1">
                  <Check size={12} />
                  Completed
                </span>
              )}
              {workout.status === 'scheduled' && !isCompleted && (
                <span className="px-2 py-0.5 text-xs bg-green-500/20 text-green-400 rounded">
                  Scheduled
                </span>
              )}
              {workout.status === 'skipped' && (
                <span className="px-2 py-0.5 text-xs bg-white/10 text-tertiary rounded">
                  Skipped
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-sm text-tertiary mt-1">
              <span className="capitalize">{workout.workout_type}</span>
              {workout.planned_duration_minutes && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Clock size={12} />
                    {workout.planned_duration_minutes} min
                  </span>
                </>
              )}
              {workout.primary_intensity && (
                <>
                  <span>•</span>
                  <span className="uppercase">{workout.primary_intensity}</span>
                </>
              )}
              {workout.planned_tss && (
                <>
                  <span>•</span>
                  <span>{workout.planned_tss} TSS</span>
                </>
              )}
            </div>
          </div>

          {/* Expand/Collapse */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 hover:bg-white/10 rounded"
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        {workout.description && (
          <p className="text-sm text-white/60 mt-2">{workout.description}</p>
        )}
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-white/5 pt-3 space-y-4">
          {/* Warmup section */}
          {('warmup_exercises' in workout || 'cooldown_exercises' in workout) && (
            <WarmupDisplay
              warmupExercises={(workout as EnhancedSuggestedWorkout).warmup_exercises}
              cooldownExercises={(workout as EnhancedSuggestedWorkout).cooldown_exercises}
            />
          )}

          {/* Exercises for strength workouts */}
          {workout.exercises && workout.exercises.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-tertiary font-medium">Exercises</p>
              <div className="space-y-2">
                {(workout.exercises as EnhancedSuggestedExercise[]).map((ex, idx) => (
                  <div
                    key={idx}
                    className="py-2 px-3 bg-white/5 rounded-lg"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{ex.exercise_name}</span>
                      <span className="text-sm text-white/60">
                        {ex.sets} x {ex.reps_min === ex.reps_max ? ex.reps_min : `${ex.reps_min}-${ex.reps_max}`}
                      </span>
                    </div>

                    {/* Enhanced details row */}
                    <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-tertiary">
                      {formatLoad(ex) && (
                        <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded">
                          {formatLoad(ex)}
                        </span>
                      )}
                      {ex.tempo && (
                        <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded flex items-center gap-1">
                          <Timer size={10} />
                          {ex.tempo}
                        </span>
                      )}
                      {ex.rest_seconds && (
                        <span className="px-1.5 py-0.5 bg-white/10 rounded">
                          {ex.rest_seconds}s rest
                        </span>
                      )}
                    </div>

                    {/* Coaching cues */}
                    {ex.coaching_cues && ex.coaching_cues.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-white/5">
                        <p className="text-xs text-secondary mb-1">Coaching Cues:</p>
                        <ul className="text-xs text-white/60 space-y-0.5">
                          {ex.coaching_cues.map((cue, cueIdx) => (
                            <li key={cueIdx} className="flex items-start gap-1.5">
                              <span className="text-amber-400 mt-0.5">•</span>
                              <span>{cue}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Notes */}
                    {ex.notes && (
                      <p className="text-xs text-secondary mt-1.5 italic">{ex.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cardio structure */}
          {workout.cardio_structure && (
            <div className="mt-3">
              <p className="text-xs text-tertiary font-medium mb-2">Structure</p>
              <CardioStructureDisplay structure={workout.cardio_structure} />
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      {workout.status === 'suggested' && (onEdit || onSchedule || onSkip) && (
        <div className="flex border-t border-white/5">
          {onEdit && (
            <button
              onClick={() => onEdit(workout)}
              className="flex-1 py-2 text-sm text-white/60 hover:text-white hover:bg-white/5 flex items-center justify-center gap-1.5"
            >
              <Pencil size={14} />
              Edit
            </button>
          )}
          {onSchedule && (
            <button
              onClick={() => onSchedule(workout)}
              className="flex-1 py-2 text-sm text-amber-400 hover:bg-amber-500/10 flex items-center justify-center gap-1.5"
            >
              <CalendarPlus size={14} />
              Schedule
            </button>
          )}
          {onSkip && (
            <button
              onClick={() => onSkip(workout)}
              className="flex-1 py-2 text-sm text-secondary hover:text-white/60 hover:bg-white/5 flex items-center justify-center gap-1.5"
            >
              <X size={14} />
              Skip
            </button>
          )}
        </div>
      )}
    </div>
  )
}
