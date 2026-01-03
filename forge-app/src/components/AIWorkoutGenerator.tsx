'use client'

import { useState, useRef, useEffect } from 'react'
import {
  X,
  Send,
  Sparkles,
  Dumbbell,
  Clock,
  Loader2,
  ChevronRight,
  Play,
  Pencil,
  RotateCcw,
  AlertCircle,
  Zap,
} from 'lucide-react'

// Types matching WorkoutBuilder/LiftingTracker
interface Exercise {
  id: string
  name: string
  primary_muscle: string
  equipment: string
  cues?: string[]
}

interface BuilderExercise {
  id: string
  exercise: Exercise
  sets: number
  reps_min: number
  reps_max: number
  rest_seconds: number
  superset_group: string | null
  notes: string
}

interface GeneratedWorkout {
  name: string
  exercises: BuilderExercise[]
  estimated_duration: number
  reasoning: string
}

interface AIWorkoutGeneratorProps {
  onStartWorkout: (exercises: BuilderExercise[], name: string) => void
  onEditInBuilder: (exercises: BuilderExercise[], name: string) => void
  onClose: () => void
}

// Quick selection options
const MUSCLE_FOCUS_OPTIONS = [
  { value: 'push', label: 'Push', muscles: ['chest', 'shoulders', 'triceps'] },
  { value: 'pull', label: 'Pull', muscles: ['back', 'biceps', 'rear_delts'] },
  { value: 'legs', label: 'Legs', muscles: ['quads', 'hamstrings', 'glutes', 'calves'] },
  { value: 'upper', label: 'Upper Body', muscles: ['chest', 'back', 'shoulders', 'arms'] },
  { value: 'lower', label: 'Lower Body', muscles: ['quads', 'hamstrings', 'glutes'] },
  { value: 'full', label: 'Full Body', muscles: ['all'] },
]

const DURATION_OPTIONS = [
  { value: 30, label: '30m' },
  { value: 45, label: '45m' },
  { value: 60, label: '60m' },
  { value: 90, label: '90m' },
]

const EQUIPMENT_OPTIONS = [
  { value: 'full_gym', label: 'Full Gym' },
  { value: 'dumbbells', label: 'Dumbbells Only' },
  { value: 'bodyweight', label: 'Bodyweight' },
]

