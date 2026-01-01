'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Plus,
  Minus,
  Search,
  Dumbbell,
  GripVertical,
  X,
  Play,
  Calendar,
  Save,
  ChevronRight,
  Clock,
  Target,
  Trash2,
  Loader2,
  Zap,
} from 'lucide-react'
import { useDebounce } from '@/hooks/useDebounce'
import { EquipmentIcon } from '@/lib/equipment-icons'

// Types
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

interface WorkoutBuilderProps {
  onStartWorkout: (exercises: BuilderExercise[], name: string) => void
  onSchedule: (exercises: BuilderExercise[], name: string, date: string) => void
  onSaveTemplate: (exercises: BuilderExercise[], name: string, category: string) => void
  onClose?: () => void
  initialExercises?: BuilderExercise[]
  initialName?: string
}

// Exercise Search Modal with Create option
function ExerciseSearchModal({
  onSelect,
  onClose,
}: {
  onSelect: (exercise: Exercise) => void
  onClose: () => void
}) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<string | null>(null)
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [muscleGroups, setMuscleGroups] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [isSearching, setIsSearching] = useState(false)
  const [showCreateExercise, setShowCreateExercise] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Debounce search to prevent flickering
  const debouncedSearch = useDebounce(search, 300)

  useEffect(() => {
    inputRef.current?.focus()
    fetchExercises()
  }, [])

  useEffect(() => {
    if (debouncedSearch !== '' || filter !== null) {
      fetchExercises()
    }
  }, [debouncedSearch, filter])

  const fetchExercises = async () => {
    if (exercises.length === 0) {
      setLoading(true)
    } else {
      setIsSearching(true)
    }
    try {
      const params = new URLSearchParams()
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (filter) params.set('muscle_group', filter)
      params.set('limit', '50')

      const res = await fetch(`/api/exercises?${params}`)
      const data = await res.json()
      setExercises(data.exercises || [])

      if (muscleGroups.length === 0 && data.exercises) {
        const groups = new Set<string>()
        data.exercises.forEach((ex: Exercise) => {
          if (ex.primary_muscle) groups.add(ex.primary_muscle)
        })
        setMuscleGroups(Array.from(groups).sort())
      }
    } catch (error) {
      console.error('Failed to fetch exercises:', error)
    } finally {
      setLoading(false)
      setIsSearching(false)
    }
  }

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
                {muscle.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-y-auto max-h-[50vh]">
          {isSearching && (
            <div className="px-4 py-2 text-xs text-white/40 flex items-center gap-2 border-b border-white/5">
              <Loader2 size={12} className="animate-spin" />
              Searching...
            </div>
          )}
          {loading ? (
            <div className="p-8 text-center text-white/40">Loading exercises...</div>
          ) : exercises.length > 0 ? (
            <>
              {exercises.map(exercise => (
                <button
                  key={exercise.id}
                  onClick={() => {
                    onSelect(exercise)
                    onClose()
                  }}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors text-left"
                >
                  <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
                    <EquipmentIcon equipment={exercise.equipment} size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{exercise.name}</p>
                    <p className="text-sm text-white/50 capitalize">{exercise.primary_muscle?.replace('_', ' ')} • {exercise.equipment}</p>
                  </div>
                  <ChevronRight size={18} className="text-white/30" />
                </button>
              ))}
              {/* Always show create option when searching */}
              {debouncedSearch && (
                <div className="px-4 py-3 border-t border-white/10">
                  <button
                    onClick={() => setShowCreateExercise(true)}
                    className="w-full py-2 text-sm text-white/50 hover:text-amber-400 transition-colors flex items-center justify-center gap-2"
                  >
                    <Plus size={16} />
                    Don't see it? Create "{debouncedSearch}"
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="p-8 text-center">
              <p className="text-white/40 mb-4">No exercises found for "{debouncedSearch}"</p>
              <button
                onClick={() => setShowCreateExercise(true)}
                className="px-4 py-2 bg-amber-500/20 text-amber-400 rounded-lg hover:bg-amber-500/30 transition-colors inline-flex items-center gap-2"
              >
                <Plus size={18} />
                Create "{debouncedSearch}"
              </button>
            </div>
          )}
        </div>

        {/* Create Exercise Modal */}
        {showCreateExercise && (
          <CreateExerciseModal
            initialName={debouncedSearch}
            onClose={() => setShowCreateExercise(false)}
            onCreated={(exercise) => {
              onSelect(exercise)
              setShowCreateExercise(false)
              onClose()
            }}
          />
        )}
      </div>
    </div>
  )
}

// Create Exercise Modal with AI generation
function CreateExerciseModal({
  initialName,
  onClose,
  onCreated,
}: {
  initialName: string
  onClose: () => void
  onCreated: (exercise: Exercise) => void
}) {
  const [name, setName] = useState(initialName)
  const [generating, setGenerating] = useState(false)
  const [generatedExercise, setGeneratedExercise] = useState<Partial<Exercise> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const EQUIPMENT_OPTIONS = [
    { value: 'barbell', label: 'Barbell' },
    { value: 'dumbbell', label: 'Dumbbell' },
    { value: 'bodyweight', label: 'Bodyweight' },
    { value: 'cable', label: 'Cable' },
    { value: 'machine', label: 'Machine' },
    { value: 'kettlebell', label: 'Kettlebell' },
    { value: 'bands', label: 'Resistance Bands' },
    { value: 'medicine_ball', label: 'Medicine Ball' },
  ]

  const generateExercise = async () => {
    if (!name.trim()) return
    setGenerating(true)
    setError(null)

    try {
      const res = await fetch('/api/exercises/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to generate exercise')
      }

      const data = await res.json()
      setGeneratedExercise(data.exercise)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate exercise')
    } finally {
      setGenerating(false)
    }
  }

  const saveExercise = async () => {
    if (!generatedExercise) return
    setSaving(true)
    setError(null)

    try {
      const res = await fetch('/api/exercises', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(generatedExercise),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save exercise')
      }

      const data = await res.json()
      onCreated(data.exercise)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save exercise')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="absolute inset-0 bg-zinc-900 z-20 overflow-y-auto animate-slide-up"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Create Exercise</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X size={20} className="text-white/60" />
          </button>
        </div>

        {!generatedExercise ? (
          <>
            <div className="mb-4">
              <label className="block text-sm text-white/60 mb-1">Exercise Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Wall Sit"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-amber-500/50"
              />
            </div>

            <button
              onClick={generateExercise}
              disabled={generating || !name.trim()}
              className="w-full py-3 bg-amber-500 text-black font-semibold rounded-xl hover:bg-amber-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {generating ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Generating with AI...
                </>
              ) : (
                <>
                  <Zap size={18} />
                  Generate Exercise Details
                </>
              )}
            </button>

            <p className="text-xs text-white/40 text-center mt-3">
              AI will suggest muscle groups, equipment, and coaching cues
            </p>
          </>
        ) : (
          <>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-white/60 mb-1">Name</label>
                <input
                  type="text"
                  value={generatedExercise.name || ''}
                  onChange={(e) => setGeneratedExercise({ ...generatedExercise, name: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-sm text-white/60 mb-1">Primary Muscle</label>
                <input
                  type="text"
                  value={generatedExercise.primary_muscle || ''}
                  onChange={(e) => setGeneratedExercise({ ...generatedExercise, primary_muscle: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-sm text-white/60 mb-1">Equipment</label>
                <select
                  value={generatedExercise.equipment || ''}
                  onChange={(e) => setGeneratedExercise({ ...generatedExercise, equipment: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white"
                >
                  {EQUIPMENT_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {generatedExercise.cues && generatedExercise.cues.length > 0 && (
                <div>
                  <label className="block text-sm text-white/60 mb-1">Coaching Cues</label>
                  <ul className="space-y-1 text-sm text-white/70">
                    {generatedExercise.cues.map((cue, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-amber-400">•</span>
                        {cue}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setGeneratedExercise(null)}
                className="flex-1 py-3 bg-white/10 text-white font-medium rounded-xl hover:bg-white/20 transition-colors"
              >
                Edit Details
              </button>
              <button
                onClick={saveExercise}
                disabled={saving}
                className="flex-1 py-3 bg-amber-500 text-black font-semibold rounded-xl hover:bg-amber-400 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save & Add'
                )}
              </button>
            </div>
          </>
        )}

        {error && (
          <div className="mt-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}
      </div>
    </div>
  )
}

// Date Picker Modal
function DatePickerModal({
  onSelect,
  onClose,
}: {
  onSelect: (date: string) => void
  onClose: () => void
}) {
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0]
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80" onClick={onClose}>
      <div
        className="bg-zinc-900 rounded-2xl w-full max-w-sm p-6 border border-white/10 animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold mb-4">Schedule Workout</h3>

        <input
          type="date"
          value={selectedDate}
          onChange={e => setSelectedDate(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-amber-500/50"
        />

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-white/10 hover:bg-white/20 rounded-xl font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onSelect(selectedDate)}
            className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-black rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
          >
            <Calendar size={18} />
            Schedule
          </button>
        </div>
      </div>
    </div>
  )
}

// Save Template Modal
function SaveTemplateModal({
  name,
  onSave,
  onClose,
}: {
  name: string
  onSave: (name: string, category: string) => void
  onClose: () => void
}) {
  const [templateName, setTemplateName] = useState(name || '')
  const [category, setCategory] = useState('custom')

  const categories = [
    { value: 'push', label: 'Push' },
    { value: 'pull', label: 'Pull' },
    { value: 'legs', label: 'Legs' },
    { value: 'upper', label: 'Upper Body' },
    { value: 'lower', label: 'Lower Body' },
    { value: 'full_body', label: 'Full Body' },
    { value: 'custom', label: 'Custom' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80" onClick={onClose}>
      <div
        className="bg-zinc-900 rounded-2xl w-full max-w-sm p-6 border border-white/10 animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold mb-4">Save as Template</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-white/60 mb-2">Template Name</label>
            <input
              type="text"
              value={templateName}
              onChange={e => setTemplateName(e.target.value)}
              placeholder="My Workout Template"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-amber-500/50"
            />
          </div>

          <div>
            <label className="block text-sm text-white/60 mb-2">Category</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-amber-500/50"
            >
              {categories.map(cat => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-white/10 hover:bg-white/20 rounded-xl font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(templateName, category)}
            disabled={!templateName.trim()}
            className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-black rounded-xl font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save size={18} />
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

// Exercise Card in Builder
function BuilderExerciseCard({
  exercise,
  onUpdate,
  onRemove,
}: {
  exercise: BuilderExercise
  onUpdate: (updates: Partial<BuilderExercise>) => void
  onRemove: () => void
}) {
  return (
    <div className="glass rounded-xl p-4">
      <div className="flex items-start gap-3">
        <button className="text-white/30 hover:text-white cursor-grab mt-1">
          <GripVertical size={18} />
        </button>

        <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center flex-shrink-0">
          <Dumbbell size={18} className="text-violet-400" />
        </div>

        <div className="flex-1 min-w-0">
          <h4 className="font-medium">{exercise.exercise.name}</h4>
          <p className="text-sm text-white/50 capitalize">
            {exercise.exercise.primary_muscle?.replace('_', ' ')} • {exercise.exercise.equipment}
          </p>

          {/* Set configuration */}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {/* Sets */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-white/50">Sets:</span>
              <div className="flex items-center">
                <button
                  onClick={() => onUpdate({ sets: Math.max(1, exercise.sets - 1) })}
                  className="p-1 hover:bg-white/10 rounded"
                >
                  <Minus size={14} />
                </button>
                <span className="w-8 text-center font-medium">{exercise.sets}</span>
                <button
                  onClick={() => onUpdate({ sets: exercise.sets + 1 })}
                  className="p-1 hover:bg-white/10 rounded"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>

            {/* Reps */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-white/50">Reps:</span>
              <input
                type="number"
                value={exercise.reps_min}
                onChange={e => onUpdate({ reps_min: parseInt(e.target.value) || 0 })}
                className="w-12 bg-white/5 border border-white/10 rounded px-2 py-1 text-center text-sm focus:outline-none focus:border-amber-500/50"
              />
              <span className="text-white/30">-</span>
              <input
                type="number"
                value={exercise.reps_max}
                onChange={e => onUpdate({ reps_max: parseInt(e.target.value) || 0 })}
                className="w-12 bg-white/5 border border-white/10 rounded px-2 py-1 text-center text-sm focus:outline-none focus:border-amber-500/50"
              />
            </div>

            {/* Rest */}
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-white/50" />
              <input
                type="number"
                value={exercise.rest_seconds}
                onChange={e => onUpdate({ rest_seconds: parseInt(e.target.value) || 0 })}
                className="w-14 bg-white/5 border border-white/10 rounded px-2 py-1 text-center text-sm focus:outline-none focus:border-amber-500/50"
              />
              <span className="text-sm text-white/50">s</span>
            </div>
          </div>
        </div>

        <button
          onClick={onRemove}
          className="p-2 text-white/30 hover:text-red-400 transition-colors"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  )
}

// Main Workout Builder Component
export function WorkoutBuilder({
  onStartWorkout,
  onSchedule,
  onSaveTemplate,
  onClose,
  initialExercises = [],
  initialName = '',
}: WorkoutBuilderProps) {
  const [workoutName, setWorkoutName] = useState(initialName)
  const [exercises, setExercises] = useState<BuilderExercise[]>(initialExercises)
  const [showExerciseSearch, setShowExerciseSearch] = useState(false)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [showSaveTemplate, setShowSaveTemplate] = useState(false)

  const addExercise = (exercise: Exercise) => {
    const newExercise: BuilderExercise = {
      id: `builder-${Date.now()}`,
      exercise,
      sets: 3,
      reps_min: 8,
      reps_max: 12,
      rest_seconds: 90,
      superset_group: null,
      notes: '',
    }
    setExercises(prev => [...prev, newExercise])
  }

  const updateExercise = (id: string, updates: Partial<BuilderExercise>) => {
    setExercises(prev => prev.map(ex =>
      ex.id === id ? { ...ex, ...updates } : ex
    ))
  }

  const removeExercise = (id: string) => {
    setExercises(prev => prev.filter(ex => ex.id !== id))
  }

  const handleStartNow = () => {
    if (exercises.length === 0) return
    onStartWorkout(exercises, workoutName || 'New Workout')
  }

  const handleSchedule = (date: string) => {
    if (exercises.length === 0) return
    onSchedule(exercises, workoutName || 'Scheduled Workout', date)
    setShowDatePicker(false)
  }

  const handleSaveTemplate = (name: string, category: string) => {
    if (exercises.length === 0) return
    onSaveTemplate(exercises, name, category)
    setShowSaveTemplate(false)
  }

  // Calculate estimated duration
  const estimatedDuration = exercises.reduce((total, ex) => {
    const setTime = 45 // seconds per set
    const restTime = ex.rest_seconds * (ex.sets - 1) // rest between sets
    return total + (ex.sets * setTime) + restTime
  }, 0)
  const estimatedMinutes = Math.round(estimatedDuration / 60)

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="p-4 lg:p-6 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <input
              type="text"
              value={workoutName}
              onChange={e => setWorkoutName(e.target.value)}
              placeholder="Workout name..."
              className="text-2xl font-display font-semibold bg-transparent border-none outline-none placeholder-white/30 w-full"
            />
            <p className="text-white/50 mt-1 flex items-center gap-4">
              <span className="flex items-center gap-1">
                <Target size={14} />
                {exercises.length} exercises
              </span>
              <span className="flex items-center gap-1">
                <Clock size={14} />
                ~{estimatedMinutes}m
              </span>
            </p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X size={24} />
            </button>
          )}
        </div>
      </div>

      {/* Exercise List */}
      <div className="p-4 lg:p-6 space-y-3">
        {exercises.map((exercise) => (
          <BuilderExerciseCard
            key={exercise.id}
            exercise={exercise}
            onUpdate={(updates) => updateExercise(exercise.id, updates)}
            onRemove={() => removeExercise(exercise.id)}
          />
        ))}

        {/* Add Exercise Button */}
        <button
          onClick={() => setShowExerciseSearch(true)}
          className="w-full py-4 border-2 border-dashed border-white/10 rounded-xl text-white/40 hover:text-white hover:border-white/20 transition-colors flex items-center justify-center gap-2"
        >
          <Plus size={20} /> Add Exercise
        </button>

        {/* Empty State */}
        {exercises.length === 0 && (
          <div className="text-center py-8">
            <Dumbbell size={48} className="mx-auto text-white/20 mb-4" />
            <p className="text-white/40">No exercises added yet</p>
            <p className="text-sm text-white/30 mt-1">Add exercises to build your workout</p>
          </div>
        )}
      </div>

      {/* Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-zinc-900/95 backdrop-blur border-t border-white/10">
        <div className="max-w-2xl mx-auto">
          {/* Primary action */}
          <button
            onClick={handleStartNow}
            disabled={exercises.length === 0}
            className="w-full py-3 mb-3 bg-amber-500 hover:bg-amber-400 text-black rounded-xl font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Play size={18} />
            Start Now
          </button>

          {/* Secondary actions */}
          <div className="flex gap-3">
            <button
              onClick={() => setShowDatePicker(true)}
              disabled={exercises.length === 0}
              className="flex-1 py-3 bg-white/10 hover:bg-white/20 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Calendar size={18} />
              Schedule
            </button>
            <button
              onClick={() => setShowSaveTemplate(true)}
              disabled={exercises.length === 0}
              className="flex-1 py-3 bg-white/10 hover:bg-white/20 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save size={18} />
              Save Template
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showExerciseSearch && (
        <ExerciseSearchModal
          onSelect={addExercise}
          onClose={() => setShowExerciseSearch(false)}
        />
      )}

      {showDatePicker && (
        <DatePickerModal
          onSelect={handleSchedule}
          onClose={() => setShowDatePicker(false)}
        />
      )}

      {showSaveTemplate && (
        <SaveTemplateModal
          name={workoutName}
          onSave={handleSaveTemplate}
          onClose={() => setShowSaveTemplate(false)}
        />
      )}
    </div>
  )
}
