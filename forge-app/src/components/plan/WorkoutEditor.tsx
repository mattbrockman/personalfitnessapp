'use client'

import { useState, useEffect } from 'react'
import {
  X,
  Plus,
  Trash2,
  GripVertical,
  Save,
  Clock,
  Dumbbell,
  Bike,
} from 'lucide-react'
import {
  SuggestedWorkout,
  SuggestedExercise,
  CardioStructure,
  CardioInterval,
  PrimaryIntensity,
  CardioStructureType,
  INTENSITY_COLORS,
  CARDIO_TYPE_LABELS,
} from '@/types/training-plan'

interface WorkoutEditorProps {
  workout: SuggestedWorkout
  onSave: (workout: SuggestedWorkout) => void
  onClose: () => void
}

const INTENSITY_OPTIONS: PrimaryIntensity[] = ['z1', 'z2', 'z3', 'z4', 'z5', 'hit', 'mixed']
const CARDIO_TYPES: CardioStructureType[] = ['steady', 'tempo', 'intervals', 'long']

export function WorkoutEditor({ workout, onSave, onClose }: WorkoutEditorProps) {
  const [name, setName] = useState(workout.name)
  const [description, setDescription] = useState(workout.description || '')
  const [durationMinutes, setDurationMinutes] = useState(workout.planned_duration_minutes || 60)
  const [primaryIntensity, setPrimaryIntensity] = useState<PrimaryIntensity | null>(workout.primary_intensity)
  const [plannedTss, setPlannedTss] = useState(workout.planned_tss || 0)
  const [exercises, setExercises] = useState<SuggestedExercise[]>(workout.exercises || [])
  const [cardioStructure, setCardioStructure] = useState<CardioStructure | null>(workout.cardio_structure)

  const isStrength = workout.category === 'strength'
  const isCardio = workout.category === 'cardio'

  // Handle save
  const handleSave = () => {
    const updatedWorkout: SuggestedWorkout = {
      ...workout,
      name,
      description: description || null,
      planned_duration_minutes: durationMinutes,
      primary_intensity: primaryIntensity,
      planned_tss: plannedTss || null,
      exercises: isStrength ? exercises : null,
      cardio_structure: isCardio ? cardioStructure : null,
    }
    onSave(updatedWorkout)
  }

  // Exercise management
  const addExercise = () => {
    setExercises([
      ...exercises,
      {
        exercise_name: '',
        sets: 3,
        reps_min: 8,
        reps_max: 12,
        rest_seconds: 90,
      },
    ])
  }

  const updateExercise = (index: number, updates: Partial<SuggestedExercise>) => {
    setExercises(prev =>
      prev.map((ex, i) => (i === index ? { ...ex, ...updates } : ex))
    )
  }

  const removeExercise = (index: number) => {
    setExercises(prev => prev.filter((_, i) => i !== index))
  }

  // Cardio structure management
  const updateCardioType = (type: CardioStructureType) => {
    if (!cardioStructure) {
      setCardioStructure({
        type,
        warmup_minutes: 10,
        main_set: [{ duration_minutes: durationMinutes - 20, intensity: 'z2' }],
        cooldown_minutes: 10,
      })
    } else {
      setCardioStructure({ ...cardioStructure, type })
    }
  }

  const updateCardioWarmup = (minutes: number) => {
    if (cardioStructure) {
      setCardioStructure({ ...cardioStructure, warmup_minutes: minutes })
    }
  }

  const updateCardioCooldown = (minutes: number) => {
    if (cardioStructure) {
      setCardioStructure({ ...cardioStructure, cooldown_minutes: minutes })
    }
  }

  const addInterval = () => {
    if (cardioStructure) {
      setCardioStructure({
        ...cardioStructure,
        main_set: [...cardioStructure.main_set, { duration_minutes: 5, intensity: 'z4' }],
      })
    }
  }

  const updateInterval = (index: number, updates: Partial<CardioInterval>) => {
    if (cardioStructure) {
      setCardioStructure({
        ...cardioStructure,
        main_set: cardioStructure.main_set.map((int, i) =>
          i === index ? { ...int, ...updates } : int
        ),
      })
    }
  }

  const removeInterval = (index: number) => {
    if (cardioStructure) {
      setCardioStructure({
        ...cardioStructure,
        main_set: cardioStructure.main_set.filter((_, i) => i !== index),
      })
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1a2e] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isStrength ? (
              <div className="p-2 bg-amber-500/20 rounded-lg">
                <Dumbbell size={20} className="text-amber-400" />
              </div>
            ) : (
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Bike size={20} className="text-blue-400" />
              </div>
            )}
            <div>
              <h2 className="text-lg font-semibold">Edit Workout</h2>
              <p className="text-sm text-white/50">{workout.suggested_date}</p>
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
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Basic info */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-white/60 mb-1">Workout Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-amber-500/50 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm text-white/60 mb-1">Description</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-amber-500/50 focus:outline-none resize-none"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-white/60 mb-1">Duration (min)</label>
                <input
                  type="number"
                  value={durationMinutes}
                  onChange={e => setDurationMinutes(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-amber-500/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-1">Intensity</label>
                <select
                  value={primaryIntensity || ''}
                  onChange={e => setPrimaryIntensity(e.target.value as PrimaryIntensity || null)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-amber-500/50 focus:outline-none"
                >
                  <option value="">Select...</option>
                  {INTENSITY_OPTIONS.map(opt => (
                    <option key={opt} value={opt}>
                      {opt.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-1">TSS</label>
                <input
                  type="number"
                  value={plannedTss}
                  onChange={e => setPlannedTss(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-amber-500/50 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Strength exercises */}
          {isStrength && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium">Exercises</h3>
                <button
                  onClick={addExercise}
                  className="px-3 py-1 text-sm bg-white/10 hover:bg-white/20 rounded-lg flex items-center gap-1"
                >
                  <Plus size={14} />
                  Add Exercise
                </button>
              </div>

              <div className="space-y-3">
                {exercises.map((ex, idx) => (
                  <div
                    key={idx}
                    className="bg-white/5 rounded-lg p-3 space-y-3"
                  >
                    <div className="flex items-center gap-2">
                      <GripVertical size={16} className="text-white/30" />
                      <input
                        type="text"
                        value={ex.exercise_name}
                        onChange={e => updateExercise(idx, { exercise_name: e.target.value })}
                        placeholder="Exercise name"
                        className="flex-1 px-2 py-1 bg-white/5 border border-white/10 rounded focus:border-amber-500/50 focus:outline-none text-sm"
                      />
                      <button
                        onClick={() => removeExercise(idx)}
                        className="p-1 hover:bg-red-500/20 text-red-400 rounded"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    <div className="grid grid-cols-4 gap-2 text-sm">
                      <div>
                        <label className="text-xs text-white/50">Sets</label>
                        <input
                          type="number"
                          value={ex.sets}
                          onChange={e => updateExercise(idx, { sets: Number(e.target.value) })}
                          className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-white/50">Min Reps</label>
                        <input
                          type="number"
                          value={ex.reps_min}
                          onChange={e => updateExercise(idx, { reps_min: Number(e.target.value) })}
                          className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-white/50">Max Reps</label>
                        <input
                          type="number"
                          value={ex.reps_max}
                          onChange={e => updateExercise(idx, { reps_max: Number(e.target.value) })}
                          className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-white/50">Rest (s)</label>
                        <input
                          type="number"
                          value={ex.rest_seconds}
                          onChange={e => updateExercise(idx, { rest_seconds: Number(e.target.value) })}
                          className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                ))}

                {exercises.length === 0 && (
                  <p className="text-center text-white/40 py-4">
                    No exercises added yet
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Cardio structure */}
          {isCardio && (
            <div>
              <h3 className="font-medium mb-3">Workout Structure</h3>

              {/* Cardio type */}
              <div className="flex gap-2 mb-4">
                {CARDIO_TYPES.map(type => (
                  <button
                    key={type}
                    onClick={() => updateCardioType(type)}
                    className={`px-3 py-1.5 rounded-lg text-sm ${
                      cardioStructure?.type === type
                        ? 'bg-blue-500 text-white'
                        : 'bg-white/10 hover:bg-white/20'
                    }`}
                  >
                    {CARDIO_TYPE_LABELS[type]}
                  </button>
                ))}
              </div>

              {cardioStructure && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-white/60 mb-1">Warmup (min)</label>
                      <input
                        type="number"
                        value={cardioStructure.warmup_minutes}
                        onChange={e => updateCardioWarmup(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-white/60 mb-1">Cooldown (min)</label>
                      <input
                        type="number"
                        value={cardioStructure.cooldown_minutes}
                        onChange={e => updateCardioCooldown(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Main set intervals */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm text-white/60">Main Set</label>
                      <button
                        onClick={addInterval}
                        className="px-2 py-1 text-xs bg-white/10 hover:bg-white/20 rounded flex items-center gap-1"
                      >
                        <Plus size={12} />
                        Add Interval
                      </button>
                    </div>

                    <div className="space-y-2">
                      {cardioStructure.main_set.map((interval, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 bg-white/5 rounded-lg p-2"
                        >
                          <input
                            type="number"
                            value={interval.duration_minutes}
                            onChange={e => updateInterval(idx, { duration_minutes: Number(e.target.value) })}
                            className="w-16 px-2 py-1 bg-white/5 border border-white/10 rounded text-sm"
                          />
                          <span className="text-sm text-white/50">min @</span>
                          <select
                            value={interval.intensity}
                            onChange={e => updateInterval(idx, { intensity: e.target.value as PrimaryIntensity })}
                            className="px-2 py-1 bg-white/5 border border-white/10 rounded text-sm"
                          >
                            {INTENSITY_OPTIONS.map(opt => (
                              <option key={opt} value={opt}>
                                {opt.toUpperCase()}
                              </option>
                            ))}
                          </select>
                          <span className="text-sm text-white/50">x</span>
                          <input
                            type="number"
                            value={interval.repeats || 1}
                            onChange={e => updateInterval(idx, { repeats: Number(e.target.value) || undefined })}
                            className="w-12 px-2 py-1 bg-white/5 border border-white/10 rounded text-sm"
                            min={1}
                          />
                          <span className="text-xs text-white/50">repeats</span>
                          <button
                            onClick={() => removeInterval(idx)}
                            className="ml-auto p-1 hover:bg-red-500/20 text-red-400 rounded"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
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
            onClick={handleSave}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-medium rounded-lg flex items-center gap-2"
          >
            <Save size={16} />
            Save Changes
          </button>
        </div>
      </div>
    </div>
  )
}
