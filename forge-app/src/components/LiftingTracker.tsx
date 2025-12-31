'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Plus,
  Minus,
  Check,
  ChevronDown,
  ChevronUp,
  Search,
  Clock,
  Dumbbell,
  RotateCcw,
  Play,
  Pause,
  SkipForward,
  GripVertical,
  X,
  Save,
  Trash2,
  ChevronRight,
  Flame,
  Target,
} from 'lucide-react'

// Types
interface Exercise {
  id: string
  name: string
  primary_muscle: string
  equipment: string
  cues?: string[]
}

interface SetData {
  id: string
  set_number: number
  set_type: 'warmup' | 'working' | 'dropset' | 'failure' | 'amrap'
  target_reps: number | null
  target_weight: number | null
  target_rpe: number | null
  actual_reps: number | null
  actual_weight: number | null
  actual_rpe: number | null
  completed: boolean
}

interface WorkoutExercise {
  id: string
  exercise: Exercise
  superset_group: string | null // 'A', 'B', 'C' etc
  rest_seconds: number
  notes: string
  sets: SetData[]
  collapsed: boolean
}

// Constants
const SET_TYPES = [
  { value: 'warmup', label: 'Warm-up', color: 'text-blue-400' },
  { value: 'working', label: 'Working', color: 'text-white' },
  { value: 'dropset', label: 'Drop Set', color: 'text-orange-400' },
  { value: 'failure', label: 'To Failure', color: 'text-red-400' },
  { value: 'amrap', label: 'AMRAP', color: 'text-purple-400' },
]

const RPE_OPTIONS = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10]

// Mock exercise data (would come from API)
const MOCK_EXERCISES: Exercise[] = [
  { id: '1', name: 'Barbell Bench Press', primary_muscle: 'chest', equipment: 'barbell', cues: ['Squeeze shoulder blades', 'Drive feet into floor'] },
  { id: '2', name: 'Incline Dumbbell Press', primary_muscle: 'chest', equipment: 'dumbbells', cues: ['30-45 degree angle', 'Feel upper chest stretch'] },
  { id: '3', name: 'Cable Flyes', primary_muscle: 'chest', equipment: 'cable', cues: ['Think elbows together', 'Constant tension'] },
  { id: '4', name: 'Barbell Row', primary_muscle: 'back', equipment: 'barbell', cues: ['Lead with elbows', 'Flat back'] },
  { id: '5', name: 'Pull-Ups', primary_muscle: 'back', equipment: 'bodyweight', cues: ['Full hang at bottom', 'Chin over bar'] },
  { id: '6', name: 'Lat Pulldown', primary_muscle: 'back', equipment: 'cable', cues: ['Slight lean back', 'Pull to chest'] },
  { id: '7', name: 'Barbell Back Squat', primary_muscle: 'legs', equipment: 'barbell', cues: ['Brace core', 'Knees track toes'] },
  { id: '8', name: 'Romanian Deadlift', primary_muscle: 'hamstrings', equipment: 'barbell', cues: ['Push hips back', 'Feel hamstring stretch'] },
  { id: '9', name: 'Leg Press', primary_muscle: 'legs', equipment: 'machine', cues: ['Dont lock knees', 'Full ROM'] },
  { id: '10', name: 'Overhead Press', primary_muscle: 'shoulders', equipment: 'barbell', cues: ['Squeeze glutes', 'Head through at top'] },
]

// Rest Timer Component
function RestTimer({ 
  seconds, 
  onComplete,
  onSkip 
}: { 
  seconds: number
  onComplete: () => void
  onSkip: () => void 
}) {
  const [timeLeft, setTimeLeft] = useState(seconds)
  const [isRunning, setIsRunning] = useState(true)

  useEffect(() => {
    if (!isRunning || timeLeft <= 0) {
      if (timeLeft <= 0) onComplete()
      return
    }

    const timer = setInterval(() => {
      setTimeLeft(t => t - 1)
    }, 1000)

    return () => clearInterval(timer)
  }, [isRunning, timeLeft, onComplete])

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60)
    const secs = s % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const progress = ((seconds - timeLeft) / seconds) * 100

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 glass-strong rounded-2xl p-4 flex items-center gap-4 z-30 animate-slide-up">
      <div className="relative w-16 h-16">
        <svg className="w-full h-full -rotate-90">
          <circle
            cx="32"
            cy="32"
            r="28"
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="4"
          />
          <circle
            cx="32"
            cy="32"
            r="28"
            fill="none"
            stroke="#f59e0b"
            strokeWidth="4"
            strokeDasharray={`${progress * 1.76} 176`}
            className="transition-all duration-1000"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-lg font-mono font-bold">
          {formatTime(timeLeft)}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => setIsRunning(!isRunning)}
          className="p-2 rounded-lg hover:bg-white/10 transition-colors"
        >
          {isRunning ? <Pause size={20} /> : <Play size={20} />}
        </button>
        <button
          onClick={() => setTimeLeft(t => t + 30)}
          className="px-3 py-1.5 text-sm bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
        >
          +30s
        </button>
        <button
          onClick={onSkip}
          className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white/60"
        >
          <SkipForward size={20} />
        </button>
      </div>
    </div>
  )
}