export function AIWorkoutGenerator({
  onStartWorkout,
  onEditInBuilder,
  onClose,
}: AIWorkoutGeneratorProps) {
  // Form state
  const [musclesFocus, setMusclesFocus] = useState<string | null>(null)
  const [duration, setDuration] = useState<number>(45)
  const [equipment, setEquipment] = useState<string>('full_gym')
  const [customPrompt, setCustomPrompt] = useState('')

  // Generation state
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generatedWorkout, setGeneratedWorkout] = useState<GeneratedWorkout | null>(null)

  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Focus input on mount
  useEffect(() => {
    // Focus on custom prompt input after a short delay
    const timer = setTimeout(() => {
      inputRef.current?.focus()
    }, 100)
    return () => clearTimeout(timer)
  }, [])

  const handleGenerate = async (useQuickForm: boolean = false) => {
    setGenerating(true)
    setError(null)

    try {
      const body: any = {}

      if (useQuickForm) {
        // Use quick form selections
        body.muscle_focus = musclesFocus ? [musclesFocus] : []
        body.duration_minutes = duration
        body.equipment = equipment
      } else {
        // Use custom prompt
        body.prompt = customPrompt
        body.duration_minutes = duration
        body.equipment = equipment
      }

      const res = await fetch('/api/ai/generate-workout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to generate workout')
      }

      const data = await res.json()
      setGeneratedWorkout(data.workout)
    } catch (err) {
      console.error('Failed to generate workout:', err)
      setError(err instanceof Error ? err.message : 'Failed to generate workout. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && customPrompt.trim()) {
      e.preventDefault()
      handleGenerate(false)
    }
  }

  const handleStartWorkout = () => {
    if (generatedWorkout) {
      onStartWorkout(generatedWorkout.exercises, generatedWorkout.name)
    }
  }

  const handleEditInBuilder = () => {
    if (generatedWorkout) {
      onEditInBuilder(generatedWorkout.exercises, generatedWorkout.name)
    }
  }

  const handleRegenerate = () => {
    setGeneratedWorkout(null)
    if (customPrompt.trim()) {
      handleGenerate(false)
    } else if (musclesFocus) {
      handleGenerate(true)
    }
  }

  const reset = () => {
    setGeneratedWorkout(null)
    setError(null)
  }

  // Preview view when workout is generated
  if (generatedWorkout) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80" onClick={onClose}>
        <div
          className="bg-zinc-900 rounded-2xl w-full max-w-lg max-h-[85vh] overflow-hidden border border-white/10 animate-slide-up"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center">
                <Sparkles size={20} className="text-amber-400" />
              </div>
              <div>
                <h3 className="font-semibold">{generatedWorkout.name}</h3>
                <p className="text-sm text-tertiary">
                  {generatedWorkout.exercises.length} exercises • ~{generatedWorkout.estimated_duration}m
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg">
              <X size={20} />
            </button>
          </div>

          {/* AI Reasoning */}
          {generatedWorkout.reasoning && (
            <div className="px-4 py-3 bg-amber-500/10 border-b border-amber-500/20">
              <p className="text-xs text-amber-400 font-medium mb-1 flex items-center gap-1">
                <Sparkles size={12} />
                AI Reasoning
              </p>
              <p className="text-sm text-white/70">{generatedWorkout.reasoning}</p>
            </div>
          )}

          {/* Exercise list */}
          <div className="overflow-y-auto max-h-[40vh] p-4 space-y-2">
            {generatedWorkout.exercises.map((ex, index) => (
              <div key={ex.id} className="flex items-center gap-3 p-3 bg-white/5 rounded-lg">
                <span className="w-6 h-6 bg-amber-500/20 rounded text-amber-400 text-xs font-bold flex items-center justify-center">
                  {index + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{ex.exercise.name}</p>
                  <p className="text-xs text-tertiary">
                    {ex.sets} sets × {ex.reps_min === ex.reps_max ? ex.reps_min : `${ex.reps_min}-${ex.reps_max}`} reps • {ex.rest_seconds}s rest
                  </p>
                </div>
                {ex.superset_group && (
                  <span className="px-2 py-0.5 text-xs font-bold bg-amber-500/20 text-amber-400 rounded">
                    {ex.superset_group}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="p-4 border-t border-white/10 space-y-3">
            <div className="flex gap-3">
              <button
                onClick={handleStartWorkout}
                className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-black rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Play size={18} />
                Start Workout
              </button>
              <button
                onClick={handleEditInBuilder}
                className="flex-1 py-3 bg-white/10 hover:bg-white/20 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Pencil size={18} />
                Edit First
              </button>
            </div>
            <button
              onClick={handleRegenerate}
              disabled={generating}
              className="w-full py-2.5 text-white/60 hover:text-white hover:bg-white/5 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
            >
              <RotateCcw size={16} />
              Regenerate
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Main generator view
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80" onClick={onClose}>
      <div
        className="bg-zinc-900 rounded-2xl w-full max-w-lg max-h-[85vh] overflow-hidden border border-white/10 animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center">
              <Sparkles size={20} className="text-amber-400" />
            </div>
            <div>
              <h3 className="font-semibold">AI Workout Generator</h3>
              <p className="text-sm text-tertiary">Smart workouts based on your data</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6 overflow-y-auto max-h-[60vh]">
          {/* Error display */}
          {error && (
            <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg flex items-start gap-2">
              <AlertCircle size={18} className="text-red-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Quick Options Section */}
          <div>
            <h4 className="text-sm font-medium text-white/60 mb-3">Quick Options</h4>

            {/* Muscle Focus */}
            <div className="mb-4">
              <p className="text-xs text-secondary mb-2">Focus Area</p>
              <div className="flex flex-wrap gap-2">
                {MUSCLE_FOCUS_OPTIONS.map(option => (
                  <button
                    key={option.value}
                    onClick={() => setMusclesFocus(musclesFocus === option.value ? null : option.value)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      musclesFocus === option.value
                        ? 'bg-amber-500 text-black'
                        : 'bg-white/10 text-white/60 hover:bg-white/20'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Duration */}
            <div className="mb-4">
              <p className="text-xs text-secondary mb-2 flex items-center gap-1">
                <Clock size={12} />
                Duration
              </p>
              <div className="flex gap-2">
                {DURATION_OPTIONS.map(option => (
                  <button
                    key={option.value}
                    onClick={() => setDuration(option.value)}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      duration === option.value
                        ? 'bg-amber-500 text-black'
                        : 'bg-white/10 text-white/60 hover:bg-white/20'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Equipment */}
            <div className="mb-4">
              <p className="text-xs text-secondary mb-2 flex items-center gap-1">
                <Dumbbell size={12} />
                Equipment
              </p>
              <div className="flex flex-wrap gap-2">
                {EQUIPMENT_OPTIONS.map(option => (
                  <button
                    key={option.value}
                    onClick={() => setEquipment(option.value)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      equipment === option.value
                        ? 'bg-amber-500 text-black'
                        : 'bg-white/10 text-white/60 hover:bg-white/20'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick generate button */}
            <button
              onClick={() => handleGenerate(true)}
              disabled={generating || !musclesFocus}
              className="w-full py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:hover:bg-amber-500 text-black rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
            >
              {generating ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Zap size={18} />
                  Generate {musclesFocus ? MUSCLE_FOCUS_OPTIONS.find(o => o.value === musclesFocus)?.label : ''} Workout
                </>
              )}
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-xs text-secondary">or describe what you want</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {/* Custom Prompt Section */}
          <div>
            <h4 className="text-sm font-medium text-white/60 mb-3">Custom Request</h4>
            <div className="relative">
              <textarea
                ref={inputRef}
                value={customPrompt}
                onChange={e => setCustomPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="e.g., 'Push day, 45 mins, avoid shoulder exercises due to rotator cuff issue'"
                rows={3}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-muted focus:outline-none focus:border-amber-500/50 resize-none"
              />
            </div>
            <button
              onClick={() => handleGenerate(false)}
              disabled={generating || !customPrompt.trim()}
              className="w-full mt-3 py-3 bg-violet-500 hover:bg-violet-400 disabled:opacity-50 disabled:hover:bg-violet-500 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
            >
              {generating ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Send size={18} />
                  Generate Custom Workout
                </>
              )}
            </button>
          </div>

          {/* Info note */}
          <div className="p-3 bg-white/5 rounded-lg">
            <p className="text-xs text-tertiary">
              The AI considers your recent workouts, exercise history, any logged injuries, and recovery status to create a personalized workout.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
