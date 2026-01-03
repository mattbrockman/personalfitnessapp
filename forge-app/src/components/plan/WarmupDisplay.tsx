'use client'

import { WarmupExercise } from '@/types/training-plan'
import { ChevronDown, ChevronUp, Timer, RefreshCw } from 'lucide-react'
import { useState } from 'react'

interface WarmupDisplayProps {
  warmupExercises?: WarmupExercise[]
  cooldownExercises?: WarmupExercise[]
  defaultExpanded?: boolean
}

function formatDuration(seconds: number): string {
  if (seconds >= 60) {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`
  }
  return `${seconds}s`
}

function ExerciseItem({ exercise }: { exercise: WarmupExercise }) {
  return (
    <div className="flex items-start justify-between py-1.5 border-b border-gray-100 last:border-b-0">
      <div className="flex-1">
        <span className="text-sm font-medium text-gray-800">{exercise.exercise_name}</span>
        {exercise.notes && (
          <p className="text-xs text-gray-500 mt-0.5">{exercise.notes}</p>
        )}
      </div>
      <div className="text-xs text-gray-600 ml-3">
        {exercise.duration_seconds && (
          <span className="flex items-center gap-1">
            <Timer className="w-3 h-3" />
            {formatDuration(exercise.duration_seconds)}
          </span>
        )}
        {exercise.reps && (
          <span className="flex items-center gap-1">
            <RefreshCw className="w-3 h-3" />
            {exercise.reps} reps
          </span>
        )}
      </div>
    </div>
  )
}

function ExerciseSection({
  title,
  exercises,
  isExpanded,
  onToggle,
  bgColor
}: {
  title: string
  exercises: WarmupExercise[]
  isExpanded: boolean
  onToggle: () => void
  bgColor: string
}) {
  if (!exercises || exercises.length === 0) return null

  return (
    <div className={`rounded-lg ${bgColor} overflow-hidden`}>
      <button
        onClick={onToggle}
        className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-black/5 transition-colors"
      >
        <span className="text-sm font-medium text-gray-700">{title}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">{exercises.length} exercises</span>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="px-3 pb-2">
          {exercises.map((exercise, index) => (
            <ExerciseItem key={index} exercise={exercise} />
          ))}
        </div>
      )}
    </div>
  )
}

export function WarmupDisplay({
  warmupExercises,
  cooldownExercises,
  defaultExpanded = false
}: WarmupDisplayProps) {
  const [warmupExpanded, setWarmupExpanded] = useState(defaultExpanded)
  const [cooldownExpanded, setCooldownExpanded] = useState(defaultExpanded)

  const hasWarmup = warmupExercises && warmupExercises.length > 0
  const hasCooldown = cooldownExercises && cooldownExercises.length > 0

  if (!hasWarmup && !hasCooldown) return null

  return (
    <div className="space-y-2">
      {hasWarmup && (
        <ExerciseSection
          title="Warmup"
          exercises={warmupExercises}
          isExpanded={warmupExpanded}
          onToggle={() => setWarmupExpanded(!warmupExpanded)}
          bgColor="bg-amber-50"
        />
      )}

      {hasCooldown && (
        <ExerciseSection
          title="Cooldown"
          exercises={cooldownExercises}
          isExpanded={cooldownExpanded}
          onToggle={() => setCooldownExpanded(!cooldownExpanded)}
          bgColor="bg-blue-50"
        />
      )}
    </div>
  )
}