// Exercise Search Modal
function ExerciseSearchModal({
  onSelect,
  onClose,
}: {
  onSelect: (exercise: Exercise) => void
  onClose: () => void
}) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const filteredExercises = MOCK_EXERCISES.filter(ex => {
    const matchesSearch = ex.name.toLowerCase().includes(search.toLowerCase())
    const matchesFilter = !filter || ex.primary_muscle === filter
    return matchesSearch && matchesFilter
  })

  const muscleGroups = Array.from(new Set(MOCK_EXERCISES.map(e => e.primary_muscle)))

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/80" onClick={onClose}>
      <div 
        className="bg-zinc-900 rounded-2xl w-full max-w-lg max-h-[80vh] overflow-hidden border border-white/10 animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b border-white/10">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search exercises..."
              className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-amber-500/50"
            />
          </div>
          
          <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
            <button
              onClick={() => setFilter(null)}
              className={`px-3 py-1 rounded-full text-sm whitespace-nowrap transition-colors ${
                !filter ? 'bg-amber-500 text-black' : 'bg-white/10 text-white/60 hover:bg-white/20'
              }`}
            >
              All
            </button>
            {muscleGroups.map(muscle => (
              <button
                key={muscle}
                onClick={() => setFilter(muscle)}
                className={`px-3 py-1 rounded-full text-sm whitespace-nowrap capitalize transition-colors ${
                  filter === muscle ? 'bg-amber-500 text-black' : 'bg-white/10 text-white/60 hover:bg-white/20'
                }`}
              >
                {muscle}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-y-auto max-h-[50vh]">
          {filteredExercises.map(exercise => (
            <button
              key={exercise.id}
              onClick={() => {
                onSelect(exercise)
                onClose()
              }}
              className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center">
                <Dumbbell size={18} className="text-violet-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium">{exercise.name}</p>
                <p className="text-sm text-white/50 capitalize">{exercise.primary_muscle} • {exercise.equipment}</p>
              </div>
              <ChevronRight size={18} className="text-white/30" />
            </button>
          ))}

          {filteredExercises.length === 0 && (
            <div className="p-8 text-center text-white/40">
              No exercises found
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Single Set Row
function SetRow({
  set,
  exerciseName,
  previousSet,
  onUpdate,
  onComplete,
  onDelete,
}: {
  set: SetData
  exerciseName: string
  previousSet?: { reps: number; weight: number }
  onUpdate: (updates: Partial<SetData>) => void
  onComplete: () => void
  onDelete: () => void
}) {
  const setType = SET_TYPES.find(t => t.value === set.set_type)

  return (
    <div className={`flex items-center gap-2 py-2 ${set.completed ? 'opacity-50' : ''}`}>
      {/* Set number/type */}
      <div className="w-12 text-center">
        <span className={`text-sm font-medium ${setType?.color || 'text-white'}`}>
          {set.set_type === 'warmup' ? 'W' : set.set_number}
        </span>
      </div>

      {/* Previous (reference) */}
      <div className="w-16 text-center text-white/40 text-sm">
        {previousSet ? `${previousSet.weight}×${previousSet.reps}` : '—'}
      </div>

      {/* Target */}
      <div className="w-20">
        <input
          type="text"
          value={set.target_weight ?? ''}
          onChange={e => onUpdate({ target_weight: e.target.value ? Number(e.target.value) : null })}
          placeholder="lbs"
          className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-center text-sm focus:outline-none focus:border-amber-500/50"
          disabled={set.completed}
        />
      </div>

      <span className="text-white/30">×</span>

      <div className="w-16">
        <input
          type="text"
          value={set.target_reps ?? ''}
          onChange={e => onUpdate({ target_reps: e.target.value ? Number(e.target.value) : null })}
          placeholder="reps"
          className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-center text-sm focus:outline-none focus:border-amber-500/50"
          disabled={set.completed}
        />
      </div>

      {/* Actual */}
      <div className="w-20">
        <input
          type="text"
          value={set.actual_weight ?? ''}
          onChange={e => onUpdate({ actual_weight: e.target.value ? Number(e.target.value) : null })}
          placeholder={set.target_weight?.toString() || 'lbs'}
          className={`w-full border rounded px-2 py-1.5 text-center text-sm focus:outline-none focus:border-amber-500/50 ${
            set.completed 
              ? 'bg-emerald-500/20 border-emerald-500/30' 
              : 'bg-white/10 border-white/20'
          }`}
        />
      </div>

      <span className="text-white/30">×</span>

      <div className="w-16">
        <input
          type="text"
          value={set.actual_reps ?? ''}
          onChange={e => onUpdate({ actual_reps: e.target.value ? Number(e.target.value) : null })}
          placeholder={set.target_reps?.toString() || 'reps'}
          className={`w-full border rounded px-2 py-1.5 text-center text-sm focus:outline-none focus:border-amber-500/50 ${
            set.completed 
              ? 'bg-emerald-500/20 border-emerald-500/30' 
              : 'bg-white/10 border-white/20'
          }`}
        />
      </div>

      {/* RPE */}
      <select
        value={set.actual_rpe ?? ''}
        onChange={e => onUpdate({ actual_rpe: e.target.value ? Number(e.target.value) : null })}
        className="w-16 bg-white/5 border border-white/10 rounded px-1 py-1.5 text-center text-sm focus:outline-none focus:border-amber-500/50"
        disabled={set.completed}
      >
        <option value="">RPE</option>
        {RPE_OPTIONS.map(rpe => (
          <option key={rpe} value={rpe}>{rpe}</option>
        ))}
      </select>

      {/* Complete button */}
      <button
        onClick={onComplete}
        className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
          set.completed 
            ? 'bg-emerald-500 text-white' 
            : 'bg-white/10 text-white/60 hover:bg-amber-500 hover:text-black'
        }`}
      >
        <Check size={18} />
      </button>
    </div>
  )
}

// Exercise Card
function ExerciseCard({
  workoutExercise,
  index,
  onUpdate,
  onRemove,
  onSetComplete,
}: {
  workoutExercise: WorkoutExercise
  index: number
  onUpdate: (updates: Partial<WorkoutExercise>) => void
  onRemove: () => void
  onSetComplete: (setId: string) => void
}) {
  const { exercise, sets, collapsed, superset_group, rest_seconds, notes } = workoutExercise
  const completedSets = sets.filter(s => s.completed).length

  const addSet = () => {
    const lastSet = sets[sets.length - 1]
    const newSet: SetData = {
      id: `set-${Date.now()}`,
      set_number: sets.filter(s => s.set_type !== 'warmup').length + 1,
      set_type: 'working',
      target_reps: lastSet?.target_reps ?? 10,
      target_weight: lastSet?.target_weight ?? null,
      target_rpe: null,
      actual_reps: null,
      actual_weight: null,
      actual_rpe: null,
      completed: false,
    }
    onUpdate({ sets: [...sets, newSet] })
  }

  const updateSet = (setId: string, updates: Partial<SetData>) => {
    onUpdate({
      sets: sets.map(s => s.id === setId ? { ...s, ...updates } : s)
    })
  }

  const deleteSet = (setId: string) => {
    onUpdate({ sets: sets.filter(s => s.id !== setId) })
  }

  return (
    <div className="glass rounded-xl overflow-hidden">
      {/* Header */}
      <div 
        className="p-4 flex items-center gap-3 cursor-pointer hover:bg-white/[0.02] transition-colors"
        onClick={() => onUpdate({ collapsed: !collapsed })}
      >
        <button className="text-white/30 hover:text-white cursor-grab">
          <GripVertical size={18} />
        </button>
        
        {superset_group && (
          <span className="px-2 py-0.5 text-xs font-bold bg-amber-500/20 text-amber-400 rounded">
            {superset_group}
          </span>
        )}
        
        <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center">
          <Dumbbell size={18} className="text-violet-400" />
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="font-medium truncate">{exercise.name}</h3>
          <p className="text-sm text-white/50">
            {completedSets}/{sets.length} sets • {rest_seconds}s rest
          </p>
        </div>

        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="p-2 text-white/30 hover:text-red-400 transition-colors"
        >
          <Trash2 size={16} />
        </button>

        {collapsed ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
      </div>

      {/* Sets (collapsible) */}
      {!collapsed && (
        <div className="px-4 pb-4">
          {/* Cues */}
          {exercise.cues && exercise.cues.length > 0 && (
            <div className="mb-3 p-2 bg-amber-500/10 rounded-lg">
              <p className="text-xs text-amber-400 font-medium mb-1">Cues</p>
              <p className="text-xs text-white/60">
                {exercise.cues.join(' • ')}
              </p>
            </div>
          )}

          {/* Header row */}
          <div className="flex items-center gap-2 text-xs text-white/40 mb-2 px-1">
            <div className="w-12 text-center">SET</div>
            <div className="w-16 text-center">PREV</div>
            <div className="w-20 text-center">TARGET</div>
            <div className="w-4"></div>
            <div className="w-16"></div>
            <div className="w-20 text-center">ACTUAL</div>
            <div className="w-4"></div>
            <div className="w-16"></div>
            <div className="w-16 text-center">RPE</div>
            <div className="w-9"></div>
          </div>

          {/* Sets */}
          {sets.map((set, i) => (
            <SetRow
              key={set.id}
              set={set}
              exerciseName={exercise.name}
              previousSet={i > 0 && sets[i-1].completed ? {
                reps: sets[i-1].actual_reps || sets[i-1].target_reps || 0,
                weight: sets[i-1].actual_weight || sets[i-1].target_weight || 0
              } : undefined}
              onUpdate={(updates) => updateSet(set.id, updates)}
              onComplete={() => onSetComplete(set.id)}
              onDelete={() => deleteSet(set.id)}
            />
          ))}

          {/* Add set button */}
          <button
            onClick={addSet}
            className="w-full mt-2 py-2 border border-dashed border-white/10 rounded-lg text-white/40 hover:text-white hover:border-white/20 transition-colors flex items-center justify-center gap-2 text-sm"
          >
            <Plus size={16} /> Add Set
          </button>

          {/* Notes */}
          <div className="mt-3">
            <textarea
              value={notes}
              onChange={(e) => onUpdate({ notes: e.target.value })}
              placeholder="Notes for this exercise..."
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm placeholder-white/30 focus:outline-none focus:border-amber-500/50 resize-none"
              rows={2}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// Main Lifting Tracker
export function LiftingTracker() {
  const [exercises, setExercises] = useState<WorkoutExercise[]>([])
  const [showExerciseSearch, setShowExerciseSearch] = useState(false)
  const [restTimer, setRestTimer] = useState<{ show: boolean; seconds: number } | null>(null)
  const [workoutStartTime] = useState(new Date())
  const [workoutName, setWorkoutName] = useState('')

  const addExercise = (exercise: Exercise) => {
    const newExercise: WorkoutExercise = {
      id: `ex-${Date.now()}`,
      exercise,
      superset_group: null,
      rest_seconds: 90,
      notes: '',
      collapsed: false,
      sets: [
        {
          id: `set-${Date.now()}`,
          set_number: 1,
          set_type: 'working',
          target_reps: 10,
          target_weight: null,
          target_rpe: null,
          actual_reps: null,
          actual_weight: null,
          actual_rpe: null,
          completed: false,
        },
        {
          id: `set-${Date.now() + 1}`,
          set_number: 2,
          set_type: 'working',
          target_reps: 10,
          target_weight: null,
          target_rpe: null,
          actual_reps: null,
          actual_weight: null,
          actual_rpe: null,
          completed: false,
        },
        {
          id: `set-${Date.now() + 2}`,
          set_number: 3,
          set_type: 'working',
          target_reps: 10,
          target_weight: null,
          target_rpe: null,
          actual_reps: null,
          actual_weight: null,
          actual_rpe: null,
          completed: false,
        },
      ],
    }
    setExercises(prev => [...prev, newExercise])
  }

  const updateExercise = (id: string, updates: Partial<WorkoutExercise>) => {
    setExercises(prev => prev.map(ex => 
      ex.id === id ? { ...ex, ...updates } : ex
    ))
  }

  const removeExercise = (id: string) => {
    setExercises(prev => prev.filter(ex => ex.id !== id))
  }

  const handleSetComplete = (exerciseId: string, setId: string) => {
    setExercises(prev => prev.map(ex => {
      if (ex.id !== exerciseId) return ex
      
      const updatedSets = ex.sets.map(s => {
        if (s.id !== setId) return s
        
        // If completing, auto-fill actuals from targets if empty
        if (!s.completed) {
          return {
            ...s,
            completed: true,
            actual_reps: s.actual_reps ?? s.target_reps,
            actual_weight: s.actual_weight ?? s.target_weight,
          }
        }
        // If uncompleting
        return { ...s, completed: false }
      })

      return { ...ex, sets: updatedSets }
    }))

    // Start rest timer
    const exercise = exercises.find(ex => ex.id === exerciseId)
    if (exercise) {
      setRestTimer({ show: true, seconds: exercise.rest_seconds })
    }
  }

  // Calculate workout stats
  const totalSets = exercises.reduce((sum, ex) => sum + ex.sets.length, 0)
  const completedSets = exercises.reduce((sum, ex) => sum + ex.sets.filter(s => s.completed).length, 0)
  const totalVolume = exercises.reduce((sum, ex) => {
    return sum + ex.sets.reduce((setSum, set) => {
      if (set.completed && set.actual_weight && set.actual_reps) {
        return setSum + (set.actual_weight * set.actual_reps)
      }
      return setSum
    }, 0)
  }, 0)

  const elapsedMinutes = Math.floor((Date.now() - workoutStartTime.getTime()) / 60000)

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="p-4 lg:p-6 border-b border-white/5">
        <input
          type="text"
          value={workoutName}
          onChange={e => setWorkoutName(e.target.value)}
          placeholder="Workout name..."
          className="text-2xl font-display font-semibold bg-transparent border-none outline-none placeholder-white/30 w-full"
        />
        <p className="text-white/50 mt-1">
          {workoutStartTime.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
        </p>
      </div>

      {/* Stats bar */}
      <div className="px-4 lg:px-6 py-3 flex items-center gap-6 text-sm border-b border-white/5">
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-white/40" />
          <span>{elapsedMinutes}m</span>
        </div>
        <div className="flex items-center gap-2">
          <Target size={16} className="text-white/40" />
          <span>{completedSets}/{totalSets} sets</span>
        </div>
        <div className="flex items-center gap-2">
          <Flame size={16} className="text-white/40" />
          <span>{totalVolume.toLocaleString()} lbs</span>
        </div>
      </div>

      {/* Exercises */}
      <div className="p-4 lg:p-6 space-y-4">
        {exercises.map((ex, i) => (
          <ExerciseCard
            key={ex.id}
            workoutExercise={ex}
            index={i}
            onUpdate={(updates) => updateExercise(ex.id, updates)}
            onRemove={() => removeExercise(ex.id)}
            onSetComplete={(setId) => handleSetComplete(ex.id, setId)}
          />
        ))}

        {/* Add exercise button */}
        <button
          onClick={() => setShowExerciseSearch(true)}
          className="w-full py-4 border-2 border-dashed border-white/10 rounded-xl text-white/40 hover:text-white hover:border-white/20 transition-colors flex items-center justify-center gap-2"
        >
          <Plus size={20} /> Add Exercise
        </button>

        {/* Empty state */}
        {exercises.length === 0 && (
          <div className="text-center py-12">
            <Dumbbell size={48} className="mx-auto text-white/20 mb-4" />
            <p className="text-white/40">No exercises yet</p>
            <p className="text-sm text-white/30 mt-1">Add exercises to start your workout</p>
          </div>
        )}
      </div>

      {/* Bottom action bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-zinc-900/95 backdrop-blur border-t border-white/10">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button className="flex-1 py-3 bg-white/10 hover:bg-white/20 rounded-xl font-medium transition-colors">
            Cancel
          </button>
          <button 
            className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-black rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
            disabled={completedSets === 0}
          >
            <Save size={18} />
            Finish Workout
          </button>
        </div>
      </div>

      {/* Rest Timer */}
      {restTimer?.show && (
        <RestTimer
          seconds={restTimer.seconds}
          onComplete={() => setRestTimer(null)}
          onSkip={() => setRestTimer(null)}
        />
      )}

      {/* Exercise Search Modal */}
      {showExerciseSearch && (
        <ExerciseSearchModal
          onSelect={addExercise}
          onClose={() => setShowExerciseSearch(false)}
        />
      )}
    </div>
  )
}
